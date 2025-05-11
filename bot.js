import { Client, GatewayIntentBits, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ApplicationCommandOptionType } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCryptoPrice } from './crypto-price-api.js';

// Load environment variables
dotenv.config();

// Get directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const OWNER_ID = process.env.OWNER_ID || '659745190382141453'; // Default owner ID
const TIP_BOT_ID = '617037497574359050'; // tip.cc bot ID
const SERVER_IDS = process.env.SERVER_IDS ? process.env.SERVER_IDS.split(',') : [];
const ADMIN_ROLE_NAME = 'Donor Manager'; // Name for the admin role
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || null; // Channel for detailed logs

// Initial list of accepted cryptocurrencies
const DEFAULT_ACCEPTED_CRYPTOCURRENCIES = [
  'AEGS', 'LTC', 'SOL', 'USDT', 'BTC', 'XRP', 'DOGE', 'SHIB', 'SHIC', 
  'BNB', 'USDC', 'ETH', 'XLA', 'ADA', 'AVAX', 'TON', 'TRON', 'PEP', 'BONC'
];

// Donor role configuration - updated to match the provided roles
const DONOR_ROLES = {
  'onyx_donor': { minAmount: 500, id: '1357183499185950882', name: 'Onyx Donor' },
  'diamond_donor': { minAmount: 251, maxAmount: 500, id: '1341176124020883496', name: 'Diamond Donor' },
  'platinum_donor': { minAmount: 101, maxAmount: 250, id: '1341175847280971907', name: 'Platinum Donor' },
  'gold_donor': { minAmount: 51, maxAmount: 100, id: '1341175703659348059', name: 'Gold Donor' },
  'silver_donor': { minAmount: 26, maxAmount: 50, id: '1341175633866391684', name: 'Silver Donor' },
  'bronze_donor': { minAmount: 5, maxAmount: 25, id: '1341175531932221471', name: 'Bronze Donor' }
};

console.log(`Bot configured for servers: ${SERVER_IDS.join(', ')}`);

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Database functions - now with per-server files
function getDatabase(serverId) {
  const dbFile = path.join(DATA_DIR, `${serverId}.json`);
  
  // Create default database if it doesn't exist
  if (!fs.existsSync(dbFile)) {
    const defaultData = {
      donationDraws: {
        'small': { 
          name: 'Small Appreciation Draw', 
          minAmount: 5, 
          maxAmount: 19.99, 
          entries: {},
          reward: '10 USDT',
          maxEntries: 100,
          active: true,
          drawTime: null,
          drawTimeFormatted: null,
          notificationSent: false
        },
        'medium': { 
          name: 'Medium Appreciation Draw', 
          minAmount: 20, 
          maxAmount: 49.99, 
          entries: {},
          reward: '50 USDT',
          maxEntries: 50,
          active: true,
          drawTime: null,
          drawTimeFormatted: null,
          notificationSent: false
        },
        'large': { 
          name: 'Large Appreciation Draw', 
          minAmount: 50, 
          maxAmount: 1000000, 
          entries: {},
          reward: '200 USDT',
          maxEntries: 20,
          active: true,
          drawTime: null,
          drawTimeFormatted: null,
          notificationSent: false
        }
      },
      users: {},
      config: {
        allowedRecipients: [],
        adminRoleId: null,
        notificationChannelId: null,
        logChannelId: null,
        acceptedCryptocurrencies: DEFAULT_ACCEPTED_CRYPTOCURRENCIES
      },
      pendingTips: {},
      drawHistory: []
    };
    
    fs.writeFileSync(dbFile, JSON.stringify(defaultData, null, 2));
    console.log(`Created default database file for server ${serverId}`);
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    
    // Handle migration from old format if needed
    if (data.raffles && !data.donationDraws) {
      data.donationDraws = data.raffles;
      delete data.raffles;
      
      // Update terminology in the draws
      for (const drawId in data.donationDraws) {
        const draw = data.donationDraws[drawId];
        if (draw.prize !== undefined && draw.reward === undefined) {
          draw.reward = draw.prize;
          delete draw.prize;
        }
        if (draw.maxTickets !== undefined && draw.maxEntries === undefined) {
          draw.maxEntries = draw.maxTickets;
          delete draw.maxTickets;
        }
      }
    }
    
    // Add new fields if they don't exist (for backward compatibility)
    if (!data.pendingTips) {
      data.pendingTips = {};
    }
    
    if (!data.drawHistory && data.raffleHistory) {
      data.drawHistory = data.raffleHistory;
      delete data.raffleHistory;
    } else if (!data.drawHistory) {
      data.drawHistory = [];
    }
    
    // Add draw time fields to donation draws if they don't exist
    for (const drawId in data.donationDraws) {
      if (!data.donationDraws[drawId].drawTime) {
        data.donationDraws[drawId].drawTime = null;
      }
      if (!data.donationDraws[drawId].drawTimeFormatted) {
        data.donationDraws[drawId].drawTimeFormatted = null;
      }
      if (!data.donationDraws[drawId].notificationSent) {
        data.donationDraws[drawId].notificationSent = false;
      }
    }
    
    // Add notification channel if it doesn't exist
    if (!data.config.notificationChannelId) {
      data.config.notificationChannelId = null;
    }
    
    // Add log channel if it doesn't exist
    if (!data.config.logChannelId) {
      data.config.logChannelId = null;
    }
    
    // Add accepted cryptocurrencies if it doesn't exist
    if (!data.config.acceptedCryptocurrencies) {
      data.config.acceptedCryptocurrencies = DEFAULT_ACCEPTED_CRYPTOCURRENCIES;
    }
    
    return data;
  } catch (error) {
    console.error(`Error reading database for server ${serverId}:`, error);
    return {
      donationDraws: {},
      users: {},
      config: {
        allowedRecipients: [],
        adminRoleId: null,
        notificationChannelId: null,
        logChannelId: null,
        acceptedCryptocurrencies: DEFAULT_ACCEPTED_CRYPTOCURRENCIES
      },
      pendingTips: {},
      drawHistory: []
    };
  }
}

