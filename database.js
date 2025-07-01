import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logError, info } from './utils/logger.js';

// Get directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Database functions
export function getDatabase(serverId) {
  const dbFile = path.join(DATA_DIR, `${serverId}.json`);
  
  if (!fs.existsSync(dbFile)) {
    const defaultData = {
      donationDraws: {
        small: {
          name: "Small Appreciation Draw",
          minAmount: 5,
          maxAmount: 19.99,
          entries: {},
          reward: "10 USDT",
          maxEntries: 100,
          active: true,
          drawTime: null,
          drawTimeFormatted: null,
          notificationSent: false,
          manualEntriesOnly: false,
          category: "monthly",
          expirationDate: null,
          createdAt: Date.now(),
          blacklist: { users: [], roles: [] },
          multiWinner: false,
          winnerCount: 1,
          luckyNumbers: false,
          vipOnly: false,
          minDonorTier: null
        },
        medium: {
          name: "Medium Appreciation Draw",
          minAmount: 20,
          maxAmount: 49.99,
          entries: {},
          reward: "50 USDT",
          maxEntries: 50,
          active: true,
          drawTime: null,
          drawTimeFormatted: null,
          notificationSent: false,
          manualEntriesOnly: false,
          category: "monthly",
          expirationDate: null,
          createdAt: Date.now(),
          blacklist: { users: [], roles: [] },
          multiWinner: false,
          winnerCount: 1,
          luckyNumbers: false,
          vipOnly: false,
          minDonorTier: null
        },
        large: {
          name: "Large Appreciation Draw",
          minAmount: 50,
          maxAmount: 1000000,
          entries: {},
          reward: "200 USDT",
          maxEntries: 20,
          active: true,
          drawTime: null,
          drawTimeFormatted: null,
          notificationSent: false,
          manualEntriesOnly: false,
          category: "monthly",
          expirationDate: null,
          createdAt: Date.now(),
          blacklist: { users: [], roles: [] },
          multiWinner: false,
          winnerCount: 1,
          luckyNumbers: false,
          vipOnly: false,
          minDonorTier: null
        }
      },
      users: {},
      config: {
        allowedRecipients: [],
        adminRoleId: null,
        notificationChannelId: null,
        logChannelId: null,
        acceptedCryptocurrencies: [
          "AEGS", "LTC", "SOL", "USDT", "BTC", "XRP", "DOGE", "SHIB", 
          "SHIC", "BNB", "USDC", "ETH", "XLA", "ADA", "AVAX", "TON", 
          "TRON", "PEP", "BONC"
        ],
        donationGoals: {},
        featureToggles: {
          vipDraws: true,
          streakBonuses: true,
          referralSystem: true,
          milestoneRewards: true,
          luckyNumbers: true,
          multiWinnerDraws: true,
          personalDashboard: true,
          drawNotifications: true,
          donationStreaks: true,
          achievementSystem: true,
          seasonalLeaderboards: true,
          advancedAnalytics: true,
          automatedDraws: true,
          drawTemplates: true,
          bulkUserManagement: true,
          customEmbedThemes: true,
          dailyWeeklyChallenges: true,
          donationMultipliers: true,
          communityGoals: true,
          seasonalEvents: true,
          donorSpotlight: true,
          blacklistSystem: true,
          antifraudDetection: true,
          cooldownPeriods: true,
          adminActionLogging: true,
          roleBasedPermissions: true,
          backupAutomation: true,
          anonymousMode: true,
          contextSensitiveHelp: true
        },
        theme: {
          primary: "#4CAF50",
          secondary: "#2196F3",
          accent: "#FF9800",
          error: "#F44336",
          warning: "#FFC107",
          info: "#00BCD4",
          success: "#8BC34A",
          vip: "#9C27B0",
          special: "#E91E63"
        },
        globalBlacklist: { users: [], roles: [] },
        seasonalLeaderboard: { startDate: null, endDate: null, name: "Season 1", active: false },
        cooldowns: { donation: 0 },
        adminRoles: {}
      },
      pendingTips: {},
      drawHistory: [],
      entryHistory: [],
      backups: [],
      achievements: {},
      referrals: {},
      challenges: {},
      templates: {},
      analytics: {
        dailyDonations: {},
        weeklyDonations: {},
        monthlyDonations: {},
        totalDonations: 0,
        donorCount: 0,
        averageDonation: 0,
        lastUpdated: Date.now()
      },
      scheduledTasks: [],
      donationMultipliers: [],
      luckyNumbers: {}
    };
    
    fs.writeFileSync(dbFile, JSON.stringify(defaultData, null, 2));
    info(`Created default database file for server ${serverId}`);
    return defaultData;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    return data;
  } catch (error) {
    logError(`Error reading database for server ${serverId}: ${error.message}`);
    
    // If there's an error reading the file, try to restore from backup
    try {
      const backupFiles = fs.readdirSync(DATA_DIR)
        .filter(file => file.startsWith(`${serverId}_backup_`))
        .sort()
        .reverse();
      
      if (backupFiles.length > 0) {
        const latestBackup = path.join(DATA_DIR, backupFiles[0]);
        const backupData = JSON.parse(fs.readFileSync(latestBackup, 'utf8'));
        
        // Save the restored data
        fs.writeFileSync(dbFile, JSON.stringify(backupData, null, 2));
        
        info(`Restored database for server ${serverId} from backup ${backupFiles[0]}`);
        return backupData;
      }
    } catch (backupError) {
      logError(`Error restoring from backup for server ${serverId}: ${backupError.message}`);
    }
    
    // If all else fails, return a new default database
    return getDatabase(serverId);
  }
}

