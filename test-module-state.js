// Test script para verificar el estado del módulo
// Ejecutar en la consola de Foundry después de cargar el módulo

console.log('=== Guard Management Module Test ===');

// Verificar si el módulo está disponible
const gm = window.GuardManagement;
if (!gm) {
  console.error('❌ GuardManagement no está disponible en window');
} else {
  console.log('✅ GuardManagement disponible:', gm);
}

// Verificar documentManager
if (gm?.documentManager) {
  console.log('✅ DocumentManager disponible');
  
  // Verificar organizaciones existentes
  const orgs = gm.documentManager.getGuardOrganizations();
  console.log('📋 Organizaciones encontradas:', orgs.length);
  
  if (orgs.length === 0) {
    console.log('⚠️ No hay organizaciones. Creando datos de ejemplo...');
    gm.documentManager.createSampleData().then(() => {
      console.log('✅ Datos de ejemplo creados');
      const newOrgs = gm.documentManager.getGuardOrganizations();
      console.log('📋 Organizaciones después de crear ejemplo:', newOrgs.length);
      newOrgs.forEach((org, index) => {
        console.log(`  ${index + 1}. ${org.name} (${org.id})`);
      });
    });
  } else {
    console.log('📋 Organizaciones existentes:');
    orgs.forEach((org, index) => {
      console.log(`  ${index + 1}. ${org.name} (${org.id})`);
    });
  }
} else {
  console.error('❌ DocumentManager no disponible');
}

// Verificar floating panel
if (gm?.floatingPanel) {
  console.log('✅ FloatingPanel disponible');
} else {
  console.error('❌ FloatingPanel no disponible');
}

// Verificar game.actors
if (game?.actors) {
  console.log('✅ game.actors disponible');
  const guardActors = game.actors.filter(actor => actor.type?.includes('guard-management'));
  console.log('🛡️ Guard actors encontrados:', guardActors.length);
  guardActors.forEach((actor, index) => {
    console.log(`  ${index + 1}. ${actor.name} (${actor.type})`);
  });
} else {
  console.error('❌ game.actors no disponible');
}

console.log('=== Fin Test ===');
