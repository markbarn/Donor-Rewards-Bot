import {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ApplicationCommandOptionType,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js"
import dotenv from "dotenv"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

// Load environment variables
dotenv.config()

// Get directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Configuration
const OWNER_ID = process.env.OWNER_ID || "659745190382141453"
const TIP_BOT_ID = "617037497574359050"
const SERVER_IDS = process.env.SERVER_IDS ? process.env.SERVER_IDS.split(",") : []
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || null
const BOT_VERSION = "2.0.0"

// Initial list of accepted cryptocurrencies
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

// Donor role configuration
const DONOR_ROLES = {
  onyx_donor: { minAmount: 500, id: "1357183499185950882", name: "Onyx Donor" },
  diamond_donor: { minAmount: 251, maxAmount: 500, id: "1341176124020883496", name: "Diamond Donor" },
  platinum_donor: { minAmount: 101, maxAmount: 250, id: "1341175847280971907", name: "Platinum Donor" },
  gold_donor: { minAmount: 51, maxAmount: 100, id: "1341175703659348059", name: "Gold Donor" },
  silver_donor: { minAmount: 26, maxAmount: 50, id: "1341175633866391684", name: "Silver Donor" },
  bronze_donor: { minAmount: 5, maxAmount: 25, id: "1341175531932221471", name: "Bronze Donor" },
}

// Draw categories
const DRAW_CATEGORIES = {
  monthly: "Monthly Draws",
  special: "Special Events",
  community: "Community Goals",
  milestone: "Milestone Rewards",
  seasonal: "Seasonal Events",
  vip: "VIP Exclusive",
  daily: "Daily Draws",
  weekly: "Weekly Draws",
}

// Achievement definitions
const ACHIEVEMENTS = {
  first_donation: {
    id: "first_donation",
    name: "First Steps",
    description: "Made your first donation",
    icon: "🌱",
    requirement: (userData) => userData.totalDonated > 0,
  },
  generous_donor: {
    id: "generous_donor",
    name: "Generous Donor",
    description: "Donated at least $100",
    icon: "💰",
    requirement: (userData) => userData.totalDonated >= 100,
  },
  big_spender: {
    id: "big_spender",
    name: "Big Spender",
    description: "Donated at least $500",
    icon: "💎",
    requirement: (userData) => userData.totalDonated >= 500,
  },
  whale: {
    id: "whale",
    name: "Whale",
    description: "Donated at least $1,000",
    icon: "🐋",
    requirement: (userData) => userData.totalDonated >= 1000,
  },
  lucky_winner: {
    id: "lucky_winner",
    name: "Lucky Winner",
    description: "Won a donation draw",
    icon: "🍀",
    requirement: (userData) => userData.wins && userData.wins > 0,
  },
}

// Default feature toggles
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

// Default theme colors
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

console.log(`Bot configured for servers: ${SERVER_IDS.join(", ")}`)

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, "data")
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// Database functions
function getDatabase(serverId) {
  const dbFile = path.join(DATA_DIR, `${serverId}.json`)

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
          minDonorTier: null,
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
          minDonorTier: null,
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
          minDonorTier: null,
        },
      },
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

    fs.writeFileSync(dbFile, JSON.stringify(defaultData, null, 2))
    console.log(`Created default database file for server ${serverId}`)
  }

  try {
    const data = JSON.parse(fs.readFileSync(dbFile, "utf8"))

    // Ensure all required fields exist
    if (!data.config) data.config = {}
    if (!data.config.featureToggles) data.config.featureToggles = DEFAULT_FEATURE_TOGGLES
    if (!data.config.theme) data.config.theme = DEFAULT_THEME
    if (!data.users) data.users = {}
    if (!data.donationDraws) data.donationDraws = {}

    // Initialize user privacy settings
    for (const userId in data.users) {
      if (!data.users[userId].hasOwnProperty("privacyEnabled")) {
        data.users[userId].privacyEnabled = false
      }
    }

    return data
  } catch (error) {
    console.error(`Error reading database for server ${serverId}:`, error)
    return getDatabase(serverId) // Recreate if corrupted
  }
}

function saveDatabase(serverId, data) {
  const dbFile = path.join(DATA_DIR, `${serverId}.json`)
  try {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2))
    return true
  } catch (error) {
    console.error(`Error saving database for server ${serverId}:`, error)
    return false
  }
}

// Create Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
})

// Function to check if user has admin permissions
async function isAdmin(serverId, userId) {
  if (userId === OWNER_ID) return true

  const db = getDatabase(serverId)
  if (!db.config.adminRoleId) return false

  const guild = client.guilds.cache.get(serverId)
  if (!guild) return false

  try {
    const member = await guild.members.fetch(userId)
    return member.roles.cache.has(db.config.adminRoleId)
  } catch (error) {
    console.error("Error checking admin role:", error)
    return false
  }
}

// Function to check if a feature is enabled
function isFeatureEnabled(serverId, featureName) {
  const db = getDatabase(serverId)
  return db.config.featureToggles[featureName] === true
}

// Function to get display name that respects privacy settings
function getDisplayName(userId, username, db) {
  if (db.config.featureToggles.anonymousMode && db.users[userId] && db.users[userId].privacyEnabled) {
    return "🕶️ Anonymous"
  }
  return username
}

// Track pending tips and draw selections
const pendingTips = new Map()
const pendingDrawSelections = new Map()

