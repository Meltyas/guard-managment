/**
 * Test script for custom dialog focus system
 * Run this in the Foundry VTT console to test focus management
 */

console.log('=== Testing Custom Dialog Focus System ===');

// Test 1: Open GM Warehouse Dialog
console.log('1. Opening GM Warehouse Dialog...');
const warehouse = GMWarehouseDialog.show();
console.log('   - GM Warehouse opened, should have focus (z-index: 80)');
console.log('   - Class should be: gm-warehouse-dialog focused');

// Test 2: Open Guard Info Dialog
setTimeout(() => {
  console.log('2. Opening Guard Info Dialog...');
  const guard = new CustomInfoDialog();
  guard.show('Test Guard', '<p>This is a test guard info dialog</p>', {
    onClose: () => console.log('   - Guard Info Dialog closed'),
  });
  console.log('   - Guard Info opened, should have focus (z-index: 80)');
  console.log('   - Class should be: custom-info-dialog focused');
  console.log('   - GM Warehouse should lose focus (z-index: 51)');
  console.log('   - GM Warehouse class should be: gm-warehouse-dialog (no focused)');

  // Test 3: Click on warehouse to give it focus back
  setTimeout(() => {
    console.log('3. Now click on the GM Warehouse dialog header to give it focus...');
    console.log('   - GM Warehouse should regain focus (z-index: 80)');
    console.log('   - GM Warehouse class should be: gm-warehouse-dialog focused');
    console.log('   - Guard Info should lose focus (z-index: 51)');
    console.log('   - Guard Info class should be: custom-info-dialog (no focused)');

    // Test 4: Verify CSS classes
    setTimeout(() => {
      console.log('4. Checking current dialog states...');
      const warehouseEl = document.querySelector('.gm-warehouse-dialog');
      const guardEl = document.querySelector('.custom-info-dialog');

      if (warehouseEl) {
        const warehouseFocused = warehouseEl.classList.contains('focused');
        const warehouseZIndex = window.getComputedStyle(warehouseEl).zIndex;
        console.log(
          `   - Warehouse: focused=${warehouseFocused}, z-index=${warehouseZIndex}, classes=${warehouseEl.className}`
        );
      }

      if (guardEl) {
        const guardFocused = guardEl.classList.contains('focused');
        const guardZIndex = window.getComputedStyle(guardEl).zIndex;
        console.log(
          `   - Guard Info: focused=${guardFocused}, z-index=${guardZIndex}, classes=${guardEl.className}`
        );
      }
    }, 500);
  }, 2000);
}, 1000);

console.log('');
console.log('Expected behavior:');
console.log('- Only one dialog should have the "focused" class at a time');
console.log('- .custom-info-dialog.focused should have z-index: 80');
console.log('- .gm-warehouse-dialog.focused should have z-index: 80');
console.log('- Non-focused dialogs should have z-index: 51');
console.log('- Clicking on a dialog should give it focus');
console.log('- Opening a new dialog should take focus from the current one');
console.log('');
console.log('Check the Elements inspector to see the "focused" class and z-index values!');
