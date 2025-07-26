/**
 * Debug script to diagnose GM Warehouse DocumentBasedManager issue
 *
 * Run this in Foundry's console to check module state
 */

console.log('🔍 Diagnosing GM Warehouse DocumentBasedManager Issue...');

function debugModuleState() {
  console.log('=== MODULE STATE DIAGNOSIS ===');

  // Check if GuardManagement is available on window
  const gm = window.GuardManagement;
  console.log('1. window.GuardManagement available:', !!gm);

  if (gm) {
    console.log('2. GuardManagement object keys:', Object.keys(gm));
    console.log('3. documentManager available:', !!gm.documentManager);

    if (gm.documentManager) {
      console.log(
        '4. documentManager methods:',
        Object.getOwnPropertyNames(Object.getPrototypeOf(gm.documentManager))
      );
      console.log(
        '5. documentManager initialized:',
        gm.documentManager.initialized || 'not visible'
      );

      // Test basic methods
      try {
        const orgs = gm.documentManager.getGuardOrganizations();
        console.log('6. getGuardOrganizations() works:', orgs.length, 'organizations found');
      } catch (error) {
        console.error('6. getGuardOrganizations() failed:', error);
      }

      try {
        const resources = gm.documentManager.getGuardResources();
        console.log('7. getGuardResources() works:', resources.length, 'resources found');
      } catch (error) {
        console.error('7. getGuardResources() failed:', error);
      }
    } else {
      console.error('4. documentManager is NOT available');
    }
  } else {
    console.error('2. GuardManagement object is NOT available on window');

    // Check what guard-related objects are on window
    const guardKeys = Object.keys(window).filter((k) => k.toLowerCase().includes('guard'));
    console.log('3. Guard-related keys on window:', guardKeys);
  }

  // Check game state
  console.log('8. game object available:', !!game);
  console.log('9. game.user.isGM:', game?.user?.isGM);
  console.log('10. game.ready:', game?.ready);

  // Check Foundry hooks
  console.log('11. Hooks available:', !!Hooks);

  console.log('=== END DIAGNOSIS ===');
}

// Test creating a resource directly
async function testResourceCreation() {
  console.log('🧪 Testing Resource Creation...');

  const gm = window.GuardManagement;
  if (!gm?.documentManager) {
    console.error('❌ DocumentBasedManager not available');
    return;
  }

  const testResource = {
    id: 'debug-test-resource-' + Date.now(),
    name: 'Debug Test Resource',
    description: 'Test resource created by debug script',
    quantity: 5,
    organizationId: 'gm-warehouse-templates',
  };

  try {
    console.log('📝 Creating resource:', testResource);
    const created = await gm.documentManager.createGuardResource(testResource);
    console.log('✅ Resource created successfully:', created);

    // Get all resources to verify
    const allResources = gm.documentManager.getGuardResources();
    console.log('📋 All resources after creation:', allResources.length, 'total');

    return created;
  } catch (error) {
    console.error('❌ Resource creation failed:', error);
    return null;
  }
}

// Also test opening GM Warehouse
function testGMWarehouse() {
  console.log('🏪 Testing GM Warehouse...');

  const gm = window.GuardManagement;
  if (!gm) {
    console.error('❌ GuardManagement not available');
    return;
  }

  // Try different ways to open the warehouse
  if (gm.guardDialogManager?.openGMWarehouse) {
    try {
      console.log('📋 Method 1: Using guardDialogManager.openGMWarehouse()');
      gm.guardDialogManager.openGMWarehouse();
    } catch (error) {
      console.error('❌ Method 1 failed:', error);
    }
  }

  // Try direct GMWarehouseDialog
  try {
    console.log('📋 Method 2: Using GMWarehouseDialog.show() directly');
    // Access the class if it's available globally
    if (window.GMWarehouseDialog) {
      window.GMWarehouseDialog.show();
    } else {
      console.log('⚠️ GMWarehouseDialog not available globally');
    }
  } catch (error) {
    console.error('❌ Method 2 failed:', error);
  }

  console.log(
    '💡 Available methods on guardDialogManager:',
    gm?.guardDialogManager ? Object.keys(gm.guardDialogManager) : 'guardDialogManager not available'
  );
}

// Run diagnosis immediately
debugModuleState();

// Wait for module and test functionality
function runFullTest() {
  console.log('🚀 Running full test suite...');
  debugModuleState();

  setTimeout(async () => {
    await testResourceCreation();
    testGMWarehouse();
  }, 1000);
}

// Auto-test if module is loaded
if (window.GuardManagement?.documentManager) {
  console.log('✅ Module is fully loaded, running tests in 2 seconds...');
  setTimeout(runFullTest, 2000);
} else {
  console.log('⏳ Module not fully loaded yet. Run runFullTest() manually when loaded.');
}

// Export functions for manual testing
window.debugModuleState = debugModuleState;
window.testGMWarehouse = testGMWarehouse;
window.testResourceCreation = testResourceCreation;
window.runFullTest = runFullTest;
