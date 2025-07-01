import { getDatabase } from '../database.js';

// Check if a feature is enabled for a server
export function isFeatureEnabled(serverId, featureName) {
  const db = getDatabase(serverId);
  return db.config?.featureToggles?.[featureName] === true;
}

// Enable a feature for a server
export function enableFeature(serverId, featureName) {
  const db = getDatabase(serverId);
  if (!db.config.featureToggles) {
    db.config.featureToggles = {};
  }
  db.config.featureToggles[featureName] = true;
  return db;
}

// Disable a feature for a server
export function disableFeature(serverId, featureName) {
  const db = getDatabase(serverId);
  if (!db.config.featureToggles) {
    db.config.featureToggles = {};
  }
  db.config.featureToggles[featureName] = false;
  return db;
}

// Get all features and their status
export function getAllFeatures(serverId) {
  const db = getDatabase(serverId);
  return db.config?.featureToggles || {};
}

// Feature categories for organization
export const FEATURE_CATEGORIES = {
  CORE: 'Core Features',
  ADVANCED: 'Advanced Features',
  EXTRA: 'Extra Features'
};

// Feature definitions with descriptions
export const FEATURES = {
  // Core Features
  vipDraws: {
    name: 'VIP Draws',
    description: 'Special draws only available to users with donor roles',
    category: FEATURE_CATEGORIES.CORE,
    defaultEnabled: true
  },
  streakBonuses: {
    name: 'Streak Bonuses',
    description: 'Bonus entries for consecutive days of donations',
    category: FEATURE_CATEGORIES.CORE,
    defaultEnabled: true
  },
  referralSystem: {
    name: 'Referral System',
    description: 'Reward users for referring new donors',
    category: FEATURE_CATEGORIES.CORE,
    defaultEnabled: true
  },
  milestoneRewards: {
    name: 'Milestone Rewards',
    description: 'Special rewards for reaching donation milestones',
    category: FEATURE_CATEGORIES.CORE,
    defaultEnabled: true
  },
  luckyNumbers: {
    name: 'Lucky Numbers',
    description: 'Users can select lucky numbers for bonus entries',
    category: FEATURE_CATEGORIES.CORE,
    defaultEnabled: true
  },
  multiWinnerDraws: {
    name: 'Multi-Winner Draws',
    description: 'Draws can have multiple winners',
    category: FEATURE_CATEGORIES.CORE,
    defaultEnabled: true
  },
  personalDashboard: {
    name: 'Personal Dashboard',
    description: 'Users can view their donation stats and entries',
    category: FEATURE_CATEGORIES.CORE,
    defaultEnabled: true
  },
  drawNotifications: {
    name: 'Draw Notifications',
    description: 'Notify users about upcoming and completed draws',
    category: FEATURE_CATEGORIES.CORE,
    defaultEnabled: true
  },
  donationStreaks: {
    name: 'Donation Streaks',
    description: 'Track consecutive days of donations',
    category: FEATURE_CATEGORIES.CORE,
    defaultEnabled: true
  },
  
  // Advanced Features
  achievementSystem: {
    name: 'Achievement System',
    description: 'Users can earn achievements for donations and wins',
    category: FEATURE_CATEGORIES.ADVANCED,
    defaultEnabled: true
  },
  seasonalLeaderboards: {
    name: 'Seasonal Leaderboards',
    description: 'Leaderboards that reset on a schedule',
    category: FEATURE_CATEGORIES.ADVANCED,
    defaultEnabled: true
  },
  advancedAnalytics: {
    name: 'Advanced Analytics',
    description: 'Detailed donation and draw statistics',
    category: FEATURE_CATEGORIES.ADVANCED,
    defaultEnabled: true
  },
  automatedDraws: {
    name: 'Automated Draws',
    description: 'Automatically select winners at scheduled times',
    category: FEATURE_CATEGORIES.ADVANCED,
    defaultEnabled: true
  },
  drawTemplates: {
    name: 'Draw Templates',
    description: 'Save and reuse draw configurations',
    category: FEATURE_CATEGORIES.ADVANCED,
    defaultEnabled: true
  },
  bulkUserManagement: {
    name: 'Bulk User Management',
    description: 'Manage multiple users at once',
    category: FEATURE_CATEGORIES.ADVANCED,
    defaultEnabled: true
  },
  customEmbedThemes: {
    name: 'Custom Embed Themes',
    description: 'Customize the colors and appearance of embeds',
    category: FEATURE_CATEGORIES.ADVANCED,
    defaultEnabled: true
  },
  dailyWeeklyChallenges: {
    name: 'Daily/Weekly Challenges',
    description: 'Special donation challenges with rewards',
    category: FEATURE_CATEGORIES.ADVANCED,
    defaultEnabled: true
  },
  
  // Extra Features
  donationMultipliers: {
    name: 'Donation Multipliers',
    description: 'Special events with multiplied entries',
    category: FEATURE_CATEGORIES.EXTRA,
    defaultEnabled: true
  },
  communityGoals: {
    name: 'Community Goals',
    description: 'Set donation goals for the community to reach',
    category: FEATURE_CATEGORIES.EXTRA,
    defaultEnabled: true
  },
  seasonalEvents: {
    name: 'Seasonal Events',
    description: 'Special events for holidays and seasons',
    category: FEATURE_CATEGORIES.EXTRA,
    defaultEnabled: true
  },
  donorSpotlight: {
    name: 'Donor Spotlight',
    description: 'Highlight top donors in a special channel',
    category: FEATURE_CATEGORIES.EXTRA,
    defaultEnabled: true
  },
  blacklistSystem: {
    name: 'Blacklist System',
    description: 'Prevent specific users from participating in draws',
    category: FEATURE_CATEGORIES.EXTRA,
    defaultEnabled: true
  },
  antifraudDetection: {
    name: 'Anti-fraud Detection',
    description: 'Detect suspicious donation patterns',
    category: FEATURE_CATEGORIES.EXTRA,
    defaultEnabled: true
  },
  cooldownPeriods: {
    name: 'Cooldown Periods',
    description: 'Set cooldowns between donations',
    category: FEATURE_CATEGORIES.EXTRA,
    defaultEnabled: true
  },
  adminActionLogging: {
    name: 'Admin Action Logging',
    description: 'Log all admin actions',
    category: FEATURE_CATEGORIES.EXTRA,
    defaultEnabled: true
  },
  roleBasedPermissions: {
    name: 'Role-Based Permissions',
    description: 'Set different permission levels for different roles',
    category: FEATURE_CATEGORIES.EXTRA,
    defaultEnabled: true
  },
  backupAutomation: {
    name: 'Backup Automation',
    description: 'Automatically backup the database',
    category: FEATURE_CATEGORIES.EXTRA,
    defaultEnabled: true
  },
  anonymousMode: {
    name: 'Anonymous Mode',
    description: 'Allow users to hide their identity',
    category: FEATURE_CATEGORIES.EXTRA,
    defaultEnabled: true
  },
  contextSensitiveHelp: {
    name: 'Context-Sensitive Help',
    description: 'Help command that adapts to the current context',
    category: FEATURE_CATEGORIES.EXTRA,
    defaultEnabled: true
  }
};

// Initialize default features for a server
export function initializeDefaultFeatures(serverId) {
  const db = getDatabase(serverId);
  
  if (!db.config.featureToggles) {
    db.config.featureToggles = {};
  }
  
  // Set default values for all features
  for (const [featureKey, featureData] of Object.entries(FEATURES)) {
    if (db.config.featureToggles[featureKey] === undefined) {
      db.config.featureToggles[featureKey] = featureData.defaultEnabled;
    }
  }
  
  return db;
}
