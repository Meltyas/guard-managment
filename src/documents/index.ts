/**
 * Register custom document types for migration compatibility.
 * DataModels are NO LONGER registered — all data is stored in game.settings.
 * Type strings are kept so Foundry can load/delete orphaned documents during migration.
 */

export function registerDataModels() {
  console.log('GuardManagement | Registering types (settings-based, no DataModels)...');

  // Ensure types arrays exist
  if (!Array.isArray((CONFIG.Actor as any).types)) {
    (CONFIG.Actor as any).types = [];
  }
  if (!Array.isArray((CONFIG.Item as any).types)) {
    (CONFIG.Item as any).types = [];
  }

  // Register type strings so Foundry can still load orphaned documents for migration/deletion
  const actorTypes = ['guard-management.guard-organization', 'guard-management.patrol'];
  const itemTypes = [
    'guard-management.guard-resource',
    'guard-management.guard-reputation',
    'guard-management.guard-modifier',
    'guard-management.patrol-effect',
  ];

  for (const t of actorTypes) {
    if (!(CONFIG.Actor as any).types.includes(t)) {
      (CONFIG.Actor as any).types.push(t);
    }
  }
  for (const t of itemTypes) {
    if (!(CONFIG.Item as any).types.includes(t)) {
      (CONFIG.Item as any).types.push(t);
    }
  }

  // NO DataModel assignments — this prevents Daggerheart from calling
  // getRollData, allApplicableEffects, isItemAvailable, etc. on our types

  console.log('GuardManagement | Types registered (no DataModels)');
}
