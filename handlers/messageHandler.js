import { Events } from 'discord.js';
import { getDatabase, saveDatabase } from '../database.js';
import { isFeatureEnabled } from '../utils/featureUtils.js';
import { logError, info } from '../utils/logger.js';
import { getCryptoPrice } from '../utils/cryptoUtils.js';

// Track pending tips
const pendingTips = new Map();

// Process messages
export async function processMessage(message) {
  // Skip bot messages except from tip.cc
  if (message.author.bot && message.author.id !== process.env.TIP_BOT_ID) return;
  
  // Only process messages in configured servers
  if (!message.guild || !process.env.SERVER_IDS.split(',').includes(message.guild.id)) return;
  
  try {
    // Process tip commands from users
    if (!message.author.bot) {
      await processTipCommand(message);
    } else if (message.author.id === process.env.TIP_BOT_ID) {
      // Process tip.cc bot messages
      await processTipCCMessage(message);
    }
  } catch (error) {
    logError(`Error processing message: ${error.message}`);
  }
}

// Process tip commands from users
async function processTipCommand(message) {
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
    
    info(`Detected tip command with${drawId ? ' draw ID #' + drawId : 'out draw ID'}`);
    
    // Clean up old pending tips (older than 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [key, value] of pendingTips.entries()) {
      if (value.timestamp < fiveMinutesAgo) {
        pendingTips.delete(key);
      }
    }
  }
}

// Process tip.cc bot messages
async function processTipCCMessage(message) {
  // Check for tip error messages
  if (message.content.includes('Tip error') || (message.embeds.length > 0 && message.embeds[0].title === 'Tip error')) {
    info('Detected tip error message');
    return;
  }
  
  // Check if this is a tip confirmation message
  // Support multiple tip.cc message formats
  const tipRegexes = [
    // Format: ✓ @user1 tipped @user2 0.01 BTC ($400.00)
    /\u2705 <@!?(\d+)> tipped <@!?(\d+)> ([\d.]+) ([A-Z]+)(?:\s+$$\$([\d.]+)$$)?/,
    
    // Format: ✓ @user1 sent @user2 0.01 BTC ($400.00)
    /\u2705 <@!?(\d+)> sent <@!?(\d+)> ([\d.]+) ([A-Z]+)(?:\s+$$\$([\d.]+)$$)?/,
    
    // Format: ✓ @user1 sent @user2 and @user3 0.01 BTC ($400.00) each
    /\u2705 <@!?(\d+)> sent <@!?(\d+)> and <@!?(\d+)> ([\d.]+) ([A-Z]+)(?:\s+$$\$([\d.]+)$$)? each/,
    
    // Format with emoji: <emoji> @user1 sent @user2 0.01 BTC (≈ $400.00)
    /<a?:[^:]+:\d+> <@!?(\d+)> sent <@!?(\d+)> \*\*([\d.]+) ([A-Z]+)\*\*(?:\s+$$≈ \$([\d.]+)$$)?/,
    
    // Format with emoji for multiple recipients: <emoji> @user1 sent @user2 and @user3 0.01 BTC (≈ $400.00) each
    /<a?:[^:]+:\d+> <@!?(\d+)> sent <@!?(\d+)> and <@!?(\d+)> \*\*([\d.]+) ([A-Z]+)\*\*(?:\s+$$≈ \$([\d.]+)$$)? each/
  ];
  
  let match = null;
  let matchedRegex = -1;
  
  for (let i = 0; i < tipRegexes.length; i++) {
    match = message.content.match(tipRegexes[i]);
    if (match) {
      matchedRegex = i;
      break;
    }
  }
  
  if (match) {
    // Process based on which regex matched
    if (matchedRegex === 0 || matchedRegex === 1 || matchedRegex === 3) {
      // Single recipient tip
      const [, senderId, receiverId, amount, currency, rawUsdAmount] = match;
      
      // Try to get USD amount, or use the crypto amount as a fallback
      let usdAmount = parseFloat(rawUsdAmount || 0);
      
      // If no USD amount provided, try to get it from the API
      if (!usdAmount && amount) {
        const cryptoPrice = await getCryptoPrice(currency, message.content, parseFloat(amount));
        if (cryptoPrice) {
          usdAmount = parseFloat(amount) * cryptoPrice;
        }
      }
      
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
      
      // Process the tip
      await processTip(message, senderId, receiverId, usdAmount, targetDrawId);
    } else if (matchedRegex === 2 || matchedRegex === 4) {
      // Multiple recipient tip
      const [, senderId, receiverId1, receiverId2, amount, currency, rawUsdAmount] = match;
      
      // Try to get USD amount, or use the crypto amount as a fallback
      let usdAmount = parseFloat(rawUsdAmount || 0);
      
      // If no USD amount provided, try to get it from the API
      if (!usdAmount && amount) {
        const cryptoPrice = await getCryptoPrice(currency, message.content, parseFloat(amount));
        if (cryptoPrice) {
          usdAmount = parseFloat(amount) * cryptoPrice;
        }
      }
      
      // Process for first recipient
      await processTip(message, senderId, receiverId1, usdAmount);
      
      // Process for second recipient
      await processTip(message, senderId, receiverId2, usdAmount);
    }
  }
}

