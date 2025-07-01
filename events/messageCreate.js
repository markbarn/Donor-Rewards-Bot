import { Events } from "discord.js"
import { getDatabase, saveDatabase } from "../utils/database.js"
import { logger } from "../utils/logger.js"
import fetch from "node-fetch"

export const name = Events.MessageCreate

export async function execute(message) {
  if (message.author.bot) return

  // Check for tip.cc donations
  if (message.author.id === "617037497574359050") {
    // tip.cc bot ID
    await handleTipccDonation(message)
  }
}

async function handleTipccDonation(message) {
  try {
    const serverId = message.guildId
    if (!serverId) return

    const db = getDatabase(serverId)

    // Parse tip.cc message
    const tipRegex = /💰\s*\*\*(.+?)\*\*\s*sent\s*\*\*(.+?)\s*(.+?)\*\*\s*to\s*\*\*(.+?)\*\*/i
    const match = message.content.match(tipRegex)

    if (!match) return

    const [, sender, amount, currency, recipient] = match

    // Check if recipient is in allowed recipients
    if (!db.config?.allowedRecipients?.length) return

    const isAllowedRecipient = db.config.allowedRecipients.some((allowed) =>
      recipient.toLowerCase().includes(allowed.toLowerCase()),
    )

    if (!isAllowedRecipient) return

    // Check if currency is accepted
    const acceptedCurrencies = db.config?.acceptedCryptocurrencies || []
    if (!acceptedCurrencies.includes(currency.toUpperCase())) return

    // Get USD value
    const usdValue = await getCryptoPrice(currency, Number.parseFloat(amount))
    if (!usdValue) return

    // Find sender in guild
    const guild = message.guild
    const senderMember = guild.members.cache.find((member) =>
      member.user.username.toLowerCase().includes(sender.toLowerCase()),
    )

    if (!senderMember) return

    const senderId = senderMember.user.id

    // Initialize user data
    if (!db.users[senderId]) {
      db.users[senderId] = {
        totalDonated: 0,
        entries: {},
        donations: [],
        achievements: [],
        privacyEnabled: false,
        wins: 0,
      }
    }

    // Add donation
    db.users[senderId].totalDonated += usdValue
    db.users[senderId].donations.push({
      amount: usdValue,
      currency,
      originalAmount: Number.parseFloat(amount),
      timestamp: Date.now(),
      recipient,
    })

    // Process entries for eligible draws
    let entriesAdded = 0
    for (const [drawId, draw] of Object.entries(db.donationDraws)) {
      if (!draw.active) continue
      if (usdValue < draw.minAmount || usdValue > draw.maxAmount) continue
      if (draw.manualEntriesOnly) continue

      // Check VIP requirement
      if (draw.vipOnly && db.config?.vipRoleId) {
        const hasVipRole = senderMember.roles.cache.has(db.config.vipRoleId)
        if (!hasVipRole) continue
      }

      // Calculate entries
      const entries = Math.floor(usdValue / draw.minAmount)
      if (entries <= 0) continue

      // Check if draw has space
      const currentEntries = Object.values(draw.entries || {}).reduce((sum, count) => sum + count, 0)
      if (currentEntries >= draw.maxEntries) continue

      // Add entries
      if (!draw.entries) draw.entries = {}
      if (!draw.entries[senderId]) draw.entries[senderId] = 0
      if (!db.users[senderId].entries) db.users[senderId].entries = {}
      if (!db.users[senderId].entries[drawId]) db.users[senderId].entries[drawId] = 0

      const entriesToAdd = Math.min(entries, draw.maxEntries - currentEntries)
      draw.entries[senderId] += entriesToAdd
      db.users[senderId].entries[drawId] += entriesToAdd
      entriesAdded += entriesToAdd
    }

    // Save database
    saveDatabase(serverId, db)

    // Send confirmation
    if (entriesAdded > 0) {
      const confirmationMessage = `🎉 **${senderMember.user.username}** donated **$${usdValue.toFixed(
        2,
      )}** and received **${entriesAdded}** draw entries!\n\nUse \`/entries\` to see your entries.`

      await message.channel.send(confirmationMessage)
    }

    logger.info(`Processed donation: ${sender} -> $${usdValue} (${entriesAdded} entries)`)
  } catch (error) {
    logger.error("Error processing tip.cc donation:", error)
  }
}

async function getCryptoPrice(symbol, amount) {
  try {
    const apiKey = process.env.COINMARKETCAP_API_KEY
    if (!apiKey) return null

    const response = await fetch(
      `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symbol.toUpperCase()}`,
      {
        headers: {
          "X-CMC_PRO_API_KEY": apiKey,
        },
      },
    )

    const data = await response.json()
    const price = data.data?.[symbol.toUpperCase()]?.quote?.USD?.price

    return price ? price * amount : null
  } catch (error) {
    logger.error(`Error fetching price for ${symbol}:`, error)
    return null
  }
}