// Register slash commands when the bot starts
client.once(Events.ClientReady, async () => {
  console.log(`Ready! Logged in as ${client.user.tag}`)

  try {
    const commands = [
      {
        name: "setup",
        description: "Initial setup for the Donor Rewards bot",
        options: [
          {
            name: "admin_role",
            description: "Set the admin role for donation management",
            type: ApplicationCommandOptionType.Role,
            required: true,
          },
          {
            name: "notification_channel",
            description: "Set the channel for donation notifications",
            type: ApplicationCommandOptionType.Channel,
            required: false,
          },
        ],
      },
      {
        name: "admin",
        description: "Access admin dashboard",
      },
      {
        name: "add_recipient",
        description: "Add a user or role as an allowed donation recipient",
        options: [
          {
            name: "recipient",
            description: "The user or role to add as a recipient",
            type: ApplicationCommandOptionType.Mentionable,
            required: true,
          },
        ],
      },
      {
        name: "remove_recipient",
        description: "Remove a user or role from allowed donation recipients",
        options: [
          {
            name: "recipient",
            description: "The user or role to remove",
            type: ApplicationCommandOptionType.Mentionable,
            required: true,
          },
        ],
      },
      {
        name: "create_draw",
        description: "Create a new donation appreciation draw",
        options: [
          {
            name: "id",
            description: "Unique ID for the draw (no spaces)",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "name",
            description: "Display name for the draw",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "min_amount",
            description: "Minimum USD donation amount to enter",
            type: ApplicationCommandOptionType.Number,
            required: true,
          },
          {
            name: "max_amount",
            description: "Maximum USD donation amount to enter (0 for no limit)",
            type: ApplicationCommandOptionType.Number,
            required: true,
          },
          {
            name: "reward",
            description: 'Reward description (e.g., "100 USDT")',
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "max_entries",
            description: "Maximum number of entries available",
            type: ApplicationCommandOptionType.Integer,
            required: true,
          },
          {
            name: "category",
            description: "Draw category",
            type: ApplicationCommandOptionType.String,
            required: false,
            choices: Object.entries(DRAW_CATEGORIES).map(([key, value]) => ({
              name: value,
              value: key,
            })),
          },
        ],
      },
      {
        name: "edit_draw",
        description: "Edit an existing donation draw",
        options: [
          {
            name: "id",
            description: "ID of the draw to edit",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "name",
            description: "New display name",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: "min_amount",
            description: "New minimum USD donation amount",
            type: ApplicationCommandOptionType.Number,
            required: false,
          },
          {
            name: "max_amount",
            description: "New maximum USD donation amount",
            type: ApplicationCommandOptionType.Number,
            required: false,
          },
          {
            name: "reward",
            description: "New reward description",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: "max_entries",
            description: "New maximum entries",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "active",
            description: "Set draw active status",
            type: ApplicationCommandOptionType.Boolean,
            required: false,
          },
          {
            name: "category",
            description: "New draw category",
            type: ApplicationCommandOptionType.String,
            required: false,
            choices: Object.entries(DRAW_CATEGORIES).map(([key, value]) => ({
              name: value,
              value: key,
            })),
          },
          {
            name: "manual_only",
            description: "Only allow manual entry assignments",
            type: ApplicationCommandOptionType.Boolean,
            required: false,
          },
          {
            name: "vip_only",
            description: "Restrict to users with donor roles",
            type: ApplicationCommandOptionType.Boolean,
            required: false,
          },
        ],
      },
      {
        name: "select_winner",
        description: "Select a winner from a donation draw",
        options: [
          {
            name: "draw_id",
            description: "ID of the draw to select from",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: "reset_draw",
        description: "Reset entries for a donation draw",
        options: [
          {
            name: "draw_id",
            description: "ID of the draw to reset",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: "entries",
        description: "Check your donation draw entries",
      },
      {
        name: "draws",
        description: "Show available donation draws",
      },
      {
        name: "draw_ids",
        description: "Show all draw IDs for donating",
      },
      {
        name: "leaderboard",
        description: "Show top donors",
        options: [
          {
            name: "limit",
            description: "Number of users to show (default: 10)",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
        ],
      },
      {
        name: "entry_leaderboard",
        description: "Show users with the most entries in a specific draw",
        options: [
          {
            name: "draw_id",
            description: "ID of the draw to show leaderboard for",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "limit",
            description: "Number of users to show (default: 10)",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
        ],
      },
      {
        name: "reset_leaderboard",
        description: "Reset the donation leaderboard",
        options: [
          {
            name: "confirm",
            description: 'Type "confirm" to reset the leaderboard',
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: "donate",
        description: "Instructions for donating to support development",
        options: [
          {
            name: "draw_id",
            description: "ID of the specific draw to enter",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
        ],
      },
      {
        name: "help",
        description: "Shows how to use the donation rewards system",
      },
      {
        name: "terms",
        description: "Shows the terms and conditions for the donation system",
      },
      {
        name: "donor_roles",
        description: "Shows information about donor roles and benefits",
      },
      {
        name: "accepted_coins",
        description: "Show the list of accepted cryptocurrencies",
      },
      {
        name: "add_cryptocurrency",
        description: "Add a cryptocurrency to the accepted list",
        options: [
          {
            name: "symbol",
            description: "Symbol of the cryptocurrency (e.g., BTC, ETH)",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: "remove_cryptocurrency",
        description: "Remove a cryptocurrency from the accepted list",
        options: [
          {
            name: "symbol",
            description: "Symbol of the cryptocurrency (e.g., BTC, ETH)",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: "assign_entries",
        description: "Manually assign entries to a user or role",
        options: [
          {
            name: "target",
            description: "The user or role to assign entries to",
            type: ApplicationCommandOptionType.Mentionable,
            required: true,
          },
          {
            name: "draw_id",
            description: "ID of the draw to assign entries for",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "entries",
            description: "Number of entries to assign",
            type: ApplicationCommandOptionType.Integer,
            required: true,
          },
          {
            name: "donation_amount",
            description: "USD amount to add to user's total",
            type: ApplicationCommandOptionType.Number,
            required: false,
          },
          {
            name: "confirm_batch",
            description: "Confirm batch assignment for roles",
            type: ApplicationCommandOptionType.Boolean,
            required: false,
          },
        ],
      },
      {
        name: "my_stats",
        description: "View your personal donation dashboard",
      },
      {
        name: "achievements",
        description: "View your achievements",
        options: [
          {
            name: "user",
            description: "View achievements for another user (admin only)",
            type: ApplicationCommandOptionType.User,
            required: false,
          },
        ],
      },
      {
        name: "features",
        description: "View all features and their status",
      },
      {
        name: "feature_toggle_core",
        description: "Toggle core features on or off",
        options: [
          {
            name: "feature",
            description: "Core feature to toggle",
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
              { name: "VIP Draws", value: "vipDraws" },
              { name: "Streak Bonuses", value: "streakBonuses" },
              { name: "Referral System", value: "referralSystem" },
              { name: "Milestone Rewards", value: "milestoneRewards" },
              { name: "Lucky Numbers", value: "luckyNumbers" },
              { name: "Multi Winner Draws", value: "multiWinnerDraws" },
              { name: "Personal Dashboard", value: "personalDashboard" },
              { name: "Draw Notifications", value: "drawNotifications" },
              { name: "Donation Streaks", value: "donationStreaks" },
            ],
          },
          {
            name: "enabled",
            description: "Enable or disable the feature",
            type: ApplicationCommandOptionType.Boolean,
            required: true,
          },
        ],
      },
      {
        name: "feature_toggle_advanced",
        description: "Toggle advanced features on or off",
        options: [
          {
            name: "feature",
            description: "Advanced feature to toggle",
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
              { name: "Achievement System", value: "achievementSystem" },
              { name: "Seasonal Boards", value: "seasonalLeaderboards" },
              { name: "Analytics", value: "advancedAnalytics" },
              { name: "Auto Draws", value: "automatedDraws" },
              { name: "Draw Templates", value: "drawTemplates" },
              { name: "Bulk User Mgmt", value: "bulkUserManagement" },
              { name: "Custom Themes", value: "customEmbedThemes" },
              { name: "Daily Challenges", value: "dailyWeeklyChallenges" },
            ],
          },
          {
            name: "enabled",
            description: "Enable or disable the feature",
            type: ApplicationCommandOptionType.Boolean,
            required: true,
          },
        ],
      },
      {
        name: "feature_toggle_extra",
        description: "Toggle extra features on or off",
        options: [
          {
            name: "feature",
            description: "Extra feature to toggle",
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
              { name: "Donation Multipliers", value: "donationMultipliers" },
              { name: "Community Goals", value: "communityGoals" },
              { name: "Seasonal Events", value: "seasonalEvents" },
              { name: "Donor Spotlight", value: "donorSpotlight" },
              { name: "Blacklist System", value: "blacklistSystem" },
              { name: "Anti Fraud", value: "antifraudDetection" },
              { name: "Cooldown Periods", value: "cooldownPeriods" },
              { name: "Admin Logging", value: "adminActionLogging" },
              { name: "Role Permissions", value: "roleBasedPermissions" },
              { name: "Backup Automation", value: "backupAutomation" },
            ],
          },
          {
            name: "enabled",
            description: "Enable or disable the feature",
            type: ApplicationCommandOptionType.Boolean,
            required: true,
          },
        ],
      },
      {
        name: "bot_info",
        description: "View information about the bot",
      },
      {
        name: "privacy",
        description: "Set your privacy preferences",
        options: [
          {
            name: "setting",
            description: "Turn anonymous mode on or off",
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
              { name: "On - Hide username", value: "on" },
              { name: "Off - Show username", value: "off" },
            ],
          },
        ],
      },
      {
        name: "reveal_anonymous",
        description: "Reveal the identity of anonymous users (Admin only)",
        options: [
          {
            name: "user",
            description: "Specific user to reveal",
            type: ApplicationCommandOptionType.User,
            required: false,
          },
        ],
      },
    ]

    console.log("Registering global commands...")
    await client.application.commands.set(commands)
    console.log("Successfully registered global commands")

    // Delete any existing guild commands to avoid duplicates
    for (const serverId of SERVER_IDS) {
      try {
        const guild = client.guilds.cache.get(serverId)
        if (guild) {
          console.log(`Removing guild-specific commands from: ${guild.name} (${guild.id})`)
          await guild.commands.set([])
          console.log(`Successfully removed guild-specific commands from: ${guild.name}`)
        }
      } catch (error) {
        console.error(`Error removing guild commands for guild ${serverId}:`, error)
      }
    }
  } catch (error) {
    console.error("Error registering slash commands:", error)
  }
})

// Handle slash commands and interactions
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) {
    // Handle button interactions
    if (interaction.isButton()) {
      const { customId, guildId, user } = interaction

      // Check if user has admin permissions
      const hasAdminRole = await isAdmin(guildId, user.id)
      if (!hasAdminRole) {
        return interaction.reply({
          content: "You do not have permission to use this button.",
          flags: MessageFlags.Ephemeral,
        })
      }

      // Handle different button actions
      if (customId === "edit_admin_role") {
        await interaction.reply({
          content: "Please use the `/setup` command to update the admin role.",
          flags: MessageFlags.Ephemeral,
        })
      } else if (customId === "edit_notification_channel") {
        await interaction.reply({
          content: "Please use the `/set_notification_channel` command to update the notification channel.",
          flags: MessageFlags.Ephemeral,
        })
      } else if (customId === "manage_draws") {
        await interaction.reply({
          content: "Please use the `/create_draw`, `/edit_draw`, or `/reset_draw` commands to manage draws.",
          flags: MessageFlags.Ephemeral,
        })
      }
    }

    return
  }

  const { commandName, options, user, guildId } = interaction

  // Check if the server is in the allowed list
  if (!SERVER_IDS.includes(guildId)) {
    return interaction.reply({
      content: "This bot is not configured for this server.",
      flags: MessageFlags.Ephemeral,
    })
  }

  // Commands that require admin permissions
  const adminCommands = [
    "admin",
    "add_recipient",
    "remove_recipient",
    "create_draw",
    "edit_draw",
    "select_winner",
    "reset_draw",
    "reset_leaderboard",
    "add_cryptocurrency",
    "remove_cryptocurrency",
    "assign_entries",
    "feature_toggle_core",
    "feature_toggle_advanced",
    "feature_toggle_extra",
    "reveal_anonymous",
  ]

  try {
    // For setup command, only server admins or the bot owner can use it
    if (commandName === "setup") {
      const member = await interaction.guild.members.fetch(user.id)
      if (user.id !== OWNER_ID && !member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: "Only server administrators can use this command.",
          flags: MessageFlags.Ephemeral,
        })
      }
    } else if (adminCommands.includes(commandName)) {
      // For other admin commands, check if user has the admin role
      const hasAdminRole = await isAdmin(guildId, user.id)
      if (!hasAdminRole) {
        return interaction.reply({
          content: "You do not have permission to use this command.",
          flags: MessageFlags.Ephemeral,
        })
      }
    }

    // Defer the reply for commands that might take longer to process
    const longProcessingCommands = [
      "draws",
      "leaderboard",
      "entry_leaderboard",
      "help",
      "terms",
      "donor_roles",
      "accepted_coins",
      "entries",
      "draw_ids",
      "my_stats",
      "achievements",
      "features",
    ]

    if (longProcessingCommands.includes(commandName)) {
      await interaction.deferReply({
        flags: commandName === "my_stats" || commandName === "entries" ? MessageFlags.Ephemeral : undefined,
      })
    }

    // Handle the command
    switch (commandName) {
      case "setup":
        await handleSetupCommand(interaction)
        break
      case "admin":
        await handleAdminCommand(interaction)
        break
      case "add_recipient":
        await handleAddRecipientCommand(interaction)
        break
      case "remove_recipient":
        await handleRemoveRecipientCommand(interaction)
        break
      case "create_draw":
        await handleCreateDrawCommand(interaction)
        break
      case "edit_draw":
        await handleEditDrawCommand(interaction)
        break
      case "select_winner":
        await handleSelectWinnerCommand(interaction)
        break
      case "reset_draw":
        await handleResetDrawCommand(interaction)
        break
      case "entries":
        await handleEntriesCommand(interaction)
        break
      case "draws":
        await handleDrawsCommand(interaction)
        break
      case "draw_ids":
        await handleDrawIdsCommand(interaction)
        break
      case "leaderboard":
        await handleLeaderboardCommand(interaction)
        break
      case "entry_leaderboard":
        await handleEntryLeaderboardCommand(interaction)
        break
      case "reset_leaderboard":
        await handleResetLeaderboardCommand(interaction)
        break
      case "donate":
        await handleDonateCommand(interaction)
        break
      case "help":
        await handleHelpCommand(interaction)
        break
      case "terms":
        await handleTermsCommand(interaction)
        break
      case "donor_roles":
        await handleDonorRolesCommand(interaction)
        break
      case "accepted_coins":
        await handleAcceptedCoinsCommand(interaction)
        break
      case "add_cryptocurrency":
        await handleAddCryptocurrencyCommand(interaction)
        break
      case "remove_cryptocurrency":
        await handleRemoveCryptocurrencyCommand(interaction)
        break
      case "assign_entries":
        await handleAssignEntriesCommand(interaction)
        break
      case "my_stats":
        await handleMyStatsCommand(interaction)
        break
      case "achievements":
        await handleAchievementsCommand(interaction)
        break
      case "features":
        await handleFeaturesCommand(interaction)
        break
      case "feature_toggle_core":
      case "feature_toggle_advanced":
      case "feature_toggle_extra":
        await handleFeatureToggleCommand(interaction)
        break
      case "bot_info":
        await handleBotInfoCommand(interaction)
        break
      case "privacy":
        await handlePrivacyCommand(interaction)
        break
      case "reveal_anonymous":
        await handleRevealAnonymousCommand(interaction)
        break
      default:
        if (interaction.deferred) {
          await interaction.followUp({ content: "This command is not yet implemented.", flags: MessageFlags.Ephemeral })
        } else {
          await interaction.reply({ content: "This command is not yet implemented.", flags: MessageFlags.Ephemeral })
        }
    }
  } catch (error) {
    console.error(`Error handling command ${commandName}:`, error)

    const errorMessage = "There was an error while executing this command!"

    try {
      if (interaction.replied) {
        await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral })
      } else if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage })
      } else {
        await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral })
      }
    } catch (followUpError) {
      console.error("Error sending error message:", followUpError)
    }
  }
})

