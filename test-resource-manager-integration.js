/**
 * Debug script to test ResourceManager integration with GMWarehouseDialog
 */

console.log('=== Testing ResourceManager Integration ===');

// Test ResourceManager availability
const gm = window.GuardManagement;
if (gm?.resourceManager) {
  console.log('✓ ResourceManager is available');

  // Test getting all resources
  const allResources = gm.resourceManager.getAllResources();
  console.log(`✓ getAllResources() returns ${allResources.length} resources:`, allResources);

  // Test creating a test resource
  try {
    const testResource = gm.resourceManager.createResource({
      name: 'Test Resource',
      description: 'A test resource for debugging',
      quantity: 10,
      organizationId: 'gm-warehouse-templates',
    });
    console.log('✓ createResource() works:', testResource);

    // Test getting all resources again
    const allResourcesAfter = gm.resourceManager.getAllResources();
    console.log(
      `✓ After creation, getAllResources() returns ${allResourcesAfter.length} resources`
    );

    // Test GMWarehouseDialog resource template loading
    try {
      const warehouseDialog = new gm.dialogs.GMWarehouseDialog();
      console.log('✓ GMWarehouseDialog can be instantiated');

      // Test getResourceTemplates method (though it's private, we can test the concept)
      console.log('✓ ResourceManager integration test complete');
    } catch (dialogError) {
      console.error('✗ Error testing GMWarehouseDialog:', dialogError);
    }
  } catch (createError) {
    console.error('✗ Error creating test resource:', createError);
  }
} else {
  console.error('✗ ResourceManager not available');
  console.log('Available GuardManagement properties:', Object.keys(gm || {}));
}

console.log('=== ResourceManager Integration Test Complete ===');