export function saveDatabase(serverId, data) {
  const dbFile = path.join(DATA_DIR, `${serverId}.json`);
  
  try {
    // Create a backup first
    if (fs.existsSync(dbFile)) {
      const backupFile = path.join(DATA_DIR, `${serverId}_backup_${Date.now()}.json`);
      fs.copyFileSync(dbFile, backupFile);
      
      // Keep only the 5 most recent backups
      const backupFiles = fs.readdirSync(DATA_DIR)
        .filter(file => file.startsWith(`${serverId}_backup_`))
        .sort();
      
      if (backupFiles.length > 5) {
        for (let i = 0; i < backupFiles.length - 5; i++) {
          fs.unlinkSync(path.join(DATA_DIR, backupFiles[i]));
        }
      }
    }
    
    // Save the data
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    logError(`Error saving database for server ${serverId}: ${error.message}`);
    return false;
  }
}

export function createBackup(serverId) {
  const dbFile = path.join(DATA_DIR, `${serverId}.json`);
  
  if (!fs.existsSync(dbFile)) {
    return false;
  }
  
  try {
    const backupFile = path.join(DATA_DIR, `${serverId}_backup_${Date.now()}.json`);
    fs.copyFileSync(dbFile, backupFile);
    info(`Created backup for server ${serverId}: ${backupFile}`);
    return true;
  } catch (error) {
    logError(`Error creating backup for server ${serverId}: ${error.message}`);
    return false;
  }
}

export function listBackups(serverId) {
  try {
    const backupFiles = fs.readdirSync(DATA_DIR)
      .filter(file => file.startsWith(`${serverId}_backup_`))
      .sort()
      .reverse();
    
    return backupFiles.map(file => {
      const timestamp = file.replace(`${serverId}_backup_`, '').replace('.json', '');
      return {
        file,
        timestamp,
        date: new Date(parseInt(timestamp))
      };
    });
  } catch (error) {
    logError(`Error listing backups for server ${serverId}: ${error.message}`);
    return [];
  }
}

export function restoreBackup(serverId, backupFile) {
  const dbFile = path.join(DATA_DIR, `${serverId}.json`);
  const backupPath = path.join(DATA_DIR, backupFile);
  
  if (!fs.existsSync(backupPath)) {
    return false;
  }
  
  try {
    // Create a backup of the current state first
    createBackup(serverId);
    
    // Restore from the specified backup
    fs.copyFileSync(backupPath, dbFile);
    info(`Restored database for server ${serverId} from backup ${backupFile}`);
    return true;
  } catch (error) {
    logError(`Error restoring backup for server ${serverId}: ${error.message}`);
    return false;
  }
}