// Command handlers
async function handleSetupCommand(interaction) {
  const adminRole = interaction.options.getRole("admin_role")
  const notificationChannel = interaction.options.getChannel("notification_channel")

  const serverId = interaction.guildId
  const db = getDatabase(serverId)

  db.config.adminRoleId = adminRole.id

  if (notificationChannel) {
    db.config.notificationChannelId = notificationChannel.id
  }

  saveDatabase(serverId, db)

  await interaction.reply({
    content: `✅ Admin role set to <@&${adminRole.id}>. ${
      notificationChannel ? `Notification channel set to <#${notificationChannel.id}>.` : "No notification channel set."
    }`,
    flags: MessageFlags.Ephemeral,
  })
}

async function handleAdminCommand(interaction) {
  const serverId = interaction.guildId
  const db = getDatabase(serverId)

  const embed = new EmbedBuilder()
    .setTitle("⚙️ Admin Dashboard")
    .setDescription("Manage the Donor Rewards bot settings:")
    .setColor(db.config.theme.secondary)
    .setFooter({ text: "Powered By Aegisum Eco System" })

  embed.addFields(
    { name: "🛡️ Admin Role", value: db.config.adminRoleId ? `<@&${db.config.adminRoleId}>` : "Not set", inline: true },
    {
      name: "🔔 Notification Channel",
      value: db.config.notificationChannelId ? `<#${db.config.notificationChannelId}>` : "Not set",
      inline: true,
    },
    {
      name: "📊 Statistics",
      value: `Total Draws: ${Object.keys(db.donationDraws).length}\nTotal Users: ${Object.keys(db.users).length}`,
      inline: true,
    },
  )

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("edit_admin_role").setLabel("Edit Admin Role").setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("edit_notification_channel")
      .setLabel("Edit Notification Channel")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("manage_draws").setLabel("Manage Draws").setStyle(ButtonStyle.Success),
  )

  await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral })
}