function saveDatabase(serverId, data) {
  const dbFile = path.join(DATA_DIR, `${serverId}.json`);
  
  try {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error saving database for server ${serverId}:`, error);
    return false;
  }
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Function to send logs to a specific channel
async function sendLogMessage(serverId, message) {
  // Check for global log channel first
  let logChannelId = LOG_CHANNEL_ID;
  
  // If no global log channel, check server-specific log channel
  if (!logChannelId) {
    const db = getDatabase(serverId);
    logChannelId = db.config.logChannelId;
  }
  
  if (!logChannelId) return;

  try {
    const guild = client.guilds.cache.get(serverId);
    if (!guild) return;
    
    const channel = guild.channels.cache.get(logChannelId);
    if (!channel) return;
    
    await channel.send(`[LOG] ${message}`);
  } catch (error) {
    console.error('Error sending log message:', error);
  }
}

// Function to check if user has admin permissions
async function isAdmin(serverId, userId) {
  // Bot owner always has admin access
  if (userId === OWNER_ID) return true;
  
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
    console.error('Error checking admin role:', error);
    return false;
  }
}

// Function to update donor roles based on total donation amount
async function updateDonorRoles(serverId, userId, username, totalDonated) {
  const guild = client.guilds.cache.get(serverId);
  if (!guild) return;
  
  try {
    // Get the member
    const member = await guild.members.fetch(userId);
    if (!member) return;
    
    // Determine which donor role the user should have
    let targetRoleId = null;
    let targetRoleName = null;
    
    // Sort roles by minimum amount in descending order
    const sortedRoles = Object.values(DONOR_ROLES)
      .sort((a, b) => b.minAmount - a.minAmount);
    
    for (const role of sortedRoles) {
      if (totalDonated >= role.minAmount && 
          (!role.maxAmount || totalDonated <= role.maxAmount)) {
        targetRoleId = role.id;
        targetRoleName = role.name;
        break;
      }
    }
    
    if (!targetRoleId) return; // No matching role
    
    // Get all donor role IDs
    const donorRoleIds = Object.values(DONOR_ROLES).map(r => r.id);
    
    // Remove all existing donor roles
    for (const roleId of donorRoleIds) {
      if (member.roles.cache.has(roleId) && roleId !== targetRoleId) {
        try {
          await member.roles.remove(roleId);
          console.log(`Removed role ${roleId} from ${username}`);
        } catch (error) {
          console.error(`Error removing role ${roleId} from ${username}:`, error);
        }
      }
    }
    
    // Add the target role if they don't have it
    if (!member.roles.cache.has(targetRoleId)) {
      try {
        await member.roles.add(targetRoleId);
        console.log(`Added ${targetRoleName} role to ${username}`);
        return targetRoleName;
      } catch (error) {
        console.error(`Error adding ${targetRoleName} role to ${username}:`, error);
      }
    }
  } catch (error) {
    console.error(`Error updating donor roles for ${username}:`, error);
  }
  
  return null;
}

// Function to find the cheapest eligible draw for a donation
function findCheapestEligibleDraw(db, amountUsd) {
  // Get all active draws
  const activeDraws = Object.entries(db.donationDraws)
    .filter(([_, draw]) => draw.active)
    .filter(([_, draw]) => amountUsd >= draw.minAmount && amountUsd <= draw.maxAmount)
    .sort((a, b) => a[1].minAmount - b[1].minAmount);
  
  // Return the cheapest draw ID or null if none found
  return activeDraws.length > 0 ? activeDraws[0][0] : null;
}

// Function to add donation draw entries
async function addDonationEntries(serverId, userId, username, amountUsd, targetDrawId = null) {
  const db = getDatabase(serverId);
  
  // Initialize user if they don't exist
  if (!db.users[userId]) {
    db.users[userId] = {
      username,
      totalDonated: 0,
      entries: {}
    };
  }
  
  // Update user's total donated amount
  db.users[userId].totalDonated += amountUsd;
  const totalDonated = db.users[userId].totalDonated;
  
  // Update donor roles based on total donation amount
  const newRole = await updateDonorRoles(serverId, userId, username, totalDonated);
  
  // Track which draws the user entered and how many entries
  const enteredDraws = [];
  
  // If no specific draw ID was provided, find the cheapest eligible draw
  if (!targetDrawId) {
    targetDrawId = findCheapestEligibleDraw(db, amountUsd);
    console.log(`Auto-selected draw ID: ${targetDrawId} for $${amountUsd} donation`);
  }
  
  // If a specific draw ID was provided or auto-selected, only enter that draw
  if (targetDrawId && db.donationDraws[targetDrawId]) {
    const draw = db.donationDraws[targetDrawId];
    
    // Skip inactive draws
    if (!draw.active) {
      console.log(`Draw ${targetDrawId} is inactive`);
      return { enteredDraws, totalDonated, newRole };
    }
    
    // Calculate number of entries based on the draw's minAmount
    const entryCount = Math.floor(amountUsd / draw.minAmount);
    
    if (entryCount > 0) {
      // Initialize entries for this draw if they don't exist
      if (!db.users[userId].entries[targetDrawId]) {
        db.users[userId].entries[targetDrawId] = 0;
      }
      if (!db.donationDraws[targetDrawId].entries[userId]) {
        db.donationDraws[targetDrawId].entries[userId] = 0;
      }
      
      // Check if adding these entries would exceed the max entries
      const currentTotalEntries = Object.values(db.donationDraws[targetDrawId].entries).reduce((sum, count) => sum + count, 0);
      const availableEntries = draw.maxEntries - currentTotalEntries;
      const entriesToAdd = Math.min(entryCount, availableEntries);
      
      if (entriesToAdd > 0) {
        // Add entries
        db.users[userId].entries[targetDrawId] += entriesToAdd;
        db.donationDraws[targetDrawId].entries[userId] += entriesToAdd;
        
        enteredDraws.push({
          drawId: targetDrawId,
          drawName: draw.name,
          entryCount: entriesToAdd,
          isFull: entriesToAdd < entryCount,
          minAmount: draw.minAmount
        });
        
        console.log(`Added ${entriesToAdd} entries for ${username} to ${draw.name} in server ${serverId}`);
      } else {
        enteredDraws.push({
          drawId: targetDrawId,
          drawName: draw.name,
          entryCount: 0,
          isFull: true,
          minAmount: draw.minAmount
        });
      }
    }
  } else if (!targetDrawId) {
    // No specific draw ID provided and no eligible draw found, enter all eligible draws
    for (const [drawId, draw] of Object.entries(db.donationDraws)) {
      // Skip inactive draws
      if (!draw.active) continue;
      
      if (amountUsd >= draw.minAmount && amountUsd <= draw.maxAmount) {
        // Calculate number of entries (1 entry per minAmount)
        const entryCount = Math.floor(amountUsd / draw.minAmount);
        
        // Initialize entries for this draw if they don't exist
        if (!db.users[userId].entries[drawId]) {
          db.users[userId].entries[drawId] = 0;
        }
        if (!db.donationDraws[drawId].entries[userId]) {
          db.donationDraws[drawId].entries[userId] = 0;
        }
        
        // Check if adding these entries would exceed the max entries
        const currentTotalEntries = Object.values(db.donationDraws[drawId].entries).reduce((sum, count) => sum + count, 0);
        const availableEntries = draw.maxEntries - currentTotalEntries;
        const entriesToAdd = Math.min(entryCount, availableEntries);
        
        if (entriesToAdd > 0) {
          // Add entries
          db.users[userId].entries[drawId] += entriesToAdd;
          db.donationDraws[drawId].entries[userId] += entriesToAdd;
          
          enteredDraws.push({
            drawId,
            drawName: draw.name,
            entryCount: entriesToAdd,
            isFull: entriesToAdd < entryCount,
            minAmount: draw.minAmount
          });
          
          console.log(`Added ${entriesToAdd} entries for ${username} to ${draw.name} in server ${serverId}`);
        } else {
          enteredDraws.push({
            drawId,
            drawName: draw.name,
            entryCount: 0,
            isFull: true,
            minAmount: draw.minAmount
          });
        }
      }
    }
  }
  
  saveDatabase(serverId, db);
  return { enteredDraws, totalDonated, newRole };
}

// Function to manually assign entries
async function manuallyAssignEntries(serverId, userId, drawId, entryCount, amountUsd) {
  const db = getDatabase(serverId);
  
  // Check if draw exists
  if (!db.donationDraws[drawId]) {
    return { success: false, message: `Draw with ID "${drawId}" not found.` };
  }
  
  // Check if draw is active
  if (!db.donationDraws[drawId].active) {
    return { success: false, message: `Draw "${db.donationDraws[drawId].name}" is inactive.` };
  }
  
  // Get user from database or fetch from Discord
  let username = 'Unknown';
  if (db.users[userId]) {
    username = db.users[userId].username;
  } else {
    try {
      const guild = client.guilds.cache.get(serverId);
      if (guild) {
        const member = await guild.members.fetch(userId);
        if (member) {
          username = member.user.username;
        }
      }
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error);
    }
  }
  
  // Initialize user if they don't exist
  if (!db.users[userId]) {
    db.users[userId] = {
      username,
      totalDonated: 0,
      entries: {}
    };
  }
  
  // Update user's total donated amount if specified
  if (amountUsd > 0) {
    db.users[userId].totalDonated += amountUsd;
    
    // Update donor roles based on total donation amount
    await updateDonorRoles(serverId, userId, username, db.users[userId].totalDonated);
  }
  
  // Initialize entries for this draw if they don't exist
  if (!db.users[userId].entries[drawId]) {
    db.users[userId].entries[drawId] = 0;
  }
  if (!db.donationDraws[drawId].entries[userId]) {
    db.donationDraws[drawId].entries[userId] = 0;
  }
  
  // Check if adding these entries would exceed the max entries
  const currentTotalEntries = Object.values(db.donationDraws[drawId].entries).reduce((sum, count) => sum + count, 0);
  const availableEntries = db.donationDraws[drawId].maxEntries - currentTotalEntries;
  const entriesToAdd = Math.min(entryCount, availableEntries);
  
  if (entriesToAdd <= 0) {
    return { success: false, message: `No entries could be added. The draw "${db.donationDraws[drawId].name}" is full.` };
  }
  
  // Add entries
  db.users[userId].entries[drawId] += entriesToAdd;
  db.donationDraws[drawId].entries[userId] += entriesToAdd;
  
  saveDatabase(serverId, db);
  
  return { 
    success: true, 
    message: `Successfully added ${entriesToAdd} entries for <@${userId}> to "${db.donationDraws[drawId].name}".`,
    entriesAdded: entriesToAdd,
    totalEntries: db.users[userId].entries[drawId],
    totalDonated: db.users[userId].totalDonated
  };
}

// Helper function to format date
function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

// Register slash commands when the bot starts
client.once(Events.ClientReady, async () => {
  console.log(`Ready! Logged in as ${client.user.tag}`);
  
  try {
    const commands = [
      {
        name: 'setup',
        description: 'Initial setup for the Donor Rewards bot',
        options: [
          {
            name: 'admin_role',
            description: 'Set the admin role for donation management',
            type: ApplicationCommandOptionType.Role,
            required: true
          },
          {
            name: 'notification_channel',
            description: 'Set the channel for donation notifications',
            type: ApplicationCommandOptionType.Channel,
            required: false
          }
        ]
      },
      {
        name: 'admin',
        description: 'Access admin dashboard'
      },
      {
        name: 'add_recipient',
        description: 'Add a user or role as an allowed donation recipient',
        options: [
          {
            name: 'recipient',
            description: 'The user or role to add as a recipient',
            type: ApplicationCommandOptionType.Mentionable,
            required: true
          }
        ]
      },
      {
        name: 'remove_recipient',
        description: 'Remove a user or role from allowed donation recipients',
        options: [
          {
            name: 'recipient',
            description: 'The user or role to remove',
            type: ApplicationCommandOptionType.Mentionable,
            required: true
          }
        ]
      },
      {
        name: 'create_draw',
        description: 'Create a new donation appreciation draw',
        options: [
          {
            name: 'id',
            description: 'Unique ID for the draw (no spaces)',
            type: ApplicationCommandOptionType.String,
            required: true
          },
          {
            name: 'name',
            description: 'Display name for the draw',
            type: ApplicationCommandOptionType.String,
            required: true
          },
          {
            name: 'min_amount',
            description: 'Minimum USD donation amount to enter',
            type: ApplicationCommandOptionType.Number,
            required: true
          },
          {
            name: 'max_amount',
            description: 'Maximum USD donation amount to enter (0 for no limit)',
            type: ApplicationCommandOptionType.Number,
            required: true
          },
          {
            name: 'reward',
            description: 'Reward description (e.g., "100 USDT")',
            type: ApplicationCommandOptionType.String,
            required: true
          },
          {
            name: 'max_entries',
            description: 'Maximum number of entries available',
            type: ApplicationCommandOptionType.Integer,
            required: true
          }
        ]
      },
      {
        name: 'edit_draw',
        description: 'Edit an existing donation draw',
        options: [
          {
            name: 'id',
            description: 'ID of the draw to edit',
            type: ApplicationCommandOptionType.String,
            required: true
          },
          {
            name: 'name',
            description: 'New display name',
            type: ApplicationCommandOptionType.String,
            required: false
          },
          {
            name: 'min_amount',
            description: 'New minimum USD donation amount',
            type: ApplicationCommandOptionType.Number,
            required: false
          },
          {
            name: 'max_amount',
            description: 'New maximum USD donation amount (0 for no limit)',
            type: ApplicationCommandOptionType.Number,
            required: false
          },
          {
            name: 'reward',
            description: 'New reward description',
            type: ApplicationCommandOptionType.String,
            required: false
          },
          {
            name: 'max_entries',
            description: 'New maximum entries',
            type: ApplicationCommandOptionType.Integer,
            required: false
          },
          {
            name: 'active',
            description: 'Set draw active status',
            type: ApplicationCommandOptionType.Boolean,
            required: false
          }
        ]
      },
      {
        name: 'select_winner',
        description: 'Select a winner from a donation draw',
        options: [
          {
            name: 'draw_id',
            description: 'ID of the draw to select from',
            type: ApplicationCommandOptionType.String,
            required: true
          }
        ]
      },
      {
        name: 'reset_draw',
        description: 'Reset entries for a donation draw',
        options: [
          {
            name: 'draw_id',
            description: 'ID of the draw to reset',
            type: ApplicationCommandOptionType.String,
            required: true
          }
        ]
      },
      {
        name: 'entries',
        description: 'Check your donation draw entries'
      },
      {
        name: 'draws',
        description: 'Show available donation draws'
      },
      {
        name: 'draw_ids',
        description: 'Show all draw IDs for donating'
      },
      {
        name: 'leaderboard',
        description: 'Show top donors',
        options: [
          {
            name: 'limit',
            description: 'Number of users to show (default: 10)',
            type: ApplicationCommandOptionType.Integer,
            required: false
          }
        ]
      },
      {
        name: 'reset_leaderboard',
        description: 'Reset the donation leaderboard',
        options: [
          {
            name: 'confirm',
            description: 'Type "confirm" to reset the leaderboard (this cannot be undone)',
            type: ApplicationCommandOptionType.String,
            required: true
          }
        ]
      },
      {
        name: 'donate',
        description: 'Instructions for donating to support development',
        options: [
          {
            name: 'draw_id',
            description: 'ID of the specific draw to enter',
            type: ApplicationCommandOptionType.String,
            required: false
          }
        ]
      },
      {
        name: 'help',
        description: 'Shows how to use the donation rewards system'
      },
      {
        name: 'terms',
        description: 'Shows the terms and conditions for the donation system'
      },
      {
        name: 'donor_roles',
        description: 'Shows information about donor roles and benefits'
      },
      // Commands for scheduled draws
      {
        name: 'schedule_draw',
        description: 'Schedule a donation draw',
        options: [
          {
            name: 'draw_id',
            description: 'ID of the draw to schedule',
            type: ApplicationCommandOptionType.String,
            required: true
          },
          {
            name: 'days',
            description: 'Days from now',
            type: ApplicationCommandOptionType.Integer,
            required: false
          },
          {
            name: 'hours',
            description: 'Hours from now',
            type: ApplicationCommandOptionType.Integer,
            required: false
          },
          {
            name: 'minutes',
            description: 'Minutes from now',
            type: ApplicationCommandOptionType.Integer,
            required: false
          }
        ]
      },
      {
        name: 'cancel_draw',
        description: 'Cancel a scheduled donation draw',
        options: [
          {
            name: 'draw_id',
            description: 'ID of the draw',
            type: ApplicationCommandOptionType.String,
            required: true
          }
        ]
      },
      {
        name: 'scheduled_draws',
        description: 'Show all scheduled donation draws'
      },
      {
        name: 'draw_history',
        description: 'Show history of past donation draws',
        options: [
          {
            name: 'limit',
            description: 'Number of past draws to show (default: 5)',
            type: ApplicationCommandOptionType.Integer,
            required: false
          }
        ]
      },
      {
        name: 'set_notification_channel',
        description: 'Set the channel for donation draw notifications',
        options: [
          {
            name: 'channel',
            description: 'The channel to send notifications to',
            type: ApplicationCommandOptionType.Channel,
            required: true
          }
        ]
      },
      {
        name: 'set_log_channel',
        description: 'Set the channel for detailed donation logs',
        options: [
          {
            name: 'channel',
            description: 'The channel to send logs to',
            type: ApplicationCommandOptionType.Channel,
            required: true
          }
        ]
      },
      {
        name: 'accepted_coins',
        description: 'Show the list of accepted cryptocurrencies'
      },
      // New commands for managing cryptocurrencies and manual entries
      {
        name: 'add_cryptocurrency',
        description: 'Add a cryptocurrency to the accepted list',
        options: [
          {
            name: 'symbol',
            description: 'Symbol of the cryptocurrency (e.g., BTC, ETH)',
            type: ApplicationCommandOptionType.String,
            required: true
          }
        ]
      },
      {
        name: 'remove_cryptocurrency',
        description: 'Remove a cryptocurrency from the accepted list',
        options: [
          {
            name: 'symbol',
            description: 'Symbol of the cryptocurrency (e.g., BTC, ETH)',
            type: ApplicationCommandOptionType.String,
            required: true
          }
        ]
      },
      {
        name: 'assign_entries',
        description: 'Manually assign entries to a user',
        options: [
          {
            name: 'user',
            description: 'The user to assign entries to',
            type: ApplicationCommandOptionType.User,
            required: true
          },
          {
            name: 'draw_id',
            description: 'ID of the draw to assign entries for',
            type: ApplicationCommandOptionType.String,
            required: true
          },
          {
            name: 'entries',
            description: 'Number of entries to assign',
            type: ApplicationCommandOptionType.Integer,
            required: true
          },
          {
            name: 'donation_amount',
            description: 'USD amount to add to user\'s total (0 to not affect total)',
            type: ApplicationCommandOptionType.Number,
            required: false
          }
        ]
      }
    ];
    
    // Register commands globally instead of per-server
    console.log('Registering global commands...');
    await client.application.commands.set(commands);
    console.log('Successfully registered global commands');
    
    // Delete any existing guild commands to avoid duplicates
    for (const serverId of SERVER_IDS) {
      try {
        const guild = client.guilds.cache.get(serverId);
        if (guild) {
          console.log(`Removing guild-specific commands from: ${guild.name} (${guild.id})`);
          await guild.commands.set([]);
          console.log(`Successfully removed guild-specific commands from: ${guild.name}`);
        }
      } catch (error) {
        console.error(`Error removing guild commands for guild ${serverId}:`, error);
      }
    }
    
    // Start the scheduled draw checker
    startScheduledDrawChecker();
    
  } catch (error) {
    console.error('Error registering slash commands:', error);
  }
});

// Function to check for scheduled draws
function startScheduledDrawChecker() {
  // Check every minute
  setInterval(async () => {
    const now = Date.now();
    
    // Check each server
    for (const serverId of SERVER_IDS) {
      try {
        const db = getDatabase(serverId);
        let dbUpdated = false;
        
        // Check each draw
        for (const [drawId, draw] of Object.entries(db.donationDraws)) {
          // Skip if no draw time or not active
          if (!draw.drawTime || !draw.active) continue;
          
          const drawTime = parseInt(draw.drawTime);
          
          // Check for upcoming draws (1 hour before) to send notifications
          const oneHourBefore = drawTime - (60 * 60 * 1000);
          
          if (now >= oneHourBefore && !draw.notificationSent && db.config.notificationChannelId) {
            // Send notification
            const guild = client.guilds.cache.get(serverId);
            if (guild) {
              const channel = guild.channels.cache.get(db.config.notificationChannelId);
              if (channel) {
                try {
                  const embed = new EmbedBuilder()
                    .setTitle('Donation Draw Soon!')
                    .setDescription(`The **${draw.name}** draw will be held in about 1 hour!`)
                    .setColor('#FFA500')
                    .addFields(
                      { name: 'Reward', value: draw.reward },
                      { name: 'Drawing at', value: draw.drawTimeFormatted },
                      { name: 'Last Chance!', value: 'Make your donations now to be included in this draw!' }
                    );
                  
                  await channel.send({ embeds: [embed] });
                  console.log(`Sent notification for upcoming draw ${drawId} in server ${serverId}`);
                  
                  // Mark notification as sent
                  draw.notificationSent = true;
                  dbUpdated = true;
                } catch (error) {
                  console.error(`Error sending notification for draw ${drawId}:`, error);
                }
              }
            }
          }
          
          // If it's time to draw
          if (now >= drawTime) {
            console.log(`Time to select winner for draw ${drawId} in server ${serverId}`);
            
            // Get the guild
            const guild = client.guilds.cache.get(serverId);
            if (guild) {
              // Find the notification channel or a suitable channel
              let channel;
              
              if (db.config.notificationChannelId) {
                channel = guild.channels.cache.get(db.config.notificationChannelId);
              }
              
              if (!channel) {
                // Fallback to a channel with "donation" or "announcement" in the name
                channel = guild.channels.cache.find(c => 
                  c.name.includes('donation') || c.name.includes('announcement')
                ) || guild.systemChannel;
              }
              
              if (channel) {
                // Select the winner
                await selectDrawWinner(drawId, serverId, channel);
                
                // Reset the draw time and notification status
                draw.drawTime = null;
                draw.drawTimeFormatted = null;
                draw.notificationSent = false;
                dbUpdated = true;
              }
            }
          }
        }
        
        // Save the database if any changes were made
        if (dbUpdated) {
          saveDatabase(serverId, db);
        }
      } catch (error) {
        console.error(`Error checking scheduled draws for server ${serverId}:`, error);
      }
    }
  }, 60000); // Check every minute
  
  console.log('Started scheduled draw checker');
}

// Function to select a draw winner
async function selectDrawWinner(drawId, serverId, channel) {
  const db = getDatabase(serverId);
  
  // Check if draw exists
  if (!db.donationDraws[drawId]) {
    console.error(`Draw ${drawId} not found in server ${serverId}`);
    return false;
  }
  
  const draw = db.donationDraws[drawId];
  const entries = draw.entries;
  
  if (!entries || Object.keys(entries).length === 0) {
    // No entries
    const noEntriesEmbed = new EmbedBuilder()
      .setTitle(`${draw.name} - No Winner`)
      .setDescription(`There were no entries in this donation draw.`)
      .setColor('#FF0000')
      .setTimestamp();
    
    await channel.send({ embeds: [noEntriesEmbed] });
    return false;
  }
  
  // Create weighted entries array
  const weightedEntries = [];
  for (const [userId, count] of Object.entries(entries)) {
    for (let i = 0; i < count; i++) {
      weightedEntries.push(userId);
    }
  }
  
  if (weightedEntries.length === 0) {
    // No valid entries
    const noValidEntriesEmbed = new EmbedBuilder()
      .setTitle(`${draw.name} - No Winner`)
      .setDescription(`There were no valid entries in this donation draw.`)
      .setColor('#FF0000')
      .setTimestamp();
    
    await channel.send({ embeds: [noValidEntriesEmbed] });
    return false;
  }
  
  // Draw a random winner
  const winnerIndex = Math.floor(Math.random() * weightedEntries.length);
  const winnerId = weightedEntries[winnerIndex];
  const winnerUsername = db.users[winnerId]?.username || 'Unknown';
  
  const embed = new EmbedBuilder()
    .setTitle(`${draw.name} Winner!`)
    .setDescription(`Congratulations to <@${winnerId}> (${winnerUsername})!`)
    .addFields(
      { name: 'Reward', value: draw.reward },
      { name: 'Winning Odds', value: `${entries[winnerId]} out of ${weightedEntries.length} entries (${((entries[winnerId] / weightedEntries.length) * 100).toFixed(2)}%)` }
    )
    .setColor('#FFD700')
    .setTimestamp();
  
  // Add buttons for admin actions
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`reset_${drawId}_${serverId}`)
        .setLabel('Reset Draw')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`redraw_${drawId}_${serverId}`)
        .setLabel('Select Again')
        .setStyle(ButtonStyle.Secondary)
    );
  
  await channel.send({ embeds: [embed], components: [row] });
  
  // Add to draw history
  if (!db.drawHistory) {
    db.drawHistory = [];
  }
  
  db.drawHistory.push({
    drawId,
    drawName: draw.name,
    drawTime: Date.now(),
    winnerId,
    winnerUsername,
    reward: draw.reward,
    totalEntries: weightedEntries.length,
    winnerEntries: entries[winnerId]
  });
  
  // Keep history limited to last 50 draws
  if (db.drawHistory.length > 50) {
    db.drawHistory = db.drawHistory.slice(-50);
  }
  
  saveDatabase(serverId, db);
  return true;
}

// Track pending tips
// Format: { messageId: { senderId, targetDrawId, timestamp } }
const pendingTips = new Map();

// Listen for messages to detect tip commands and tip.cc transactions
client.on(Events.MessageCreate, async (message) => {
  // Skip bot messages except from tip.cc
  if (message.author.bot && message.author.id !== TIP_BOT_ID) return;
  
  // Only process messages in configured servers
  if (!message.guild || !SERVER_IDS.includes(message.guild.id)) return;
  
  // Check if this is a tip command from a user (not a bot)
  if (!message.author.bot) {
    // Look for tip commands with draw ID
    // Format: $tip @user amount #drawID
    const tipCommandRegex = /\$tip\s+<@!?(\d+)>\s+(.+?)(?:\s+#(\w+))?$/i;
    const tipMatch = message.content.match(tipCommandRegex);
    
    if (tipMatch) {
      const [, recipientId, amountText, drawId] = tipMatch;
      
      // Store the pending tip with the draw ID
      pendingTips.set(message.id, {
        senderId: message.author.id,
        recipientId,
        targetDrawId: drawId?.toLowerCase(),
        timestamp: Date.now(),
        channelId: message.channel.id
      });
      
      console.log(`Detected tip command with${drawId ? ' draw ID #' + drawId : 'out draw ID'}`);
      
      // Clean up old pending tips (older than 5 minutes)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      for (const [key, value] of pendingTips.entries()) {
        if (value.timestamp < fiveMinutesAgo) {
          pendingTips.delete(key);
        }
      }
    }
    
    return;
  }
  
  // From here, we're only processing tip.cc bot messages
  if (message.author.id !== TIP_BOT_ID) return;
  
  console.log(`Received message from tip.cc in server ${message.guild.id}: ${message.content}`);
  
  // Check for tip error messages
  if (message.content.includes('Tip error') || (message.embeds.length > 0 && message.embeds[0].title === 'Tip error')) {
    console.log('Detected tip error message');
    return;
  }
  
  // Check if this is a tip confirmation message
  // Support multiple tip.cc message formats
  // IMPORTANT: We're using simple string patterns instead of complex regex to avoid syntax issues
  const isTipMessage = (
    message.content.includes('tipped') || 
    message.content.includes('sent')
  ) && message.mentions.users.size >= 2;
  
  if (isTipMessage) {
    try {
      // Extract sender and receiver IDs from mentions
      const mentionedUsers = Array.from(message.mentions.users.values());
      if (mentionedUsers.length < 2) return;
      
      const senderId = mentionedUsers[0].id;
      const receiverId = mentionedUsers[1].id;
      
      // Extract cryptocurrency amount and symbol
      // This regex looks for patterns like "0.0600 USDT" or "100.00 BONC"
      const cryptoPattern = /(\d+(?:,\d+)*(?:\.\d+)?)\s+([A-Z]+)/i;
      const cryptoMatch = message.content.match(cryptoPattern);
      
      if (!cryptoMatch || cryptoMatch.length < 3) {
        console.log('Could not extract crypto amount and symbol from tip message');
        return;
      }
      
      // Extract the amount and symbol
      let cryptoAmount = cryptoMatch[1].replace(/,/g, ''); // Remove commas
      let cryptoSymbol = cryptoMatch[2].toUpperCase();
      const originalAmount = cryptoMatch[1];
      const originalSymbol = cryptoMatch[2];
      
      // Convert to number
      cryptoAmount = parseFloat(cryptoAmount);
      
      // Get database for this server
      const db = getDatabase(message.guild.id);
      
      // Special handling for satoshi (convert to BTC)
      let isSatoshi = false;
      if (cryptoSymbol === 'SATOSHI') {
        isSatoshi = true;
        cryptoSymbol = 'BTC';
        cryptoAmount = cryptoAmount / 100000000; // Convert satoshi to BTC
        console.log(`Converted ${originalAmount} SATOSHI to ${cryptoAmount} BTC`);
      }
      
      // Check if the cryptocurrency is in the accepted list
      if (!db.config.acceptedCryptocurrencies.includes(cryptoSymbol) && !isSatoshi) {
        console.log(`Skipping tip processing for ${cryptoSymbol} - not in accepted cryptocurrencies list`);
        await sendLogMessage(message.guild.id, `Skipping tip processing for ${cryptoSymbol} - not in accepted cryptocurrencies list`);
        return;
      }
      
      // Get USD value from API
      const cryptoPrice = await getCryptoPrice(cryptoSymbol, message.content, cryptoAmount);
      
      // Log the detected crypto and its price
      console.log(`Detected tip: ${cryptoAmount} ${cryptoSymbol}, Price: ${cryptoPrice ? '$' + cryptoPrice : 'Unknown'}`);
      await sendLogMessage(message.guild.id, `Detected tip: ${cryptoAmount} ${cryptoSymbol}, Price: ${cryptoPrice ? '$' + cryptoPrice : 'Unknown'}`);
      
      // If we couldn't get a price, skip processing this tip
      if (cryptoPrice === null) {
        console.log(`Skipping tip processing for ${cryptoSymbol} - no price data available`);
        await sendLogMessage(message.guild.id, `Skipping tip processing for ${cryptoSymbol} - no price data available`);
        return;
      }
      
      // Calculate USD value
      const usdAmount = cryptoAmount * cryptoPrice;
      
      // Find the most recent pending tip from this sender
      let targetDrawId = null;
      let pendingTipKey = null;
      
      for (const [key, value] of pendingTips.entries()) {
        if (value.senderId === senderId && value.recipientId === receiverId) {
          targetDrawId = value.targetDrawId;
          pendingTipKey = key;
          break;
        }
      }
      
      // If found, remove it from pending tips
      if (pendingTipKey) {
        pendingTips.delete(pendingTipKey);
      }
      
      // Check if the receiver is in the allowed recipients list
      const isAllowedRecipient = db.config.allowedRecipients && db.config.allowedRecipients.some(recipient => {
        // Check if it's a user ID
        if (recipient.type === 'user' && recipient.id === receiverId) {
          return true;
        }
        
        // Check if it's a role ID
        if (recipient.type === 'role') {
          // Get the member who received the tip
          const member = message.guild.members.cache.get(receiverId);
          // Check if they have the role
          return member && member.roles.cache.has(recipient.id);
        }
        
        return false;
      });
      
      if (isAllowedRecipient) {
        const senderUsername = mentionedUsers[0].username || 'Unknown';
        const receiverUsername = mentionedUsers[1].username || 'Unknown';
        
        console.log(`Valid donation detected in server ${message.guild.id}: ${senderUsername} donated $${usdAmount.toFixed(2)} (${cryptoAmount} ${cryptoSymbol}) to ${receiverUsername}`);
        await sendLogMessage(message.guild.id, `Valid donation detected: ${senderUsername} donated $${usdAmount.toFixed(2)} (${cryptoAmount} ${cryptoSymbol}) to ${receiverUsername}`);
        
        // Add donation entries - with specific draw ID if provided
        const { enteredDraws, totalDonated, newRole } = await addDonationEntries(message.guild.id, senderId, senderUsername, usdAmount, targetDrawId);
        
        // Send confirmation message
        if (enteredDraws.length > 0) {
          const embed = new EmbedBuilder()
            .setTitle('Thank You for Your Donation!')
            .setDescription(`Thank you for supporting our development, <@${senderId}>!`)
            .setColor('#00FF00')
            .setFooter({ text: `Use /entries to see all your draw entries` });
          
          // Add fields for each draw entered
          for (const entry of enteredDraws) {
            let value = entry.entryCount > 0
              ? `You received ${entry.entryCount} appreciation ${entry.entryCount === 1 ? 'entry' : 'entries'}! (1 entry per $${entry.minAmount} donated)`
              : 'This draw is full!';
              
            embed.addFields({
              name: entry.drawName,
              value: value
            });
          }
          
          // Add total donation amount
          embed.addFields({
            name: 'Total Donations',
            value: `You have donated a total of $${totalDonated.toFixed(2)} to support our development!`
          });
          
          // Add new role if assigned
          if (newRole) {
            embed.addFields({
              name: '🎉 New Donor Role Achieved!',
              value: `You've been awarded the **${newRole}** role for your generous support!`
            });
          }
          
          // Add cryptocurrency info - use original values for display
          embed.addFields({
            name: 'Donation Details',
            value: `${originalAmount} ${originalSymbol} (≈ $${usdAmount.toFixed(2)})`
          });
          
          // Add disclaimer
          embed.addFields({
            name: 'Important Notice',
            value: 'Your donation directly supports our development efforts. Appreciation draws are our way of saying thank you for your support!'
          });
          
          // Send the message with error handling
          try {
            await message.channel.send({ embeds: [embed] });
          } catch (error) {
            console.error('Error sending donation confirmation message:', error);
            await sendLogMessage(message.guild.id, `Error sending donation confirmation: ${error.message}`);
          }
        }
      }
      
      // Check if there are multiple recipients (for "and" pattern)
      if (mentionedUsers.length > 2 && message.content.includes(' and ')) {
        const receiverId2 = mentionedUsers[2].id;
        await processTip(message, senderId, receiverId2, usdAmount, cryptoAmount, cryptoSymbol, originalAmount, originalSymbol);
      }
    } catch (error) {
      console.error('Error processing tip message:', error);
      await sendLogMessage(message.guild.id, `Error processing tip: ${error.message}`);
    }
  }
});

