/**
 * Register custom document types and data models
 */

import type {} from '../types/foundry';
import {
  GuardModifierModel,
  GuardOrganizationModel,
  GuardReputationModel,
  GuardResourceModel,
  PatrolEffectModel,
  PatrolModel,
} from './models/index.js';

const MODULE_FOLDER_NAME = 'Guard Management';

/**
 * Register all custom DataModels with Foundry
 */
export function registerDataModels() {
  console.log('GuardManagement | Registering DataModels...');

  // Ensure types arrays exist
  if (!Array.isArray(CONFIG.Actor.types)) {
    CONFIG.Actor.types = [];
  }
  if (!Array.isArray(CONFIG.Item.types)) {
    CONFIG.Item.types = [];
  }

  // Register Actor sub-types in types array (required for validation)
  if (!CONFIG.Actor.types.includes('guard-management.guard-organization')) {
    CONFIG.Actor.types.push('guard-management.guard-organization');
  }
  if (!CONFIG.Actor.types.includes('guard-management.patrol')) {
    CONFIG.Actor.types.push('guard-management.patrol');
  }

  // Register Actor sub-types DataModels
  Object.assign(CONFIG.Actor.dataModels, {
    'guard-management.guard-organization': GuardOrganizationModel,
    'guard-management.patrol': PatrolModel,
  });

  // Register default icons for custom Actor types (prevents Daggerheart DEFAULT_ICON errors)
  if (!(CONFIG as any).Actor.typeIcons) {
    (CONFIG as any).Actor.typeIcons = {};
  }
  (CONFIG as any).Actor.typeIcons['guard-management.guard-organization'] = 'icons/svg/castle.svg';
  (CONFIG as any).Actor.typeIcons['guard-management.patrol'] = 'icons/svg/pawprint.svg';

  // Register Item sub-types in types array (required for validation)
  if (!CONFIG.Item.types.includes('guard-management.guard-resource')) {
    CONFIG.Item.types.push('guard-management.guard-resource');
  }
  if (!CONFIG.Item.types.includes('guard-management.guard-reputation')) {
    CONFIG.Item.types.push('guard-management.guard-reputation');
  }
  if (!CONFIG.Item.types.includes('guard-management.guard-modifier')) {
    CONFIG.Item.types.push('guard-management.guard-modifier');
  }
  if (!CONFIG.Item.types.includes('guard-management.patrol-effect')) {
    CONFIG.Item.types.push('guard-management.patrol-effect');
  }

  // Register Item sub-types DataModels
  Object.assign(CONFIG.Item.dataModels, {
    'guard-management.guard-resource': GuardResourceModel,
    'guard-management.guard-reputation': GuardReputationModel,
    'guard-management.guard-modifier': GuardModifierModel,
    'guard-management.patrol-effect': PatrolEffectModel,
  });

  // Register default icons for custom Item types
  if (!(CONFIG as any).Item.typeIcons) {
    (CONFIG as any).Item.typeIcons = {};
  }
  (CONFIG as any).Item.typeIcons['guard-management.guard-resource'] = 'icons/svg/item-bag.svg';
  (CONFIG as any).Item.typeIcons['guard-management.guard-reputation'] = 'icons/svg/angel.svg';
  (CONFIG as any).Item.typeIcons['guard-management.guard-modifier'] = 'icons/svg/upgrade.svg';
  (CONFIG as any).Item.typeIcons['guard-management.patrol-effect'] = 'icons/svg/aura.svg';

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
    img: data.img || 'icons/svg/castle.svg', // Explicit default icon
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
    img: data.img || 'icons/svg/pawprint.svg', // Explicit default icon
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
 * Create a Patrol Effect item
 */
export async function createPatrolEffect(data: any = {}) {
  const effectData: any = {
    name: data.name || 'New Patrol Effect',
    type: 'guard-management.patrol-effect',
    img: data.image || '',
    system: {
      description: data.description || '',
      type: data.type || 'neutral',
      image: data.image || '',
      targetPatrolId: data.targetPatrolId || '',
      statModifications: data.statModifications || [],
      version: 1,
    },
    ownership: {
      default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
    },
  };
  const folder = await getOrCreateModuleFolder('Item');
  if (folder) effectData.folder = (folder as any).id;
  return await Item.create(effectData);
}

/**
 * Create a Guard Modifier item
 */
export async function createGuardModifier(data: any = {}) {
  const modifierData: any = {
    name: data.name || 'New Guard Modifier',
    type: 'guard-management.guard-modifier',
    img: data.image || '',
    system: {
      description: data.description || '',
      type: data.type || 'neutral',
      image: data.image || '',
      organizationId: data.organizationId || '',
      statModifications: data.statModifications || [],
      version: 1,
    },
    ownership: {
      default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
    },
  };
  const folder = await getOrCreateModuleFolder('Item');
  if (folder) modifierData.folder = (folder as any).id;
  return await Item.create(modifierData);
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
