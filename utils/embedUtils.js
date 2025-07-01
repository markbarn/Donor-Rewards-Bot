import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { getDatabase } from '../database.js';
import { FEATURES, FEATURE_CATEGORIES } from './featureUtils.js';

// Default theme colors
const DEFAULT_THEME = {
  primary: '#4CAF50',
  secondary: '#2196F3',
  accent: '#FF9800',
  error: '#F44336',
  warning: '#FFC107',
  info: '#00BCD4',
  success: '#8BC34A',
  vip: '#9C27B0',
  special: '#E91E63',
};

// Get theme color for a server
export function getThemeColor(serverId, colorName = 'primary') {
  const db = getDatabase(serverId);
  return db.config?.theme?.[colorName] || DEFAULT_THEME[colorName] || DEFAULT_THEME.primary;
}

// Create a rich embed with consistent styling
export function createEmbed(serverId, options = {}) {
  const {
    title,
    description,
    color = 'primary',
    thumbnail,
    image,
    author,
    footer = 'Powered By Aegisum Eco System',
    timestamp = true,
    url,
    fields = []
  } = options;
  
  const embed = new EmbedBuilder();
  
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  
  // Set color from theme
  embed.setColor(getThemeColor(serverId, color));
  
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);
  if (author) embed.setAuthor(author);
  if (footer) embed.setFooter({ text: footer });
  if (timestamp) embed.setTimestamp();
  if (url) embed.setURL(url);
  
  // Add fields
  for (const field of fields) {
    embed.addFields(field);
  }
  
  return embed;
}

// Create admin dashboard embed
export async function createAdminDashboard(serverId) {
  const db = getDatabase(serverId);
  
  // Create the embed
  const embed = createEmbed(serverId, {
    title: '⚙️ Admin Dashboard',
    description: 'Manage the Donor Rewards bot settings:',
    color: 'secondary',
    fields: [
      {
        name: '🛡️ Admin Role',
        value: db.config?.adminRoleId ? `<@&${db.config.adminRoleId}>` : 'Not set',
        inline: true
      },
      {
        name: '🔔 Notification Channel',
        value: db.config?.notificationChannelId ? `<#${db.config.notificationChannelId}>` : 'Not set',
        inline: true
      },
      {
        name: '📊 Statistics',
        value: `Total Draws: ${Object.keys(db.donationDraws || {}).length}\nTotal Users: ${Object.keys(db.users || {}).length}`,
        inline: true
      }
    ]
  });
  
  // Add active draws section
  const activeDraws = Object.entries(db.donationDraws || {})
    .filter(([_, draw]) => draw.active)
    .slice(0, 3);
  
  if (activeDraws.length > 0) {
    let drawsText = '';
    for (const [id, draw] of activeDraws) {
      const totalEntries = Object.values(draw.entries || {}).reduce((sum, count) => sum + count, 0);
      drawsText += `**${draw.name}** (${id})\n`;
      drawsText += `Entries: ${totalEntries}/${draw.maxEntries}\n`;
      drawsText += `Reward: ${draw.reward}\n\n`;
    }
    
    embed.addFields({
      name: '🎪 Active Draws (Top 3)',
      value: drawsText.trim() || 'No active draws',
      inline: false
    });
  } else {
    embed.addFields({
      name: '🎪 Active Draws',
      value: 'No active draws',
      inline: false
    });
  }
  
  // Add feature status section
  const enabledFeatures = Object.entries(db.config?.featureToggles || {})
    .filter(([_, enabled]) => enabled)
    .map(([feature, _]) => feature);
  
  const disabledFeatures = Object.entries(db.config?.featureToggles || {})
    .filter(([_, enabled]) => !enabled)
    .map(([feature, _]) => feature);
  
  embed.addFields({
    name: '✅ Enabled Features',
    value: enabledFeatures.length > 0 
      ? enabledFeatures.slice(0, 5).map(f => `• ${FEATURES[f]?.name || f}`).join('\n') + (enabledFeatures.length > 5 ? `\n• ...and ${enabledFeatures.length - 5} more` : '')
      : 'No features enabled',
    inline: true
  });
  
  embed.addFields({
    name: '❌ Disabled Features',
    value: disabledFeatures.length > 0 
      ? disabledFeatures.slice(0, 5).map(f => `• ${FEATURES[f]?.name || f}`).join('\n') + (disabledFeatures.length > 5 ? `\n• ...and ${disabledFeatures.length - 5} more` : '')
      : 'No features disabled',
    inline: true
  });
  
  // Create action buttons
  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('edit_adminRole')
        .setLabel('Edit Admin Role')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🛡️'),
      new ButtonBuilder()
        .setCustomId('edit_notificationChannel')
        .setLabel('Edit Notification Channel')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔔'),
      new ButtonBuilder()
        .setCustomId('manage_draws')
        .setLabel('Manage Draws')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎪')
    );
  
  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('manage_users')
        .setLabel('Manage Users')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👥'),
      new ButtonBuilder()
        .setCustomId('manage_features')
        .setLabel('Manage Features')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⚙️'),
      new ButtonBuilder()
        .setCustomId('refresh_dashboard')
        .setLabel('Refresh')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔄')
    );
  
  return { embed, components: [row1, row2] };
}