// Helper function to process a tip
async function processTip(message, senderId, receiverId, usdAmount, cryptoAmount, cryptoSymbol, originalAmount, originalSymbol) {
  // Find the most recent pending tip from this sender to this recipient
  let targetDrawId = null;
  let pendingTipKey = null;
  
  for (const [key, value] of pendingTips.entries()) {
    if (value.senderId === senderId && value.recipientId === receiverId) {
      targetDrawId = value.targetDrawId;
      pendingTipKey = key;
      break;
    }
  }
  
  // If found, remove it from pending tips
  if (pendingTipKey) {
    pendingTips.delete(pendingTipKey);
  }
  
  // Get database for this server
  const db = getDatabase(message.guild.id);
  
  // Check if the receiver is in the allowed recipients list
  const isAllowedRecipient = db.config.allowedRecipients && db.config.allowedRecipients.some(recipient => {
    // Check if it's a user ID
    if (recipient.type === 'user' && recipient.id === receiverId) {
      return true;
    }
    
    // Check if it's a role ID
    if (recipient.type === 'role') {
      // Get the member who received the tip
      const member = message.guild.members.cache.get(receiverId);
      // Check if they have the role
      return member && member.roles.cache.has(recipient.id);
    }
    
    return false;
  });
  
  if (isAllowedRecipient) {
    const senderUsername = message.mentions.users.get(senderId)?.username || 'Unknown';
    const receiverUsername = message.mentions.users.get(receiverId)?.username || 'Unknown';
    
    console.log(`Valid donation detected in server ${message.guild.id}: ${senderUsername} donated $${usdAmount.toFixed(2)} (${cryptoAmount} ${cryptoSymbol}) to ${receiverUsername}`);
    await sendLogMessage(message.guild.id, `Valid donation detected: ${senderUsername} donated $${usdAmount.toFixed(2)} (${cryptoAmount} ${cryptoSymbol}) to ${receiverUsername}`);
    
    // Add donation entries - with specific draw ID if provided
    const { enteredDraws, totalDonated, newRole } = await addDonationEntries(message.guild.id, senderId, senderUsername, usdAmount, targetDrawId);
    
    // Send confirmation message
    if (enteredDraws.length > 0) {
      const embed = new EmbedBuilder()
        .setTitle('Thank You for Your Donation!')
        .setDescription(`Thank you for supporting our development, <@${senderId}>!`)
        .setColor('#00FF00')
        .setFooter({ text: `Use /entries to see all your draw entries` });
      
      // Add fields for each draw entered
      for (const entry of enteredDraws) {
        let value = entry.entryCount > 0
          ? `You received ${entry.entryCount} appreciation ${entry.entryCount === 1 ? 'entry' : 'entries'}! (1 entry per $${entry.minAmount} donated)`
          : 'This draw is full!';
          
        embed.addFields({
          name: entry.drawName,
          value: value
        });
      }
      
      // Add total donation amount
      embed.addFields({
        name: 'Total Donations',
        value: `You have donated a total of $${totalDonated.toFixed(2)} to support our development!`
      });
      
      // Add new role if assigned
      if (newRole) {
        embed.addFields({
          name: '🎉 New Donor Role Achieved!',
          value: `You've been awarded the **${newRole}** role for your generous support!`
        });
      }
      
      // Add cryptocurrency info - use original values for display
      embed.addFields({
        name: 'Donation Details',
        value: `${originalAmount} ${originalSymbol} (≈ $${usdAmount.toFixed(2)})`
      });
      
      // Add disclaimer
      embed.addFields({
        name: 'Important Notice',
        value: 'Your donation directly supports our development efforts. Appreciation draws are our way of saying thank you for your support!'
      });
      
      // Send the message with error handling
      try {
        await message.channel.send({ embeds: [embed] });
      } catch (error) {
        console.error('Error sending donation confirmation message:', error);
        await sendLogMessage(message.guild.id, `Error sending donation confirmation: ${error.message}`);
      }
    }
  }
}

