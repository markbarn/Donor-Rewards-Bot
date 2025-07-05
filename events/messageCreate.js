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

    // Parse tip.cc message - Updated regex to handle animated emojis
    const tipRegex = /<(?:a?):(\w+):\d+>|💰\s*<@!?(\d+)>\s*sent\s*<@!?(\d+)>\s*(?:\*\*)?(\d+(?:\.\d+)?)\s*(\w+)(?:\*\*)?(?:\s*\(≈\s*\$(\d+(?:\.\d+)?)\))?/i
    
    logger.info(`🔍 Processing tip.cc message: "${message.content}"`)
    
    const match = message.content.match(tipRegex)
    if (!match) {
      logger.info(`🔍 No tip match found in message: "${message.content}"`)
      return
    }

    // Extract data from the match
    // Format: <emoji> <@!senderID> sent <@!recipientID> amount SYMBOL (≈ $usdValue)
    const [, , senderId, recipientId, amount, currency, extractedUsdValue] = match
    
    if (!senderId || !recipientId || !amount || !currency) {
      logger.info(`🔍 Incomplete tip data in message: "${message.content}"`)
      return
    }
    
    logger.info(`🔍 Detected tip: ${senderId} sent ${amount} ${currency} to ${recipientId}`)

    // Check if recipient is in allowed recipients
    if (!db.config?.allowedRecipients?.length) return

    // Get recipient username from the ID
    const recipient = await message.guild.members.fetch(recipientId)
      .then(member => member.user.username)
      .catch(() => recipientId)

    const isAllowedRecipient = db.config.allowedRecipients.some((allowed) =>
      recipient.toLowerCase().includes(allowed.toLowerCase()) || recipientId === allowed.replace(/[<@!>]/g, '')
    )

    if (!isAllowedRecipient) return

    // Check if currency is accepted
    const acceptedCurrencies = db.config?.acceptedCryptocurrencies || []
    if (!acceptedCurrencies.includes(currency.toUpperCase())) return

    // Get USD value - first try from the message, then from APIs
    let usdValue = null
    
    // If the message contains a USD value, use it
    if (extractedUsdValue) {
      logger.info(`🔍 Extracted price from tip.cc message: $${extractedUsdValue}`)
      usdValue = parseFloat(extractedUsdValue)
    } else {
      // Otherwise, fetch from APIs
      usdValue = await getCryptoPrice(currency, parseFloat(amount))
    }
    
    if (!usdValue) {
      logger.error(`🔍 Could not get USD value for ${amount} ${currency}`)
      return
    }
    
    logger.info(`🔍 USD value calculated: $${usdValue.toFixed(2)}`)

    // Find sender in guild
    const senderMember = await message.guild.members.fetch(senderId)
      .catch(() => null)

    if (!senderMember) {
      logger.info(`🔍 Could not find sender with ID ${senderId}`)
      return
    }
    
    logger.info(`🔍 Matched sender ${senderId} to user ID ${senderMember.user.id}`)

    // Initialize user data
    if (!db.users[senderMember.user.id]) {
      db.users[senderMember.user.id] = {
        totalDonated: 0,
        entries: {},
        donations: [],
        achievements: [],
        privacyEnabled: false,
        wins: 0,
        streak: {
          current: 0,
          longest: 0,
          lastDonation: 0
        }
      }
    }
    
    logger.info(`💰 Processing donation: $${usdValue.toFixed(2)} USD`)

    // Add donation
    db.users[senderMember.user.id].totalDonated += usdValue
    db.users[senderMember.user.id].donations.push({
      amount: usdValue,
      currency,
      originalAmount: parseFloat(amount),
      timestamp: Date.now(),
      recipient,
    })

    // Update streak
    const now = Date.now()
    const lastDonation = db.users[senderMember.user.id].streak?.lastDonation || 0
    const oneDayMs = 24 * 60 * 60 * 1000
    
    // If last donation was within the last 24-48 hours, increment streak
    if (now - lastDonation <= 2 * oneDayMs && now - lastDonation >= oneDayMs / 2) {
      db.users[senderMember.user.id].streak.current += 1
      
      // Update longest streak if current is longer
      if (db.users[senderMember.user.id].streak.current > db.users[senderMember.user.id].streak.longest) {
        db.users[senderMember.user.id].streak.longest = db.users[senderMember.user.id].streak.current
      }
    } 
    // If it's been more than 48 hours, reset streak
    else if (now - lastDonation > 2 * oneDayMs) {
      db.users[senderMember.user.id].streak.current = 1
    }
    
    // Update last donation timestamp
    db.users[senderMember.user.id].streak.lastDonation = now

    // Process entries for eligible draws
    let entriesAdded = 0
    const entriesByDraw = {}
    
    logger.info(`🎯 Adding entries to eligible draws`)
    
    for (const [drawId, draw] of Object.entries(db.donationDraws)) {
      if (!draw.active) continue
      if (usdValue < draw.minAmount || (draw.maxAmount && usdValue > draw.maxAmount)) continue
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
      if (draw.maxEntries && currentEntries >= draw.maxEntries) continue

      // Add entries
      if (!draw.entries) draw.entries = {}
      if (!draw.entries[senderMember.user.id]) draw.entries[senderMember.user.id] = 0
      if (!db.users[senderMember.user.id].entries) db.users[senderMember.user.id].entries = {}
      if (!db.users[senderMember.user.id].entries[drawId]) db.users[senderMember.user.id].entries[drawId] = 0

      const maxEntriesToAdd = draw.maxEntries ? draw.maxEntries - currentEntries : entries
      const entriesToAdd = Math.min(entries, maxEntriesToAdd)
      
      draw.entries[senderMember.user.id] += entriesToAdd
      db.users[senderMember.user.id].entries[drawId] += entriesToAdd
      entriesAdded += entriesToAdd
      entriesByDraw[drawId] = entriesToAdd
      
      logger.info(`🎯 Added ${entriesToAdd} entries to draw: ${draw.name || drawId}`)
    }

    // Check for achievements
    await checkAndAssignAchievements(db, senderMember.user.id)

    // Save database
    saveDatabase(serverId, db)
    
    logger.info(`✅ Donation processed successfully`)

    // Send confirmation
    if (entriesAdded > 0) {
      // Create a more detailed confirmation message
      let confirmationMessage = `🎉 **Thank you for your donation!** 🎉\n\n`
      confirmationMessage += `<@${senderMember.user.id}> just donated **$${usdValue.toFixed(2)}** and received **${entriesAdded}** draw entries!\n\n`
      
      // Add entries by draw
      confirmationMessage += `📋 **Entries Added:**\n`
      for (const [drawId, entries] of Object.entries(entriesByDraw)) {
        const drawName = db.donationDraws[drawId]?.name || drawId
        confirmationMessage += `• **${drawName}**: ${entries} entries\n`
      }
      
      // Add total donated
      confirmationMessage += `\n💰 **Donation Amount:** $${usdValue.toFixed(2)}\n`
      confirmationMessage += `💵 **Total Donated:** $${db.users[senderMember.user.id].totalDonated.toFixed(2)}\n\n`
      
      // Add helpful commands
      confirmationMessage += `📝 Use \`/user entries\` to see all your entries across draws!\n`
      confirmationMessage += `🎯 Use \`/user select_draw\` to choose a different draw for your next donation!\n\n`
      
      // Add thank you message
      confirmationMessage += `Thank you for supporting our community! ❤️`

      await message.channel.send(confirmationMessage)
    }

    logger.info(`Processed donation: ${senderMember.user.id} -> $${usdValue.toFixed(2)} (${entriesAdded} entries)`)
  } catch (error) {
    logger.error("Error processing tip.cc donation:", error)
  }
}

