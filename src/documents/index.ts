/**
 * Register custom document types and data models
 */

import {
  GuardOrganizationModel,
  GuardReputationModel,
  GuardResourceModel,
  PatrolModel,
} from './models/index.js';

/**
 * Register all custom DataModels with Foundry
 */
export function registerDataModels() {
  console.log('GuardManagement | Registering DataModels...');

  // Register Actor sub-types
  Object.assign(CONFIG.Actor.dataModels, {
    'guard-management.guard-organization': GuardOrganizationModel,
    'guard-management.patrol': PatrolModel,
  });

  // Register Item sub-types
  Object.assign(CONFIG.Item.dataModels, {
    'guard-management.guard-resource': GuardResourceModel,
    'guard-management.guard-reputation': GuardReputationModel,
  });

  console.log('GuardManagement | DataModels registered successfully');
}

/**
 * Create a Guard Organization actor
 */
export async function createGuardOrganization(data: any = {}) {
  // Validate required fields
  if (!data.name || data.name.trim() === '') {
    throw new Error('Organization name is required');
  }

  const organizationData = {
    name: data.name,
    type: 'guard-management.guard-organization',
    system: {
      subtitle: data.subtitle || '',
      baseStats: data.baseStats || {
        robustismo: 0,
        analitica: 0,
        subterfugio: 0,
        elocuencia: 0,
      },
      activeModifiers: [],
      resources: [],
      reputation: [],
      patrols: [],
      version: 1,
    },
    // Establecer permisos para que todos los usuarios puedan editar
    ownership: {
      default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER, // Todos los usuarios tienen permisos de propietario
    },
  };

  return await Actor.create(organizationData);
}

/**
 * Create a Patrol actor
 */
export async function createPatrol(data: any = {}) {
  const patrolData: any = {
    name: data.name || 'New Patrol',
    type: 'guard-management.patrol',
    system: {
      unitCount: data.unitCount || 1,
      organizationId: data.organizationId || '',
      customModifiers: [],
      activeEffects: [],
      status: data.status || 'idle',
      version: 1,
    },
    // Establecer permisos para que todos los usuarios puedan editar
    ownership: {
      default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER, // Todos los usuarios tienen permisos de propietario
    },
  };

  // Only add leaderId if provided and not empty
  if (data.leaderId && data.leaderId.trim() !== '') {
    patrolData.system.leaderId = data.leaderId;
  }

  return await Actor.create(patrolData);
}

/**
 * Create a Guard Resource item
 */
export async function createGuardResource(data: any = {}) {
  const resourceData = {
    name: data.name || 'New Resource',
    type: 'guard-management.guard-resource',
    img: data.image || '', // Campo img estándar de Foundry
    system: {
      description: data.description || '',
      quantity: data.quantity || 1,
      image: data.image || '', // También en system para compatibilidad
      organizationId: data.organizationId || '',
      version: 1,
    },
    // Establecer permisos para que todos los usuarios puedan editar
    ownership: {
      default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER, // Todos los usuarios tienen permisos de propietario
    },
  };

  return await Item.create(resourceData);
}

/**
 * Create a Guard Reputation item
 */
export async function createGuardReputation(data: any = {}) {
  const reputationData = {
    name: data.name || 'New Reputation',
    type: 'guard-management.guard-reputation',
    system: {
      description: data.description || '',
      level: data.level || 4, // Neutrales
      organizationId: data.organizationId || '',
      version: 1,
    },
    // Establecer permisos para que todos los usuarios puedan editar
    ownership: {
      default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER, // Todos los usuarios tienen permisos de propietario
    },
  };

  return await Item.create(reputationData);
}