// Handle slash commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return;
  
  const { commandName, options, user, guildId } = interaction;
  
  // Check if the server is in the allowed list
  if (!SERVER_IDS.includes(guildId)) {
    return interaction.reply({ 
      content: 'This bot is not configured for this server.', 
      ephemeral: true 
    });
  }
  
  // Commands that require admin permissions
  const adminCommands = [
    'admin', 
    'add_recipient', 
    'remove_recipient', 
    'create_draw', 
    'edit_draw', 
    'select_winner', 
    'reset_draw',
    'schedule_draw',
    'cancel_draw',
    'set_notification_channel',
    'set_log_channel',
    'reset_leaderboard',
    'add_cryptocurrency',
    'remove_cryptocurrency',
    'assign_entries'
  ];
  
  if (adminCommands.includes(commandName)) {
    // For setup command, only server admins or the bot owner can use it
    if (commandName === 'setup') {
      const member = await interaction.guild.members.fetch(user.id);
      if (user.id !== OWNER_ID && !member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'Only server administrators can use this command.', ephemeral: true });
      }
    } else {
      // For other admin commands, check if user has the admin role
      const hasAdminRole = await isAdmin(guildId, user.id);
      if (!hasAdminRole) {
        return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
      }
    }
  }
  
  try {
    switch (commandName) {
      case 'setup':
        await handleSetupCommand(interaction);
        break;
      case 'admin':
        await handleAdminCommand(interaction);
        break;
      case 'add_recipient':
        await handleAddRecipientCommand(interaction);
        break;
      case 'remove_recipient':
        await handleRemoveRecipientCommand(interaction);
        break;
      case 'create_draw':
        await handleCreateDrawCommand(interaction);
        break;
      case 'edit_draw':
        await handleEditDrawCommand(interaction);
        break;
      case 'select_winner':
        await handleSelectWinnerCommand(interaction);
        break;
      case 'reset_draw':
        await handleResetDrawCommand(interaction);
        break;
      case 'entries':
        await handleEntriesCommand(interaction);
        break;
      case 'draws':
        await handleDrawsCommand(interaction);
        break;
      case 'draw_ids':
        await handleDrawIdsCommand(interaction);
        break;
      case 'leaderboard':
        await handleLeaderboardCommand(interaction);
        break;
      case 'reset_leaderboard':
        await handleResetLeaderboardCommand(interaction);
        break;
      case 'donate':
        await handleDonateCommand(interaction);
        break;
      case 'help':
        await handleHelpCommand(interaction);
        break;
      case 'terms':
        await handleTermsCommand(interaction);
        break;
      case 'donor_roles':
        await handleDonorRolesCommand(interaction);
        break;
      case 'accepted_coins':
        await handleAcceptedCoinsCommand(interaction);
        break;
      // Scheduled draw commands
      case 'schedule_draw':
        await handleScheduleDrawCommand(interaction);
        break;
      case 'cancel_draw':
        await handleCancelDrawCommand(interaction);
        break;
      case 'scheduled_draws':
        await handleScheduledDrawsCommand(interaction);
        break;
      case 'draw_history':
        await handleDrawHistoryCommand(interaction);
        break;
      case 'set_notification_channel':
        await handleSetNotificationChannelCommand(interaction);
        break;
      case 'set_log_channel':
        await handleSetLogChannelCommand(interaction);
        break;
      // New commands
      case 'add_cryptocurrency':
        await handleAddCryptocurrencyCommand(interaction);
        break;
      case 'remove_cryptocurrency':
        await handleRemoveCryptocurrencyCommand(interaction);
        break;
      case 'assign_entries':
        await handleAssignEntriesCommand(interaction);
        break;
    }
  } catch (error) {
    console.error(`Error handling command ${commandName}:`, error);
    
    // Check if the interaction has already been replied to
  if (interaction.replied || interaction.deferred) {
  await interaction.followUp({ 
    content: 'There was an error while executing this command!', 
    ephemeral: true 
  });
} else {
  await interaction.reply({ 
    content: 'There was an error while executing this command!', 
    ephemeral: true 
  });
}
  }
});

