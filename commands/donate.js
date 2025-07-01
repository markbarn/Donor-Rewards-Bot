import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js"
import { getDatabase } from "../utils/database.js"
import { logger } from "../utils/logger.js"

const DEFAULT_ACCEPTED_CRYPTOCURRENCIES = [
  "AEGS",
  "LTC",
  "SOL",
  "USDT",
  "BTC",
  "XRP",
  "DOGE",
  "SHIB",
  "SHIC",
  "BNB",
  "USDC",
  "ETH",
  "XLA",
  "ADA",
  "AVAX",
  "TON",
  "TRON",
  "PEP",
  "BONC",
]

export const data = new SlashCommandBuilder()
  .setName("donate")
  .setDescription("Get donation instructions and accepted cryptocurrencies")
  .addStringOption((option) =>
    option.setName("draw_id").setDescription("Get instructions for a specific draw").setRequired(false),
  )

export async function execute(interaction) {
  try {
    const serverId = interaction.guildId
    const db = getDatabase(serverId)
    const drawId = interaction.options.getString("draw_id")

    if (drawId) {
      // Show specific draw instructions
      const draw = db.donationDraws?.[drawId]
      if (!draw) {
        return interaction.reply({
          content: "❌ Draw not found. Use `/draws list` to see available draws.",
          flags: MessageFlags.Ephemeral,
        })
      }

      const embed = new EmbedBuilder()
        .setTitle(`💰 How to Enter: ${draw.name}`)
        .setColor(db.config?.theme?.primary || "#4CAF50")
        .addFields(
          {
            name: "💎 Donation Range",
            value: `$${draw.minAmount} - $${draw.maxAmount >= 1000000 ? "No limit" : draw.maxAmount}`,
            inline: true,
          },
          { name: "🏆 Reward", value: draw.reward, inline: true },
          {
            name: "🎟️ Entries Available",
            value: `${Object.values(draw.entries || {}).reduce((sum, count) => sum + count, 0)}/${draw.maxEntries}`,
            inline: true,
          },
        )

      if (db.config?.allowedRecipients?.length) {
        const recipients = db.config.allowedRecipients.map((r) => `• ${r}`).join("\n")
        embed.addFields({
          name: "📨 Donation Recipients",
          value: recipients,
          inline: false,
        })
      }

      embed.addFields({
        name: "💡 How to Donate",
        value: "Use tip.cc: `$tip @recipient amount SYMBOL`\nExample: `$tip @user 10 USDT`",
        inline: false,
      })

      if (draw.manualEntriesOnly) {
        embed.addFields({
          name: "🔒 Manual Entries Only",
          value: "This draw requires manual entry assignment by admins.",
          inline: false,
        })
      }

      embed.setFooter({ text: "Powered By Aegisum Eco System" })
      return interaction.reply({ embeds: [embed] })
    }

    // Show general donation instructions
    const coins = db.config?.acceptedCryptocurrencies || DEFAULT_ACCEPTED_CRYPTOCURRENCIES

    const embed = new EmbedBuilder()
      .setTitle("💰 How to Donate")
      .setDescription("Here's how to donate and enter draws:")
      .setColor(db.config?.theme?.info || "#00BCD4")

    if (db.config?.allowedRecipients?.length) {
      const recipients = db.config.allowedRecipients.map((r) => `• ${r}`).join("\n")
      embed.addFields({
        name: "📨 Donation Recipients",
        value: recipients,
        inline: false,
      })
    }

    embed.addFields(
      {
        name: "💡 How to Donate",
        value: "Use tip.cc: `$tip @recipient amount SYMBOL`\nExample: `$tip @user 10 USDT`",
        inline: false,
      },
      {
        name: "💎 Accepted Coins",
        value: coins.slice(0, 10).join(", ") + (coins.length > 10 ? "..." : ""),
        inline: false,
      },
      {
        name: "🎁 Available Draws",
        value: "Use `/draws list` to see all active draws",
        inline: true,
      },
      {
        name: "🎟️ Your Entries",
        value: "Use `/user entries` to check your current entries",
        inline: true,
      },
    )

    embed.setFooter({ text: "Powered By Aegisum Eco System" })
    await interaction.reply({ embeds: [embed] })
  } catch (error) {
    logger.error("Error in donate command:", error)
    await interaction.reply({
      content: "❌ An error occurred while fetching donation instructions.",
      flags: MessageFlags.Ephemeral,
    })
  }
}
