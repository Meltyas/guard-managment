/**
 * Test Script: Real-Time Synchronization
 *
 * This script tests the new real-time synchronization system
 * Run this in Foundry's console to test sync functionality
 */

async function testRealTimeSync() {
  console.log('🧪 Testing Real-Time Synchronization...');

  const gm = window.GuardManagement;
  if (!gm || !gm.isInitialized) {
    console.error('❌ Guard Management module not initialized');
    return;
  }

  // Test 1: Create a new resource and verify events are emitted
  console.log('\n📝 Test 1: Creating a new resource...');

  try {
    const newResource = await gm.documentManager.createGuardResource({
      name: 'Test Sync Resource',
      description: 'A resource to test real-time sync',
      quantity: 50,
      organizationId: 'test-org-sync',
    });

    console.log('✅ Resource created:', newResource.name);
    console.log('📡 Check console for "guard-resource-created" and "guard-ui-refresh" events');

    // Wait a moment for events to propagate
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Test 2: Update the resource
    console.log('\n📝 Test 2: Updating the resource...');

    const success = await gm.documentManager.updateGuardResource(newResource.id, {
      name: 'Updated Sync Resource',
      quantity: 75,
      description: 'Updated description for sync testing',
    });

    if (success) {
      console.log('✅ Resource updated successfully');
      console.log('📡 Check console for "guard-resource-updated" and "guard-ui-refresh" events');
    } else {
      console.log('❌ Resource update failed');
    }

    // Wait a moment for events to propagate
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Test 3: Delete the resource
    console.log('\n📝 Test 3: Deleting the resource...');

    const deleted = await gm.documentManager.deleteGuardResource(newResource.id);

    if (deleted) {
      console.log('✅ Resource deleted successfully');
      console.log('📡 Check console for "guard-resource-deleted" and "guard-ui-refresh" events');
    } else {
      console.log('❌ Resource deletion failed');
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  // Test 4: Check event listener setup
  console.log('\n📝 Test 4: Checking DocumentEventManager...');

  if (gm.documentEventManager && gm.documentEventManager.initialized) {
    console.log('✅ DocumentEventManager is initialized');
  } else {
    console.log('❌ DocumentEventManager not properly initialized');
  }

  console.log('\n🎯 Real-time sync test completed!');
  console.log('💡 To test UI updates:');
  console.log('   1. Open GM Warehouse Dialog');
  console.log('   2. Create/edit/delete resources from another client');
  console.log('   3. Check if the UI updates automatically without F5');
}

// Manual trigger function
window.testSync = testRealTimeSync;

console.log('🚀 Real-time sync test loaded!');
console.log('📖 Run: window.testSync() to start testing');
console.log('🔍 Or run: testRealTimeSync() directly');
