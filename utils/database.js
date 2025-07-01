import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { logger } from "./logger.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, "..", "data")

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

const DEFAULT_ACCEPTED_CRYPTOCURRENCIES = [
  "AEGS",
  "LTC",
  "SOL",
  "USDT",
  "BTC",
  "XRP",
  "DOGE",
  "SHIB",
  "SHIC",
  "BNB",
  "USDC",
  "ETH",
  "XLA",
  "ADA",
  "AVAX",
  "TON",
  "TRON",
  "PEP",
  "BONC",
]

const DEFAULT_FEATURE_TOGGLES = {
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
}

const DEFAULT_THEME = {
  primary: "#4CAF50",
  secondary: "#2196F3",
  accent: "#FF9800",
  error: "#F44336",
  warning: "#FFC107",
  info: "#00BCD4",
  success: "#8BC34A",
  vip: "#9C27B0",
  special: "#E91E63",
}

export function getDatabase(serverId) {
  const dbFile = path.join(DATA_DIR, `${serverId}.json`)

  if (!fs.existsSync(dbFile)) {
    const defaultData = createDefaultDatabase()
    fs.writeFileSync(dbFile, JSON.stringify(defaultData, null, 2))
    logger.info(`Created default database file for server ${serverId}`)
  }

  try {
    const data = JSON.parse(fs.readFileSync(dbFile, "utf8"))

    // Ensure all required fields exist (migration)
    const migrated = migrateDatabase(data)
    if (migrated) {
      saveDatabase(serverId, data)
    }

    return data
  } catch (error) {
    logger.error(`Error reading database for server ${serverId}:`, error)
    const defaultData = createDefaultDatabase()
    saveDatabase(serverId, defaultData)
    return defaultData
  }
}

export function saveDatabase(serverId, data) {
  const dbFile = path.join(DATA_DIR, `${serverId}.json`)

  try {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2))
    return true
  } catch (error) {
    logger.error(`Error saving database for server ${serverId}:`, error)
    return false
  }
}

function createDefaultDatabase() {
  return {
    donationDraws: {},
    users: {},
    config: {
      allowedRecipients: [],
      adminRoleId: null,
      notificationChannelId: null,
      logChannelId: null,
      acceptedCryptocurrencies: DEFAULT_ACCEPTED_CRYPTOCURRENCIES,
      donationGoals: {},
      featureToggles: DEFAULT_FEATURE_TOGGLES,
      theme: DEFAULT_THEME,
      globalBlacklist: { users: [], roles: [] },
      seasonalLeaderboard: { startDate: null, endDate: null, name: "Season 1", active: false },
      cooldowns: { donation: 0 },
      adminRoles: {},
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
      lastUpdated: Date.now(),
    },
    scheduledTasks: [],
    donationMultipliers: [],
    luckyNumbers: {},
  }
}

function migrateDatabase(data) {
  let migrated = false

  // Ensure config exists
  if (!data.config) {
    data.config = {}
    migrated = true
  }

  // Ensure feature toggles exist
  if (!data.config.featureToggles) {
    data.config.featureToggles = DEFAULT_FEATURE_TOGGLES
    migrated = true
  }

  // Ensure theme exists
  if (!data.config.theme) {
    data.config.theme = DEFAULT_THEME
    migrated = true
  }

  // Ensure accepted cryptocurrencies exist
  if (!data.config.acceptedCryptocurrencies) {
    data.config.acceptedCryptocurrencies = DEFAULT_ACCEPTED_CRYPTOCURRENCIES
    migrated = true
  }

  // Ensure users have privacy settings
  if (data.users) {
    for (const userId in data.users) {
      if (!data.users[userId].hasOwnProperty("privacyEnabled")) {
        data.users[userId].privacyEnabled = false
        migrated = true
      }
    }
  }

  // Ensure required collections exist
  const requiredCollections = [
    "donationDraws",
    "users",
    "pendingTips",
    "drawHistory",
    "entryHistory",
    "backups",
    "achievements",
    "referrals",
    "challenges",
    "templates",
    "scheduledTasks",
    "donationMultipliers",
    "luckyNumbers",
  ]

  for (const collection of requiredCollections) {
    if (!data[collection]) {
      data[collection] = {}
      migrated = true
    }
  }

  // Ensure analytics exists
  if (!data.analytics) {
    data.analytics = {
      dailyDonations: {},
      weeklyDonations: {},
      monthlyDonations: {},
      totalDonations: 0,
      donorCount: 0,
      averageDonation: 0,
      lastUpdated: Date.now(),
    }
    migrated = true
  }

  return migrated
}

export function createBackup(serverId) {
  try {
    const data = getDatabase(serverId)
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const backupFile = path.join(DATA_DIR, `${serverId}_backup_${timestamp}.json`)

    fs.writeFileSync(backupFile, JSON.stringify(data, null, 2))
    logger.info(`Created backup for server ${serverId}: ${backupFile}`)

    return backupFile
  } catch (error) {
    logger.error(`Error creating backup for server ${serverId}:`, error)
    return null
  }
}