async function handleAddRecipientCommand(interaction) {
  const recipient = interaction.options.getMentionable("recipient")
  const serverId = interaction.guildId
  const db = getDatabase(serverId)

  if (!db.config.allowedRecipients) {
    db.config.allowedRecipients = []
  }

  const recipientData = {
    id: recipient.id,
    type: recipient.user ? "user" : "role",
    name: recipient.user ? recipient.user.username : recipient.name,
  }

  // Check if already exists
  const exists = db.config.allowedRecipients.some((r) => r.id === recipient.id)
  if (exists) {
    return interaction.reply({
      content: "❌ This recipient is already in the allowed list.",
      flags: MessageFlags.Ephemeral,
    })
  }

  db.config.allowedRecipients.push(recipientData)
  saveDatabase(serverId, db)

  await interaction.reply({
    content: `✅ Added ${recipientData.type === "user" ? `<@${recipient.id}>` : `<@&${recipient.id}>`} as an allowed donation recipient.`,
    flags: MessageFlags.Ephemeral,
  })
}

async function handleRemoveRecipientCommand(interaction) {
  const recipient = interaction.options.getMentionable("recipient")
  const serverId = interaction.guildId
  const db = getDatabase(serverId)

  if (!db.config.allowedRecipients) {
    db.config.allowedRecipients = []
  }

  const index = db.config.allowedRecipients.findIndex((r) => r.id === recipient.id)
  if (index === -1) {
    return interaction.reply({
      content: "❌ This recipient is not in the allowed list.",
      flags: MessageFlags.Ephemeral,
    })
  }

  const removed = db.config.allowedRecipients.splice(index, 1)[0]
  saveDatabase(serverId, db)

  await interaction.reply({
    content: `✅ Removed ${removed.type === "user" ? `<@${recipient.id}>` : `<@&${recipient.id}>`} from allowed donation recipients.`,
    flags: MessageFlags.Ephemeral,
  })
}

async function handleCreateDrawCommand(interaction) {
  const id = interaction.options.getString("id")
  const name = interaction.options.getString("name")
  const minAmount = interaction.options.getNumber("min_amount")
  const maxAmount = interaction.options.getNumber("max_amount")
  const reward = interaction.options.getString("reward")
  const maxEntries = interaction.options.getInteger("max_entries")
  const category = interaction.options.getString("category") || "monthly"

  const serverId = interaction.guildId
  const db = getDatabase(serverId)

  if (db.donationDraws[id]) {
    return interaction.reply({
      content: `❌ A draw with ID "${id}" already exists.`,
      flags: MessageFlags.Ephemeral,
    })
  }

  db.donationDraws[id] = {
    name,
    minAmount,
    maxAmount: maxAmount === 0 ? 1000000 : maxAmount,
    entries: {},
    reward,
    maxEntries,
    active: true,
    drawTime: null,
    drawTimeFormatted: null,
    notificationSent: false,
    manualEntriesOnly: false,
    category,
    expirationDate: null,
    createdAt: Date.now(),
    blacklist: { users: [], roles: [] },
    multiWinner: false,
    winnerCount: 1,
    luckyNumbers: false,
    vipOnly: false,
    minDonorTier: null,
  }

  saveDatabase(serverId, db)

  const embed = new EmbedBuilder()
    .setTitle("✅ Draw Created Successfully")
    .setColor(db.config.theme.success)
    .addFields(
      { name: "ID", value: id, inline: true },
      { name: "Name", value: name, inline: true },
      { name: "Min Amount", value: `$${minAmount}`, inline: true },
      { name: "Max Amount", value: maxAmount === 0 ? "No limit" : `$${maxAmount}`, inline: true },
      { name: "Reward", value: reward, inline: true },
      { name: "Max Entries", value: maxEntries.toString(), inline: true },
      { name: "Category", value: DRAW_CATEGORIES[category], inline: true },
    )
    .setFooter({ text: "Powered By Aegisum Eco System" })

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
}

async function handleEditDrawCommand(interaction) {
  const id = interaction.options.getString("id")
  const name = interaction.options.getString("name")
  const active = interaction.options.getBoolean("active")
  const minAmount = interaction.options.getNumber("min_amount")
  const maxAmount = interaction.options.getNumber("max_amount")
  const reward = interaction.options.getString("reward")
  const maxEntries = interaction.options.getInteger("max_entries")
  const category = interaction.options.getString("category")
  const manualOnly = interaction.options.getBoolean("manual_only")
  const vipOnly = interaction.options.getBoolean("vip_only")

  const serverId = interaction.guildId
  const db = getDatabase(serverId)

  if (!db.donationDraws[id]) {
    return interaction.reply({
      content: `❌ Draw with ID "${id}" not found.`,
      flags: MessageFlags.Ephemeral,
    })
  }

  const draw = db.donationDraws[id]
  const changes = []

  if (name !== null) {
    draw.name = name
    changes.push(`Name: ${name}`)
  }

  if (active !== null) {
    draw.active = active
    changes.push(`Status: ${active ? "Active" : "Inactive"}`)
  }

  if (minAmount !== null) {
    draw.minAmount = minAmount
    changes.push(`Min Amount: $${minAmount}`)
  }

  if (maxAmount !== null) {
    draw.maxAmount = maxAmount === 0 ? 1000000 : maxAmount
    changes.push(`Max Amount: ${maxAmount === 0 ? "No limit" : `$${maxAmount}`}`)
  }

  if (reward !== null) {
    draw.reward = reward
    changes.push(`Reward: ${reward}`)
  }

  if (maxEntries !== null) {
    draw.maxEntries = maxEntries
    changes.push(`Max Entries: ${maxEntries}`)
  }

  if (category !== null) {
    draw.category = category
    changes.push(`Category: ${DRAW_CATEGORIES[category]}`)
  }

  if (manualOnly !== null) {
    draw.manualEntriesOnly = manualOnly
    changes.push(`Manual Entries Only: ${manualOnly ? "Yes" : "No"}`)
  }

  if (vipOnly !== null) {
    draw.vipOnly = vipOnly
    changes.push(`VIP Only: ${vipOnly ? "Yes" : "No"}`)
  }

  if (changes.length === 0) {
    return interaction.reply({
      content: "❌ No changes specified.",
      flags: MessageFlags.Ephemeral,
    })
  }

  saveDatabase(serverId, db)

  await interaction.reply({
    content: `✅ Updated draw "${draw.name}":\n${changes.join("\n")}`,
    flags: MessageFlags.Ephemeral,
  })
}