// Command handlers - now with server ID parameter
async function handleSetupCommand(interaction) {
  const adminRole = interaction.options.getRole('admin_role');
  const notificationChannel = interaction.options.getChannel('notification_channel');
  const serverId = interaction.guildId;
  
  const db = getDatabase(serverId);
  db.config.adminRoleId = adminRole.id;
  
  if (notificationChannel) {
    db.config.notificationChannelId = notificationChannel.id;
  }
  
  saveDatabase(serverId, db);
  
  const embed = new EmbedBuilder()
    .setTitle('Setup Complete')
    .setDescription(`Donor Rewards has been set up successfully!`)
    .setColor('#00FF00')
    .addFields(
      { name: 'Admin Role', value: `<@&${adminRole.id}>` }
    );
  
  if (notificationChannel) {
    embed.addFields({ name: 'Notification Channel', value: `<#${notificationChannel.id}>` });
  }
  
  embed.addFields({ name: 'Next Steps', value: 'Use `/add_recipient` to add users or roles that can receive donations for draw entries.' });
  
  interaction.reply({ embeds: [embed] });
}

async function handleAdminCommand(interaction) {
  const serverId = interaction.guildId;
  const db = getDatabase(serverId);
  
  const embed = new EmbedBuilder()
    .setTitle('Donor Rewards Admin Dashboard')
    .setDescription('Use these commands to manage donation draws:')
    .setColor('#FF5500')
    .addFields(
      { name: '/add_recipient', value: 'Add a user or role as an allowed donation recipient' },
      { name: '/remove_recipient', value: 'Remove a user or role from allowed donation recipients' },
      { name: '/create_draw', value: 'Create a new donation appreciation draw' },
      { name: '/edit_draw', value: 'Edit an existing donation draw' },
      { name: '/select_winner', value: 'Select a winner from a donation draw' },
      { name: '/reset_draw', value: 'Reset entries for a donation draw' },
      { name: '/reset_leaderboard', value: 'Reset the donation leaderboard' },
      { name: '/schedule_draw', value: 'Schedule an automatic draw' },
      { name: '/cancel_draw', value: 'Cancel a scheduled draw' },
      { name: '/set_notification_channel', value: 'Set the channel for draw notifications' },
      { name: '/set_log_channel', value: 'Set the channel for detailed donation logs' },
      { name: '/leaderboard', value: 'Show top donors' },
      { name: '/add_cryptocurrency', value: 'Add a cryptocurrency to the accepted list' },
      { name: '/remove_cryptocurrency', value: 'Remove a cryptocurrency from the accepted list' },
      { name: '/assign_entries', value: 'Manually assign entries to a user' }
    );
  
  // Add current configuration
  let recipientsText = 'None';
  if (db.config.allowedRecipients && db.config.allowedRecipients.length > 0) {
    recipientsText = db.config.allowedRecipients.map(r => 
      `${r.type === 'user' ? 'User' : 'Role'}: <@${r.type === 'user' ? '' : '&'}${r.id}>`
    ).join('\n');
  }
  
  embed.addFields(
    { name: 'Admin Role', value: db.config.adminRoleId ? `<@&${db.config.adminRoleId}>` : 'Not set' },
    { name: 'Notification Channel', value: db.config.notificationChannelId ? `<#${db.config.notificationChannelId}>` : 'Not set' },
    { name: 'Log Channel', value: db.config.logChannelId ? `<#${db.config.logChannelId}>` : 'Not set' },
    { name: 'Allowed Recipients', value: recipientsText }
  );
  
  // Add active draws
  const activeDraws = Object.entries(db.donationDraws)
    .filter(([_, draw]) => draw.active)
    .map(([id, draw]) => {
      const totalEntries = Object.values(draw.entries).reduce((sum, count) => sum + count, 0);
      let drawInfo = `${draw.name} (ID: ${id})\nEntries: ${totalEntries}/${draw.maxEntries}\nReward: ${draw.reward}`;
      
      if (draw.drawTime) {
        drawInfo += `\nScheduled Draw: ${draw.drawTimeFormatted}`;
      }
      
      return drawInfo;
    });
  
  if (activeDraws.length > 0) {
    embed.addFields({ name: 'Active Donation Draws', value: activeDraws.join('\n\n') });
  } else {
    embed.addFields({ name: 'Active Donation Draws', value: 'No active draws' });
  }
  
  interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleAddRecipientCommand(interaction) {
  const recipient = interaction.options.getMentionable('recipient');
  const serverId = interaction.guildId;
  const db = getDatabase(serverId);
  
  // Initialize allowedRecipients if it doesn't exist
  if (!db.config.allowedRecipients) {
    db.config.allowedRecipients = [];
  }
  
  // Determine if it's a user or role
  const type = recipient.user ? 'user' : 'role';
  const id = recipient.user ? recipient.user.id : recipient.id;
  
  // Check if already in the list
  const alreadyExists = db.config.allowedRecipients.some(r => 
    r.type === type && r.id === id
  );
  
  if (alreadyExists) {
    return interaction.reply({ 
      content: `This ${type} is already in the allowed recipients list.`, 
      ephemeral: true 
    });
  }
  
  // Add to the list
  db.config.allowedRecipients.push({
    type,
    id,
    name: recipient.user ? recipient.user.username : recipient.name
  });
  
  saveDatabase(serverId, db);
  
  interaction.reply({ 
    content: `Added ${type} ${recipient.user ? recipient.user.username : recipient.name} to allowed donation recipients.`,
    ephemeral: true
  });
}

async function handleRemoveRecipientCommand(interaction) {
  const recipient = interaction.options.getMentionable('recipient');
  const serverId = interaction.guildId;
  const db = getDatabase(serverId);
  
  // Determine if it's a user or role
  const type = recipient.user ? 'user' : 'role';
  const id = recipient.user ? recipient.user.id : recipient.id;
  
  // Find and remove
  if (!db.config.allowedRecipients) {
    return interaction.reply({ 
      content: `No recipients have been added yet.`, 
      ephemeral: true 
    });
  }
  
  const initialLength = db.config.allowedRecipients.length;
  db.config.allowedRecipients = db.config.allowedRecipients.filter(r => 
    !(r.type === type && r.id === id)
  );
  
  if (db.config.allowedRecipients.length === initialLength) {
    return interaction.reply({ 
      content: `This ${type} was not in the allowed recipients list.`, 
      ephemeral: true 
    });
  }
  
  saveDatabase(serverId, db);
  
  interaction.reply({ 
    content: `Removed ${type} ${recipient.user ? recipient.user.username : recipient.name} from allowed recipients.`,
    ephemeral: true
  });
}

async function handleCreateDrawCommand(interaction) {
  const drawId = interaction.options.getString('id').toLowerCase().replace(/\s+/g, '_');
  const name = interaction.options.getString('name');
  const minAmount = interaction.options.getNumber('min_amount');
  let maxAmount = interaction.options.getNumber('max_amount');
  const reward = interaction.options.getString('reward');
  const maxEntries = interaction.options.getInteger('max_entries');
  const serverId = interaction.guildId;
  
  if (maxAmount === 0) maxAmount = 1000000; // Use a large number instead of Infinity for JSON compatibility
  
  const db = getDatabase(serverId);
  
  // Check if draw ID already exists
  if (db.donationDraws[drawId]) {
    return interaction.reply({ 
      content: `A donation draw with ID "${drawId}" already exists. Use /edit_draw to modify it.`, 
      ephemeral: true 
    });
  }
  
  // Create new draw
  db.donationDraws[drawId] = {
    name,
    minAmount,
    maxAmount,
    reward,
    maxEntries,
    entries: {},
    active: true,
    drawTime: null,
    drawTimeFormatted: null,
    notificationSent: false
  };
  
  saveDatabase(serverId, db);
  
  const embed = new EmbedBuilder()
    .setTitle('Donation Draw Created')
    .setDescription(`Successfully created donation draw: ${name}`)
    .setColor('#00FF00')
    .addFields(
      { name: 'ID', value: drawId },
      { name: 'Donation Range', value: maxAmount === 1000000 ? `$${minAmount}+` : `$${minAmount} - $${maxAmount}` },
      { name: 'Reward', value: reward },
      { name: 'Max Entries', value: maxEntries.toString() }
    );
  
  interaction.reply({ embeds: [embed] });
}

async function handleEditDrawCommand(interaction) {
  const drawId = interaction.options.getString('id');
  const serverId = interaction.guildId;
  const db = getDatabase(serverId);
  
  // Check if draw exists
  if (!db.donationDraws[drawId]) {
    return interaction.reply({ 
      content: `No donation draw found with ID "${drawId}".`, 
      ephemeral: true 
    });
  }
  
  const draw = db.donationDraws[drawId];
  
  // Update draw properties if provided
  if (interaction.options.getString('name')) {
    draw.name = interaction.options.getString('name');
  }
  
  if (interaction.options.getNumber('min_amount') !== null) {
    draw.minAmount = interaction.options.getNumber('min_amount');
  }
  
  if (interaction.options.getNumber('max_amount') !== null) {
    draw.maxAmount = interaction.options.getNumber('max_amount') === 0 
      ? 1000000 // Use a large number instead of Infinity for JSON compatibility
      : interaction.options.getNumber('max_amount');
  }
  
  if (interaction.options.getString('reward')) {
    draw.reward = interaction.options.getString('reward');
  }
  
  if (interaction.options.getInteger('max_entries') !== null) {
    draw.maxEntries = interaction.options.getInteger('max_entries');
  }
  
  if (interaction.options.getBoolean('active') !== null) {
    draw.active = interaction.options.getBoolean('active');
  }
  
  saveDatabase(serverId, db);
  
  const embed = new EmbedBuilder()
    .setTitle('Donation Draw Updated')
    .setDescription(`Successfully updated donation draw: ${draw.name}`)
    .setColor('#00FF00')
    .addFields(
      { name: 'ID', value: drawId },
      { name: 'Donation Range', value: draw.maxAmount === 1000000 ? `$${draw.minAmount}+` : `$${draw.minAmount} - $${draw.maxAmount}` },
      { name: 'Reward', value: draw.reward },
      { name: 'Max Entries', value: draw.maxEntries.toString() },
      { name: 'Status', value: draw.active ? 'Active' : 'Inactive' }
    );
  
  if (draw.drawTime) {
    embed.addFields({ name: 'Scheduled Draw', value: draw.drawTimeFormatted });
  }
  
  interaction.reply({ embeds: [embed] });
}

async function handleSelectWinnerCommand(interaction) {
  const drawId = interaction.options.getString('draw_id');
  const serverId = interaction.guildId;
  const db = getDatabase(serverId);
  
  // Check if draw exists
  if (!db.donationDraws[drawId]) {
    return interaction.reply({ 
      content: `No donation draw found with ID "${drawId}".`, 
      ephemeral: true 
    });
  }
  
  const draw = db.donationDraws[drawId];
  const entries = draw.entries;
  
  if (!entries || Object.keys(entries).length === 0) {
    return interaction.reply({ 
      content: `No entries in the ${draw.name} yet.`, 
      ephemeral: true 
    });
  }
  
  // Create weighted entries array
  const weightedEntries = [];
  for (const [userId, count] of Object.entries(entries)) {
    for (let i = 0; i < count; i++) {
      weightedEntries.push(userId);
    }
  }
  
  if (weightedEntries.length === 0) {
    return interaction.reply({ 
      content: `No valid entries in the ${draw.name}.`, 
      ephemeral: true 
    });
  }
  
  // Draw a random winner
  const winnerIndex = Math.floor(Math.random() * weightedEntries.length);
  const winnerId = weightedEntries[winnerIndex];
  const winnerUsername = db.users[winnerId]?.username || 'Unknown';
  
  const embed = new EmbedBuilder()
    .setTitle(`${draw.name} Winner!`)
    .setDescription(`Congratulations to <@${winnerId}> (${winnerUsername})!`)
    .addFields(
      { name: 'Reward', value: draw.reward },
      { name: 'Winning Odds', value: `${entries[winnerId]} out of ${weightedEntries.length} entries (${((entries[winnerId] / weightedEntries.length) * 100).toFixed(2)}%)` }
    )
    .setColor('#FFD700')
    .setTimestamp();
  
  // Add buttons for admin actions
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`reset_${drawId}_${serverId}`)
        .setLabel('Reset Draw')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`redraw_${drawId}_${serverId}`)
        .setLabel('Select Again')
        .setStyle(ButtonStyle.Secondary)
    );
  
  await interaction.reply({ embeds: [embed], components: [row] });
  
  // Add to draw history
  if (!db.drawHistory) {
    db.drawHistory = [];
  }
  
  db.drawHistory.push({
    drawId,
    drawName: draw.name,
    drawTime: Date.now(),
    winnerId,
    winnerUsername,
    reward: draw.reward,
    totalEntries: weightedEntries.length,
    winnerEntries: entries[winnerId]
  });
  
  // Keep history limited to last 50 draws
  if (db.drawHistory.length > 50) {
    db.drawHistory = db.drawHistory.slice(-50);
  }
  
  // Reset scheduled draw if there was one
  if (draw.drawTime) {
    draw.drawTime = null;
    draw.drawTimeFormatted = null;
    draw.notificationSent = false;
  }
  
  saveDatabase(serverId, db);
}

