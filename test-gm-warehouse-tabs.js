// Test script para verificar que los tabs del GM Warehouse funcionen correctamente
// Ejecutar en la consola del navegador cuando Foundry esté activo

console.log('Testing GM Warehouse Tab Functionality...');

// Simulate GM user
if (typeof game !== 'undefined' && game.user) {
  game.user.isGM = true;
  console.log('GM user simulated for testing');
}

// Test the GM Warehouse Dialog
if (typeof window !== 'undefined' && window.GuardManagement) {
  const gm = window.GuardManagement;
  console.log('GuardManagement available, testing GM Warehouse...');

  // Test static show method
  if (gm.GMWarehouseDialog && gm.GMWarehouseDialog.show) {
    console.log('GMWarehouseDialog found, attempting to show...');
    try {
      const dialog = gm.GMWarehouseDialog.show();
      console.log('GM Warehouse dialog created successfully:', dialog);
      console.log('Dialog is open:', dialog.isOpen());

      // Wait a bit then close
      setTimeout(() => {
        console.log('Closing dialog...');
        dialog.close();
        console.log('Dialog closed. Is open:', dialog.isOpen());
      }, 3000);
    } catch (error) {
      console.error('Error showing GM Warehouse dialog:', error);
    }
  } else {
    console.warn('GMWarehouseDialog not found in GuardManagement');
  }
} else {
  console.warn('GuardManagement not available. Make sure the module is loaded.');
}

console.log('GM Warehouse test script completed.');
console.log('If the dialog opened, try clicking between tabs to test switching functionality.');
