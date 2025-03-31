export const ROLES_CONFIG = {
  ADMIN: {
    name: process.env.ADMIN_ROLE_NAME || 'System Admin IT',
    description: 'Rol con acceso total al sistema',
    defaultPermissions: {
      can_create: true,
      can_read: true,
      can_update: true,
      can_delete: true
    }
  },
  USER: {
    name: process.env.USER_ROLE_NAME || 'User',
    description: 'Rol con acceso básico al sistema',
    defaultPermissions: {
      can_create: false,
      can_read: true,
      can_update: false,
      can_delete: false
    }
  }
}; 