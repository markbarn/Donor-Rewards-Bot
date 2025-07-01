import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js"
import { getDatabase } from "../utils/database.js"
import { logger } from "../utils/logger.js"

export const data = new SlashCommandBuilder()
  .setName("draws")
  .setDescription("Draw management and information commands")
  .addSubcommand((subcommand) => subcommand.setName("list").setDescription("Show available donation draws"))
  .addSubcommand((subcommand) =>
    subcommand
      .setName("info")
      .setDescription("Get detailed information about a specific draw")
      .addStringOption((option) => option.setName("draw_id").setDescription("ID of the draw").setRequired(true)),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("leaderboard")
      .setDescription("View entry leaderboard for a specific draw")
      .addStringOption((option) => option.setName("draw_id").setDescription("ID of the draw").setRequired(true)),
  )
  .addSubcommand((subcommand) => subcommand.setName("ids").setDescription("Show all draw IDs for easy reference"))

export async function execute(interaction) {
  try {
    const serverId = interaction.guildId
    const db = getDatabase(serverId)
    const subcommand = interaction.options.getSubcommand()

    logger.info(`Draws command executed: ${subcommand} by ${interaction.user.tag}`)

    switch (subcommand) {
      case "list":
        await handleList(interaction, db)
        break
      case "info":
        await handleInfo(interaction, db)
        break
      case "leaderboard":
        await handleLeaderboard(interaction, db)
        break
      case "ids":
        await handleIds(interaction, db)
        break
      default:
        await handleList(interaction, db)
        break
    }
  } catch (error) {
    logger.error("Error in draws command:", error)

    const errorMessage = {
      content: "❌ An error occurred while executing the draws command.",
      flags: MessageFlags.Ephemeral,
    }

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage)
      } else {
        await interaction.reply(errorMessage)
      }
    } catch (followUpError) {
      logger.error("Error sending draws error message:", followUpError)
    }
  }
}

async function handleList(interaction, db) {
  const activeDraws = Object.entries(db.donationDraws || {})
    .filter(([_, draw]) => draw.active)
    .sort((a, b) => a[1].minAmount - b[1].minAmount)

  if (activeDraws.length === 0) {
    return interaction.reply({
      content: "❌ There are no active draws at the moment.",
      flags: MessageFlags.Ephemeral,
    })
  }

  const embeds = []
  const maxFieldsPerEmbed = 3

  for (let i = 0; i < activeDraws.length; i += maxFieldsPerEmbed) {
    const embed = new EmbedBuilder()
      .setColor(db.config?.theme?.primary || "#4CAF50")
      .setFooter({ text: "Powered By Aegisum Eco System" })

    if (i === 0) {
      embed.setTitle("🎁 Available Donation Draws").setDescription("Here are all the active donation draws:")
    }

    const drawsSlice = activeDraws.slice(i, i + maxFieldsPerEmbed)

    for (const [drawId, draw] of drawsSlice) {
      const currentEntries = Object.values(draw.entries || {}).reduce((sum, count) => sum + count, 0)
      const maxAmount = draw.maxAmount >= 1000000 ? "No limit" : `$${draw.maxAmount}`

      let statusIcons = ""
      if (draw.manualEntriesOnly) statusIcons += "🔒 "
      if (draw.vipOnly) statusIcons += "⭐ "
      if (draw.drawTime) statusIcons += "⏰ "

      const fieldValue = [
        `💰 **Range:** $${draw.minAmount} - ${maxAmount}`,
        `🎟️ **Entries:** ${currentEntries}/${draw.maxEntries}`,
        `🏆 **Reward:** ${draw.reward}`,
        `📊 **Progress:** ${Math.round((currentEntries / draw.maxEntries) * 100)}%`,
        statusIcons ? `ℹ️ **Status:** ${statusIcons}` : "",
      ]
        .filter(Boolean)
        .join("\n")

      embed.addFields({
        name: `${draw.name} (ID: \`${drawId}\`)`,
        value: fieldValue,
        inline: false,
      })
    }

    embeds.push(embed)
  }

  // Add instruction embed
  const instructionEmbed = new EmbedBuilder()
    .setColor("#2196F3")
    .setTitle("💡 How to Enter")
    .setDescription("Use `/donate` for instructions on how to enter these draws!")
    .addFields(
      { name: "🎯 Specific Draw", value: "Use `/donate draw_id:drawID` for specific instructions", inline: true },
      { name: "🆔 Draw IDs", value: "Use `/draws ids` to see all available IDs", inline: true },
    )

  embeds.push(instructionEmbed)
  await interaction.reply({ embeds })
}

