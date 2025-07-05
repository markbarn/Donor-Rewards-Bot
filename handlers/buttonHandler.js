import { MessageFlags } from 'discord.js';
import { isAdmin } from '../utils/permissionUtils.js';
import { getDatabase, saveDatabase } from '../database.js';
import { createAdminDashboard } from '../utils/embedUtils.js';
import { logError, info } from '../utils/logger.js';

// Handle button interactions
export async function handleButtonInteraction(interaction) {
  const { customId, guildId, user } = interaction;
  
  // Extract button action and parameters
  const [action, ...params] = customId.split('_');
  
  try {
    switch (action) {
      case 'edit':
        await handleEditButton(interaction, params);
        break;
      case 'manage':
        await handleManageButton(interaction, params);
        break;
      case 'toggle':
        await handleToggleButton(interaction, params);
        break;
      case 'reset':
        await handleResetButton(interaction, params);
        break;
      case 'draw':
        await handleDrawButton(interaction, params);
        break;
      case 'confirm':
        await handleConfirmButton(interaction, params);
        break;
      case 'cancel':
        await handleCancelButton(interaction, params);
        break;
      case 'page':
        await handlePageButton(interaction, params);
        break;
      case 'refresh':
        await handleRefreshButton(interaction, params);
        break;
      default:
        await interaction.reply({
          content: `Unknown button action: ${action}`,
          flags: MessageFlags.Ephemeral
        });
    }
  } catch (error) {
    logError(`Error handling button interaction ${action}: ${error.message}`);
    
    try {
      await interaction.reply({
        content: 'There was an error processing this button. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    } catch (replyError) {
      logError(`Error sending button error message: ${replyError.message}`);
    }
  }
}

// Handle edit buttons (edit_adminRole, edit_notificationChannel, etc.)
async function handleEditButton(interaction, params) {
  const [target] = params;
  const { guildId, user } = interaction;
  
  // Check if user has admin permissions
  const hasAdminRole = await isAdmin(guildId, user.id);
  if (!hasAdminRole) {
    return interaction.reply({
      content: 'You do not have permission to use this button.',
      flags: MessageFlags.Ephemeral
    });
  }
  
  switch (target) {
    case 'adminRole':
      await interaction.reply({
        content: 'Please use the `/setup` command to update the admin role.',
        flags: MessageFlags.Ephemeral
      });
      break;
    case 'notificationChannel':
      await interaction.reply({
        content: 'Please use the `/setup` command with the notification_channel option to update the notification channel.',
        flags: MessageFlags.Ephemeral
      });
      break;
    default:
      await interaction.reply({
        content: `Unknown edit target: ${target}`,
        flags: MessageFlags.Ephemeral
      });
  }
}

// Handle manage buttons (manage_draws, manage_users, etc.)
async function handleManageButton(interaction, params) {
  const [target] = params;
  const { guildId, user } = interaction;
  
  // Check if user has admin permissions
  const hasAdminRole = await isAdmin(guildId, user.id);
  if (!hasAdminRole) {
    return interaction.reply({
      content: 'You do not have permission to use this button.',
      flags: MessageFlags.Ephemeral
    });
  }
  
  switch (target) {
    case 'draws':
      // Create a management interface for draws
      await interaction.reply({
        content: 'Draw management interface is coming soon. For now, please use the following commands:\n' +
                 '`/create_draw` - Create a new draw\n' +
                 '`/edit_draw` - Edit an existing draw\n' +
                 '`/reset_draw` - Reset entries for a draw\n' +
                 '`/select_winner` - Select a winner from a draw',
        flags: MessageFlags.Ephemeral
      });
      break;
    case 'users':
      await interaction.reply({
        content: 'User management interface is coming soon. For now, please use the following commands:\n' +
                 '`/assign_entries` - Assign entries to a user\n' +
                 '`/blacklist` - Manage blacklisted users',
        flags: MessageFlags.Ephemeral
      });
      break;
    case 'features':
      await interaction.reply({
        content: 'Feature management interface is coming soon. For now, please use the following commands:\n' +
                 '`/feature_toggle_core` - Toggle core features\n' +
                 '`/feature_toggle_advanced` - Toggle advanced features\n' +
                 '`/feature_toggle_extra` - Toggle extra features',
        flags: MessageFlags.Ephemeral
      });
      break;
    default:
      await interaction.reply({
        content: `Unknown management target: ${target}`,
        flags: MessageFlags.Ephemeral
      });
  }
}

// Handle toggle buttons (toggle_feature_X, etc.)
async function handleToggleButton(interaction, params) {
  const [type, id] = params;
  const { guildId, user } = interaction;
  
  // Check if user has admin permissions
  const hasAdminRole = await isAdmin(guildId, user.id);
  if (!hasAdminRole) {
    return interaction.reply({
      content: 'You do not have permission to use this button.',
      flags: MessageFlags.Ephemeral
    });
  }
  
  const db = getDatabase(guildId);
  
  switch (type) {
    case 'feature':
      // Toggle a feature
      if (!db.config.featureToggles) {
        db.config.featureToggles = {};
      }
      
      db.config.featureToggles[id] = !db.config.featureToggles[id];
      saveDatabase(guildId, db);
      
      await interaction.reply({
        content: `Feature "${id}" has been ${db.config.featureToggles[id] ? 'enabled' : 'disabled'}.`,
        flags: MessageFlags.Ephemeral
      });
      break;
    case 'draw':
      // Toggle a draw's active status
      if (!db.donationDraws[id]) {
        return interaction.reply({
          content: `Draw with ID "${id}" not found.`,
          flags: MessageFlags.Ephemeral
        });
      }
      
      db.donationDraws[id].active = !db.donationDraws[id].active;
      saveDatabase(guildId, db);
      
      await interaction.reply({
        content: `Draw "${db.donationDraws[id].name}" has been ${db.donationDraws[id].active ? 'activated' : 'deactivated'}.`,
        flags: MessageFlags.Ephemeral
      });
      break;
    default:
      await interaction.reply({
        content: `Unknown toggle type: ${type}`,
        flags: MessageFlags.Ephemeral
      });
  }
}

// Handle reset buttons (reset_draw_X, etc.)
async function handleResetButton(interaction, params) {
  const [type, id] = params;
  const { guildId, user } = interaction;
  
  // Check if user has admin permissions
  const hasAdminRole = await isAdmin(guildId, user.id);
  if (!hasAdminRole) {
    return interaction.reply({
      content: 'You do not have permission to use this button.',
      flags: MessageFlags.Ephemeral
    });
  }
  
  switch (type) {
    case 'draw':
      // Reset a draw's entries
      await interaction.reply({
        content: `Please use the \`/reset_draw\` command to reset entries for draw "${id}".`,
        flags: MessageFlags.Ephemeral
      });
      break;
    default:
      await interaction.reply({
        content: `Unknown reset type: ${type}`,
        flags: MessageFlags.Ephemeral
      });
  }
}

// Handle draw buttons (draw_X, redraw_X, etc.)
async function handleDrawButton(interaction, params) {
  const [action, id] = params;
  const { guildId, user } = interaction;
  
  // Check if user has admin permissions
  const hasAdminRole = await isAdmin(guildId, user.id);
  if (!hasAdminRole) {
    return interaction.reply({
      content: 'You do not have permission to use this button.',
      flags: MessageFlags.Ephemeral
    });
  }
  
  switch (action) {
    case 'select':
      // Select a winner for a draw
      await interaction.reply({
        content: `Please use the \`/select_winner\` command to select a winner for draw "${id}".`,
        flags: MessageFlags.Ephemeral
      });
      break;
    case 'redraw':
      // Redraw a winner for a draw
      await interaction.reply({
        content: `Please use the \`/select_winner\` command to select a new winner for draw "${id}".`,
        flags: MessageFlags.Ephemeral
      });
      break;
    default:
      await interaction.reply({
        content: `Unknown draw action: ${action}`,
        flags: MessageFlags.Ephemeral
      });
  }
}

// Handle confirm buttons (confirm_reset_X, confirm_delete_X, etc.)
async function handleConfirmButton(interaction, params) {
  const [action, ...actionParams] = params;
  const { guildId, user } = interaction;
  
  // Check if user has admin permissions
  const hasAdminRole = await isAdmin(guildId, user.id);
  if (!hasAdminRole) {
    return interaction.reply({
      content: 'You do not have permission to use this button.',
      flags: MessageFlags.Ephemeral
    });
  }
  
  await interaction.reply({
    content: 'Confirmation actions are not yet implemented.',
    flags: MessageFlags.Ephemeral
  });
}

// Handle cancel buttons (cancel_X, etc.)
async function handleCancelButton(interaction, params) {
  await interaction.deferUpdate().catch(e => {});
  await interaction.editReply({
    content: 'Action cancelled.',
    components: [],
    embeds: []
  }).catch(e => {
    interaction.followUp({
      content: 'Action cancelled.',
      flags: MessageFlags.Ephemeral
    }).catch(e => {});
  });
}

// Handle page buttons (page_next_X, page_prev_X, etc.)
async function handlePageButton(interaction, params) {
  const [direction, view, currentPage] = params;
  
  await interaction.reply({
    content: 'Pagination is not yet implemented.',
    flags: MessageFlags.Ephemeral
  });
}

// Handle refresh buttons (refresh_dashboard, refresh_draws, etc.)
async function handleRefreshButton(interaction, params) {
  const [view] = params;
  const { guildId, user } = interaction;
  
  // Check if user has admin permissions
  const hasAdminRole = await isAdmin(guildId, user.id);
  if (!hasAdminRole) {
    return interaction.reply({
      content: 'You do not have permission to use this button.',
      flags: MessageFlags.Ephemeral
    });
  }
  
  switch (view) {
    case 'dashboard':
      // Refresh the admin dashboard
      const { embed, components } = await createAdminDashboard(guildId);
      await interaction.deferUpdate().catch(e => {});
      await interaction.editReply({ embeds: [embed], components }).catch(e => {
        interaction.followUp({
          content: 'Dashboard refreshed.',
          flags: MessageFlags.Ephemeral
        }).catch(e => {});
      });
      break;
    default:
      await interaction.reply({
        content: `Unknown refresh target: ${view}`,
        flags: MessageFlags.Ephemeral
      });
  }
}
