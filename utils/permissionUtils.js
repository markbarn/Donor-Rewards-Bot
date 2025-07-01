import { getDatabase } from '../database.js';

// Check if user has admin permissions
export async function isAdmin(serverId, userId) {
  // Bot owner always has admin access
  const OWNER_ID = process.env.OWNER_ID || '';
  if (userId === OWNER_ID) return true;
  
  const db = getDatabase(serverId);
  
  // If no admin role is set, only the owner has access
  if (!db.config?.adminRoleId) return false;
  
  // Get the guild and member
  const guild = global.client.guilds.cache.get(serverId);
  if (!guild) return false;
  
  try {
    const member = await guild.members.fetch(userId);
    return member.roles.cache.has(db.config.adminRoleId);
  } catch (error) {
    console.error('Error checking admin role:', error);
    return false;
  }
}

// Check if user has a specific permission
export async function hasPermission(serverId, userId, permission) {
  // Admin always has all permissions
  if (await isAdmin(serverId, userId)) return true;
  
  const db = getDatabase(serverId);
  
  // Check if role-based permissions are enabled
  if (!db.config?.featureToggles?.roleBasedPermissions) {
    // If role-based permissions are disabled, only admins have permissions
    return false;
  }
  
  // If no permissions are set up, only admins have permissions
  if (!db.config?.permissions) return false;
  
  // Get the guild and member
  const guild = global.client.guilds.cache.get(serverId);
  if (!guild) return false;
  
  try {
    const member = await guild.members.fetch(userId);
    
    // Check if any of the user's roles have the permission
    for (const role of member.roles.cache.values()) {
      if (db.config.permissions[role.id]?.includes(permission)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking permissions:', error);
    return false;
  }
}

// Get all permissions for a user
export async function getUserPermissions(serverId, userId) {
  // Admin always has all permissions
  if (await isAdmin(serverId, userId)) {
    return ['ADMIN', 'MANAGE_DRAWS', 'MANAGE_USERS', 'MANAGE_FEATURES', 'VIEW_ANALYTICS', 'MANAGE_BLACKLIST'];
  }
  
  const db = getDatabase(serverId);
  
  // Check if role-based permissions are enabled
  if (!db.config?.featureToggles?.roleBasedPermissions) {
    // If role-based permissions are disabled, users have no permissions
    return [];
  }
  
  // If no permissions are set up, users have no permissions
  if (!db.config?.permissions) return [];
  
  // Get the guild and member
  const guild = global.client.guilds.cache.get(serverId);
  if (!guild) return [];
  
  try {
    const member = await guild.members.fetch(userId);
    
    // Collect all permissions from all roles
    const permissions = new Set();
    
    for (const role of member.roles.cache.values()) {
      if (db.config.permissions[role.id]) {
        for (const permission of db.config.permissions[role.id]) {
          permissions.add(permission);
        }
      }
    }
    
    return Array.from(permissions);
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
}
