// utils/helpers.js
import { MessageFlags } from 'discord.js';
import { logger } from './logger.js';
import { getDatabase } from '../database.js';

// Function to check if user has admin permissions
export async function isAdmin(serverId, userId, client) {
  // Bot owner always has admin access
  if (userId === process.env.OWNER_ID) return true;
  
  const db = getDatabase(serverId);
  
  // If no admin role is set, only the owner has access
  if (!db.config.adminRoleId) return false;
  
  // Get the guild and member
  const guild = client.guilds.cache.get(serverId);
  if (!guild) return false;
  
  try {
    const member = await guild.members.fetch(userId);
    return member.roles.cache.has(db.config.adminRoleId);
  } catch (error) {
    logger.error(`Error checking admin role: ${error.message}`);
    return false;
  }
}

// Function to check if a feature is enabled
export function isFeatureEnabled(serverId, featureName) {
  const db = getDatabase(serverId);
  return db.config.featureToggles[featureName] === true;
}

// Function to get display name that respects privacy settings
export function getDisplayName(userId, username, db) {
  if (db.config.featureToggles.anonymousMode && db.users[userId] && db.users[userId].privacyEnabled) {
    return '🕶️ Anonymous';
  }
  return username;
}

// Function to handle command errors
export async function handleCommandError(interaction, error, errorMessage = 'There was an error while executing this command!') {
  logger.error(`Command error in ${interaction.commandName}: ${error.message}`);
  logger.error(error.stack);
  
  try {
    if (interaction.replied) {
      await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
    } else if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
    }
  } catch (followUpError) {
    logger.error(`Error sending error message: ${followUpError.message}`);
  }
}

// Function to paginate arrays for embeds
export function paginateArray(array, page, pageSize) {
  const maxPage = Math.ceil(array.length / pageSize);
  if (page < 1) page = 1;
  if (page > maxPage) page = maxPage;
  
  const startIndex = (page - 1) * pageSize;
  return {
    items: array.slice(startIndex, startIndex + pageSize),
    currentPage: page,
    maxPage,
    hasNextPage: page < maxPage,
    hasPrevPage: page > 1
  };
}

// Function to format numbers with commas
export function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Function to format currency
export function formatCurrency(amount) {
  return `$${parseFloat(amount).toFixed(2)}`;
}

// Function to check cooldowns
export function checkCooldown(userId, commandName, cooldownAmount) {
  const timestamps = new Map();
  const now = Date.now();
  const cooldownTime = cooldownAmount * 1000;
  
  if (!timestamps.has(commandName)) {
    timestamps.set(commandName, new Map());
  }
  
  const userTimestamps = timestamps.get(commandName);
  const expirationTime = userTimestamps.get(userId) + cooldownTime;
  
  if (userTimestamps.has(userId) && now < expirationTime) {
    const timeLeft = (expirationTime - now) / 1000;
    return { onCooldown: true, timeLeft };
  }
  
  userTimestamps.set(userId, now);
  setTimeout(() => userTimestamps.delete(userId), cooldownTime);
  
  return { onCooldown: false };
}

// Function to validate and sanitize input
export function sanitizeInput(input, maxLength = 100) {
  if (!input) return '';
  
  // Trim and limit length
  let sanitized = input.trim().substring(0, maxLength);
  
  // Remove potentially dangerous characters
  sanitized = sanitized.replace(/[^\w\s\-_.]/g, '');
  
  return sanitized;
}

// Function to generate a random ID
export function generateId(length = 8) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Function to check if a string is a valid date
export function isValidDate(dateString) {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

// Function to check if a user is in a server
export async function isUserInServer(userId, serverId, client) {
  try {
    const guild = client.guilds.cache.get(serverId);
    if (!guild) return false;
    
    const member = await guild.members.fetch(userId);
    return !!member;
  } catch (error) {
    return false;
  }
}
