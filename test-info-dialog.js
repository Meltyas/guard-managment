// Test manual para el flujo de información → edición
// Este archivo es solo para testing, se puede eliminar después

console.log('Testing Guard Management Dialog Flow...');

// Simular el clic en "Ver Organización"
if (window.GuardManagement?.guardDialogManager) {
  console.log('GuardDialogManager available');

  // Simular que se ha hecho clic en el botón
  window.GuardManagement.guardDialogManager.handleAction('manage-organizations');
} else {
  console.log('GuardManagement not yet available. Wait for module initialization.');

  // Listener para cuando el módulo esté listo
  Hooks.once('ready', () => {
    setTimeout(() => {
      if (window.GuardManagement?.guardDialogManager) {
        console.log('Testing dialog after ready...');
        window.GuardManagement.guardDialogManager.handleAction('manage-organizations');
      }
    }, 1000);
  });
}
