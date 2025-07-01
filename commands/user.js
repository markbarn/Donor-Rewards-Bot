import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js"
import { getDatabase } from "../utils/database.js"
import { logger } from "../utils/logger.js"

export const data = new SlashCommandBuilder().setName("help").setDescription("Show comprehensive help information")

export async function execute(interaction) {
  try {
    const serverId = interaction.guildId
    const db = getDatabase(serverId)

    const embed = new EmbedBuilder()
      .setTitle("🆘 Help - Donor Rewards Bot")
      .setDescription("Complete command reference for the Donor Rewards Bot")
      .setColor(db.config?.theme?.info || "#00BCD4")

    // Essential Commands
    embed.addFields({
      name: "🚀 Essential Commands",
      value: [
        "`/donate` - Get donation instructions and accepted coins",
        "`/draws list` - View all available draws",
        "`/user entries` - Check your draw entries",
        "`/user profile` - View your donation profile",
        "`/ping` - Check bot status",
      ].join("\n"),
      inline: false,
    })

    // User Commands
    embed.addFields({
      name: "👤 User Commands",
      value: [
        "`/user profile [target]` - View donation profile",
        "`/user entries` - Check your draw entries",
        "`/user achievements [target]` - View achievements",
        "`/user privacy <setting>` - Manage privacy settings",
        "`/user leaderboard [type]` - View leaderboards",
        "`/user donor_roles` - View donor role requirements",
      ].join("\n"),
      inline: false,
    })

    // Draw Commands
    embed.addFields({
      name: "🎁 Draw Commands",
      value: [
        "`/draws list` - Show available draws",
        "`/draws info <draw_id>` - Get detailed draw info",
        "`/draws leaderboard <draw_id>` - View entry leaderboard",
        "`/draws ids` - Show all draw IDs for reference",
      ].join("\n"),
      inline: false,
    })

    // Check if user has admin permissions
    const isAdmin = await checkAdminPermissions(interaction, db)

    if (isAdmin) {
      embed.addFields({
        name: "⚙️ Admin Commands",
        value: [
          "`/admin setup` - Initial bot configuration",
          "`/admin dashboard` - View admin dashboard",
          "`/admin analytics [type]` - View detailed analytics",
          "`/admin create_draw` - Create new draws",
          "`/admin select_winner <draw_id>` - Select draw winners",
          "`/admin assign_entries` - Manually assign entries",
          "`/admin add_recipient` - Add donation recipients",
          "`/admin remove_recipient` - Remove donation recipients",
          "`/admin edit_draw` - Edit existing draws",
          "`/admin blacklist` - Manage blacklisted users",
          "`/admin features` - Toggle bot features",
        ].join("\n"),
        inline: false,
      })
    }

    embed.addFields(
      {
        name: "💡 Quick Start Guide",
        value: [
          "1. Use `/donate` to learn how to donate",
          "2. Use `/draws list` to see available draws",
          "3. Donate using tip.cc: `$tip @recipient amount SYMBOL`",
          "4. Check your entries with `/user entries`",
          "5. View your profile with `/user profile`",
        ].join("\n"),
        inline: false,
      },
      {
        name: "🔗 Support & Features",
        value: [
          "• **Privacy Controls**: Use `/user privacy` to manage visibility",
          "• **Achievements**: Unlock achievements by donating",
          "• **Leaderboards**: Compete with other donors",
          "• **Multiple Draws**: Enter multiple draws simultaneously",
          "• **Real-time Tracking**: Automatic donation detection",
        ].join("\n"),
        inline: false,
      },
    )

    embed.setFooter({ text: "Powered By Aegisum Eco System • Use /help for this menu anytime" })
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
  } catch (error) {
    logger.error("Error in help command:", error)
    await interaction.reply({
      content: "❌ An error occurred while fetching help information.",
      flags: MessageFlags.Ephemeral,
    })
  }
}

async function checkAdminPermissions(interaction, db) {
  const OWNER_ID = process.env.OWNER_ID || "659745190382141453"
  if (interaction.user.id === OWNER_ID) return true
  if (!db.config?.adminRoleId) return false

  try {
    const member = await interaction.guild.members.fetch(interaction.user.id)
    return member.roles.cache.has(db.config.adminRoleId)
  } catch (error) {
    logger.error("Error checking admin permissions:", error)
    return false
  }
}
