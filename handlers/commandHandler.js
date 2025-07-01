import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Collection } from 'discord.js';
import { info, logError } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const commandsDir = path.join(__dirname, '..', 'commands');

// Command collection
const commands = new Collection();

// Load all commands
export async function loadCommands() {
  // Get all command categories (subdirectories)
  const categories = fs.readdirSync(commandsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  for (const category of categories) {
    const categoryPath = path.join(commandsDir, category);
    
    // Get all command files in the category
    const commandFiles = fs.readdirSync(categoryPath)
      .filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
      try {
        const filePath = path.join(categoryPath, file);
        const fileUrl = `file://${filePath}`;
        
        // Import the command module
        const command = await import(fileUrl);
        
        // Add the command to the collection
        if ('data' in command && 'execute' in command) {
          commands.set(command.data.name, command);
          info(`Loaded command: ${command.data.name}`);
        } else {
          logError(`Invalid command file: ${file}`);
        }
      } catch (error) {
        logError(`Error loading command ${file}: ${error.message}`);
      }
    }
  }
  
  return commands;
}

// Get a command handler by name
export function getCommandHandler(name) {
  return commands.get(name);
}

// Get all command handlers
export function getAllCommandHandlers() {
  return commands;
}

// Register slash commands with Discord
export async function registerCommands(client, global = true, guildIds = []) {
  const commandData = Array.from(commands.values()).map(command => command.data.toJSON());
  
  try {
    if (global) {
      // Register commands globally
      info(`Registering ${commandData.length} global commands...`);
      await client.application.commands.set(commandData);
      info('Successfully registered global commands');
    } else {
      // Register commands for specific guilds
      for (const guildId of guildIds) {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          info(`Registering commands for guild: ${guild.name} (${guild.id})`);
          await guild.commands.set(commandData);
          info(`Successfully registered commands for guild: ${guild.name}`);
        }
      }
    }
    
    return true;
  } catch (error) {
    logError(`Error registering commands: ${error.message}`);
    return false;
  }
}

// Delete guild-specific commands
export async function deleteGuildCommands(client, guildIds) {
  for (const guildId of guildIds) {
    try {
      const guild = client.guilds.cache.get(guildId);
      if (guild) {
        info(`Removing guild-specific commands from: ${guild.name} (${guild.id})`);
        await guild.commands.set([]);
        info(`Successfully removed guild-specific commands from: ${guild.name}`);
      }
    } catch (error) {
      logError(`Error removing guild commands for guild ${guildId}: ${error.message}`);
    }
  }
}