async function handleSelectWinnerCommand(interaction) {
  const drawId = interaction.options.getString("draw_id")
  const serverId = interaction.guildId
  const db = getDatabase(serverId)

  if (!db.donationDraws[drawId]) {
    return interaction.reply({
      content: `❌ Draw with ID "${drawId}" not found.`,
      flags: MessageFlags.Ephemeral,
    })
  }

  const draw = db.donationDraws[drawId]
  const entries = draw.entries

  if (!entries || Object.keys(entries).length === 0) {
    return interaction.reply({
      content: `❌ No entries found for draw "${draw.name}".`,
      flags: MessageFlags.Ephemeral,
    })
  }

  // Create weighted entries array
  const weightedEntries = []
  for (const [userId, count] of Object.entries(entries)) {
    for (let i = 0; i < count; i++) {
      weightedEntries.push(userId)
    }
  }

  if (weightedEntries.length === 0) {
    return interaction.reply({
      content: `❌ No valid entries found for draw "${draw.name}".`,
      flags: MessageFlags.Ephemeral,
    })
  }

  // Select random winner
  const winnerIndex = Math.floor(Math.random() * weightedEntries.length)
  const winnerId = weightedEntries[winnerIndex]
  const winnerEntries = entries[winnerId]
  const odds = ((winnerEntries / weightedEntries.length) * 100).toFixed(2)

  // Get winner info
  const winnerUser = db.users[winnerId]
  const winnerUsername = winnerUser ? winnerUser.username : "Unknown"
  const displayName = getDisplayName(winnerId, winnerUsername, db)

  // Update user's win count
  if (winnerUser) {
    if (!winnerUser.wins) winnerUser.wins = 0
    winnerUser.wins += 1
  }

  // Add to draw history
  if (!db.drawHistory) db.drawHistory = []
  db.drawHistory.push({
    drawId,
    drawName: draw.name,
    drawTime: Date.now(),
    winnerId,
    winnerUsername: displayName,
    winnerRealUsername: winnerUsername,
    reward: draw.reward,
    totalEntries: weightedEntries.length,
    winnerEntries,
    winnerPosition: 1,
    totalWinners: 1,
  })

  // Keep history limited to last 50 draws
  if (db.drawHistory.length > 50) {
    db.drawHistory = db.drawHistory.slice(-50)
  }

  saveDatabase(serverId, db)

  const embed = new EmbedBuilder()
    .setTitle(`🎉 ${draw.name} Winner!`)
    .setDescription(`Congratulations to <@${winnerId}>!`)
    .setColor(db.config.theme.success)
    .addFields(
      { name: "🏆 Reward", value: draw.reward },
      { name: "🎯 Winning Odds", value: `${winnerEntries} out of ${weightedEntries.length} entries (${odds}%)` },
    )
    .setTimestamp()
    .setFooter({ text: "Powered By Aegisum Eco System" })

  await interaction.reply({ embeds: [embed] })
}

async function handleResetDrawCommand(interaction) {
  const drawId = interaction.options.getString("draw_id")
  const serverId = interaction.guildId
  const db = getDatabase(serverId)

  if (!db.donationDraws[drawId]) {
    return interaction.reply({
      content: `❌ Draw with ID "${drawId}" not found.`,
      flags: MessageFlags.Ephemeral,
    })
  }

  const draw = db.donationDraws[drawId]

  // Reset entries in the draw
  draw.entries = {}

  // Remove entries from users
  for (const userId in db.users) {
    if (db.users[userId].entries && db.users[userId].entries[drawId]) {
      delete db.users[userId].entries[drawId]
    }
  }

  saveDatabase(serverId, db)

  await interaction.reply({
    content: `✅ Reset all entries for draw "${draw.name}".`,
    flags: MessageFlags.Ephemeral,
  })
}

async function handleEntriesCommand(interaction) {
  const serverId = interaction.guildId
  const userId = interaction.user.id
  const db = getDatabase(serverId)

  const userData = db.users[userId]

  if (!userData || !userData.entries || Object.keys(userData.entries).length === 0) {
    return interaction.editReply({ content: "You don't have any entries in any draws." })
  }

  const embed = new EmbedBuilder()
    .setTitle("🎟️ Your Draw Entries")
    .setDescription("Here are your entries in all active draws:")
    .setColor(db.config.theme.primary)
    .setFooter({ text: "Powered By Aegisum Eco System" })

  let totalEntries = 0
  for (const [drawId, entryCount] of Object.entries(userData.entries)) {
    const draw = db.donationDraws[drawId]
    if (!draw) continue

    totalEntries += entryCount

    if (entryCount > 0) {
      const totalDrawEntries = Object.values(draw.entries).reduce((sum, count) => sum + count, 0)
      const odds = totalDrawEntries > 0 ? ((entryCount / totalDrawEntries) * 100).toFixed(2) : "0.00"

      embed.addFields({
        name: draw.name,
        value: `Entries: ${entryCount}\nWinning odds: ${odds}%\nReward: ${draw.reward}${draw.active ? "" : "\n⚠️ Draw inactive"}`,
        inline: true,
      })
    }
  }

  embed.addFields({
    name: "💯 Total Entries",
    value: `You have ${totalEntries} entries across all draws.`,
    inline: false,
  })

  await interaction.editReply({ embeds: [embed] })
}

async function handleDrawsCommand(interaction) {
  const serverId = interaction.guildId
  const db = getDatabase(serverId)

  const activeDraws = Object.entries(db.donationDraws)
    .filter(([_, draw]) => draw.active)
    .sort((a, b) => a[1].minAmount - b[1].minAmount)

  if (activeDraws.length === 0) {
    return interaction.editReply("There are no active draws at the moment.")
  }

  const embed = new EmbedBuilder()
    .setTitle("🎁 Available Donation Draws")
    .setDescription("Here are all the active donation draws:")
    .setColor(db.config.theme.primary)
    .setFooter({ text: "Powered By Aegisum Eco System" })

  for (const [drawId, draw] of activeDraws) {
    const currentEntries = Object.values(draw.entries).reduce((sum, count) => sum + count, 0)

    let drawInfo = `Donation range: $${draw.minAmount}${draw.maxAmount > 0 ? ` - $${draw.maxAmount}` : "+"}
Entries: 1 per $${draw.minAmount} donated
Total entries: ${currentEntries}/${draw.maxEntries}
Reward: ${draw.reward}
Category: ${DRAW_CATEGORIES[draw.category] || "Uncategorized"}`

    if (draw.manualEntriesOnly) {
      drawInfo += "\n🔒 Manual entries only"
    }

    if (draw.vipOnly) {
      drawInfo += "\n⭐ VIP donors only"
    }

    embed.addFields({
      name: `${draw.name}`,
      value: drawInfo,
      inline: false,
    })
  }

  await interaction.editReply({ embeds: [embed] })
}

async function handleDrawIdsCommand(interaction) {
  const serverId = interaction.guildId
  const db = getDatabase(serverId)

  const activeDraws = Object.entries(db.donationDraws)
    .filter(([_, draw]) => draw.active)
    .sort((a, b) => a[1].minAmount - b[1].minAmount)

  if (activeDraws.length === 0) {
    return interaction.editReply("There are no active draws at the moment.")
  }

  const embed = new EmbedBuilder()
    .setTitle("🆔 Draw IDs for Donations")
    .setDescription("Use these IDs when donating to enter specific draws:\n`$tip @recipient amount #drawID`")
    .setColor(db.config.theme.info)
    .setFooter({ text: "Powered By Aegisum Eco System" })

  for (const [drawId, draw] of activeDraws) {
    embed.addFields({
      name: `${draw.name}`,
      value: `ID: \`#${drawId}\`\nMin donation: $${draw.minAmount}\nReward: ${draw.reward}`,
      inline: true,
    })
  }

  await interaction.editReply({ embeds: [embed] })
}

async function handleLeaderboardCommand(interaction) {
  const limit = interaction.options.getInteger("limit") || 10
  const serverId = interaction.guildId
  const db = getDatabase(serverId)

  const users = Object.entries(db.users)
    .filter(([_, userData]) => userData.totalDonated > 0)
    .sort((a, b) => b[1].totalDonated - a[1].totalDonated)
    .slice(0, limit)

  if (users.length === 0) {
    return interaction.editReply("No donations have been made yet.")
  }

  const embed = new EmbedBuilder()
    .setTitle("🏆 Top Donors Leaderboard")
    .setDescription(`Top ${users.length} donors by total contribution:`)
    .setColor(db.config.theme.accent)
    .setFooter({ text: "Powered By Aegisum Eco System" })

  let leaderboardText = ""
  users.forEach(([userId, userData], index) => {
    const displayName = getDisplayName(userId, userData.username, db)
    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`
    leaderboardText += `${medal} ${displayName} - $${userData.totalDonated.toFixed(2)}\n`
  })

  embed.addFields({ name: "Rankings", value: leaderboardText })

  await interaction.editReply({ embeds: [embed] })
}

async function handleEntryLeaderboardCommand(interaction) {
  const drawId = interaction.options.getString("draw_id")
  const limit = interaction.options.getInteger("limit") || 10
  const serverId = interaction.guildId
  const db = getDatabase(serverId)

  if (!db.donationDraws[drawId]) {
    return interaction.editReply(`❌ Draw with ID "${drawId}" not found.`)
  }

  const draw = db.donationDraws[drawId]
  const entries = Object.entries(draw.entries)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)

  if (entries.length === 0) {
    return interaction.editReply(`No entries found for draw "${draw.name}".`)
  }

  const embed = new EmbedBuilder()
    .setTitle(`🎯 Entry Leaderboard: ${draw.name}`)
    .setDescription(`Top ${entries.length} users by entry count:`)
    .setColor(db.config.theme.accent)
    .setFooter({ text: "Powered By Aegisum Eco System" })

  let leaderboardText = ""
  entries.forEach(([userId, entryCount], index) => {
    const userData = db.users[userId]
    const displayName = userData ? getDisplayName(userId, userData.username, db) : "Unknown User"
    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`
    leaderboardText += `${medal} ${displayName} - ${entryCount} entries\n`
  })

  embed.addFields({ name: "Rankings", value: leaderboardText })

  await interaction.editReply({ embeds: [embed] })
}

