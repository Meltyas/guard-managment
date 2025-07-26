/**
 * Script de prueba para el drag & drop de recursos
 * Ejecutar en la consola de Foundry para probar la funcionalidad
 */

async function testDragDropFeature() {
  console.log('=== TESTING DRAG & DROP FEATURE ===');

  const gm = window.GuardManagement;
  if (!gm) {
    console.error('GuardManagement module not found');
    return;
  }

  // 1. Verificar que tenemos organizaciones
  const organizations = gm.documentManager.getGuardOrganizations();
  console.log('Available organizations:', organizations.length);

  if (organizations.length === 0) {
    console.log('Creating sample organization...');
    await gm.documentManager.createSampleData();
  }

  // 2. Verificar que tenemos recursos en el warehouse
  const resources = gm.documentManager.getGuardResources();
  console.log('Available resources:', resources.length);

  if (resources.length === 0) {
    console.log('Creating sample resources...');

    // Crear algunos recursos de ejemplo
    const sampleResources = [
      {
        name: 'Espadas de Acero',
        description: 'Espadas de alta calidad para la guardia',
        quantity: 25,
        organizationId: 'gm-warehouse-templates', // Storage en warehouse
      },
      {
        name: 'Pociones de Curación',
        description: 'Pociones menores para uso en el campo',
        quantity: 15,
        organizationId: 'gm-warehouse-templates',
      },
      {
        name: 'Armaduras de Cuero',
        description: 'Armaduras ligeras para patrullaje',
        quantity: 20,
        organizationId: 'gm-warehouse-templates',
      },
    ];

    for (const resourceData of sampleResources) {
      await gm.documentManager.createGuardResource(resourceData);
    }
  }

  // 3. Mostrar el warehouse para probar drag
  console.log('Opening GM Warehouse...');
  const warehouse = new (await import('./src/dialogs/GMWarehouseDialog.js')).GMWarehouseDialog();
  warehouse.show();

  // 4. Mostrar una organización para probar drop
  setTimeout(() => {
    console.log('Opening Organization Dialog...');
    const firstOrg = organizations[0];
    if (firstOrg) {
      gm.guardDialogManager.showEditOrganizationDialog(firstOrg);
    }
  }, 1000);

  console.log('=== DRAG & DROP TEST SETUP COMPLETE ===');
  console.log('Instructions:');
  console.log('1. Open both the GM Warehouse and Organization dialogs');
  console.log('2. Drag a resource from the warehouse to the organization resources area');
  console.log("3. The resource should appear in the organization's resource list");
  console.log('4. Check console for drag/drop events');
}

// Función específica para debuggear drop zones
function debugDropZones() {
  console.log('=== DEBUGGING DROP ZONES ===');

  const dropZones = document.querySelectorAll('.drop-zone');
  console.log('Drop zones found:', dropZones.length);

  dropZones.forEach((zone, index) => {
    console.log(`Drop zone ${index}:`, {
      element: zone,
      classList: zone.classList.toString(),
      organizationId: zone.dataset.organizationId,
      hasEventListeners: zone._eventListeners || 'unknown',
      parentElement: zone.parentElement?.tagName,
      bounds: zone.getBoundingClientRect(),
    });
  });

  // Check for draggable elements
  const draggableElements = document.querySelectorAll('[draggable="true"]');
  console.log('Draggable elements found:', draggableElements.length);

  draggableElements.forEach((element, index) => {
    console.log(`Draggable ${index}:`, {
      element: element,
      resourceId: element.dataset.resourceId,
      bounds: element.getBoundingClientRect(),
    });
  });

  return {
    dropZones: dropZones.length,
    draggableElements: draggableElements.length,
  };
}

