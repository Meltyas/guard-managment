/**
 * Foundry VTT hooks registration
 */

export function registerHooks(): void {
  console.log('GuardManagement | Registering hooks...');

  // Hook for when the game is ready - register macro and keybindings
  Hooks.once('ready', () => {
    console.log('GuardManagement | Game ready, setting up Guard Management');

    // Register global access
    const guardManagement = (window as any).guardManagementInstance;
    (window as any).GuardManagement = guardManagement;

    // Setup socket listener for organization sync
    if (game?.socket && guardManagement?.guardOrganizationManager) {
      game.socket.on('module.guard-management', async (data: any) => {
        await guardManagement.guardOrganizationManager.handleSocketMessage(data);
      });
      console.log('GuardManagement | Socket listener registered for organization sync');
    }

    // Register keybindings
    if (guardManagement) {
      registerKeybindings(guardManagement);
    }

    // Create chat command
    registerChatCommands(guardManagement);
  });

  // Hook for when a user connects
  Hooks.on('userConnected', (user: User, connected: boolean) => {
    if (connected) {
      console.log(`GuardManagement | User connected: ${user.name}`);
      // Trigger a sync to the newly connected user
      if (game?.user?.isGM) {
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
  Hooks.on(
    'updateToken',
    (token: TokenDocument, updateData: any, _options: any, userId: string) => {
      // Check if this token represents a guard
      if (token.name?.toLowerCase().includes('guard')) {
        console.log(`GuardManagement | Guard token updated: ${token.name}`);
        Hooks.call('guard-management.guardTokenUpdated', token, updateData, userId);
      }
    }
  );

  // Hook for combat tracker updates (guards might react to combat)
  Hooks.on('updateCombat', (combat: Combat, updateData: any, _options: any, userId: string) => {
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
  Hooks.on('guard-management.canvasReady', (_canvas: Canvas) => {
    console.log('GuardManagement | Processing canvas ready');
  });

  // Custom hook for guard token updates
  Hooks.on(
    'guard-management.guardTokenUpdated',
    (token: TokenDocument, _updateData: any, _userId: string) => {
      console.log('GuardManagement | Processing guard token update:', token.name);
    }
  );

  // Custom hook for combat updates
  Hooks.on(
    'guard-management.combatUpdated',
    (_combat: Combat, _updateData: any, _userId: string) => {
      console.log('GuardManagement | Processing combat update');
    }
  );

  console.log('GuardManagement | Hooks registered successfully');
}

/**
 * Register keybindings for Guard Management
 */
function registerKeybindings(guardManagement: any): void {
  // Register keybinding to toggle floating panel
  game?.keybindings?.register('guard-management', 'togglePanel', {
    name: 'Alternar Panel de Guardias',
    hint: 'Muestra u oculta el panel flotante de gestión de guardias',
    editable: [
      {
        key: 'KeyG',
        modifiers: ['Control', 'Shift'],
      },
    ],
    onDown: () => {
      guardManagement?.toggleFloatingPanel();
    },
    restricted: false,
  });

  // Register keybinding to create new organization
  game?.keybindings?.register('guard-management', 'createOrganization', {
    name: 'Nueva Organización de Guardias',
    hint: 'Abre el diálogo para crear una nueva organización de guardias',
    editable: [
      {
        key: 'KeyN',
        modifiers: ['Control', 'Shift'],
      },
    ],
    onDown: () => {
      guardManagement?.showCreateOrganizationDialog();
    },
    restricted: false,
  });

  console.log(
    'GuardManagement | Keybindings registered (Ctrl+Shift+G to toggle panel, Ctrl+Shift+N for new org)'
  );
}

/**
 * Register chat commands for Guard Management
 */
function registerChatCommands(guardManagement: any): void {
  // Listen for chat messages to handle commands
  Hooks.on('chatMessage', (_chatLog: any, message: string, _chatData: any) => {
    // Handle /guard command
    if (message.startsWith('/guard') || message.startsWith('/guardia')) {
      const args = message.split(' ').slice(1);

      switch (args[0]?.toLowerCase()) {
        case 'panel':
        case 'toggle':
          guardManagement?.toggleFloatingPanel();
          break;
        case 'new':
        case 'nuevo':
        case 'create':
        case 'crear':
          guardManagement?.showCreateOrganizationDialog();
          break;
        case 'manage':
        case 'gestionar':
        case 'list':
        case 'lista':
          guardManagement?.showManageOrganizationsDialog();
          break;
        case 'help':
        case 'ayuda':
          ChatMessage.create({
            content: `
              <h3>Comandos de Gestión de Guardias</h3>
              <ul>
                <li><code>/guard panel</code> - Alternar panel flotante</li>
                <li><code>/guard new</code> - Nueva organización</li>
                <li><code>/guard manage</code> - Gestionar organizaciones</li>
                <li><code>/guard help</code> - Mostrar esta ayuda</li>
              </ul>
              <p><strong>Atajos de teclado:</strong></p>
              <ul>
                <li><kbd>Ctrl+Shift+G</kbd> - Alternar panel</li>
                <li><kbd>Ctrl+Shift+N</kbd> - Nueva organización</li>
              </ul>
            `,
            whisper: [game?.user?.id],
          });
          break;
        default:
          guardManagement?.toggleFloatingPanel();
          break;
      }

      return false; // Prevent message from being sent to chat
    }

    return true; // Allow other messages to proceed
  });

  console.log('GuardManagement | Chat commands registered (/guard, /guardia)');
}