async function checkAndAssignAchievements(db, userId) {
  try {
    const user = db.users[userId]
    if (!user) return
    
    // Define achievements
    const achievements = [
      {
        id: "first_steps",
        name: "First Steps",
        description: "Made your first donation",
        check: (user) => user.donations.length > 0,
      },
      {
        id: "generous_donor",
        name: "Generous Donor",
        description: "Donated at least $100",
        check: (user) => user.totalDonated >= 100,
      },
      {
        id: "big_spender",
        name: "Big Spender",
        description: "Donated at least $500",
        check: (user) => user.totalDonated >= 500,
      },
      {
        id: "whale",
        name: "Whale",
        description: "Donated at least $1,000",
        check: (user) => user.totalDonated >= 1000,
      },
      {
        id: "lucky_winner",
        name: "Lucky Winner",
        description: "Won a donation draw",
        check: (user) => user.wins > 0,
      },
      {
        id: "streak_master",
        name: "Streak Master",
        description: "Maintained a 7-day donation streak",
        check: (user) => user.streak?.longest >= 7,
      }
    ]
    
    // Initialize achievements array if it doesn't exist
    if (!user.achievements) user.achievements = []
    
    // Check each achievement
    for (const achievement of achievements) {
      // Skip if already earned
      if (user.achievements.includes(achievement.id)) continue
      
      // Check if achievement should be awarded
      if (achievement.check(user)) {
        user.achievements.push(achievement.id)
        logger.info(`🏆 Achievement unlocked: ${achievement.name} for user ${userId}`)
      }
    }
  } catch (error) {
    logger.error(`Error checking achievements for user ${userId}:`, error)
  }
}

