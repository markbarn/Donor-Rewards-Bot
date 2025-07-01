import { MessageFlags } from 'discord.js';
import { isAdmin } from '../utils/permissionUtils.js';
import { logError } from '../utils/logger.js';

// Handle select menu interactions
export async function handleSelectMenuInteraction(interaction) {
  const { customId, values, guildId, user } = interaction;
  
  // Extract menu action and parameters
  const [action, ...params] = customId.split('_');
  
  try {
    switch (action) {
      case 'select':
        await handleSelectAction(interaction, params, values);
        break;
      case 'filter':
        await handleFilterAction(interaction, params, values);
        break;
      case 'sort':
        await handleSortAction(interaction, params, values);
        break;
      default:
        await interaction.reply({
          content: `Unknown select menu action: ${action}`,
          flags: MessageFlags.Ephemeral
        });
    }
  } catch (error) {
    logError(`Error handling select menu interaction ${action}: ${error.message}`);
    
    try {
      await interaction.reply({
        content: 'There was an error processing this selection. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    } catch (replyError) {
      logError(`Error sending select menu error message: ${replyError.message}`);
    }
  }
}

// Handle select actions (select_draw, select_user, etc.)
async function handleSelectAction(interaction, params, values) {
  const [type] = params;
  const { guildId, user } = interaction;
  
  // Check if user has admin permissions for admin actions
  const isAdminAction = ['draw', 'user', 'feature'].includes(type);
  if (isAdminAction) {
    const hasAdminRole = await isAdmin(guildId, user.id);
    if (!hasAdminRole) {
      return interaction.reply({
        content: 'You do not have permission to use this selection.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
  
  await interaction.reply({
    content: 'Selection actions are not yet implemented.',
    flags: MessageFlags.Ephemeral
  });
}

// Handle filter actions (filter_draws, filter_users, etc.)
async function handleFilterAction(interaction, params, values) {
  const [type] = params;
  
  await interaction.reply({
    content: 'Filter actions are not yet implemented.',
    flags: MessageFlags.Ephemeral
  });
}

// Handle sort actions (sort_draws, sort_users, etc.)
async function handleSortAction(interaction, params, values) {
  const [type] = params;
  
  await interaction.reply({
    content: 'Sort actions are not yet implemented.',
    flags: MessageFlags.Ephemeral
  });
}