async function handleResetLeaderboardCommand(interaction) {
  const confirm = interaction.options.getString("confirm")
  const serverId = interaction.guildId

  if (confirm !== "confirm") {
    return interaction.reply({
      content: '❌ You must type "confirm" to reset the leaderboard.',
      flags: MessageFlags.Ephemeral,
    })
  }

  const db = getDatabase(serverId)

  // Reset all user donation totals
  for (const userId in db.users) {
    db.users[userId].totalDonated = 0
  }

  saveDatabase(serverId, db)

  await interaction.reply({
    content: "✅ Donation leaderboard has been reset. All user donation totals have been set to $0.",
    flags: MessageFlags.Ephemeral,
  })
}

async function handleDonateCommand(interaction) {
  const drawId = interaction.options.getString("draw_id")
  const serverId = interaction.guildId
  const db = getDatabase(serverId)

  const embed = new EmbedBuilder()
    .setTitle("💰 How to Donate")
    .setDescription("Support our development by making a donation!")
    .setColor(db.config.theme.primary)
    .setFooter({ text: "Powered By Aegisum Eco System" })

  if (drawId && db.donationDraws[drawId]) {
    const draw = db.donationDraws[drawId]
    embed.addFields(
      { name: "🎯 Specific Draw", value: `You want to enter: **${draw.name}**` },
      { name: "💵 Required Amount", value: `Minimum: $${draw.minAmount}` },
      { name: "🏆 Reward", value: draw.reward },
      { name: "📝 How to Donate", value: `Use: \`$tip @recipient ${draw.minAmount} #${drawId}\`` },
    )
  } else {
    embed.addFields(
      { name: "📝 How to Donate", value: "Use the tip.cc bot: `$tip @recipient amount`" },
      { name: "🎯 Specific Draw", value: "To enter a specific draw: `$tip @recipient amount #drawID`" },
      { name: "🆔 Draw IDs", value: "Use `/draw_ids` to see all available draw IDs" },
    )
  }

  embed.addFields(
    { name: "💎 Accepted Cryptocurrencies", value: "Use `/accepted_coins` to see the full list" },
    { name: "ℹ️ Important", value: "Only donations to approved recipients count towards draws!" },
  )

  await interaction.reply({ embeds: [embed] })
}

async function handleHelpCommand(interaction) {
  const embed = new EmbedBuilder()
    .setTitle("📚 Donor Rewards Help")
    .setDescription("Here's how to use the Donor Rewards system:")
    .setColor("#4CAF50")
    .addFields(
      {
        name: "💰 Making Donations",
        value:
          "Use `$tip @recipient amount` to donate.\nTo enter a specific draw, add the draw ID: `$tip @recipient amount #drawID`",
      },
      {
        name: "🎁 Viewing Draws",
        value:
          "`/draws` - See all active draws\n`/draw_ids` - Get IDs for specific draws\n`/entries` - Check your entries",
      },
      {
        name: "📊 Statistics",
        value:
          "`/my_stats` - View your donation dashboard\n`/leaderboard` - See top donors\n`/achievements` - View your achievements",
      },
      {
        name: "🔒 Privacy Settings",
        value: "`/privacy on/off` - Toggle anonymous mode",
      },
      {
        name: "ℹ️ Other Commands",
        value:
          "`/donor_roles` - Information about donor roles\n`/terms` - Terms and conditions\n`/help` - Show this help message",
      },
    )
    .setFooter({ text: "Powered By Aegisum Eco System" })

  await interaction.editReply({ embeds: [embed] })
}

async function handleTermsCommand(interaction) {
  const embed = new EmbedBuilder()
    .setTitle("📋 Terms and Conditions")
    .setDescription("Please read these terms carefully:")
    .setColor("#FFC107")
    .addFields(
      {
        name: "🎯 Purpose",
        value: "Donations support our development efforts. Appreciation draws are our way of saying thank you!",
      },
      {
        name: "🎲 Draw Rules",
        value:
          "• Entries are based on donation amounts\n• Winners are selected randomly\n• All draws are for appreciation only",
      },
      {
        name: "💰 Donations",
        value: "• All donations are voluntary\n• Donations are non-refundable\n• Only approved recipients count",
      },
      {
        name: "🔒 Privacy",
        value: "• You can enable anonymous mode\n• We respect your privacy choices\n• Data is stored securely",
      },
      {
        name: "⚖️ Disclaimer",
        value:
          "This is an appreciation system, not gambling. Donations support development regardless of draw outcomes.",
      },
    )
    .setFooter({ text: "By participating, you agree to these terms" })

  await interaction.editReply({ embeds: [embed] })
}

async function handleDonorRolesCommand(interaction) {
  const embed = new EmbedBuilder()
    .setTitle("👑 Donor Roles & Benefits")
    .setDescription("Unlock special roles based on your total donations:")
    .setColor("#9C27B0")
    .setFooter({ text: "Powered By Aegisum Eco System" })

  const sortedRoles = Object.values(DONOR_ROLES).sort((a, b) => a.minAmount - b.minAmount)

  for (const role of sortedRoles) {
    const rangeText = role.maxAmount ? `$${role.minAmount} - $${role.maxAmount}` : `$${role.minAmount}+`

    embed.addFields({
      name: `${role.name}`,
      value: `Donation Range: ${rangeText}\nRole: <@&${role.id}>`,
      inline: true,
    })
  }

  embed.addFields({
    name: "🎁 Benefits",
    value: "• Special role recognition\n• Access to VIP draws\n• Priority support\n• Exclusive features",
    inline: false,
  })

  await interaction.editReply({ embeds: [embed] })
}

async function handleAcceptedCoinsCommand(interaction) {
  const serverId = interaction.guildId
  const db = getDatabase(serverId)

  const embed = new EmbedBuilder()
    .setTitle("💎 Accepted Cryptocurrencies")
    .setDescription("These cryptocurrencies are accepted for donations:")
    .setColor(db.config.theme.info)
    .setFooter({ text: "Powered By Aegisum Eco System" })

  const coins = db.config.acceptedCryptocurrencies || DEFAULT_ACCEPTED_CRYPTOCURRENCIES
  const coinList = coins.map((coin) => `• ${coin}`).join("\n")

  embed.addFields(
    { name: "Supported Coins", value: coinList },
    { name: "How to Donate", value: "Use tip.cc: `$tip @recipient amount SYMBOL`" },
    { name: "Note", value: "Prices are automatically converted to USD for draw entries" },
  )

  await interaction.editReply({ embeds: [embed] })
}

