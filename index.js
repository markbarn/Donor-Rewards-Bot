import { Client, GatewayIntentBits, Collection } from "discord.js"
import dotenv from "dotenv"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { logger } from "./utils/logger.js"

// Load environment variables
dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Create Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
})

// Initialize collections
client.commands = new Collection()
client.events = new Collection()

// Load events
const eventsPath = path.join(__dirname, "events")
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith(".js"))

  for (const file of eventFiles) {
    try {
      const filePath = path.join(eventsPath, file)
      const event = await import(`file://${filePath}`)

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args))
      } else {
        client.on(event.name, (...args) => event.execute(...args))
      }

      logger.info(`Loaded event: ${event.name}`)
    } catch (error) {
      logger.error(`Error loading event ${file}:`, error)
    }
  }
}

// Load commands
async function loadCommands(dir, collection = client.commands) {
  const items = fs.readdirSync(dir)

  for (const item of items) {
    const itemPath = path.join(dir, item)
    const stat = fs.statSync(itemPath)

    if (stat.isDirectory()) {
      await loadCommands(itemPath, collection)
    } else if (item.endsWith(".js")) {
      try {
        const command = await import(`file://${itemPath}`)

        if (command.data && command.execute) {
          collection.set(command.data.name, command)
          logger.info(`Loaded command: ${command.data.name}`)
        } else {
          logger.warn(`Invalid command file: ${item}`)
        }
      } catch (error) {
        logger.error(`Error loading command ${item}:`, error)
      }
    }
  }
}

// Load all commands
const commandsPath = path.join(__dirname, "commands")
if (fs.existsSync(commandsPath)) {
  await loadCommands(commandsPath)
}

// Login to Discord
client
  .login(process.env.BOT_TOKEN)
  .then(() => {
    logger.info("Bot startup complete")
  })
  .catch((error) => {
    logger.error("Failed to login:", error)
    process.exit(1)
  })

// Handle unhandled promise rejections
process.on("unhandledRejection", (error) => {
  logger.error("Unhandled promise rejection:", error)
})

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception:", error)
  process.exit(1)
})
