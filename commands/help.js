import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js"
import { getDatabase } from "../utils/database.js"
import { logger } from "../utils/logger.js"

export const data = new SlashCommandBuilder().setName("help").setDescription("Show comprehensive help information")

export async function execute(interaction) {
  try {
    const serverId = interaction.guildId
    const db = getDatabase(serverId)
    
    // Check if user has admin permissions
    const isAdmin = await checkAdminPermissions(interaction, db)
    
    // Show main help menu first
    await showMainHelpMenu(interaction, db, isAdmin)
  } catch (error) {
    logger.error("Error in help command:", error)
    await interaction.reply({
      content: "❌ An error occurred while fetching help information.",
      flags: MessageFlags.Ephemeral,
    })
  }
}

async function showMainHelpMenu(interaction, db, isAdmin) {
  try {
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

    // Add category buttons
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("help_user_commands")
        .setLabel("User Commands")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("👤"),
      new ButtonBuilder()
        .setCustomId("help_draw_commands")
        .setLabel("Draw Commands")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🎁"),
      new ButtonBuilder()
        .setCustomId("help_achievement_system")
        .setLabel("Achievement System")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🏆")
    )

    // Add admin button if user has admin permissions
    const row2 = new ActionRowBuilder()
    if (isAdmin) {
      row2.addComponents(
        new ButtonBuilder()
          .setCustomId("help_admin_commands")
          .setLabel("Admin Commands")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("⚙️")
      )
    }

    // Add quick start guide
    embed.addFields({
      name: "💡 Quick Start Guide",
      value: [
        "1. Use `/donate` to learn how to donate",
        "2. Use `/draws list` to see available draws",
        "3. Donate using tip.cc: `$tip @recipient amount SYMBOL`",
        "4. Check your entries with `/user entries`",
        "5. View your profile with `/user profile`",
      ].join("\n"),
      inline: false,
    })

    embed.setFooter({ text: "Powered By Aegisum Eco System • Main Help Menu" })

    // Send the message with buttons
    const components = [row]
    if (row2.components.length > 0) {
      components.push(row2)
    }

    const response = await interaction.reply({ 
      embeds: [embed], 
      components: components,
      flags: MessageFlags.Ephemeral 
    })

    // Create collector for button interactions
    const collector = response.createMessageComponentCollector({ 
      time: 300000 // 5 minutes
    })

    collector.on("collect", async (i) => {
      // Verify the user who clicked is the same who initiated
      if (i.user.id !== interaction.user.id) {
        await i.reply({ 
          content: "This menu is not for you. Please use the `/help` command to get your own menu.", 
          ephemeral: true 
        })
        return
      }

      // Handle button clicks
      switch (i.customId) {
        case "help_user_commands":
          await showUserCommands(i, db, 1)
          break
        case "help_draw_commands":
          await showDrawCommands(i, db)
          break
        case "help_admin_commands":
          await showAdminCommands(i, db)
          break
        case "help_achievement_system":
          await showAchievementSystem(i, db)
          break
        case "help_main_menu":
          await i.update({ 
            embeds: [embed], 
            components: components
          })
          break
        case "help_user_commands_next":
          await showUserCommands(i, db, 2)
          break
        case "help_user_commands_prev":
          await showUserCommands(i, db, 1)
          break
      }
    })

    collector.on("end", async () => {
      // Remove buttons after timeout
      try {
        await interaction.editReply({ 
          components: [] 
        })
      } catch (error) {
        logger.error("Error removing buttons from help menu:", error)
      }
    })
  } catch (error) {
    logger.error("Error showing main help menu:", error)
    await interaction.editReply({
      content: "❌ An error occurred while displaying the help menu.",
      components: [],
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

async function showUserCommands(interaction, db, page = 1) {
  try {
    const embed = new EmbedBuilder()
      .setColor(db.config?.theme?.primary || "#3498DB")

    // Navigation row
    const navigationRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("help_main_menu")
        .setLabel("Back to Main")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🏠")
    )

    if (page === 1) {
      embed.setTitle("👤 User Commands - Profile & Stats")
        .setDescription("Commands to view and manage your donation profile and statistics.")
        .addFields(
          {
            name: "/user profile [target]",
            value: "View detailed donation profile including total donated, achievements earned, and donation history. Add target to view another user's public profile.",
            inline: false
          },
          {
            name: "/user entries",
            value: "Check your current draw entries across all active draws. Shows how many entries you have in each draw and potential rewards.",
            inline: false
          },
          {
            name: "/user donor_roles",
            value: "View donor role requirements and your progress towards the next role. Shows all available donor roles and their donation thresholds.",
            inline: false
          },
          {
            name: "/user select_draw [draw_id]",
            value: "Choose which draw your future donations will count towards. Use auto to return to automatic selection based on donation amount.",
            inline: false
          }
        )
        .setFooter({ text: "Powered By Aegisum Eco System • Page 1/2" })

      // Add next page button
      navigationRow.addComponents(
        new ButtonBuilder()
          .setCustomId("help_user_commands_next")
          .setLabel("Next")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("➡️")
      )
    } else if (page === 2) {
      embed.setTitle("👤 User Commands - Achievements & Privacy")
        .setDescription("Commands to manage your achievements and privacy settings.")
        .addFields(
          {
            name: "/user achievements [target]",
            value: "View your achievements or another user's achievements. Shows progress towards locked achievements.",
            inline: false
          },
          {
            name: "/user privacy <setting>",
            value: "Manage your privacy settings. Control who can see your donation history and profile details.",
            inline: false
          },
          {
            name: "/user leaderboard [type]",
            value: "View donation leaderboards. Types include: all_time, monthly, weekly, and draws.",
            inline: false
          },
          {
            name: "/user streak",
            value: "View your current donation streak and streak history. Maintain daily donations to increase your streak.",
            inline: false
          }
        )
        .setFooter({ text: "Powered By Aegisum Eco System • Page 2/2" })

      // Add previous page button
      navigationRow.addComponents(
        new ButtonBuilder()
          .setCustomId("help_user_commands_prev")
          .setLabel("Previous")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("⬅️")
      )
    }

    await interaction.update({
      embeds: [embed],
      components: [navigationRow]
    })
  } catch (error) {
    logger.error("Error showing user commands:", error)
    await interaction.update({
      content: "❌ An error occurred while displaying user commands.",
      components: [],
      embeds: []
    })
  }
}

async function showDrawCommands(interaction, db) {
  try {
    const embed = new EmbedBuilder()
      .setTitle("🎁 Draw Commands")
      .setDescription("Commands to view and interact with donation draws.")
      .setColor(db.config?.theme?.success || "#4CAF50")
      .addFields(
        {
          name: "/draws list",
          value: "View all active draws with their requirements and rewards. Shows which draws you're eligible for.",
          inline: false
        },
        {
          name: "/draws info <draw_id>",
          value: "Get detailed information about a specific draw including entry count, requirements, and rewards.",
          inline: false
        },
        {
          name: "/draws leaderboard <draw_id>",
          value: "View the entry leaderboard for a specific draw. See who has the most entries.",
          inline: false
        },
        {
          name: "/draws ids",
          value: "List all draw IDs for reference when using other commands.",
          inline: false
        },
        {
          name: "/draws history",
          value: "View past draws and their winners. See what rewards were given out previously.",
          inline: false
        }
      )
      .setFooter({ text: "Powered By Aegisum Eco System • Draw Commands" })

    // Navigation row
    const navigationRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("help_main_menu")
        .setLabel("Back to Main")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🏠")
    )

    await interaction.update({
      embeds: [embed],
      components: [navigationRow]
    })
  } catch (error) {
    logger.error("Error showing draw commands:", error)
    await interaction.update({
      content: "❌ An error occurred while displaying draw commands.",
      components: [],
      embeds: []
    })
  }
}

async function showAdminCommands(interaction, db) {
  try {
    const embed = new EmbedBuilder()
      .setTitle("⚙️ Admin Commands - Management Tools")
      .setDescription("Administrative commands for bot management and configuration.\n\n⚠️ These commands require admin permissions.")
      .setColor(db.config?.theme?.danger || "#F44336")
      .addFields(
        {
          name: "🔧 Setup & Configuration",
          value: [
            "`/admin setup` - Initial bot configuration wizard",
            "`/admin configure_donor_roles` - Set up donor role system",
            "`/admin features` - Toggle bot features on/off",
            "`/admin add_recipient` - Add allowed donation recipients",
            "`/admin remove_recipient` - Remove donation recipients"
          ].join("\n"),
          inline: false
        },
        {
          name: "📊 Monitoring & Analytics",
          value: [
            "`/admin dashboard` - View comprehensive admin dashboard",
            "`/admin analytics [type]` - Detailed analytics and statistics",
            "`/admin fix_achievements` - Fix achievement assignments",
            "`/admin clean_recipients` - Clean up recipient list"
          ].join("\n"),
          inline: false
        },
        {
          name: "🎁 Draw Management",
          value: [
            "`/admin create_draw` - Create new donation draws",
            "`/admin edit_draw` - Modify existing draws",
            "`/admin select_winner <draw_id>` - Select draw winners",
            "`/admin assign_entries` - Manually assign draw entries"
          ].join("\n"),
          inline: false
        },
        {
          name: "👥 User Management",
          value: [
            "`/admin blacklist` - Manage blacklisted users",
            "`/admin reset_user` - Reset user data",
            "`/admin bulk_operations` - Perform bulk user operations"
          ].join("\n"),
          inline: false
        }
      )
      .setFooter({ text: "Powered By Aegisum Eco System • Admin Help" })

    // Navigation row
    const navigationRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("help_main_menu")
        .setLabel("Back to Main")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🏠")
    )

    await interaction.update({
      embeds: [embed],
      components: [navigationRow]
    })
  } catch (error) {
    logger.error("Error showing admin commands:", error)
    await interaction.update({
      content: "❌ An error occurred while displaying admin commands.",
      components: [],
      embeds: []
    })
  }
}