async function handleAddCryptocurrencyCommand(interaction) {
  const symbol = interaction.options.getString("symbol").toUpperCase()
  const serverId = interaction.guildId
  const db = getDatabase(serverId)

  if (!db.config.acceptedCryptocurrencies) {
    db.config.acceptedCryptocurrencies = DEFAULT_ACCEPTED_CRYPTOCURRENCIES
  }

  if (db.config.acceptedCryptocurrencies.includes(symbol)) {
    return interaction.reply({
      content: `❌ ${symbol} is already in the accepted cryptocurrencies list.`,
      flags: MessageFlags.Ephemeral,
    })
  }

  db.config.acceptedCryptocurrencies.push(symbol)
  saveDatabase(serverId, db)

  await interaction.reply({
    content: `✅ Added ${symbol} to the accepted cryptocurrencies list.`,
    flags: MessageFlags.Ephemeral,
  })
}

async function handleRemoveCryptocurrencyCommand(interaction) {
  const symbol = interaction.options.getString("symbol").toUpperCase()
  const serverId = interaction.guildId
  const db = getDatabase(serverId)

  if (!db.config.acceptedCryptocurrencies) {
    db.config.acceptedCryptocurrencies = DEFAULT_ACCEPTED_CRYPTOCURRENCIES
  }

  const index = db.config.acceptedCryptocurrencies.indexOf(symbol)
  if (index === -1) {
    return interaction.reply({
      content: `❌ ${symbol} is not in the accepted cryptocurrencies list.`,
      flags: MessageFlags.Ephemeral,
    })
  }

  db.config.acceptedCryptocurrencies.splice(index, 1)
  saveDatabase(serverId, db)

  await interaction.reply({
    content: `✅ Removed ${symbol} from the accepted cryptocurrencies list.`,
    flags: MessageFlags.Ephemeral,
  })
}

