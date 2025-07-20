/**
 * Foundry VTT hooks registration
 */

export function registerHooks(): void {
  console.log('GuardManagement | Registering hooks...');

  // Hook for when a user connects
  Hooks.on('userConnected', (user: User, connected: boolean) => {
    if (connected) {
      console.log(`GuardManagement | User connected: ${user.name}`);
      // Trigger a sync to the newly connected user
      if (game.user?.isGM) {
        // GM can send current state to the new user
        Hooks.call('guard-management.userConnected', user);
      }
    }
  });

  // Hook for when the canvas is ready
  Hooks.on('canvasReady', (canvas: Canvas) => {
    console.log('GuardManagement | Canvas is ready');
    // Initialize any canvas-related features
    Hooks.call('guard-management.canvasReady', canvas);
  });

  // Hook for token updates (useful for guard position tracking)
  Hooks.on('updateToken', (token: TokenDocument, updateData: any, options: any, userId: string) => {
    // Check if this token represents a guard
    if (token.name?.toLowerCase().includes('guard')) {
      console.log(`GuardManagement | Guard token updated: ${token.name}`);
      Hooks.call('guard-management.guardTokenUpdated', token, updateData, userId);
    }
  });

  // Hook for combat tracker updates (guards might react to combat)
  Hooks.on('updateCombat', (combat: Combat, updateData: any, options: any, userId: string) => {
    console.log('GuardManagement | Combat updated');
    Hooks.call('guard-management.combatUpdated', combat, updateData, userId);
  });

  // Custom hook for testing sync scenarios
  Hooks.on('guard-management.testSync', (data: any) => {
    console.log('GuardManagement | Test sync triggered:', data);
  });

  // Custom hook for when sync data is applied
  Hooks.on('guard-management.syncDataApplied', (syncData: any) => {
    console.log('GuardManagement | Sync data applied:', syncData);
  });

  // Custom hook for user connection events
  Hooks.on('guard-management.userConnected', (user: User) => {
    console.log('GuardManagement | Processing new user connection:', user.name);
  });

  // Custom hook for canvas ready events
  Hooks.on('guard-management.canvasReady', (canvas: Canvas) => {
    console.log('GuardManagement | Processing canvas ready');
  });

  // Custom hook for guard token updates
  Hooks.on('guard-management.guardTokenUpdated', (token: TokenDocument, updateData: any, userId: string) => {
    console.log('GuardManagement | Processing guard token update:', token.name);
  });

  // Custom hook for combat updates
  Hooks.on('guard-management.combatUpdated', (combat: Combat, updateData: any, userId: string) => {
    console.log('GuardManagement | Processing combat update');
  });

  console.log('GuardManagement | Hooks registered successfully');
}