async function handleInfo(interaction, db) {
  const drawId = interaction.options.getString("draw_id")
  const draw = db.donationDraws?.[drawId]

  if (!draw) {
    return interaction.reply({
      content: "❌ Draw not found. Use `/draws ids` to see available draws.",
      flags: MessageFlags.Ephemeral,
    })
  }

  const currentEntries = Object.values(draw.entries || {}).reduce((sum, count) => sum + count, 0)
  const maxAmount = draw.maxAmount >= 1000000 ? "No limit" : `$${draw.maxAmount}`

  const embed = new EmbedBuilder()
    .setTitle(`🎁 ${draw.name}`)
    .setDescription(`Detailed information about draw: **\`${drawId}\`**`)
    .setColor(draw.active ? db.config?.theme?.primary || "#4CAF50" : db.config?.theme?.error || "#F44336")
    .addFields(
      { name: "🆔 Draw ID", value: `\`${drawId}\``, inline: true },
      { name: "📊 Status", value: draw.active ? "🟢 Active" : "🔴 Inactive", inline: true },
      { name: "🏆 Reward", value: draw.reward, inline: true },
      { name: "💰 Min Amount", value: `$${draw.minAmount}`, inline: true },
      { name: "💎 Max Amount", value: maxAmount, inline: true },
      { name: "🎟️ Entries", value: `${currentEntries}/${draw.maxEntries}`, inline: true },
      { name: "📈 Progress", value: `${Math.round((currentEntries / draw.maxEntries) * 100)}%`, inline: true },
      { name: "⭐ VIP Only", value: draw.vipOnly ? "Yes" : "No", inline: true },
      { name: "🔒 Manual Entries", value: draw.manualEntriesOnly ? "Yes" : "No", inline: true },
    )

  if (draw.createdAt) {
    embed.addFields({
      name: "📅 Created",
      value: new Date(draw.createdAt).toLocaleDateString(),
      inline: true,
    })
  }

  if (draw.winner) {
    embed.addFields({
      name: "🏆 Winner",
      value: `<@${draw.winner}>`,
      inline: true,
    })
  }

  embed.setFooter({ text: "Powered By Aegisum Eco System" })
  await interaction.reply({ embeds: [embed] })
}

async function handleLeaderboard(interaction, db) {
  const drawId = interaction.options.getString("draw_id")
  const draw = db.donationDraws?.[drawId]

  if (!draw) {
    return interaction.reply({
      content: "❌ Draw not found.",
      flags: MessageFlags.Ephemeral,
    })
  }

  const entries = draw.entries || {}
  const sortedEntries = Object.entries(entries)
    .filter(([userId]) => !db.users?.[userId]?.privacyEnabled)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)

  if (sortedEntries.length === 0) {
    return interaction.reply({
      content: "📊 No public entries found for this draw.",
      flags: MessageFlags.Ephemeral,
    })
  }

  const totalEntries = Object.values(entries).reduce((sum, count) => sum + count, 0)

  const embed = new EmbedBuilder()
    .setTitle(`🎟️ Entry Leaderboard: ${draw.name}`)
    .setColor(db.config?.theme?.primary || "#4CAF50")
    .setDescription(`Total entries: ${totalEntries}/${draw.maxEntries}`)

  const leaderboardText = sortedEntries
    .map(([userId, entryCount], index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`
      const percentage = ((entryCount / totalEntries) * 100).toFixed(1)
      return `${medal} <@${userId}> - ${entryCount} entries (${percentage}%)`
    })
    .join("\n")

  embed.addFields({
    name: "📊 Top Entries",
    value: leaderboardText,
    inline: false,
  })

  embed
    .addFields(
      { name: "🏆 Reward", value: draw.reward, inline: true },
      { name: "💰 Range", value: `$${draw.minAmount} - $${draw.maxAmount}`, inline: true },
      { name: "📊 Status", value: draw.active ? "🟢 Active" : "🔴 Inactive", inline: true },
    )
    .setFooter({ text: "Powered By Aegisum Eco System" })
    .setTimestamp()

  await interaction.reply({ embeds: [embed] })
}

async function handleIds(interaction, db) {
  const draws = Object.entries(db.donationDraws || {})

  if (draws.length === 0) {
    return interaction.reply({
      content: "❌ No draws have been created yet.",
      flags: MessageFlags.Ephemeral,
    })
  }

  const activeDraws = draws.filter(([, draw]) => draw.active)
  const inactiveDraws = draws.filter(([, draw]) => !draw.active)

  const embed = new EmbedBuilder()
    .setTitle("🆔 Draw IDs Reference")
    .setDescription("Quick reference for all draw IDs:")
    .setColor(db.config?.theme?.info || "#00BCD4")

  if (activeDraws.length > 0) {
    const activeList = activeDraws.map(([drawId, draw]) => `• \`${drawId}\` - ${draw.name}`).join("\n")

    embed.addFields({
      name: "🟢 Active Draws",
      value: activeList,
      inline: false,
    })
  }

  if (inactiveDraws.length > 0) {
    const inactiveList = inactiveDraws
      .slice(0, 10) // Limit to prevent embed overflow
      .map(([drawId, draw]) => `• \`${drawId}\` - ${draw.name}`)
      .join("\n")

    embed.addFields({
      name: "🔴 Inactive Draws",
      value: inactiveList,
      inline: false,
    })

    if (inactiveDraws.length > 10) {
      embed.addFields({
        name: "📝 Note",
        value: `Showing first 10 inactive draws. Total: ${inactiveDraws.length}`,
        inline: false,
      })
    }
  }

  embed
    .addFields({
      name: "💡 Usage",
      value: [
        "• Copy the draw ID (including backticks)",
        "• Use with `/draws info draw_id:DRAW_ID`",
        "• Use with `/donate draw_id:DRAW_ID`",
      ].join("\n"),
      inline: false,
    })
    .setFooter({ text: "Powered By Aegisum Eco System" })

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
}
