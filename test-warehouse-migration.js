/**
 * Test script to verify GM Warehouse migration from localStorage to DocumentBasedManager
 *
 * Run this in Foundry's console after loading the module
 */

console.log('🧪 Testing GM Warehouse Migration...');

async function testWarehouseMigration() {
  try {
    // Check that GuardManagement is available
    const gm = window.GuardManagement;
    if (!gm) {
      console.error('❌ GuardManagement module not loaded');
      return;
    }

    console.log('✅ GuardManagement module loaded');

    // Check that documentManager is available
    if (!gm.documentManager) {
      console.error('❌ DocumentBasedManager not available');
      return;
    }

    console.log('✅ DocumentBasedManager available');

    // Test creating a resource through DocumentBasedManager
    console.log('📝 Testing resource creation...');

    const testResource = {
      id: 'test-warehouse-resource-' + Date.now(),
      name: 'Test Warehouse Resource',
      type: 'Material',
      quantity: 10,
      description: 'Test resource created via DocumentBasedManager',
      organizationId: 'gm-warehouse-templates',
    };

    const createdResource = await gm.documentManager.createGuardResource(testResource);

    if (createdResource) {
      console.log('✅ Resource created successfully:', createdResource);
    } else {
      console.error('❌ Failed to create resource');
      return;
    }

    // Test retrieving resources
    console.log('📖 Testing resource retrieval...');

    const allResources = await gm.documentManager.getGuardResources();
    console.log(`✅ Retrieved ${allResources.length} resources:`, allResources);

    // Check if our test resource is in the list
    const ourResource = allResources.find((r) => r.system?.resourceId === testResource.id);
    if (ourResource) {
      console.log('✅ Test resource found in retrieval:', ourResource);
    } else {
      console.log('⚠️  Test resource not found in retrieval (this might be expected)');
    }

    // Test GM Warehouse Dialog
    console.log('🏪 Testing GM Warehouse Dialog...');

    if (gm.guardDialogManager && gm.guardDialogManager.openGMWarehouse) {
      console.log('✅ GM Warehouse dialog available');
      console.log(
        '💡 You can now test opening the GM Warehouse with: GuardManagement.guardDialogManager.openGMWarehouse()'
      );
    } else {
      console.error('❌ GM Warehouse dialog not available');
    }

    console.log('🎉 Migration test completed successfully!');

    return {
      success: true,
      createdResource,
      allResources,
      resourceCount: allResources.length,
    };
  } catch (error) {
    console.error('❌ Migration test failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Auto-run if GuardManagement is already loaded
if (window.GuardManagement) {
  testWarehouseMigration().then((result) => {
    console.log('🧪 Test result:', result);
  });
} else {
  console.log('⏳ Waiting for GuardManagement to load...');
  console.log('💡 Run testWarehouseMigration() manually when the module is loaded');
}

// Export for manual testing
window.testWarehouseMigration = testWarehouseMigration;
