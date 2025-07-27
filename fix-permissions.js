/**
 * Script para corregir permisos de documentos de Guard Management
 * Ejecutar en la consola del navegador de Foundry VTT
 */

console.log('🔧 Iniciando corrección de permisos para Guard Management...');

// Verificar que el módulo esté cargado
if (!window.GuardManagement) {
  console.error('❌ Módulo Guard Management no encontrado. Asegúrate de que esté activado.');
} else if (!window.GuardManagement.isInitialized) {
  console.error(
    '❌ Módulo Guard Management no está inicializado. Espera un momento e intenta de nuevo.'
  );
} else {
  // Ejecutar la corrección de permisos
  window.GuardManagement.fixDocumentPermissions()
    .then(() => {
      console.log('✅ ¡Permisos corregidos exitosamente!');
      console.log(
        '💡 Ahora todos los usuarios pueden editar todos los documentos de Guard Management.'
      );

      // Mostrar estadísticas
      const orgs = window.GuardManagement.documentManager.getGuardOrganizations();
      const patrols = window.GuardManagement.documentManager.getPatrols();
      const resources = window.GuardManagement.documentManager.getGuardResources();
      const reputations = window.GuardManagement.documentManager.getGuardReputations();

      console.log('📊 Documentos actualizados:');
      console.log(`   • ${orgs.length} organizaciones`);
      console.log(`   • ${patrols.length} patrullas`);
      console.log(`   • ${resources.length} recursos`);
      console.log(`   • ${reputations.length} reputaciones`);
    })
    .catch((error) => {
      console.error('❌ Error al corregir permisos:', error);
    });
}
