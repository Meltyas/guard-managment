// Simple drag & drop test for Guard Management
// Paste this in the console to test

(function testDragDrop() {
  console.log('=== Testing Guard Management Drag & Drop ===');

  // Test 1: Check if GuardManagement is loaded
  const gm = window.GuardManagement;
  if (!gm) {
    console.error('❌ GuardManagement not found');
    return;
  }
  console.log('✅ GuardManagement loaded');

  // Test 2: Check warehouse dialog elements
  const warehouseDialog = document.querySelector('.gm-warehouse-dialog');
  if (warehouseDialog) {
    console.log('✅ Warehouse dialog found');

    const draggableResources = warehouseDialog.querySelectorAll(
      '.resource-template[draggable="true"]'
    );
    console.log(`Found ${draggableResources.length} draggable resources`);

    draggableResources.forEach((resource, index) => {
      const resourceId = resource.getAttribute('data-resource-id');
      console.log(`  Resource ${index}: ID=${resourceId}`);
    });
  } else {
    console.log('❌ Warehouse dialog not found');
  }

  // Test 3: Check organization dialog elements
  const orgDialog = document.querySelector('.dialog-v2');
  if (orgDialog) {
    console.log('✅ Organization dialog found');

    const dropZones = orgDialog.querySelectorAll('.drop-zone');
    console.log(`Found ${dropZones.length} drop zones`);

    dropZones.forEach((zone, index) => {
      const orgId = zone.getAttribute('data-organization-id');
      console.log(`  Drop zone ${index}: Organization ID=${orgId}`);

      // Check if listeners are attached (basic check)
      const hasListeners = zone.ondrop || zone.ondragover;
      console.log(`    Has basic listeners: ${hasListeners ? 'Yes' : 'No'}`);
    });
  } else {
    console.log('❌ Organization dialog not found');
  }

  // Test 4: Manual setup function
  window.setupDragDropManually = function () {
    console.log('🔧 Setting up drag & drop manually...');

    // Setup warehouse draggable items
    const draggableItems = document.querySelectorAll('.resource-template[draggable="true"]');
    draggableItems.forEach((item) => {
      item.addEventListener('dragstart', function (event) {
        console.log('🚀 Drag started:', this.getAttribute('data-resource-id'));
        const resourceId = this.getAttribute('data-resource-id');
        event.dataTransfer.setData(
          'text/plain',
          JSON.stringify({
            type: 'guard-resource',
            resourceId: resourceId,
          })
        );
      });
    });

    // Setup drop zones
    const dropZones = document.querySelectorAll('.drop-zone');
    dropZones.forEach((zone) => {
      zone.addEventListener('dragover', function (event) {
        event.preventDefault();
        this.classList.add('drag-over');
      });

      zone.addEventListener('dragleave', function (event) {
        this.classList.remove('drag-over');
      });

      zone.addEventListener('drop', function (event) {
        event.preventDefault();
        this.classList.remove('drag-over');

        try {
          const data = JSON.parse(event.dataTransfer.getData('text/plain'));
          console.log('📦 Dropped data:', data);
          console.log('📍 Dropped on zone:', this.getAttribute('data-organization-id'));
        } catch (error) {
          console.error('❌ Error parsing drop data:', error);
        }
      });
    });

    console.log('✅ Manual setup complete');
  };

  console.log('Run window.setupDragDropManually() to manually setup drag & drop');
})();
