// Script para probar si el diálogo de información se renderiza correctamente
// Ejecutar en la consola del navegador cuando Foundry esté cargado

console.log('Testing CustomInfoDialog rendering...');

// Crear datos de prueba
const testOrgData = {
  id: 'test-org-001',
  name: 'Guardia de Prueba',
  stats: {
    robustismo: 12,
    analitica: 10,
    subterfugio: 8,
    elocuencia: 14,
  },
  resources: [
    { name: 'Armas', quantity: 25, type: 'equipment' },
    { name: 'Raciones', quantity: 50, type: 'supplies' },
  ],
  reputation: [
    { faction: 'Noble Houses', level: 3, description: 'Neutral' },
    { faction: 'Merchants Guild', level: 5, description: 'Friendly' },
  ],
  patrols: [
    { id: 'patrol-1', name: 'Patrulla Norte', members: 8, leader: 'Capitán García' },
    { id: 'patrol-2', name: 'Patrulla Sur', members: 6, leader: 'Sargento López' },
  ],
};

// Probar la creación del diálogo
try {
  if (window.GuardManagement && window.GuardManagement.CustomInfoDialog) {
    console.log('✅ CustomInfoDialog found');

    // Crear instancia del diálogo
    const dialog = new window.GuardManagement.CustomInfoDialog(testOrgData);
    console.log('✅ Dialog instance created');

    // Mostrar el diálogo
    dialog.show();
    console.log('✅ Dialog shown - check if HTML renders properly (not as raw text)');

    // Log del contenido generado para debugging
    const content = dialog.generateOrganizationInfoContent(testOrgData);
    console.log('Generated content:', content);
  } else {
    console.error('❌ CustomInfoDialog not found in window.GuardManagement');
    console.log('Available:', Object.keys(window.GuardManagement || {}));
  }
} catch (error) {
  console.error('❌ Error testing CustomInfoDialog:', error);
}