// Create draw details embed
export function createDrawEmbed(serverId, drawId) {
  const db = getDatabase(serverId);
  const draw = db.donationDraws?.[drawId];
  
  if (!draw) {
    return createEmbed(serverId, {
      title: '❌ Draw Not Found',
      description: `No draw found with ID "${drawId}".`,
      color: 'error'
    });
  }
  
  const totalEntries = Object.values(draw.entries || {}).reduce((sum, count) => sum + count, 0);
  const entriesPercent = Math.round((totalEntries / draw.maxEntries) * 100);
  
  // Create progress bar
  const progressBarLength = 20;
  const filledBars = Math.round((entriesPercent / 100) * progressBarLength);
  const progressBar = '█'.repeat(filledBars) + '░'.repeat(progressBarLength - filledBars);
  
  // Format draw time if set
  let drawTimeText = 'Not scheduled';
  if (draw.drawTime) {
    const drawDate = new Date(draw.drawTime);
    drawTimeText = `<t:${Math.floor(drawDate.getTime() / 1000)}:F>`;
  }
  
  return createEmbed(serverId, {
    title: `🎁 ${draw.name}`,
    description: `**ID:** ${drawId}\n**Status:** ${draw.active ? '✅ Active' : '❌ Inactive'}`,
    color: draw.active ? 'success' : 'error',
    thumbnail: 'https://cdn.discordapp.com/attachments/1234567890/1234567890/gift.png',
    fields: [
      {
        name: '💰 Donation Range',
        value: `$${draw.minAmount}${draw.maxAmount === 1000000 ? '+' : ` - $${draw.maxAmount}`}`,
        inline: true
      },
      {
        name: '🏆 Reward',
        value: draw.reward,
        inline: true
      },
      {
        name: '📅 Category',
        value: draw.category || 'Uncategorized',
        inline: true
      },
      {
        name: '🎟️ Entries',
        value: `${totalEntries}/${draw.maxEntries} (${entriesPercent}%)\n${progressBar}`,
        inline: false
      },
      {
        name: '⏰ Draw Time',
        value: drawTimeText,
        inline: true
      },
      {
        name: '🔒 Settings',
        value: `Manual Entries Only: ${draw.manualEntriesOnly ? 'Yes' : 'No'}\nVIP Only: ${draw.vipOnly ? 'Yes' : 'No'}\nMulti-Winner: ${draw.multiWinner ? `Yes (${draw.winnerCount})` : 'No'}`,
        inline: true
      }
    ]
  });
}

