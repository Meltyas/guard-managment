/**
 * Script para eliminar Items antiguos de tipo guard-resource y guard-reputation
 * Ejecutar desde la consola del navegador en Foundry
 */

(async function cleanupOldResourceItems() {
  console.log('🧹 Starting cleanup of old resource/reputation Items...');

  const resourcesToDelete = game.items.filter(
    (item) => item.type === 'guard-management.guard-resource'
  );
  const reputationsToDelete = game.items.filter(
    (item) => item.type === 'guard-management.guard-reputation'
  );

  console.log(`Found ${resourcesToDelete.length} guard-resource Items`);
  console.log(`Found ${reputationsToDelete.length} guard-reputation Items`);

  if (resourcesToDelete.length === 0 && reputationsToDelete.length === 0) {
    console.log('✅ No Items to delete');
    return;
  }

  const confirmDelete = confirm(
    `Are you sure you want to delete ${resourcesToDelete.length} resources and ${reputationsToDelete.length} reputations?\n\nThis action cannot be undone.`
  );

  if (!confirmDelete) {
    console.log('❌ Cleanup cancelled by user');
    return;
  }

  // Delete resources
  for (const resource of resourcesToDelete) {
    try {
      await resource.delete();
      console.log(`✅ Deleted resource: ${resource.name} (${resource.id})`);
    } catch (error) {
      console.error(`❌ Error deleting resource ${resource.id}:`, error);
    }
  }

  // Delete reputations
  for (const reputation of reputationsToDelete) {
    try {
      await reputation.delete();
      console.log(`✅ Deleted reputation: ${reputation.name} (${reputation.id})`);
    } catch (error) {
      console.error(`❌ Error deleting reputation ${reputation.id}:`, error);
    }
  }

  console.log('🎉 Cleanup completed!');
  console.log(`Deleted ${resourcesToDelete.length} resources and ${reputationsToDelete.length} reputations`);
})();
