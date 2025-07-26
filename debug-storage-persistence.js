/**
 * Debug script para verificar la persistencia del localStorage
 * Ejecutar en la consola para verificar qué está pasando con los resources
 */

// Función para crear un resource de prueba
function createTestResource() {
  const resourceTemplatesKey = 'guard-management-resource-templates';
  const testResource = {
    id: foundry.utils.randomID(),
    name: 'Test Resource Persistence',
    description: 'Para verificar persistencia',
    quantity: 5,
    organizationId: 'test-org',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const currentTemplates = JSON.parse(localStorage.getItem(resourceTemplatesKey) || '[]');
  currentTemplates.push(testResource);
  localStorage.setItem(resourceTemplatesKey, JSON.stringify(currentTemplates));

  console.log('✅ Test resource created:', testResource);
  console.log('📦 Current templates in storage:', currentTemplates);
  return testResource;
}

// Función para verificar resources en storage
function checkResourceStorage() {
  const resourceTemplatesKey = 'guard-management-resource-templates';
  const templates = JSON.parse(localStorage.getItem(resourceTemplatesKey) || '[]');

  console.log('=== STORAGE CHECK ===');
  console.log('📦 Resources in localStorage:', templates);
  console.log('🔢 Total count:', templates.length);

  // Verificar también en GM Warehouse si está disponible
  if (window.GuardManagement?.dialogManager?.gmWarehouseDialog) {
    console.log('🏪 GM Warehouse dialog exists');
  }

  return templates;
}

// Función para limpiar test resources
function cleanTestResources() {
  const resourceTemplatesKey = 'guard-management-resource-templates';
  const templates = JSON.parse(localStorage.getItem(resourceTemplatesKey) || '[]');
  const cleaned = templates.filter((r) => !r.name.includes('Test Resource'));
  localStorage.setItem(resourceTemplatesKey, JSON.stringify(cleaned));

  console.log('🧹 Cleaned test resources');
  console.log('📦 Remaining templates:', cleaned);
}

// Función para monitorear cambios en localStorage
function monitorStorageChanges() {
  const resourceTemplatesKey = 'guard-management-resource-templates';
  let lastState = localStorage.getItem(resourceTemplatesKey);

  console.log('👁️ Started monitoring localStorage changes...');
  console.log('📊 Initial state:', JSON.parse(lastState || '[]'));

  const monitor = setInterval(() => {
    const currentState = localStorage.getItem(resourceTemplatesKey);
    if (currentState !== lastState) {
      console.log('🔄 Storage changed!');
      console.log('📊 Old state:', JSON.parse(lastState || '[]'));
      console.log('📊 New state:', JSON.parse(currentState || '[]'));
      lastState = currentState;
    }
  }, 1000);

  // Auto-stop después de 30 segundos
  setTimeout(() => {
    clearInterval(monitor);
    console.log('⏹️ Storage monitoring stopped');
  }, 30000);

  return monitor;
}

// Exportar funciones para uso en consola
window.debugStorage = {
  createTestResource,
  checkResourceStorage,
  cleanTestResources,
  monitorStorageChanges,
};

console.log('🛠️ Debug Storage loaded. Use:');
console.log('debugStorage.checkResourceStorage() - Check current storage');
console.log('debugStorage.createTestResource() - Create test resource');
console.log('debugStorage.cleanTestResources() - Clean test resources');
console.log('debugStorage.monitorStorageChanges() - Monitor changes for 30s');