// Process a tip and add entries
async function processTip(message, senderId, receiverId, usdAmount, targetDrawId = null) {
  const serverId = message.guild.id;
  const db = getDatabase(serverId);
  
  // Check if the receiver is in the allowed recipients list
  const isAllowedRecipient = db.config?.allowedRecipients?.some(recipient => {
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
    
    info(`Valid tip detected for draw entry in server ${serverId}: ${senderUsername} tipped ${receiverUsername} $${usdAmount}`);
    
    // Add draw entries - with specific draw ID if provided
    const entries = await addDrawEntries(serverId, senderId, senderUsername, usdAmount, targetDrawId);
    
    // Send confirmation message
    if (entries.length > 0) {
      const embed = createTipConfirmationEmbed(serverId, senderId, entries);
      message.channel.send({ embeds: [embed] });
    }
  }
}

// Add entries to draws based on donation amount
async function addDrawEntries(serverId, userId, username, amountUsd, targetDrawId = null) {
  const db = getDatabase(serverId);
  
  // Initialize user if they don't exist
  if (!db.users[userId]) {
    db.users[userId] = {
      username,
      totalDonated: 0,
      entries: {},
      achievements: [],
      wins: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastDonationDate: null,
      referrals: { referred: [], referredBy: null, bonusEntries: 0 },
      luckyNumbers: {},
      privacyEnabled: false
    };
  }
  
  // Update user's total donated amount
  db.users[userId].totalDonated += amountUsd;
  
  // Update donation streak
  if (isFeatureEnabled(serverId, 'donationStreaks')) {
    updateDonationStreak(db.users[userId]);
  }
  
  // Check for achievements
  if (isFeatureEnabled(serverId, 'achievementSystem')) {
    checkAchievements(db.users[userId]);
  }
  
  // Track which draws the user entered and how many tickets
  const enteredDraws = [];
  
  // If a specific draw ID was provided, only enter that draw
  if (targetDrawId && db.donationDraws[targetDrawId]) {
    const draw = db.donationDraws[targetDrawId];
    
    // Skip inactive draws
    if (!draw.active) {
      info(`Draw ${targetDrawId} is inactive`);
      return enteredDraws;
    }
    
    // Skip manual-only draws
    if (draw.manualEntriesOnly) {
      info(`Draw ${targetDrawId} is manual entries only`);
      return enteredDraws;
    }
    
    // Skip VIP-only draws if user doesn't have the required role
    if (draw.vipOnly && !userHasDonorRole(serverId, userId)) {
      info(`Draw ${targetDrawId} is VIP only and user doesn't have a donor role`);
      return enteredDraws;
    }
    
    // Calculate number of tickets based on the draw's minAmount
    const ticketCount = Math.floor(amountUsd / draw.minAmount);
    
    if (ticketCount > 0) {
      // Initialize entries for this draw if they don't exist
      if (!db.users[userId].entries[targetDrawId]) {
        db.users[userId].entries[targetDrawId] = 0;
      }
      if (!draw.entries[userId]) {
        draw.entries[userId] = 0;
      }
      
      // Check if adding these tickets would exceed the max tickets
      const currentTotalTickets = Object.values(draw.entries).reduce((sum, count) => sum + count, 0);
      const availableTickets = draw.maxEntries - currentTotalTickets;
      const ticketsToAdd = Math.min(ticketCount, availableTickets);
      
      if (ticketsToAdd > 0) {
        // Add tickets
        db.users[userId].entries[targetDrawId] += ticketsToAdd;
        draw.entries[userId] += ticketsToAdd;
        
        enteredDraws.push({
          drawId: targetDrawId,
          drawName: draw.name,
          ticketCount: ticketsToAdd,
          isFull: ticketsToAdd < ticketCount,
          minAmount: draw.minAmount
        });
        
        info(`Added ${ticketsToAdd} tickets for ${username} to ${draw.name} in server ${serverId}`);
      } else {
        enteredDraws.push({
          drawId: targetDrawId,
          drawName: draw.name,
          ticketCount: 0,
          isFull: true,
          minAmount: draw.minAmount
        });
      }
    }
  } else {
    // No specific draw ID provided, enter all eligible draws
    for (const [drawId, draw] of Object.entries(db.donationDraws)) {
      // Skip inactive draws
      if (!draw.active) continue;
      
      // Skip manual-only draws
      if (draw.manualEntriesOnly) continue;
      
      // Skip VIP-only draws if user doesn't have the required role
      if (draw.vipOnly && !userHasDonorRole(serverId, userId)) continue;
      
      if (amountUsd >= draw.minAmount && amountUsd <= draw.maxAmount) {
        // Calculate number of tickets (1 ticket per minAmount)
        const ticketCount = Math.floor(amountUsd / draw.minAmount);
        
        // Initialize entries for this draw if they don't exist
        if (!db.users[userId].entries[drawId]) {
          db.users[userId].entries[drawId] = 0;
        }
        if (!draw.entries[userId]) {
          draw.entries[userId] = 0;
        }
        
        // Check if adding these tickets would exceed the max tickets
        const currentTotalTickets = Object.values(draw.entries).reduce((sum, count) => sum + count, 0);
        const availableTickets = draw.maxEntries - currentTotalTickets;
        const ticketsToAdd = Math.min(ticketCount, availableTickets);
        
        if (ticketsToAdd > 0) {
          // Add tickets
          db.users[userId].entries[drawId] += ticketsToAdd;
          draw.entries[userId] += ticketsToAdd;
          
          enteredDraws.push({
            drawId,
            drawName: draw.name,
            ticketCount: ticketsToAdd,
            isFull: ticketsToAdd < ticketCount,
            minAmount: draw.minAmount
          });
          
          info(`Added ${ticketsToAdd} tickets for ${username} to ${draw.name} in server ${serverId}`);
        } else {
          enteredDraws.push({
            drawId,
            drawName: draw.name,
            ticketCount: 0,
            isFull: true,
            minAmount: draw.minAmount
          });
        }
      }
    }
  }
  
  saveDatabase(serverId, db);
  return enteredDraws;
}

// Update user's donation streak
function updateDonationStreak(userData) {
  const now = new Date();
  const lastDonationDate = userData.lastDonationDate ? new Date(userData.lastDonationDate) : null;
  
  // Initialize streak data if not present
  if (!userData.currentStreak) userData.currentStreak = 0;
  if (!userData.longestStreak) userData.longestStreak = 0;
  
  if (!lastDonationDate) {
    // First donation
    userData.currentStreak = 1;
    userData.longestStreak = 1;
  } else {
    // Calculate days since last donation
    const daysSinceLastDonation = Math.floor((now - lastDonationDate) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastDonation <= 1) {
      // Donation on consecutive days
      userData.currentStreak += 1;
      
      // Update longest streak if current streak is longer
      if (userData.currentStreak > userData.longestStreak) {
        userData.longestStreak = userData.currentStreak;
      }
    } else {
      // Streak broken
      userData.currentStreak = 1;
    }
  }
  
  // Update last donation date
  userData.lastDonationDate = now.toISOString();
}

// Check for achievements
function checkAchievements(userData) {
  if (!userData.achievements) userData.achievements = [];
  
  // First donation achievement
  if (userData.totalDonated > 0 && !userData.achievements.includes('first_donation')) {
    userData.achievements.push('first_donation');
  }
  
  // Generous donor achievement
  if (userData.totalDonated >= 100 && !userData.achievements.includes('generous_donor')) {
    userData.achievements.push('generous_donor');
  }
  
  // Big spender achievement
  if (userData.totalDonated >= 500 && !userData.achievements.includes('big_spender')) {
    userData.achievements.push('big_spender');
  }
  
  // Whale achievement
  if (userData.totalDonated >= 1000 && !userData.achievements.includes('whale')) {
    userData.achievements.push('whale');
  }
  
  // Lucky winner achievement
  if (userData.wins && userData.wins > 0 && !userData.achievements.includes('lucky_winner')) {
    userData.achievements.push('lucky_winner');
  }
}

// Check if user has a donor role
function userHasDonorRole(serverId, userId) {
  // This is a placeholder - implement actual role checking logic
  return true;
}

// Create tip confirmation embed
function createTipConfirmationEmbed(serverId, senderId, entries) {
  const db = getDatabase(serverId);
  
  const embed = {
    title: '🎟️ Draw Entries Added!',
    description: `Thank you for your donation, <@${senderId}>!`,
    color: parseInt(db.config?.theme?.success?.replace('#', '') || '8BC34A', 16),
    fields: [],
    footer: { text: 'Use /entries to see all your tickets' }
  };
  
  // Add fields for each draw entered
  for (const entry of entries) {
    let value = entry.ticketCount > 0
      ? `You received ${entry.ticketCount} ticket(s)! ($${entry.minAmount} per ticket)`
      : 'This draw is full!';
      
    embed.fields.push({
      name: entry.drawName,
      value: value
    });
  }
  
  return embed;
}

// Export the message event handler
export const name = Events.MessageCreate;
export const execute = processMessage;