// Create user profile embed
export function createUserProfileEmbed(serverId, userId, targetUser = null) {
  const db = getDatabase(serverId);
  const userData = db.users?.[userId];
  
  if (!userData) {
    return createEmbed(serverId, {
      title: '❌ User Not Found',
      description: targetUser 
        ? `${targetUser.username} hasn't made any donations yet.`
        : `You haven't made any donations yet.`,
      color: 'error'
    });
  }
  
  // Check if anonymous mode is enabled
  const isAnonymous = userData.privacyEnabled && db.config?.featureToggles?.anonymousMode;
  const displayName = isAnonymous ? '🕶️ Anonymous' : userData.username;
  
  // Calculate total entries
  const totalEntries = Object.values(userData.entries || {}).reduce((sum, count) => sum + count, 0);
  
  // Get achievements if enabled
  let achievementsText = 'Achievement system is disabled.';
  if (db.config?.featureToggles?.achievementSystem) {
    const achievements = userData.achievements || [];
    achievementsText = achievements.length > 0
      ? achievements.map(id => `• ${id}`).join('\n')
      : 'No achievements unlocked yet.';
  }
  
  return createEmbed(serverId, {
    title: targetUser 
      ? `👤 ${displayName}'s Profile`
      : '👤 Your Profile',
    description: targetUser
      ? `Here's ${displayName}'s donation information:`
      : 'Here\'s your donation information:',
    color: 'primary',
    thumbnail: targetUser?.avatarURL() || null,
    fields: [
      {
        name: '💰 Total Donated',
        value: `$${userData.totalDonated?.toFixed(2) || '0.00'}`,
        inline: true
      },
      {
        name: '🏆 Draws Won',
        value: userData.wins?.toString() || '0',
        inline: true
      },
      {
        name: '🎟️ Total Entries',
        value: totalEntries.toString(),
        inline: true
      },
      {
        name: '🔥 Donation Streak',
        value: `Current: ${userData.currentStreak || 0} days\nLongest: ${userData.longestStreak || 0} days`,
        inline: true
      },
      {
        name: '📅 Last Donation',
        value: userData.lastDonationDate 
          ? `<t:${Math.floor(new Date(userData.lastDonationDate).getTime() / 1000)}:R>`
          : 'Never',
        inline: true
      },
      {
        name: '🏅 Achievements',
        value: achievementsText,
        inline: false
      }
    ]
  });
}

// Create leaderboard embed
export function createLeaderboardEmbed(serverId, users, options = {}) {
  const {
    title = '🏆 Donation Leaderboard',
    description = 'Top donors by total contribution:',
    limit = 10,
    sortBy = 'totalDonated',
    sortDirection = 'desc'
  } = options;
  
  const db = getDatabase(serverId);
  
  // Sort users by the specified field
  const sortedUsers = [...users].sort((a, b) => {
    const aValue = a[1][sortBy] || 0;
    const bValue = b[1][sortBy] || 0;
    return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
  }).slice(0, limit);
  
  if (sortedUsers.length === 0) {
    return createEmbed(serverId, {
      title,
      description: 'No data available for the leaderboard.',
      color: 'warning'
    });
  }
  
  // Create leaderboard text
  let leaderboardText = '';
  sortedUsers.forEach(([userId, userData], index) => {
    // Check if anonymous mode is enabled
    const isAnonymous = userData.privacyEnabled && db.config?.featureToggles?.anonymousMode;
    const displayName = isAnonymous ? '🕶️ Anonymous' : userData.username;
    
    // Add medal emoji for top 3
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    
    // Format the value based on the sort field
    let value = '';
    if (sortBy === 'totalDonated') {
      value = `$${userData.totalDonated?.toFixed(2) || '0.00'}`;
    } else if (sortBy === 'wins') {
      value = `${userData.wins || 0} wins`;
    } else {
      value = userData[sortBy]?.toString() || '0';
    }
    
    leaderboardText += `${medal} **${displayName}** - ${value}\n`;
  });
  
  return createEmbed(serverId, {
    title,
    description,
    color: 'accent',
    fields: [
      {
        name: 'Rankings',
        value: leaderboardText,
        inline: false
      }
    ]
  });
}

