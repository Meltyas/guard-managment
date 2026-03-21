/**
 * Data migration from Foundry Documents to game.settings
 * Runs once per world when migrationVersion < current version
 */

import type { GuardModifier, PatrolEffect } from './types/entities';

const CURRENT_MIGRATION_VERSION = 1;

export async function runMigrationIfNeeded(): Promise<void> {
  if (!game?.user?.isGM) return;

  const currentVersion =
    (game?.settings?.get('guard-management', 'migrationVersion') as number) || 0;
  if (currentVersion >= CURRENT_MIGRATION_VERSION) return;

  console.log('GuardManagement | Running migration v1: Documents -> Settings');

  try {
    await migrateModifiersToSettings();
    await migratePatrolEffectsToSettings();
    await cleanupLegacyDocuments();

    await game?.settings?.set('guard-management', 'migrationVersion', CURRENT_MIGRATION_VERSION);
    console.log('GuardManagement | Migration v1 complete');

    if (ui?.notifications) {
      ui.notifications.info('Guard Management: Data migrated to settings-based storage.');
    }
  } catch (e) {
    console.error('GuardManagement | Migration failed:', e);
    if (ui?.notifications) {
      ui.notifications.error('Guard Management: Migration failed. Check console for details.');
    }
  }
}

async function migrateModifiersToSettings(): Promise<void> {
  const modifierDocs =
    (game as any).items?.filter?.((i: any) => i.type === 'guard-management.guard-modifier') || [];

  if (modifierDocs.length === 0) {
    console.log('GuardManagement | No modifier documents to migrate');
    return;
  }

  const modifiers: GuardModifier[] = modifierDocs.map((doc: any) => ({
    id: doc.id, // Preserve original ID for activeModifiers references
    name: doc.name,
    description: doc.system?.description || '',
    type: doc.system?.type || 'neutral',
    image: doc.img || '',
    organizationId: doc.system?.organizationId || '',
    statModifications: doc.system?.statModifications || [],
    version: doc.system?.version || 1,
  }));

  await game?.settings?.set('guard-management', 'modifiers', modifiers);
  console.log(`GuardManagement | Migrated ${modifiers.length} guard modifiers to settings`);

  // Delete the old Foundry Item documents
  const ids = modifierDocs.map((d: any) => d.id);
  await (Item as any).deleteDocuments(ids);
  console.log(`GuardManagement | Deleted ${ids.length} legacy modifier documents`);
}

async function migratePatrolEffectsToSettings(): Promise<void> {
  const effectDocs =
    (game as any).items?.filter?.((i: any) => i.type === 'guard-management.patrol-effect') || [];

  if (effectDocs.length === 0) {
    console.log('GuardManagement | No patrol effect documents to migrate');
    return;
  }

  const effects: PatrolEffect[] = effectDocs.map((doc: any) => ({
    id: doc.id, // Preserve original ID for patrol references
    name: doc.name,
    description: doc.system?.description || '',
    type: doc.system?.type || 'neutral',
    image: doc.img || '',
    targetPatrolId: doc.system?.targetPatrolId || '',
    statModifications: doc.system?.statModifications || [],
    version: doc.system?.version || 1,
  }));

  await game?.settings?.set('guard-management', 'patrolEffects', effects);
  console.log(`GuardManagement | Migrated ${effects.length} patrol effects to settings`);

  // Delete the old Foundry Item documents
  const ids = effectDocs.map((d: any) => d.id);
  await (Item as any).deleteDocuments(ids);
  console.log(`GuardManagement | Deleted ${ids.length} legacy patrol effect documents`);
}

async function cleanupLegacyDocuments(): Promise<void> {
  // Clean up any remaining guard-management Actor documents
  const actorDocs =
    (game as any).actors?.filter?.((a: any) => a.type?.startsWith('guard-management.')) || [];

  if (actorDocs.length > 0) {
    const ids = actorDocs.map((d: any) => d.id);
    await (Actor as any).deleteDocuments(ids);
    console.log(`GuardManagement | Deleted ${ids.length} legacy actor documents`);
  }

  // Clean up remaining guard-management Item documents (resources, reputations)
  const itemDocs =
    (game as any).items?.filter?.((i: any) => i.type?.startsWith('guard-management.')) || [];

  if (itemDocs.length > 0) {
    const ids = itemDocs.map((d: any) => d.id);
    await (Item as any).deleteDocuments(ids);
    console.log(`GuardManagement | Deleted ${ids.length} legacy item documents`);
  }
}
