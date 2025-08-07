/**
 * Register custom document types and data models
 */

import type {} from '../types/foundry';
import {
  GuardOrganizationModel,
  GuardReputationModel,
  GuardResourceModel,
  PatrolModel,
} from './models/index.js';

const MODULE_FOLDER_NAME = 'Guard Management';

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
    ownership: {
      default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
    },
  } as any;

  const folder = await getOrCreateModuleFolder('Actor');
  if (folder) organizationData.folder = (folder as any).id;

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
    ownership: {
      default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
    },
  };
  if (data.leaderId && data.leaderId.trim() !== '') {
    patrolData.system.leaderId = data.leaderId;
  }
  const folder = await getOrCreateModuleFolder('Actor');
  if (folder) patrolData.folder = (folder as any).id;
  return await Actor.create(patrolData);
}

/**
 * Create a Guard Resource item
 */
export async function createGuardResource(data: any = {}) {
  const resourceData: any = {
    name: data.name || 'New Resource',
    type: 'guard-management.guard-resource',
    img: data.image || '',
    system: {
      description: data.description || '',
      quantity: data.quantity || 1,
      image: data.image || '',
      organizationId: data.organizationId || '',
      version: 1,
    },
    ownership: {
      default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
    },
  };
  const folder = await getOrCreateModuleFolder('Item');
  if (folder) resourceData.folder = (folder as any).id;
  return await Item.create(resourceData);
}

/**
 * Create a Guard Reputation item
 */
export async function createGuardReputation(data: any = {}) {
  const reputationData: any = {
    name: data.name || 'New Reputation',
    type: 'guard-management.guard-reputation',
    img: data.image || '',
    system: {
      description: data.description || '',
      level: data.level || 4,
      organizationId: data.organizationId || '',
      version: 1,
    },
    ownership: {
      default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
    },
  };
  const folder = await getOrCreateModuleFolder('Item');
  if (folder) reputationData.folder = (folder as any).id;
  return await Item.create(reputationData);
}

/**
 * Get or create the module folder for Actors or Items
 */
async function getOrCreateModuleFolder(type: 'Actor' | 'Item'): Promise<Folder | null> {
  try {
    // @ts-ignore Foundry global
    const collection = game?.folders;
    if (!collection) return null;
    // @ts-ignore
    let folder: Folder | undefined = game.folders?.find?.(
      (f: any) => f.name === MODULE_FOLDER_NAME && f.type === type
    );
    if (!folder) {
      // @ts-ignore
      folder = await Folder.create({ name: MODULE_FOLDER_NAME, type, sorting: 'a' });
    }
    return folder ?? null;
  } catch (e) {
    console.error('GuardManagement | Failed to get/create module folder', type, e);
    return null;
  }
}
