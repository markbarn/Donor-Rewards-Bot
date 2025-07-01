import { Events } from "discord.js"
import { logger } from "../utils/logger.js"
import { getDatabase, saveDatabase } from "../utils/database.js"

export const name = Events.ClientReady
export const once = true

export async function execute(client) {
  logger.info(`Ready! Logged in as ${client.user.tag}`)

  const SERVER_IDS = process.env.SERVER_IDS ? process.env.SERVER_IDS.split(",") : []

  // Initialize databases for all servers
  for (const serverId of SERVER_IDS) {
    try {
      const db = getDatabase(serverId)
      if (!db.config.featureToggles) {
        logger.info(`Initialized default features for server ${serverId}`)
        saveDatabase(serverId, db)
      }
    } catch (error) {
      logger.error(`Error initializing database for server ${serverId}:`, error)
    }
  }

  // Register slash commands with detailed debugging
  try {
    const commands = []

    // Collect all commands with validation
    client.commands.forEach((command, name) => {
      try {
        if (!command.data) {
          logger.error(`Command ${name} missing data property`)
          return
        }
        
        const commandData = command.data.toJSON()
        commands.push(commandData)
        logger.info(`✅ Prepared command: ${commandData.name}`)
      } catch (error) {
        logger.error(`❌ Error preparing command ${name}:`, error.message)
      }
    })

    logger.info(`Registering ${commands.length} global commands...`)
    
    if (commands.length === 0) {
      logger.error("No valid commands to register!")
      return
    }

    const result = await client.application.commands.set(commands)
    logger.info(`Successfully registered ${result.size} global commands`)

    // List registered commands
    result.forEach(cmd => {
      logger.info(`✅ Registered: ${cmd.name}`)
    })

  } catch (error) {
    logger.error("Error registering slash commands:")
    logger.error("Error name:", error.name)
    logger.error("Error message:", error.message)
    logger.error("Error code:", error.code)
    logger.error("Error status:", error.status)
    if (error.rawError) {
      logger.error("Raw error:", JSON.stringify(error.rawError, null, 2))
    }
    console.error("Full error object:", error)
  }
}