// Función para probar manualmente el drag & drop
function testManualDragDrop() {
  console.log('=== MANUAL DRAG & DROP TEST ===');

  const dropZones = document.querySelectorAll('.drop-zone');
  const draggables = document.querySelectorAll('[draggable="true"]');

  if (dropZones.length === 0) {
    console.error('No drop zones found! Make sure an organization dialog is open.');
    return;
  }

  if (draggables.length === 0) {
    console.error('No draggable elements found! Make sure the GM warehouse is open.');
    return;
  }

  console.log('Found elements for testing:', {
    dropZones: dropZones.length,
    draggables: draggables.length,
  });

  // Agregar listeners temporales para testing
  dropZones.forEach((zone, index) => {
    const testHandler = (event) => {
      console.log(`TEST: Event on drop zone ${index}:`, event.type);
      event.preventDefault();

      if (event.type === 'drop') {
        console.log('TEST: Drop data:', event.dataTransfer?.getData('text/plain'));
      }
    };

    zone.addEventListener('dragover', testHandler);
    zone.addEventListener('dragenter', testHandler);
    zone.addEventListener('drop', testHandler);

    console.log(`Added test listeners to drop zone ${index}`);
  });

  // Simular un drag start en el primer elemento draggable
  if (draggables.length > 0) {
    const firstDraggable = draggables[0];
    console.log('Testing drag start on first draggable element');

    const dragStartEvent = new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
      dataTransfer: new DataTransfer(),
    });

    firstDraggable.dispatchEvent(dragStartEvent);
  }
}

// Función helper para inspeccionar el estado actual
function inspectDragDropState() {
  console.log('=== CURRENT DRAG & DROP STATE ===');

  const gm = window.GuardManagement;
  if (!gm) {
    console.error('GuardManagement module not found');
    return;
  }

  const organizations = gm.documentManager.getGuardOrganizations();
  const resources = gm.documentManager.getGuardResources();

  console.log(
    'Organizations:',
    organizations.map((org) => ({
      id: org.id,
      name: org.name,
      resources: org.system?.resources || [],
    }))
  );

  console.log(
    'Resources:',
    resources.map((res) => ({
      id: res.id,
      name: res.name,
      quantity: res.system?.quantity || res.quantity,
      organizationId: res.system?.organizationId || res.organizationId,
    }))
  );

  // Check for drag & drop elements
  const draggableResources = document.querySelectorAll('.resource-template[draggable="true"]');
  const dropZones = document.querySelectorAll('.drop-zone');

  console.log('Draggable resources found:', draggableResources.length);
  console.log('Drop zones found:', dropZones.length);

  return {
    organizations: organizations.length,
    resources: resources.length,
    draggableElements: draggableResources.length,
    dropZones: dropZones.length,
  };
}

// Event listener para monitorear eventos de drag & drop
function setupDragDropMonitoring() {
  console.log('Setting up drag & drop event monitoring...');

  // Listen for custom events
  window.addEventListener('guard-resource-assigned', (event) => {
    console.log('Resource assigned event:', event.detail);
  });

  // Listen for standard drag events on document
  document.addEventListener('dragstart', (event) => {
    if (event.target.closest('.resource-template')) {
      console.log('MONITOR: Drag started:', event.target);
    }
  });

  document.addEventListener('dragover', (event) => {
    if (event.target.closest('.drop-zone')) {
      console.log('MONITOR: Drag over drop zone:', event.target);
    }
  });

  document.addEventListener('drop', (event) => {
    if (event.target.closest('.drop-zone')) {
      console.log('MONITOR: Drop on drop zone:', event.target);
    }
  });

  console.log('Drag & drop monitoring active');
}

// Funciones disponibles globalmente para testing
window.testDragDropFeature = testDragDropFeature;
window.inspectDragDropState = inspectDragDropState;
window.setupDragDropMonitoring = setupDragDropMonitoring;
window.debugDropZones = debugDropZones;
window.testManualDragDrop = testManualDragDrop;

console.log('Drag & Drop test functions loaded. Available commands:');
console.log('- testDragDropFeature(): Set up test environment');
console.log('- inspectDragDropState(): Check current state');
console.log('- setupDragDropMonitoring(): Monitor drag & drop events');
console.log('- debugDropZones(): Debug drop zone setup');
console.log('- testManualDragDrop(): Test drag & drop manually');