async function showAchievementSystem(interaction, db) {
  try {
    const embed = new EmbedBuilder()
      .setTitle("🏆 Achievement System")
      .setDescription("Information about the achievement system and available achievements.")
      .setColor(db.config?.theme?.warning || "#FFC107")
      .addFields(
        {
          name: "Available Achievements",
          value: [
            "**First Steps** - Made your first donation",
            "**Generous Donor** - Donated at least $100",
            "**Big Spender** - Donated at least $500",
            "**Whale** - Donated at least $1,000",
            "**Lucky Winner** - Won a donation draw",
            "**Streak Master** - Maintained a 7-day donation streak",
            "**Community Pillar** - Referred at least 3 other donors"
          ].join("\n"),
          inline: false
        },
        {
          name: "How to Earn Achievements",
          value: [
            "• Achievements are automatically awarded when you meet the criteria",
            "• Use `/user achievements` to view your current achievements",
            "• Some achievements have multiple tiers with increasing rewards",
            "• Achievements may grant special perks or bonus entries"
          ].join("\n"),
          inline: false
        },
        {
          name: "Achievement Benefits",
          value: [
            "• Special roles in the server",
            "• Bonus entries in certain draws",
            "• Recognition on leaderboards",
            "• Exclusive access to special events"
          ].join("\n"),
          inline: false
        }
      )
      .setFooter({ text: "Powered By Aegisum Eco System • Achievement System" })

    // Navigation row
    const navigationRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("help_main_menu")
        .setLabel("Back to Main")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🏠")
    )

    await interaction.update({
      embeds: [embed],
      components: [navigationRow]
    })
  } catch (error) {
    logger.error("Error showing achievement system:", error)
    await interaction.update({
      content: "❌ An error occurred while displaying achievement information.",
      components: [],
      embeds: []
    })
  }
}
