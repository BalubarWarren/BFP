import { ROLE_PERMISSIONS } from './constants.js';

/**
 * Check if a user has a specific permission
 * @param {Object} user - User object with role and permissions
 * @param {string} permission - Permission to check
 * @returns {boolean}
 */
export function hasPermission(user, permission) {
  if (!user || !user.role) return false;

  const rolePerms = ROLE_PERMISSIONS[user.role];
  if (!rolePerms) return false;

  // If user has custom permissions stored, check those first
  if (user.permissions) {
    try {
      const customPerms = JSON.parse(user.permissions);
      return customPerms.includes(permission);
    } catch (e) {
      // Fallback to role permissions
    }
  }

  return rolePerms.permissions.includes(permission);
}

/**
 * Check if user has multiple permissions (AND operation)
 * @param {Object} user - User object
 * @param {string[]} permissions - Array of permissions
 * @returns {boolean}
 */
export function hasAllPermissions(user, permissions) {
  return permissions.every((perm) => hasPermission(user, perm));
}

/**
 * Check if user has any of the permissions (OR operation)
 * @param {Object} user - User object
 * @param {string[]} permissions - Array of permissions
 * @returns {boolean}
 */
export function hasAnyPermission(user, permissions) {
  return permissions.some((perm) => hasPermission(user, perm));
}

/**
 * Get role level (higher = more privileges)
 * @param {string} role - Role name
 * @returns {number}
 */
export function getRoleLevel(role) {
  const rolePerms = ROLE_PERMISSIONS[role];
  return rolePerms ? rolePerms.level : 0;
}

/**
 * Check if one role can manage another role
 * @param {string} managerRole - Role of the user managing
 * @param {string} targetRole - Role being managed
 * @returns {boolean}
 */
export function canManageRole(managerRole, targetRole) {
  const managerLevel = getRoleLevel(managerRole);
  const targetLevel = getRoleLevel(targetRole);
  return managerLevel > targetLevel;
}

/**
 * Get role description and permissions
 * @param {string} role - Role name
 * @returns {Object}
 */
export function getRoleInfo(role) {
  return ROLE_PERMISSIONS[role] || null;
}

/**
 * Get all roles with their info (for role selection dropdowns, etc.)
 * @returns {Array}
 */
export function getAllRoles() {
  return Object.entries(ROLE_PERMISSIONS).map(([role, info]) => ({
    id: role,
    name: role,
    description: info.description,
    level: info.level,
    permissions: info.permissions,
  }));
}

/**
 * Check if user should have access to municipality data
 * @param {Object} user - User object
 * @param {number} municipalityId - Municipality ID to check access to
 * @returns {boolean}
 */
export function canAccessMunicipality(user, municipalityId) {
  if (!user) return false;

  // Super admin can access all municipalities
  if (user.role === 'SUPER_ADMIN') return true;

  // PIO and high-level roles can access all
  if (['PIO', 'PROVINCIAL_CHIEF_INVESTIGATOR', 'REGION_IIS', 'REGIONAL_CHIEF_OPERATION'].includes(user.role)) {
    return true;
  }

  // Local roles can only access their municipality
  if (user.municipalityId === municipalityId) return true;

  return false;
}

/**
 * Middleware for checking permissions in API routes
 * @param {Function} handler - Express/Next.js handler
 * @param {string[]} requiredPermissions - Array of required permissions
 * @returns {Function}
 */
export function requirePermission(...requiredPermissions) {
  return async (request, context) => {
    try {
      // Extract user from token (implement based on your auth system)
      // This is a placeholder - implement based on your JWT/session handling
      const authHeader = request.headers.get('authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
      }

      // Your JWT verification logic here
      // const user = await verifyAndGetUser(authHeader);

      // Check permissions
      // if (!hasAnyPermission(user, requiredPermissions)) {
      //   return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
      // }

      // Call the actual handler
      return handler(request, context);
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Authentication error' }), { status: 401 });
    }
  };
}