async function handleResetDrawCommand(interaction) {
  const drawId = interaction.options.getString('draw_id');
  const serverId = interaction.guildId;
  const db = getDatabase(serverId);
  
  // Check if draw exists
  if (!db.donationDraws[drawId]) {
    return interaction.reply({ 
      content: `No donation draw found with ID "${drawId}".`, 
      ephemeral: true 
    });
  }
  
  const draw = db.donationDraws[drawId];
  
  // Reset entries
  draw.entries = {};
  
  // Remove entries from users
  for (const userId in db.users) {
    if (db.users[userId].entries && db.users[userId].entries[drawId]) {
      delete db.users[userId].entries[drawId];
    }
  }
  
  saveDatabase(serverId, db);
  
  interaction.reply({ 
    content: `Successfully reset all entries for "${draw.name}".`,
    ephemeral: true
  });
}

async function handleResetLeaderboardCommand(interaction) {
  const serverId = interaction.guildId;
  const confirmText = interaction.options.getString('confirm');
  
  if (confirmText !== 'confirm') {
    return interaction.reply({
      content: 'You must type "confirm" to reset the leaderboard. This action cannot be undone.',
      ephemeral: true
    });
  }
  
  const db = getDatabase(serverId);
  
  // Create a backup of the database before resetting
  const backupFile = path.join(DATA_DIR, `${serverId}_backup_${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(db, null, 2));
  
  // Reset user donation totals but keep their usernames
  for (const userId in db.users) {
    db.users[userId].totalDonated = 0;
    db.users[userId].entries = {};
  }
  
  // Reset all draw entries
  for (const drawId in db.donationDraws) {
    db.donationDraws[drawId].entries = {};
  }
  
  saveDatabase(serverId, db);
  
  interaction.reply({
    content: 'Leaderboard has been reset. All donation totals have been set to zero and draw entries have been cleared. A backup of the previous data has been saved.',
    ephemeral: true
  });
}

async function handleEntriesCommand(interaction) {
  const serverId = interaction.guildId;
  const db = getDatabase(serverId);
  const userId = interaction.user.id;
  const userData = db.users[userId];
  
  if (!userData || !userData.entries || Object.keys(userData.entries).length === 0) {
    return interaction.reply({ content: 'You don\'t have any donation draw entries yet. Make a donation to enter!', ephemeral: true });
  }
  
  const embed = new EmbedBuilder()
    .setTitle('Your Donation Draw Entries')
    .setDescription(`Total amount donated: $${userData.totalDonated.toFixed(2)}`)
    .setColor('#0099FF');
  
  for (const [drawId, count] of Object.entries(userData.entries)) {
    const draw = db.donationDraws[drawId];
    if (draw && count > 0) {
      const totalEntries = Object.values(draw.entries).reduce((sum, count) => sum + count, 0);
      const odds = ((count / totalEntries) * 100).toFixed(2);
      
      let fieldValue = `${count} ${count === 1 ? 'entry' : 'entries'} - ${odds}% chance of winning\nReward: ${draw.reward}`;
      
      if (draw.drawTime) {
        fieldValue += `\nDraw scheduled: ${draw.drawTimeFormatted}`;
      }
      
      embed.addFields({
        name: draw.name,
        value: fieldValue
      });
    }
  }
  
  // Add donor role information
  const member = await interaction.guild.members.fetch(userId);
  const donorRoles = Object.values(DONOR_ROLES)
    .sort((a, b) => b.minAmount - a.minAmount);
  
  let currentDonorRole = null;
  for (const role of donorRoles) {
    if (member.roles.cache.has(role.id)) {
      currentDonorRole = role;
      break;
    }
  }
  
  if (currentDonorRole) {
    embed.addFields({
      name: 'Your Donor Status',
      value: `Current role: **${currentDonorRole.name}** ($${currentDonorRole.minAmount}+)`
    });
    
    // Find next role if there is one
    const nextRole = donorRoles.find(role => role.minAmount > userData.totalDonated);
    if (nextRole) {
      const amountNeeded = nextRole.minAmount - userData.totalDonated;
      embed.addFields({
        name: 'Next Donor Role',
        value: `Donate $${amountNeeded.toFixed(2)} more to reach **${nextRole.name}**!`
      });
    }
  } else {
    // Find the first role they could get
    const firstRole = donorRoles[donorRoles.length - 1]; // Lowest tier
    if (userData.totalDonated < firstRole.minAmount) {
      const amountNeeded = firstRole.minAmount - userData.totalDonated;
      embed.addFields({
        name: 'Donor Status',
        value: `Donate $${amountNeeded.toFixed(2)} more to reach **${firstRole.name}**!`
      });
    }
  }
  
  // Add disclaimer
  embed.addFields({
    name: 'Important Notice',
    value: 'Your donations directly support our development efforts. Appreciation draws are our way of saying thank you for your support!'
  });
  
  interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDrawsCommand(interaction) {
  const serverId = interaction.guildId;
  const db = getDatabase(serverId);
  
  const embed = new EmbedBuilder()
    .setTitle('Available Donation Draws')
    .setDescription('Donate to enter these appreciation draws:')
    .setColor('#0099FF');
  
  let hasActiveDraws = false;
  
  for (const [drawId, draw] of Object.entries(db.donationDraws)) {
    if (!draw.active) continue;
    
    hasActiveDraws = true;
    const entryCount = Object.values(draw.entries).reduce((sum, count) => sum + count, 0);
    const donationRange = draw.maxAmount === 1000000 
      ? `$${draw.minAmount}+` 
      : `$${draw.minAmount} - $${draw.maxAmount}`;
    
    let fieldValue = `ID: #${drawId}\nDonation range: ${donationRange}\nEntries: 1 per $${draw.minAmount} donated\nTotal entries: ${entryCount}/${draw.maxEntries}\nReward: ${draw.reward}`;
    
    if (draw.drawTime) {
      fieldValue += `\nDraw scheduled: ${draw.drawTimeFormatted}`;
    }
    
    embed.addFields({
      name: draw.name,
      value: fieldValue
    });
  }
  
  if (!hasActiveDraws) {
    embed.setDescription('There are no active donation draws at the moment.');
  }
  
  // Add disclaimer
  embed.addFields({
    name: 'Important Notice',
    value: 'Your donations directly support our development efforts. Appreciation draws are our way of saying thank you for your support!'
  });
  
  interaction.reply({ embeds: [embed] });
}

async function handleDrawIdsCommand(interaction) {
  const serverId = interaction.guildId;
  const db = getDatabase(serverId);
  
  const embed = new EmbedBuilder()
    .setTitle('Donation Draw IDs')
    .setDescription('Use these IDs when donating to specify which draw to enter:\n`$tip @recipient amount #drawID`')
    .setColor('#0099FF');
  
  let hasActiveDraws = false;
  
  for (const [drawId, draw] of Object.entries(db.donationDraws)) {
    if (!draw.active) continue;
    
    hasActiveDraws = true;
    const entryCount = Object.values(draw.entries).reduce((sum, count) => sum + count, 0);
    
    let fieldValue = `ID: \`#${drawId}\`\nDonation: $${draw.minAmount} per entry\nTotal entries: ${entryCount}/${draw.maxEntries}\nReward: ${draw.reward}`;
    
    if (draw.drawTime) {
      fieldValue += `\nDraw scheduled: ${draw.drawTimeFormatted}`;
    }
    
    embed.addFields({
      name: draw.name,
      value: fieldValue
    });
  }
  
  if (!hasActiveDraws) {
    embed.setDescription('There are no active donation draws at the moment.');
  }
  
  // Add disclaimer
  embed.addFields({
    name: 'Important Notice',
    value: 'Your donations directly support our development efforts. Appreciation draws are our way of saying thank you for your support!'
  });
  
  interaction.reply({ embeds: [embed] });
}

