import { MessageFlags } from 'discord.js';
import { isAdmin } from '../utils/permissionUtils.js';
import { logError } from '../utils/logger.js';

// Handle modal submit interactions
export async function handleModalSubmit(interaction) {
  const { customId, guildId, user } = interaction;
  
  // Extract modal action and parameters
  const [action, ...params] = customId.split('_');
  
  try {
    switch (action) {
      case 'create':
        await handleCreateModal(interaction, params);
        break;
      case 'edit':
        await handleEditModal(interaction, params);
        break;
      case 'config':
        await handleConfigModal(interaction, params);
        break;
      default:
        await interaction.reply({
          content: `Unknown modal action: ${action}`,
          flags: MessageFlags.Ephemeral
        });
    }
  } catch (error) {
    logError(`Error handling modal interaction ${action}: ${error.message}`);
    
    try {
      await interaction.reply({
        content: 'There was an error processing your submission. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    } catch (replyError) {
      logError(`Error sending modal error message: ${replyError.message}`);
    }
  }
}

// Handle create modals (create_draw, create_template, etc.)
async function handleCreateModal(interaction, params) {
  const [type] = params;
  const { guildId, user } = interaction;
  
  // Check if user has admin permissions
  const hasAdminRole = await isAdmin(guildId, user.id);
  if (!hasAdminRole) {
    return interaction.reply({
      content: 'You do not have permission to use this form.',
      flags: MessageFlags.Ephemeral
    });
  }
  
  await interaction.reply({
    content: 'Creation forms are not yet implemented.',
    flags: MessageFlags.Ephemeral
  });
}

// Handle edit modals (edit_draw_X, edit_user_X, etc.)
async function handleEditModal(interaction, params) {
  const [type, id] = params;
  const { guildId, user } = interaction;
  
  // Check if user has admin permissions
  const hasAdminRole = await isAdmin(guildId, user.id);
  if (!hasAdminRole) {
    return interaction.reply({
      content: 'You do not have permission to use this form.',
      flags: MessageFlags.Ephemeral
    });
  }
  
  await interaction.reply({
    content: 'Edit forms are not yet implemented.',
    flags: MessageFlags.Ephemeral
  });
}

// Handle config modals (config_notifications, config_theme, etc.)
async function handleConfigModal(interaction, params) {
  const [type] = params;
  const { guildId, user } = interaction;
  
  // Check if user has admin permissions
  const hasAdminRole = await isAdmin(guildId, user.id);
  if (!hasAdminRole) {
    return interaction.reply({
      content: 'You do not have permission to use this form.',
      flags: MessageFlags.Ephemeral
    });
  }
  
  await interaction.reply({
    content: 'Configuration forms are not yet implemented.',
    flags: MessageFlags.Ephemeral
  });
}