// Create draw winner announcement embed
export function createWinnerEmbed(serverId, drawId, winnerId, winnerUsername, entries, totalEntries) {
  const db = getDatabase(serverId);
  const draw = db.donationDraws?.[drawId];
  
  if (!draw) {
    return createEmbed(serverId, {
      title: '❌ Draw Not Found',
      description: `No draw found with ID "${drawId}".`,
      color: 'error'
    });
  }
  
  // Check if anonymous mode is enabled
  const userData = db.users?.[winnerId];
  const isAnonymous = userData?.privacyEnabled && db.config?.featureToggles?.anonymousMode;
  const displayName = isAnonymous ? '🕶️ Anonymous' : winnerUsername;
  
  // Calculate odds
  const odds = ((entries / totalEntries) * 100).toFixed(2);
  
  return createEmbed(serverId, {
    title: `🎉 ${draw.name} Winner!`,
    description: `Congratulations to <@${winnerId}>!`,
    color: 'success',
    thumbnail: 'https://cdn.discordapp.com/attachments/1234567890/1234567890/trophy.png',
    fields: [
      {
        name: '🏆 Reward',
        value: draw.reward,
        inline: true
      },
      {
        name: '🎯 Winning Odds',
        value: `${entries} out of ${totalEntries} entries (${odds}%)`,
        inline: true
      },
      {
        name: '📊 Draw Details',
        value: `Total Entries: ${totalEntries}\nDraw ID: ${drawId}`,
        inline: false
      }
    ]
  });
}

// Create help embed
export function createHelpEmbed(serverId) {
  return createEmbed(serverId, {
    title: '📚 Donor Rewards Help',
    description: 'Here\'s how to use the Donor Rewards system:',
    color: 'info',
    fields: [
      {
        name: '💰 Making Donations',
        value: 'Use `$tip @recipient amount` to donate.\nTo enter a specific draw, add the draw ID: `$tip @recipient amount #drawID`',
        inline: false
      },
      {
        name: '🎁 Viewing Draws',
        value: '`/draws` - See all active draws\n`/draw_ids` - Get IDs for specific draws\n`/entries` - Check your entries',
        inline: false
      },
      {
        name: '📊 Statistics',
        value: '`/profile` - View your donation dashboard\n`/leaderboard` - See top donors\n`/achievements` - View your achievements',
        inline: false
      },
      {
        name: '🔒 Privacy Settings',
        value: '`/privacy on/off` - Toggle anonymous mode',
        inline: false
      },
      {
        name: '🛠️ Admin Commands',
        value: '`/admin` - Access admin dashboard\n`/create_draw` - Create a new draw\n`/select_winner` - Select a winner from a draw',
        inline: false
      }
    ]
  });
}

// Create feature list embed
export function createFeatureListEmbed(serverId) {
  const db = getDatabase(serverId);
  const featureToggles = db.config?.featureToggles || {};
  
  // Group features by category
  const featuresByCategory = {};
  
  for (const [featureKey, featureData] of Object.entries(FEATURES)) {
    const category = featureData.category;
    if (!featuresByCategory[category]) {
      featuresByCategory[category] = [];
    }
    
    featuresByCategory[category].push({
      key: featureKey,
      ...featureData,
      enabled: featureToggles[featureKey] === true
    });
  }
  
  // Create embed
  const embed = createEmbed(serverId, {
    title: '✨ Feature Toggles',
    description: 'Here\'s a list of all features and their current status:',
    color: 'info'
  });
  
  // Add fields for each category
  for (const [category, features] of Object.entries(featuresByCategory)) {
    let featureText = '';
    
    for (const feature of features) {
      const status = feature.enabled ? '✅ Enabled' : '❌ Disabled';
      featureText += `• **${feature.name}**: ${status}\n`;
    }
    
    embed.addFields({
      name: category,
      value: featureText || 'No features in this category.',
      inline: false
    });
  }
  
  return embed;
}