async function handleAcceptedCoinsCommand(interaction) {
  const serverId = interaction.guildId;
  const db = getDatabase(serverId);
  
  const embed = new EmbedBuilder()
    .setTitle('Accepted Cryptocurrencies')
    .setDescription('The following cryptocurrencies are accepted for donations:')
    .setColor('#0099FF');
  
  // Group coins by category (this is just a rough grouping)
  const coins = db.config.acceptedCryptocurrencies || DEFAULT_ACCEPTED_CRYPTOCURRENCIES;
  
  const categories = {
    'Major Coins': coins.filter(c => ['BTC', 'ETH', 'USDT', 'USDC', 'BNB'].includes(c)),
    'Altcoins': coins.filter(c => ['LTC', 'SOL', 'XRP', 'ADA', 'AVAX', 'TON', 'TRON', 'XLA'].includes(c)),
    'Meme Coins': coins.filter(c => ['DOGE', 'SHIB', 'SHIC', 'PEP', 'BONC'].includes(c)),
    'Project Tokens': coins.filter(c => ['AEGS'].includes(c)),
    'Other Coins': coins.filter(c => 
      !['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'LTC', 'SOL', 'XRP', 'ADA', 'AVAX', 'TON', 'TRON', 'XLA', 'DOGE', 'SHIB', 'SHIC', 'PEP', 'BONC', 'AEGS'].includes(c)
    )
  };
  
  for (const [category, categorizedCoins] of Object.entries(categories)) {
    if (categorizedCoins.length > 0) {
      embed.addFields({
        name: category,
        value: categorizedCoins.join(', ')
      });
    }
  }
  
  embed.addFields({
    name: 'Special Notes',
    value: '• Satoshi (SATOSHI) is automatically converted to BTC\n• Only the cryptocurrencies listed above are accepted\n• Admins can add or remove cryptocurrencies using the `/add_cryptocurrency` and `/remove_cryptocurrency` commands'
  });
  
  interaction.reply({ embeds: [embed] });
}

async function handleDonateCommand(interaction) {
  const drawId = interaction.options.getString('draw_id');
  const serverId = interaction.guildId;
  const db = getDatabase(serverId);
  
  // Get allowed recipients
  let recipientsText = 'No recipients configured yet. An admin needs to add recipients with `/add_recipient`.';
  if (db.config.allowedRecipients && db.config.allowedRecipients.length > 0) {
    recipientsText = db.config.allowedRecipients.map(r => 
      `<@${r.type === 'user' ? '' : '&'}${r.id}>`
    ).join(', ');
  }
  
  const embed = new EmbedBuilder()
    .setTitle('How to Support Our Development')
    .setColor('#00FF00');
  
  if (drawId && db.donationDraws[drawId]) {
    // Specific draw info
    const draw = db.donationDraws[drawId];
    const entriesPerDollar = 1 / draw.minAmount;
    
    embed.setDescription(`To support our development and enter the **${draw.name}** draw, donate to one of these recipients:`)
      .addFields(
        { name: 'Recipients', value: recipientsText },
        { name: 'Donation Command', value: `\`$tip @recipient amount #${drawId}\`` },
        { name: 'Draw Details', value: `Donation: $${draw.minAmount} per entry\nReward: ${draw.reward}\nEntries: ${entriesPerDollar} per $1 donated` }
      );
    
    if (draw.drawTime) {
      embed.addFields({ name: 'Draw Time', value: draw.drawTimeFormatted });
    }
  } else {
    // General donation info
    embed.setDescription('To support our development and receive entries in our appreciation draws, donate to one of these recipients:')
      .addFields(
        { name: 'Recipients', value: recipientsText },
        { name: 'Donation Command (any draw)', value: '`$tip @recipient amount`' },
        { name: 'Donation Command (specific draw)', value: '`$tip @recipient amount #drawID`' },
        { name: 'Available Draws', value: 'Use `/draws` to see all available draws and their IDs' }
      );
  }
  
  // Add donor roles information
  const donorRolesInfo = Object.values(DONOR_ROLES)
    .sort((a, b) => a.minAmount - b.minAmount)
    .map(role => `<@&${role.id}> - $${role.minAmount}${role.maxAmount ? ` to $${role.maxAmount}` : '+'}`);
  
  embed.addFields({
    name: 'Donor Roles',
    value: 'As you donate, you\'ll automatically receive these roles based on your total contribution:\n\n' + donorRolesInfo.join('\n')
  });
  
  // Add accepted cryptocurrencies
  embed.addFields({
    name: 'Accepted Cryptocurrencies',
    value: 'We accept: ' + (db.config.acceptedCryptocurrencies || DEFAULT_ACCEPTED_CRYPTOCURRENCIES).join(', ') + '\nUse `/accepted_coins` for more details'
  });
  
  // Add disclaimer
  embed.addFields({
    name: 'Important Notice',
    value: 'Your donations directly support our development efforts. Appreciation draws are our way of saying thank you for your support!'
  });
  
  interaction.reply({ embeds: [embed] });
}

async function handleLeaderboardCommand(interaction) {
  const serverId = interaction.guildId;
  const limit = interaction.options.getInteger('limit') || 10;
  const db = getDatabase(serverId);
  
  // Get all users and sort by total donated amount
  const users = Object.entries(db.users || {})
    .map(([id, data]) => ({
      id,
      username: data.username || 'Unknown',
      totalDonated: data.totalDonated || 0
    }))
    .sort((a, b) => b.totalDonated - a.totalDonated)
    .slice(0, limit);
  
  if (users.length === 0) {
    return interaction.reply({ content: 'No donations recorded yet.', ephemeral: true });
  }
  
  const embed = new EmbedBuilder()
    .setTitle('Top Donors')
    .setDescription('Thank you to all our generous supporters:')
    .setColor('#FFD700');
  
  users.forEach((user, index) => {
    embed.addFields({
      name: `${index + 1}. ${user.username}`,
      value: `$${user.totalDonated.toFixed(2)}`
    });
  });
  
  // Add disclaimer
  embed.addFields({
    name: 'Important Notice',
    value: 'Your donations directly support our development efforts. Thank you for your generosity!'
  });
  
  interaction.reply({ embeds: [embed] });
}

async function handleHelpCommand(interaction) {
  const serverId = interaction.guildId;
  const db = getDatabase(serverId);
  
  // Get allowed recipients
  let recipientsText = 'No recipients configured yet. Ask an admin to add recipients.';
  if (db.config.allowedRecipients && db.config.allowedRecipients.length > 0) {
    recipientsText = db.config.allowedRecipients.map(r => 
      `<@${r.type === 'user' ? '' : '&'}${r.id}>`
    ).join(', ');
  }
  
  const embed = new EmbedBuilder()
    .setTitle('Donor Rewards Help Guide')
    .setDescription('Welcome to Donor Rewards! Here\'s how to support our development and participate in appreciation draws.')
    .setColor('#4B0082')
    .addFields(
      { 
        name: 'How to Support Development', 
        value: 'Send donations to designated recipients to support our development efforts and automatically receive entries in our appreciation draws.' 
      },
      { 
        name: 'Donation Methods', 
        value: `**Standard Donation (enters all eligible draws):**
\`$tip @recipient amount\`

**Specific Draw Donation:**
\`$tip @recipient amount #drawID\`

The bot will wait for tip.cc to confirm your donation before assigning entries.` 
      },
      { 
        name: 'Allowed Recipients', 
        value: recipientsText 
      },
      { 
        name: 'User Commands', 
        value: `/help - Shows this help message
/entries - Check your draw entries
/draws - View all available appreciation draws
/draw_ids - Get IDs for specific draws
/donate - Get donation instructions
/leaderboard - See top donors
/scheduled_draws - See upcoming draws
/draw_history - View past draw winners
/donor_roles - View information about donor roles
/accepted_coins - View accepted cryptocurrencies
/terms - View terms and conditions` 
      },
      { 
        name: 'How Appreciation Draws Work', 
        value: `Each $${db.donationDraws.small?.minAmount || '5'} you donate gives you 1 entry in the eligible draw.
More entries = higher chance of winning!
Admins will select winners periodically or at scheduled times.
Your odds are shown when you check your entries.` 
      },
      { 
        name: 'Donor Roles', 
        value: `As you donate, you'll automatically receive special roles based on your total contribution. Use /donor_roles to see the thresholds.` 
      },
      { 
        name: 'Important Notice', 
        value: `This is a donor appreciation system. Donations are voluntary contributions to support development and not purchases of draw entries. Winners are selected randomly from those who have contributed.` 
      }
    )
    .setFooter({ text: 'Thank you for supporting our development!' });
  
  interaction.reply({ embeds: [embed] });
}

async function handleTermsCommand(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('Donor Rewards - Terms and Conditions')
    .setDescription('Please read these terms carefully before participating in our donation system.')
    .setColor('#4B0082')
    .addFields(
      { 
        name: 'Primary Purpose', 
        value: 'The primary purpose of this system is to collect voluntary donations to support our development efforts. Appreciation draws are a secondary benefit to thank donors for their support.' 
      },
      { 
        name: 'Voluntary Donations', 
        value: 'All donations are voluntary contributions to support development. Donations are not purchases of draw entries or tickets.' 
      },
      { 
        name: 'Appreciation Draws', 
        value: 'Appreciation draws are our way of saying thank you to donors. Entry into these draws is provided as a gesture of appreciation, not as the primary purpose of donations.' 
      },
      { 
        name: 'Winner Selection', 
        value: 'Winners are selected randomly from the pool of donors who have received entries in a particular draw. The more you donate, the more entries you receive, increasing your chances of being selected.' 
      },
      { 
        name: 'Rewards', 
        value: 'Rewards are provided on a best-effort basis. We reserve the right to substitute rewards of equal or greater value if necessary.' 
      },
      { 
        name: 'Donor Roles', 
        value: 'Donor roles are assigned automatically based on your total donation amount. These roles provide recognition and may include additional benefits within our community.' 
      },
      { 
        name: 'Data Collection', 
        value: 'We collect and store your Discord user ID, username, and donation amounts to track entries and donor roles. This information is used solely for the operation of the donation system.' 
      },
      { 
        name: 'Modifications', 
        value: 'We reserve the right to modify these terms or the operation of the donation system at any time. Continued participation after changes constitutes acceptance of the new terms.' 
      },
      { 
        name: 'Contact', 
        value: 'If you have any questions about these terms or the donation system, please contact a server administrator.' 
      }
    )
    .setFooter({ text: 'Last updated: May 9, 2024' });
  
  interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDonorRolesCommand(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('Donor Roles and Benefits')
    .setDescription('As you donate to support our development, you\'ll automatically receive these roles based on your total contribution:')
    .setColor('#4B0082');
  
  // Sort roles by donation amount (ascending)
  const sortedRoles = Object.values(DONOR_ROLES)
    .sort((a, b) => a.minAmount - b.minAmount);
  
  for (const role of sortedRoles) {
    const amountRange = role.maxAmount 
      ? `$${role.minAmount} - $${role.maxAmount}` 
      : `$${role.minAmount}+`;
    
    embed.addFields({
      name: `${role.name} - ${amountRange}`,
      value: `<@&${role.id}>`
    });
  }
  
  embed.addFields(
    { 
      name: 'Benefits', 
      value: 'All donors receive special permissions and access to exclusive channels, sneak peeks at upcoming updates, and beta testing opportunities for our latest software!' 
    },
    {
      name: 'How It Works',
      value: 'Roles are assigned automatically based on your total donation amount. As you donate more, you\'ll progress through the tiers. Higher tiers replace lower tiers.'
    },
    {
      name: 'Check Your Status',
      value: 'Use the `/entries` command to see your current donation total and donor role status.'
    }
  );
  
  interaction.reply({ embeds: [embed] });
}

// New command handlers for scheduled draws
async function handleScheduleDrawCommand(interaction) {
  const drawId = interaction.options.getString('draw_id');
  const days = interaction.options.getInteger('days') || 0;
  const hours = interaction.options.getInteger('hours') || 0;
  const minutes = interaction.options.getInteger('minutes') || 0;
  const serverId = interaction.guildId;
  
  // Validate at least one time unit is provided
  if (days === 0 && hours === 0 && minutes === 0) {
    return interaction.reply({ 
      content: 'Please specify at least one time unit (days, hours, or minutes).', 
      ephemeral: true 
    });
  }
  
  const db = getDatabase(serverId);
  
  // Check if draw exists
  if (!db.donationDraws[drawId]) {
    return interaction.reply({ 
      content: `No donation draw found with ID "${drawId}".`, 
      ephemeral: true 
    });
  }
  
  const draw = db.donationDraws[drawId];
  
  // Calculate draw time
  const now = Date.now();
  const drawTime = now + (days * 24 * 60 * 60 * 1000) + (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);
  
  // Format the draw time
  const drawTimeFormatted = formatDate(drawTime);
  
  // Update draw
  draw.drawTime = drawTime;
  draw.drawTimeFormatted = drawTimeFormatted;
  draw.notificationSent = false;
  
  saveDatabase(serverId, db);
  
  const embed = new EmbedBuilder()
    .setTitle('Donation Draw Scheduled')
    .setDescription(`A drawing for the **${draw.name}** has been scheduled!`)
    .setColor('#00FF00')
    .addFields(
      { name: 'Draw ID', value: drawId },
      { name: 'Draw Time', value: drawTimeFormatted },
      { name: 'Time Until Draw', value: `${days} days, ${hours} hours, ${minutes} minutes` }
    );
  
  interaction.reply({ embeds: [embed] });
}

async function handleCancelDrawCommand(interaction) {
  const drawId = interaction.options.getString('draw_id');
  const serverId = interaction.guildId;
  const db = getDatabase(serverId);
  
  // Check if draw exists
  if (!db.donationDraws[drawId]) {
    return interaction.reply({ 
      content: `No donation draw found with ID "${drawId}".`, 
      ephemeral: true 
    });
  }
  
  const draw = db.donationDraws[drawId];
  
  // Check if there's a scheduled draw
  if (!draw.drawTime) {
    return interaction.reply({ 
      content: `There is no scheduled draw for the "${draw.name}".`, 
      ephemeral: true 
    });
  }
  
  // Cancel the draw
  const previousDrawTime = draw.drawTimeFormatted;
  draw.drawTime = null;
  draw.drawTimeFormatted = null;
  draw.notificationSent = false;
  
  saveDatabase(serverId, db);
  
  interaction.reply({ 
    content: `Successfully cancelled the scheduled draw for "${draw.name}" that was set for ${previousDrawTime}.`,
    ephemeral: true
  });
}

async function handleScheduledDrawsCommand(interaction) {
  const serverId = interaction.guildId;
  const db = getDatabase(serverId);
  
  const embed = new EmbedBuilder()
    .setTitle('Scheduled Donation Draws')
    .setColor('#0099FF');
  
  // Find all draws with scheduled draws
  const scheduledDraws = Object.entries(db.donationDraws)
    .filter(([_, draw]) => draw.drawTime && draw.active)
    .sort((a, b) => a[1].drawTime - b[1].drawTime);
  
  if (scheduledDraws.length === 0) {
    embed.setDescription('There are no scheduled donation draws at the moment.');
  } else {
    embed.setDescription('Here are the upcoming donation draws:');
    
    for (const [drawId, draw] of scheduledDraws) {
      const entryCount = Object.values(draw.entries).reduce((sum, count) => sum + count, 0);
      const timeUntil = calculateTimeUntil(draw.drawTime);
      
      embed.addFields({
        name: draw.name,
        value: `ID: ${drawId}\nReward: ${draw.reward}\nEntries: ${entryCount}/${draw.maxEntries}\nDraw Time: ${draw.drawTimeFormatted}\nTime Remaining: ${timeUntil}`
      });
    }
  }
  
  interaction.reply({ embeds: [embed] });
}

// Helper function to calculate time until a timestamp
function calculateTimeUntil(timestamp) {
  const now = Date.now();
  const diff = timestamp - now;
  
  if (diff <= 0) return 'Now';
  
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  
  let result = '';
  if (days > 0) result += `${days} day${days !== 1 ? 's' : ''}, `;
  if (hours > 0 || days > 0) result += `${hours} hour${hours !== 1 ? 's' : ''}, `;
  result += `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  
  return result;
}

async function handleDrawHistoryCommand(interaction) {
  const serverId = interaction.guildId;
  const limit = interaction.options.getInteger('limit') || 5;
  const db = getDatabase(serverId);
  
  if (!db.drawHistory || db.drawHistory.length === 0) {
    return interaction.reply({ content: 'No donation draw history available yet.', ephemeral: true });
  }
  
  const embed = new EmbedBuilder()
    .setTitle('Donation Draw History')
    .setDescription('Past donation draw winners:')
    .setColor('#9932CC');
  
  // Get the most recent draws first
  const recentDraws = [...db.drawHistory]
    .sort((a, b) => b.drawTime - a.drawTime)
    .slice(0, limit);
  
  for (const draw of recentDraws) {
    const drawDate = formatDate(draw.drawTime);
    const winningOdds = ((draw.winnerEntries / draw.totalEntries) * 100).toFixed(2);
    
    embed.addFields({
      name: draw.drawName,
      value: `Winner: <@${draw.winnerId}> (${draw.winnerUsername})\nReward: ${draw.reward}\nDrawn: ${drawDate}\nWinning Odds: ${winningOdds}%\nTotal Entries: ${draw.totalEntries}`
    });
  }
  
  interaction.reply({ embeds: [embed] });
}

async function handleSetNotificationChannelCommand(interaction) {
  const channel = interaction.options.getChannel('channel');
  const serverId = interaction.guildId;
  const db = getDatabase(serverId);
  
  // Update the notification channel
  db.config.notificationChannelId = channel.id;
  saveDatabase(serverId, db);
  
  interaction.reply({ 
    content: `Successfully set <#${channel.id}> as the notification channel for donation draw announcements.`,
    ephemeral: true
  });
}

