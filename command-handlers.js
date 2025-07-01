// Additional command handlers for the new features

// This file contains the remaining command handlers that were too long to include in the main bot.js file

import { EmbedBuilder } from "discord.js"
import { getDatabase, saveDatabase } from "./database.js" // Import database functions

// Export all command handlers
export async function handleSetupCommand(interaction) {
  const adminRole = interaction.options.getRole("admin_role")
  const notificationChannel = interaction.options.getChannel("notification_channel")
  const serverId = interaction.guildId

  const db = getDatabase(serverId)
  db.config.adminRoleId = adminRole.id

  if (notificationChannel) {
    db.config.notificationChannelId = notificationChannel.id
  }

  saveDatabase(serverId, db)

  const embed = new EmbedBuilder()
    .setTitle("✅ Setup Complete")
    .setDescription(`Donor Rewards has been set up successfully!`)
    .setColor(db.config.theme.success)
    .addFields({ name: "👑 Admin Role", value: `<@&${adminRole.id}>` })
    .setFooter({ text: "Powered By Aegisum Eco System" })

  if (notificationChannel) {
    embed.addFields({ name: "📢 Notification Channel", value: `<#${notificationChannel.id}>` })
  }

  embed.addFields({
    name: "📋 Next Steps",
    value:
      "• Use `/add_recipient` to add users or roles that can receive donations\n• Use `/create_draw` to set up your first draw\n• Use `/features` to view and toggle available features",
  })

  interaction.reply({ embeds: [embed] })
}

export async function handleAdminCommand(interaction) {
  const serverId = interaction.guildId
  const db = getDatabase(serverId)

  const embed = new EmbedBuilder()
    .setTitle("🛠️ Donor Rewards Admin Dashboard")
    .setDescription("Manage your donation system:")
    .setColor(db.config.theme.primary)
    .setFooter({ text: "Powered By Aegisum Eco System" })

  // Core management commands
  embed.addFields(
    {
      name: "📊 Core Management",
      value:
        "`/add_recipient` - Add donation recipients\n`/create_draw` - Create new draws\n`/assign_entries` - Manually assign entries\n`/analytics` - View donation analytics",
      inline: true,
    },
    {
      name: "🎮 Draw Management",
      value:
        "`/select_winner` - Select draw winners\n`/schedule_draw` - Schedule automatic draws\n`/reset_draw` - Reset draw entries\n`/blacklist` - Manage blacklists",
      inline: true,
    },
    {
      name: "⚙️ Configuration",
      value:
        "`/feature_toggle` - Enable/disable features\n`/set_theme` - Customize colors\n`/create_backup` - Backup database\n`/bot_info` - View bot information",
      inline: true,
    },
  )

  // Current configuration summary
  let recipientsText = "None"
  if (db.config.allowedRecipients && db.config.allowedRecipients.length > 0) {
    recipientsText = db.config.allowedRecipients
      .map((r) => `${r.type === "user" ? "👤" : "🎭"} <@${r.type === "user" ? "" : "&"}${r.id}>`)
      .join(", ")
  }

  embed.addFields(
    { name: "👑 Admin Role", value: db.config.adminRoleId ? `<@&${db.config.adminRoleId}>` : "Not set", inline: true },
    {
      name: "📢 Notifications",
      value: db.config.notificationChannelId ? `<#${db.config.notificationChannelId}>` : "Not set",
      inline: true,
    },
    { name: "📝 Logs", value: db.config.logChannelId ? `<#${db.config.logChannelId}>` : "Not set", inline: true },
  )

  embed.addFields({ name: "🎯 Allowed Recipients", value: recipientsText, inline: false })

  // Active draws summary
  const activeDraws = Object.entries(db.donationDraws)
    .filter(([_, draw]) => draw.active)
    .slice(0, 3) // Show only first 3
    .map(([id, draw]) => {
      const totalEntries = Object.values(draw.entries).reduce((sum, count) => sum + count, 0)
      let status = `${totalEntries}/${draw.maxEntries} entries`

      if (draw.manualEntriesOnly) status += " 🔒"
      if (draw.vipOnly) status += " ⭐"
      if (draw.drawTime) status += " ⏰"

      return `**${draw.name}** (${id})\n${status} | 🏆 ${draw.reward}`
    })

  if (activeDraws.length > 0) {
    embed.addFields({ name: "🎪 Active Draws (Top 3)", value: activeDraws.join("\n\n"), inline: false })

    const totalActiveDraws = Object.values(db.donationDraws).filter((draw) => draw.active).length
    if (totalActiveDraws > 3) {
      embed.addFields({ name: "📈 Total Active Draws", value: totalActiveDraws.toString(), inline: true })
    }
  } else {
    embed.addFields({ name: "🎪 Active Draws", value: "No active draws", inline: false })
  }

  // Quick stats
  const totalDonors = Object.values(db.users).filter((user) => user.totalDonated > 0).length
  const totalDonations = Object.values(db.users).reduce((sum, user) => sum + user.totalDonated, 0)

  embed.addFields(
    { name: "👥 Total Donors", value: totalDonors.toString(), inline: true },
    { name: "💰 Total Donations", value: `$${totalDonations.toFixed(2)}`, inline: true },
    { name: "🎲 Total Draws", value: (db.drawHistory?.length || 0).toString(), inline: true },
  )

  interaction.reply({ embeds: [embed], ephemeral: true })
}

// Add more handlers here as needed...