async function handleAssignEntriesCommand(interaction) {
  const target = interaction.options.getMentionable("target")
  const drawId = interaction.options.getString("draw_id")
  const entries = interaction.options.getInteger("entries")
  const donationAmount = interaction.options.getNumber("donation_amount") || 0
  const confirmBatch = interaction.options.getBoolean("confirm_batch") || false

  const serverId = interaction.guildId
  const db = getDatabase(serverId)

  if (!db.donationDraws[drawId]) {
    return interaction.reply({
      content: `❌ Draw with ID "${drawId}" not found.`,
      flags: MessageFlags.Ephemeral,
    })
  }

  const draw = db.donationDraws[drawId]
  const isRole = target.id && !target.username

  if (isRole) {
    // Handle role assignment
    try {
      const role = await interaction.guild.roles.fetch(target.id)
      if (!role) {
        return interaction.reply({
          content: "❌ Role not found.",
          flags: MessageFlags.Ephemeral,
        })
      }

      const members = role.members
      if (members.size === 0) {
        return interaction.reply({
          content: "❌ No members found with this role.",
          flags: MessageFlags.Ephemeral,
        })
      }

      if (members.size > 50 && !confirmBatch) {
        return interaction.reply({
          content: `⚠️ This role has ${members.size} members. This would assign ${entries * members.size} total entries. Use the confirm_batch option if you're sure.`,
          flags: MessageFlags.Ephemeral,
        })
      }

      let totalAssigned = 0
      let usersAffected = 0

      for (const [memberId, member] of members) {
        // Initialize user if they don't exist
        if (!db.users[memberId]) {
          db.users[memberId] = {
            username: member.user.username,
            totalDonated: 0,
            entries: {},
            achievements: [],
            wins: 0,
            currentStreak: 0,
            longestStreak: 0,
            lastDonationDate: null,
            referrals: { referred: [], referredBy: null, bonusEntries: 0 },
            luckyNumbers: {},
            privacyEnabled: false,
          }
        }

        // Add donation amount if specified
        if (donationAmount > 0) {
          db.users[memberId].totalDonated += donationAmount
        }

        // Initialize entries for this draw
        if (!db.users[memberId].entries[drawId]) {
          db.users[memberId].entries[drawId] = 0
        }
        if (!draw.entries[memberId]) {
          draw.entries[memberId] = 0
        }

        // Add entries
        db.users[memberId].entries[drawId] += entries
        draw.entries[memberId] += entries
        totalAssigned += entries
        usersAffected++
      }

      saveDatabase(serverId, db)

      await interaction.reply({
        content: `✅ Successfully assigned ${totalAssigned} total entries to ${usersAffected} users with the role for "${draw.name}".`,
        flags: MessageFlags.Ephemeral,
      })
    } catch (error) {
      console.error("Error processing role assignment:", error)
      return interaction.reply({
        content: `❌ Error processing role assignment: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      })
    }
  } else {
    // Handle user assignment
    const userId = target.id
    const username = target.username || "Unknown"

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
        privacyEnabled: false,
      }
    }

    // Add donation amount if specified
    if (donationAmount > 0) {
      db.users[userId].totalDonated += donationAmount
    }

    // Initialize entries for this draw
    if (!db.users[userId].entries[drawId]) {
      db.users[userId].entries[drawId] = 0
    }
    if (!draw.entries[userId]) {
      draw.entries[userId] = 0
    }

    // Add entries
    db.users[userId].entries[drawId] += entries
    draw.entries[userId] += entries

    saveDatabase(serverId, db)

    await interaction.reply({
      content: `✅ Successfully added ${entries} entries for <@${userId}> to "${draw.name}".`,
      flags: MessageFlags.Ephemeral,
    })
  }
}

async function handleMyStatsCommand(interaction) {
  if (!isFeatureEnabled(interaction.guildId, "personalDashboard")) {
    return interaction.editReply({ content: "❌ Personal dashboard feature is disabled." })
  }

  const serverId = interaction.guildId
  const userId = interaction.user.id
  const db = getDatabase(serverId)
  const userData = db.users[userId]

  if (!userData || userData.totalDonated === 0) {
    return interaction.editReply({
      content: "❌ You haven't made any donations yet. Start donating to see your stats!",
    })
  }

  const embed = new EmbedBuilder()
    .setTitle(`📊 ${interaction.user.username}'s Donation Dashboard`)
    .setColor(db.config.theme.primary)
    .setThumbnail(interaction.user.displayAvatarURL())
    .setFooter({ text: "Powered By Aegisum Eco System" })

  embed.addFields(
    { name: "💰 Total Donated", value: `$${userData.totalDonated.toFixed(2)}`, inline: true },
    { name: "🏆 Draws Won", value: (userData.wins || 0).toString(), inline: true },
    {
      name: "🎯 Total Entries",
      value: Object.values(userData.entries || {})
        .reduce((sum, count) => sum + count, 0)
        .toString(),
      inline: true,
    },
  )

  if (userData.achievements && userData.achievements.length > 0) {
    embed.addFields({
      name: "🏅 Achievements",
      value: `${userData.achievements.length}/${Object.keys(ACHIEVEMENTS).length} unlocked`,
      inline: true,
    })
  }

  // Current draws
  if (userData.entries && Object.keys(userData.entries).length > 0) {
    let activeDrawsText = ""
    let count = 0
    for (const [drawId, entryCount] of Object.entries(userData.entries)) {
      if (count >= 5) break
      const draw = db.donationDraws[drawId]
      if (draw && draw.active && entryCount > 0) {
        activeDrawsText += `• **${draw.name}**: ${entryCount} entries\n`
        count++
      }
    }
    if (activeDrawsText) {
      embed.addFields({ name: "🎪 Active Draw Entries", value: activeDrawsText, inline: false })
    }
  }

  await interaction.editReply({ embeds: [embed] })
}

async function handleAchievementsCommand(interaction) {
  if (!isFeatureEnabled(interaction.guildId, "achievementSystem")) {
    return interaction.editReply({ content: "❌ Achievement system is disabled." })
  }

  const serverId = interaction.guildId
  const targetUser = interaction.options.getUser("user") || interaction.user
  const isAdminVar = await isAdmin(serverId, interaction.user.id)

  if (targetUser.id !== interaction.user.id && !isAdminVar) {
    return interaction.editReply({ content: "❌ You can only view your own achievements." })
  }

  const db = getDatabase(serverId)
  const userData = db.users[targetUser.id]

  if (!userData) {
    return interaction.editReply({
      content: `❌ ${targetUser.username} hasn't made any donations yet.`,
    })
  }

  const userAchievements = userData.achievements || []

  const embed = new EmbedBuilder()
    .setTitle(`🏅 ${targetUser.username}'s Achievements`)
    .setColor(db.config.theme.accent)
    .setThumbnail(targetUser.displayAvatarURL())
    .setFooter({ text: "Powered By Aegisum Eco System" })

  const unlockedAchievements = Object.values(ACHIEVEMENTS)
    .filter((achievement) => userAchievements.includes(achievement.id))
    .map((achievement) => `${achievement.icon} **${achievement.name}**\n${achievement.description}`)

  if (unlockedAchievements.length > 0) {
    embed.addFields({
      name: `🔓 Unlocked (${unlockedAchievements.length}/${Object.keys(ACHIEVEMENTS).length})`,
      value: unlockedAchievements.join("\n\n"),
      inline: false,
    })
  }

  const lockedAchievements = Object.values(ACHIEVEMENTS)
    .filter((achievement) => !userAchievements.includes(achievement.id))
    .slice(0, 3)
    .map((achievement) => `🔒 **${achievement.name}**\n${achievement.description}`)

  if (lockedAchievements.length > 0) {
    embed.addFields({
      name: "🔒 Locked (Next to unlock)",
      value: lockedAchievements.join("\n\n"),
      inline: false,
    })
  }

  await interaction.editReply({ embeds: [embed] })
}

async function handleFeaturesCommand(interaction) {
  const serverId = interaction.guildId
  const db = getDatabase(serverId)

  const embed = new EmbedBuilder()
    .setTitle("🎛️ Feature Management")
    .setDescription("Current status of all bot features:")
    .setColor(db.config.theme.info)
    .setFooter({ text: "Powered By Aegisum Eco System" })

  let featuresText = ""
  for (const [feature, enabled] of Object.entries(db.config.featureToggles)) {
    const emoji = enabled ? "✅" : "❌"
    const displayName = feature.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())
    featuresText += `${emoji} **${displayName}**\n`
  }

  embed.addFields({ name: "Available Features", value: featuresText })

  await interaction.editReply({ embeds: [embed] })
}

async function handleFeatureToggleCommand(interaction) {
  const feature = interaction.options.getString("feature")
  const enabled = interaction.options.getBoolean("enabled")
  const serverId = interaction.guildId
  const db = getDatabase(serverId)

  if (!db.config.featureToggles.hasOwnProperty(feature)) {
    return interaction.reply({ content: "❌ Invalid feature specified.", flags: MessageFlags.Ephemeral })
  }

  db.config.featureToggles[feature] = enabled
  saveDatabase(serverId, db)

  const displayName = feature.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())
  const status = enabled ? "enabled" : "disabled"
  const emoji = enabled ? "✅" : "❌"

  await interaction.reply({
    content: `${emoji} **${displayName}** has been ${status}.`,
    flags: MessageFlags.Ephemeral,
  })
}

async function handleBotInfoCommand(interaction) {
  const embed = new EmbedBuilder()
    .setTitle("🤖 Donor Rewards Bot Information")
    .setDescription("Advanced donation tracking and appreciation system")
    .setColor("#4CAF50")
    .addFields(
      { name: "📊 Version", value: BOT_VERSION, inline: true },
      { name: "🚀 Uptime", value: `<t:${Math.floor(client.readyTimestamp / 1000)}:R>`, inline: true },
      { name: "🖥️ Servers", value: SERVER_IDS.length.toString(), inline: true },
      {
        name: "💡 Features",
        value:
          "• Multi-server support\n• Crypto price tracking\n• Achievement system\n• VIP draws\n• Analytics\n• And much more!",
        inline: false,
      },
      { name: "🔗 Developer", value: "Built with ❤️ by the Aegisum team", inline: false },
    )
    .setFooter({ text: "Powered By Aegisum Eco System" })
    .setTimestamp()

  await interaction.reply({ embeds: [embed] })
}

async function handlePrivacyCommand(interaction) {
  const serverId = interaction.guildId
  const userId = interaction.user.id
  const db = getDatabase(serverId)

  if (!db.config.featureToggles.anonymousMode) {
    return interaction.reply({
      content: "❌ Anonymous mode is currently disabled on this server.",
      flags: MessageFlags.Ephemeral,
    })
  }

  const privacySetting = interaction.options.getString("setting")

  // Initialize user if they don't exist
  if (!db.users[userId]) {
    db.users[userId] = {
      username: interaction.user.username,
      totalDonated: 0,
      entries: {},
      achievements: [],
      wins: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastDonationDate: null,
      referrals: { referred: [], referredBy: null, bonusEntries: 0 },
      luckyNumbers: {},
      privacyEnabled: false,
    }
  }

  db.users[userId].privacyEnabled = privacySetting === "on"
  saveDatabase(serverId, db)

  const status = db.users[userId].privacyEnabled ? "enabled" : "disabled"
  const emoji = db.users[userId].privacyEnabled ? "🕶️" : "👁️"

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} Privacy Settings Updated`)
    .setDescription(`Anonymous mode has been **${status}**.`)
    .setColor(db.config.theme.primary)
    .addFields({
      name: "What this means",
      value: db.users[userId].privacyEnabled
        ? "Your username will be hidden in public displays like leaderboards and winner announcements. You'll appear as '🕶️ Anonymous'."
        : "Your username will be visible in public displays like leaderboards and winner announcements.",
    })
    .setFooter({ text: "Powered By Aegisum Eco System" })

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
}

async function handleRevealAnonymousCommand(interaction) {
  const serverId = interaction.guildId
  const db = getDatabase(serverId)

  if (!db.config.featureToggles.anonymousMode) {
    return interaction.reply({
      content: "❌ Anonymous mode is currently disabled on this server.",
      flags: MessageFlags.Ephemeral,
    })
  }

  const targetUser = interaction.options.getUser("user")

  if (!targetUser) {
    const anonymousUsers = Object.entries(db.users)
      .filter(([_, userData]) => userData.privacyEnabled)
      .map(([userId, userData]) => `<@${userId}> (${userData.username})`)

    if (anonymousUsers.length === 0) {
      return interaction.reply({
        content: "There are currently no users with anonymous mode enabled.",
        flags: MessageFlags.Ephemeral,
      })
    }

    const embed = new EmbedBuilder()
      .setTitle("🕶️ Anonymous Users")
      .setDescription("Here are all users with anonymous mode enabled:")
      .setColor(db.config.theme.primary)
      .addFields({ name: "Users", value: anonymousUsers.join("\n") })
      .setFooter({ text: "This information is only visible to admins" })

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
  }

  const userData = db.users[targetUser.id]

  if (!userData) {
    return interaction.reply({
      content: `User <@${targetUser.id}> has no data in the system.`,
      flags: MessageFlags.Ephemeral,
    })
  }

  if (!userData.privacyEnabled) {
    return interaction.reply({
      content: `User <@${targetUser.id}> does not have anonymous mode enabled.`,
      flags: MessageFlags.Ephemeral,
    })
  }

  const embed = new EmbedBuilder()
    .setTitle("🕶️ Anonymous User Revealed")
    .setDescription(`Information for anonymous user:`)
    .setColor(db.config.theme.primary)
    .addFields(
      { name: "User", value: `<@${targetUser.id}> (${userData.username})`, inline: false },
      { name: "Total Donated", value: `$${userData.totalDonated.toFixed(2)}`, inline: true },
      { name: "Wins", value: `${userData.wins || 0}`, inline: true },
    )
    .setFooter({ text: "This information is only visible to admins" })

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
}

// Login to Discord with error handling
async function startBot() {
  try {
    await client.login(process.env.BOT_TOKEN)
    console.log("Bot logged in successfully")
  } catch (error) {
    console.error("Failed to login:", error)
    process.exit(1)
  }
}

startBot()