async function handleSetLogChannelCommand(interaction) {
  const channel = interaction.options.getChannel('channel');
  const serverId = interaction.guildId;
  
  // Update environment variable
  process.env.LOG_CHANNEL_ID = channel.id;
  
  // Also store in database for persistence
  const db = getDatabase(serverId);
  db.config.logChannelId = channel.id;
  saveDatabase(serverId, db);
  
  interaction.reply({ 
    content: `Successfully set <#${channel.id}> as the log channel for donation details.`,
    ephemeral: true
  });
}

// New command handlers for cryptocurrency management
async function handleAddCryptocurrencyCommand(interaction) {
  const symbol = interaction.options.getString('symbol').toUpperCase();
  const serverId = interaction.guildId;
  const db = getDatabase(serverId);
  
  // Initialize acceptedCryptocurrencies if it doesn't exist
  if (!db.config.acceptedCryptocurrencies) {
    db.config.acceptedCryptocurrencies = [...DEFAULT_ACCEPTED_CRYPTOCURRENCIES];
  }
  
  // Check if already in the list
  if (db.config.acceptedCryptocurrencies.includes(symbol)) {
    return interaction.reply({ 
      content: `${symbol} is already in the accepted cryptocurrencies list.`, 
      ephemeral: true 
    });
  }
  
  // Add to the list
  db.config.acceptedCryptocurrencies.push(symbol);
  saveDatabase(serverId, db);
  
  interaction.reply({ 
    content: `Added ${symbol} to the accepted cryptocurrencies list.`,
    ephemeral: true
  });
}

async function handleRemoveCryptocurrencyCommand(interaction) {
  const symbol = interaction.options.getString('symbol').toUpperCase();
  const serverId = interaction.guildId;
  const db = getDatabase(serverId);
  
  // Initialize acceptedCryptocurrencies if it doesn't exist
  if (!db.config.acceptedCryptocurrencies) {
    db.config.acceptedCryptocurrencies = [...DEFAULT_ACCEPTED_CRYPTOCURRENCIES];
  }
  
  // Check if in the list
  if (!db.config.acceptedCryptocurrencies.includes(symbol)) {
    return interaction.reply({ 
      content: `${symbol} is not in the accepted cryptocurrencies list.`, 
      ephemeral: true 
    });
  }
  
  // Remove from the list
  db.config.acceptedCryptocurrencies = db.config.acceptedCryptocurrencies.filter(s => s !== symbol);
  saveDatabase(serverId, db);
  
  interaction.reply({ 
    content: `Removed ${symbol} from the accepted cryptocurrencies list.`,
    ephemeral: true
  });
}

// New command handler for manual entry assignment
async function handleAssignEntriesCommand(interaction) {
  const user = interaction.options.getUser('user');
  const drawId = interaction.options.getString('draw_id');
  const entryCount = interaction.options.getInteger('entries');
  const donationAmount = interaction.options.getNumber('donation_amount') || 0;
  const serverId = interaction.guildId;
  
  // Validate inputs
  if (entryCount <= 0) {
    return interaction.reply({ 
      content: 'The number of entries must be greater than 0.', 
      ephemeral: true 
    });
  }
  
  if (donationAmount < 0) {
    return interaction.reply({ 
      content: 'The donation amount cannot be negative.', 
      ephemeral: true 
    });
  }
  
  // Assign entries
  const result = await manuallyAssignEntries(serverId, user.id, drawId, entryCount, donationAmount);
  
  if (!result.success) {
    return interaction.reply({ 
      content: result.message, 
      ephemeral: true 
    });
  }
  
  const embed = new EmbedBuilder()
    .setTitle('Entries Assigned')
    .setDescription(result.message)
    .setColor('#00FF00')
    .addFields(
      { name: 'User', value: `<@${user.id}>` },
      { name: 'Entries Added', value: result.entriesAdded.toString() },
      { name: 'Total Entries', value: result.totalEntries.toString() }
    );
  
  if (donationAmount > 0) {
    embed.addFields({ name: 'Total Donations', value: `$${result.totalDonated.toFixed(2)}` });
  }
  
  interaction.reply({ embeds: [embed] });
}

// Button interaction handler
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  
  // Handle draw reset and redraw buttons
  if (interaction.customId.startsWith('reset_')) {
    const [, drawId, serverId] = interaction.customId.split('_');
    
    // Check if user has admin permissions
    const hasAdminRole = await isAdmin(serverId, interaction.user.id);
    if (!hasAdminRole) {
      return interaction.reply({ content: 'You do not have permission to use this button.', ephemeral: true });
    }
    
    const db = getDatabase(serverId);
    
    // Check if draw exists
    if (!db.donationDraws[drawId]) {
      return interaction.reply({ content: `Donation draw not found.`, ephemeral: true });
    }
    
    const draw = db.donationDraws[drawId];
    
    // Reset entries
    draw.entries = {};
    
    // Remove entries from users
    for (const userId in db.users) {
      if (db.users[userId].entries && db.users[userId].entries[drawId]) {
        delete db.users[userId].entries[drawId];
      }
    }
    
    saveDatabase(serverId, db);
    
    await interaction.update({ content: `Donation draw ${draw.name} has been reset.`, embeds: [], components: [] });
  }
  
  if (interaction.customId.startsWith('redraw_')) {
    const [, drawId, serverId] = interaction.customId.split('_');
    
    // Check if user has admin permissions
    const hasAdminRole = await isAdmin(serverId, interaction.user.id);
    if (!hasAdminRole) {
      return interaction.reply({ content: 'You do not have permission to use this button.', ephemeral: true });
    }
    
    // Update the message to indicate a redraw is happening
    await interaction.update({ content: 'Selecting new winner...', components: [] });
    
    // Create a fake options object for the handler
    const fakeOptions = {
      getString: (name) => name === 'draw_id' ? drawId : null
    };
    
    // Create a fake interaction object
    const fakeInteraction = {
      options: fakeOptions,
      reply: (content) => interaction.followUp(content),
      user: interaction.user,
      guild: interaction.guild,
      guildId: serverId
    };
    
    // Call the select winner handler
    await handleSelectWinnerCommand(fakeInteraction);
  }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);

console.log('Donor Rewards bot is starting...');
