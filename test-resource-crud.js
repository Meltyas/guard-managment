/**
 * Test script for Resource CRUD operations
 * Run in Foundry console to test the new functionality
 */

(async function testResourceCRUD() {
  console.log('🧪 Testing Resource CRUD Operations...');

  const gm = window.GuardManagement;

  if (!gm || !gm.isInitialized) {
    console.error('❌ GuardManagement not available or not initialized');
    return;
  }

  // Test 1: Create a test resource
  console.log('\n1️⃣ Creating test resource...');
  try {
    const testResource = await gm.documentManager.createGuardResource({
      name: 'Test Resource for CRUD',
      description: 'A test resource for CRUD operations',
      quantity: 50,
      organizationId: '',
    });
    console.log('✅ Test resource created:', testResource.name, testResource.id);

    // Test 2: Get organization and assign resource
    console.log('\n2️⃣ Testing resource assignment...');
    const organizations = gm.documentManager.getGuardOrganizations();
    if (organizations.length > 0) {
      const org = organizations[0];

      // Assign resource to organization
      const currentResources = org.system?.resources || [];
      const newResources = [...currentResources, testResource.id];

      await gm.documentManager.updateGuardOrganization(org.id, {
        resources: newResources,
        version: (org.system.version || 0) + 1,
        updatedAt: new Date(),
      });

      console.log('✅ Resource assigned to organization:', org.name);

      // Test 3: Update resource
      console.log('\n3️⃣ Testing resource update...');
      await gm.documentManager.updateGuardResource(testResource.id, {
        name: 'Updated Test Resource',
        description: 'Updated description for testing',
        quantity: 75,
        version: (testResource.system.version || 0) + 1,
      });
      console.log('✅ Resource updated successfully');

      // Test 4: Delete resource (should remove from organization too)
      console.log('\n4️⃣ Testing resource deletion...');
      const deleted = await gm.documentManager.deleteGuardResource(testResource.id);
      console.log('✅ Resource deletion result:', deleted);

      // Verify resource was removed from organization
      const updatedOrg = gm.documentManager.getGuardOrganization(org.id);
      const stillHasResource = updatedOrg?.system?.resources?.includes(testResource.id);
      console.log('✅ Resource removed from organization:', !stillHasResource);
    } else {
      console.log('⚠️ No organizations found - skipping assignment test');

      // Just delete the resource
      const deleted = await gm.documentManager.deleteGuardResource(testResource.id);
      console.log('✅ Resource deletion result:', deleted);
    }
  } catch (error) {
    console.error('❌ Error during testing:', error);
  }

  console.log('\n🎯 Resource CRUD testing complete!');
})();

// Test warehouse dialog functionality
function testWarehouseResourceOperations() {
  console.log('🏪 Testing Warehouse Resource Operations...');

  // Test opening warehouse
  try {
    const warehouse = window.GuardManagement.GMWarehouseDialog.show();
    console.log('✅ Warehouse dialog opened');

    // Test that edit and delete handlers exist
    if (typeof warehouse.handleEditTemplate === 'function') {
      console.log('✅ Edit handler available');
    } else {
      console.log('❌ Edit handler missing');
    }

    if (typeof warehouse.handleDeleteTemplate === 'function') {
      console.log('✅ Delete handler available');
    } else {
      console.log('❌ Delete handler missing');
    }
  } catch (error) {
    console.error('❌ Error testing warehouse:', error);
  }
}

// Test CustomInfoDialog event listeners
function testCustomInfoDialogEvents() {
  console.log('📋 Testing CustomInfoDialog Events...');

  // Simulate resource update event
  const updateEvent = new CustomEvent('guard-resource-updated', {
    detail: {
      resourceId: 'test-resource-id',
      oldName: 'Old Name',
      newName: 'New Name',
    },
  });

  document.dispatchEvent(updateEvent);
  console.log('✅ Resource update event dispatched');

  // Simulate resource deletion event
  const deleteEvent = new CustomEvent('guard-resource-deleted', {
    detail: {
      resourceId: 'test-resource-id',
      resourceName: 'Deleted Resource',
    },
  });

  document.dispatchEvent(deleteEvent);
  console.log('✅ Resource delete event dispatched');
}

console.log('🔧 Resource CRUD Test Functions Available:');
console.log('- testResourceCRUD() - Full CRUD testing');
console.log('- testWarehouseResourceOperations() - Warehouse dialog testing');
console.log('- testCustomInfoDialogEvents() - Event system testing');
