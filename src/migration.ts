/**
 * Data migration from Foundry Documents to game.settings
 * Runs once per world when migrationVersion < current version
 */

import type { GuardModifier, PatrolEffect } from './types/entities';

const CURRENT_MIGRATION_VERSION = 2;

// Mapping from old stat keys to new Daggerheart trait keys
const STAT_KEY_MAP: Record<string, string> = {
  robustismo: 'strength',
  analitica: 'knowledge',
  subterfugio: 'finesse',
  elocuencia: 'presence',
};

const OLD_STAT_KEYS = Object.keys(STAT_KEY_MAP);

/** Migrates a GuardStats object from old keys to Daggerheart trait keys */
function migrateStats(stats: Record<string, number>): Record<string, number> {
  const migrated: Record<string, number> = {
    agility: 0,
    strength: 0,
    finesse: 0,
    instinct: 0,
    presence: 0,
    knowledge: 0,
  };

  for (const [oldKey, newKey] of Object.entries(STAT_KEY_MAP)) {
    if (oldKey in stats) {
      migrated[newKey] = stats[oldKey] ?? 0;
    }
  }

  // Preserve already-migrated keys if present
  for (const key of Object.keys(migrated)) {
    if (key in stats) {
      migrated[key] = stats[key] ?? 0;
    }
  }

  return migrated;
}

/** Returns true if the object still uses legacy stat keys */
function hasLegacyStats(stats: Record<string, unknown>): boolean {
  return OLD_STAT_KEYS.some((k) => k in stats);
}

export async function runMigrationIfNeeded(): Promise<void> {
  if (!game?.user?.isGM) return;

  const currentVersion =
    (game?.settings?.get('guard-management', 'migrationVersion') as number) || 0;
  if (currentVersion >= CURRENT_MIGRATION_VERSION) return;

  // Run sequential migrations
  if (currentVersion < 1) {
    console.log('GuardManagement | Running migration v1: Documents -> Settings');
    try {
      await migrateModifiersToSettings();
      await migratePatrolEffectsToSettings();
      await cleanupLegacyDocuments();
      console.log('GuardManagement | Migration v1 complete');
    } catch (e) {
      console.error('GuardManagement | Migration v1 failed:', e);
      if (ui?.notifications) {
        ui.notifications.error('Guard Management: Migration v1 failed. Check console for details.');
      }
      return;
    }
  }

  if (currentVersion < 2) {
    console.log('GuardManagement | Running migration v2: Old stats -> Daggerheart traits');
    try {
      await migrateStatsToTraits();
      console.log('GuardManagement | Migration v2 complete');
      if (ui?.notifications) {
        ui.notifications.info(
          'Guard Management: Stats migrados a rasgos de Daggerheart (Agilidad, Fuerza, Destreza, Instinto, Presencia, Conocimiento).'
        );
      }
    } catch (e) {
      console.error('GuardManagement | Migration v2 failed:', e);
      if (ui?.notifications) {
        ui.notifications.error('Guard Management: Migration v2 failed. Check console for details.');
      }
      return;
    }
  }

  await game?.settings?.set('guard-management', 'migrationVersion', CURRENT_MIGRATION_VERSION);
  console.log('GuardManagement | All migrations complete (v' + CURRENT_MIGRATION_VERSION + ')');
}

// ─── Migration v2: Stats → Daggerheart Traits ────────────────────────────────

async function migrateStatsToTraits(): Promise<void> {
  await migrateOrganizationStats();
  await migratePatrolStats();
  await migrateModifierStatNames();
  await migratePatrolEffectStatNames();
}

async function migrateOrganizationStats(): Promise<void> {
  const org = game?.settings?.get('guard-management', 'guardOrganization') as any;
  if (!org) return;

  if (org.baseStats && hasLegacyStats(org.baseStats)) {
    org.baseStats = migrateStats(org.baseStats);
    await game?.settings?.set('guard-management', 'guardOrganization', org);
    console.log('GuardManagement | Migrated organization baseStats to Daggerheart traits');
  }
}

async function migratePatrolStats(): Promise<void> {
  const patrols = (game?.settings?.get('guard-management', 'patrols') as any[]) || [];
  let changed = false;

  for (const patrol of patrols) {
    if (patrol.baseStats && hasLegacyStats(patrol.baseStats)) {
      patrol.baseStats = migrateStats(patrol.baseStats);
      changed = true;
    }
    if (patrol.derivedStats && hasLegacyStats(patrol.derivedStats)) {
      patrol.derivedStats = migrateStats(patrol.derivedStats);
      changed = true;
    }
    if (patrol.calculatedStats && hasLegacyStats(patrol.calculatedStats)) {
      patrol.calculatedStats = migrateStats(patrol.calculatedStats);
      changed = true;
    }
    // Migrate patrolEffects modifiers
    if (Array.isArray(patrol.patrolEffects)) {
      for (const effect of patrol.patrolEffects) {
        if (effect.modifiers && hasLegacyStats(effect.modifiers)) {
          effect.modifiers = migrateStats(effect.modifiers);
          changed = true;
        }
      }
    }
    // Migrate legacy customModifiers statName keys
    if (Array.isArray(patrol.customModifiers)) {
      for (const mod of patrol.customModifiers) {
        if (mod.statName && STAT_KEY_MAP[mod.statName]) {
          mod.statName = STAT_KEY_MAP[mod.statName];
          changed = true;
        }
      }
    }
  }

  if (changed) {
    await game?.settings?.set('guard-management', 'patrols', patrols);
    console.log('GuardManagement | Migrated patrol stats to Daggerheart traits');
  }
}

async function migrateModifierStatNames(): Promise<void> {
  let modifiers: any[] = [];
  try {
    modifiers = (game?.settings?.get('guard-management', 'modifiers') as any[]) || [];
  } catch {
    // Setting not registered (no legacy modifiers) — nothing to migrate
    return;
  }
  let changed = false;

  for (const mod of modifiers) {
    if (Array.isArray(mod.statModifications)) {
      for (const sm of mod.statModifications) {
        if (sm.statName && STAT_KEY_MAP[sm.statName]) {
          sm.statName = STAT_KEY_MAP[sm.statName];
          changed = true;
        }
      }
    }
  }

  if (changed) {
    await game?.settings?.set('guard-management', 'modifiers', modifiers);
    console.log('GuardManagement | Migrated modifier statName keys to Daggerheart traits');
  }
}

async function migratePatrolEffectStatNames(): Promise<void> {
  let effects: any[] = [];
  try {
    effects = (game?.settings?.get('guard-management', 'patrolEffects') as any[]) || [];
  } catch {
    // Setting not registered (no legacy patrol effects) — nothing to migrate
    return;
  }
  let changed = false;

  for (const effect of effects) {
    if (Array.isArray(effect.statModifications)) {
      for (const sm of effect.statModifications) {
        if (sm.statName && STAT_KEY_MAP[sm.statName]) {
          sm.statName = STAT_KEY_MAP[sm.statName];
          changed = true;
        }
      }
    }
  }

  if (changed) {
    await game?.settings?.set('guard-management', 'patrolEffects', effects);
    console.log('GuardManagement | Migrated patrolEffect statName keys to Daggerheart traits');
  }
}

// ─── Migration v1: Documents → Settings ──────────────────────────────────────

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