async function getCryptoPrice(symbol, amount) {
  try {
    // Normalize symbol
    const normalizedSymbol = symbol.toUpperCase()
    
    // Try Aegisum API first for AEGS
    if (normalizedSymbol === 'AEGS') {
      const aegsPrice = await getAegisumPrice(normalizedSymbol, amount)
      if (aegsPrice) return aegsPrice
    }
    
    // Try CoinGecko API
    const geckoPrice = await getCoinGeckoPrice(normalizedSymbol, amount)
    if (geckoPrice) return geckoPrice
    
    // Try CoinMarketCap API as fallback
    const cmcPrice = await getCoinMarketCapPrice(normalizedSymbol, amount)
    if (cmcPrice) return cmcPrice
    
    // If all APIs fail, log warning
    logger.warn(`❌ Could not fetch price for ${normalizedSymbol} from any API`)
    return null
  } catch (error) {
    logger.error(`Error in getCryptoPrice for ${symbol}:`, error)
    return null
  }
}

async function getAegisumPrice(symbol, amount) {
  try {
    if (symbol !== 'AEGS') return null
    
    const response = await fetch('https://aegisum.com/api/coins/aegs/')
    
    if (!response.ok) {
      logger.warn(`Aegisum API returned status ${response.status} for ${symbol}`)
      return null
    }
    
    const data = await response.json()
    
    if (data && data.price) {
      const price = parseFloat(data.price)
      const totalValue = price * amount
      logger.info(`🔍 Aegisum price for ${symbol}: $${price.toFixed(8)} (Total: $${totalValue.toFixed(4)})`)
      return totalValue
    }
    
    return null
  } catch (error) {
    logger.error(`Error fetching Aegisum price for ${symbol}:`, error)
    return null
  }
}

async function getCoinGeckoPrice(symbol, amount) {
  try {
    // Map of common symbols to CoinGecko IDs
    const symbolToId = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'USDT': 'tether',
      'SOL': 'solana',
      'XRP': 'ripple',
      'DOGE': 'dogecoin',
      'SHIB': 'shiba-inu',
      'BNB': 'binancecoin',
      'LTC': 'litecoin'
    }
    
    const coinId = symbolToId[symbol]
    if (!coinId) return null
    
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`)
    
    if (!response.ok) {
      logger.warn(`CoinGecko API returned status ${response.status} for ${symbol}`)
      return null
    }
    
    const data = await response.json()
    
    if (data && data[coinId] && data[coinId].usd) {
      const price = data[coinId].usd
      const totalValue = price * amount
      logger.info(`🔍 CoinGecko price for ${symbol}: $${price.toFixed(8)} (Total: $${totalValue.toFixed(4)})`)
      return totalValue
    }
    
    return null
  } catch (error) {
    logger.error(`Error fetching CoinGecko price for ${symbol}:`, error)
    return null
  }
}

async function getCoinMarketCapPrice(symbol, amount) {
  try {
    const apiKey = process.env.COINMARKETCAP_API_KEY
    if (!apiKey) return null

    const response = await fetch(
      `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symbol}`,
      {
        headers: {
          "X-CMC_PRO_API_KEY": apiKey,
        },
      },
    )

    if (!response.ok) {
      logger.warn(`CoinMarketCap API returned status ${response.status} for ${symbol}`)
      return null
    }

    const data = await response.json()
    const price = data.data?.[symbol]?.quote?.USD?.price

    if (price) {
      const totalValue = price * amount
      logger.info(`🔍 CoinMarketCap price for ${symbol}: $${price.toFixed(8)} (Total: $${totalValue.toFixed(4)})`)
      return totalValue
    }

    return null
  } catch (error) {
    logger.error(`Error fetching CoinMarketCap price for ${symbol}:`, error)
    return null
  }
}
