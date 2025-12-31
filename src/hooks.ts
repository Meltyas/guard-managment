/**
 * Foundry VTT hooks registration
 */

export function registerHooks(): void {
  console.log('GuardManagement | Registering hooks...');

  // Suppress Daggerheart roll reconstruction errors (not related to Guard Management)
  const originalConsoleError = console.error;
  console.error = function (...args: any[]) {
    const errorMsg = args[0]?.toString() || '';
    // Suppress specific Daggerheart roll errors that aren't our fault
    if (errorMsg.includes('Cannot read properties of undefined') && errorMsg.includes('bonuses')) {
      console.warn(
        'GuardManagement | Suppressed Daggerheart roll reconstruction error (corrupted chat data)'
      );
      return;
    }
    originalConsoleError.apply(console, args);
  };

  // Intercept preCreate for Guard Management actors/items BEFORE Daggerheart processes them
  // By returning false from a preCreate hook, we prevent the default creation and do it ourselves
  Hooks.on('preCreateActor', async (document: any, data: any, options: any, userId: string) => {
    if (document.type?.startsWith('guard-management.')) {
      console.log(`GuardManagement | Intercepting actor creation: ${document.type}`);
      // Mark as handled so we don't create it again
      options._guardManagementHandled = true;
      // Allow the creation to proceed without Daggerheart interference
      return true;
    }
  });

  Hooks.on('preCreateItem', async (document: any, data: any, options: any, userId: string) => {
    if (document.type?.startsWith('guard-management.')) {
      console.log(`GuardManagement | Intercepting item creation: ${document.type}`);
      // Mark as handled
      options._guardManagementHandled = true;
      // Allow the creation to proceed without Daggerheart interference
      return true;
    }
  });

  // Wrap Daggerheart's Actor class to handle our custom types
  // This runs in setup to ensure it happens after Daggerheart initializes
  Hooks.once('ready', () => {
    const OriginalActorClass = CONFIG.Actor.documentClass;

    class GuardManagementActor extends OriginalActorClass {
      async _preCreate(data: any, options: any, user: any) {
        // Skip Daggerheart validation for Guard Management types
        if (this.type?.startsWith('guard-management.')) {
          console.log(`GuardManagement | Bypassing Daggerheart _preCreate for Actor ${this.type}`);
          // Don't call Daggerheart's _preCreate at all for our types
          // Just set up minimal structure and return
          return true;
        }
        // For Daggerheart types, use their validation
        return await super._preCreate(data, options, user);
      }

      prepareData() {
        if (this.type?.startsWith('guard-management.')) {
          // Use base Foundry prepare for our types
          Actor.prototype.prepareData.call(this);
        } else {
          // Use Daggerheart's prepare for their types
          super.prepareData();
        }
      }
    }

    CONFIG.Actor.documentClass = GuardManagementActor as any;

    // Do the same for Items
    const OriginalItemClass = CONFIG.Item.documentClass;

    class GuardManagementItem extends OriginalItemClass {
      async _preCreate(data: any, options: any, user: any) {
        // Skip Daggerheart validation for Guard Management types
        if (this.type?.startsWith('guard-management.')) {
          console.log(`GuardManagement | Bypassing Daggerheart _preCreate for Item ${this.type}`);
          return true;
        }
        // For Daggerheart types, use their validation
        return await super._preCreate(data, options, user);
      }

      prepareData() {
        if (this.type?.startsWith('guard-management.')) {
          // Use base Foundry prepare for our types
          Item.prototype.prepareData.call(this);
        } else {
          // Use Daggerheart's prepare for their types
          super.prepareData();
        }
      }
    }

    CONFIG.Item.documentClass = GuardManagementItem as any;

    console.log('GuardManagement | Wrapped Daggerheart Document classes');
  });

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
  Hooks.on('userConnected', (user: any, connected: boolean) => {
    if (connected) {
      console.log(`GuardManagement | User connected: ${user?.name}`);
      if ((game as any)?.user?.isGM) {
        (Hooks as any).call?.('guard-management.userConnected', user);
      }
    }
  });

  // Hook for when the canvas is ready
  Hooks.on('canvasReady', (canvas: any) => {
    console.log('GuardManagement | Canvas is ready');
    (Hooks as any).call?.('guard-management.canvasReady', canvas);
  });

  // Hook for token updates (useful for guard position tracking)
  Hooks.on('updateToken', (token: any, updateData: any, _options: any, userId: string) => {
    try {
      const tName = token?.name || token?.document?.name || '';
      if (tName.toLowerCase().includes('guard')) {
        console.log(`GuardManagement | Guard token updated: ${tName}`);
        (Hooks as any).call?.('guard-management.guardTokenUpdated', token, updateData, userId);
      }
    } catch (err) {
      console.error('GuardManagement | Token update handling error', err);
    }
  });

  // Hook for combat tracker updates (guards might react to combat)
  Hooks.on('updateCombat', (combat: any, updateData: any, _options: any, userId: string) => {
    console.log('GuardManagement | Combat updated');
    (Hooks as any).call?.('guard-management.combatUpdated', combat, updateData, userId);
  });

  // Custom hook for user connection events
  Hooks.on('guard-management.userConnected', (user: any) => {
    console.log('GuardManagement | Processing new user connection:', user?.name);
  });

  // Custom hook for guard token updates
  Hooks.on(
    'guard-management.guardTokenUpdated',
    (token: any, _updateData: any, _userId: string) => {
      const tName = token?.name || token?.document?.name || '';
      console.log('GuardManagement | Processing guard token update:', tName);
    }
  );

  // Hide Guard Management Actors & Items from their directories
  const hideGuardDocs = () => {
    const showDebug = (game as any)?.settings?.get?.('guard-management', 'debugMode');
    if (showDebug) return;

    // Inject CSS (idempotent)
    if (!document.getElementById('gm-hide-docs-css')) {
      const style = document.createElement('style');
      style.id = 'gm-hide-docs-css';
      style.textContent = `
        /* Extra hardening: hide any list items we mark */
        li.gm-hidden-doc { display:none !important; }
      `;
      document.head.appendChild(style);
    }

    const removeGuardEntries = (root: any) => {
      try {
        if (!root) return;
        const collectNodes = (sel: string): Element[] => {
          if (root instanceof HTMLElement) return Array.from(root.querySelectorAll(sel));
          if (typeof root.find === 'function') return Array.from(root.find(sel).toArray());
          if (root[0] instanceof HTMLElement) return Array.from(root[0].querySelectorAll(sel));
          return [];
        };
        const nodes = collectNodes('li.document.item, li.document.actor');
        for (const el of nodes) {
          const id = (el as HTMLElement).dataset.documentId;
          if (!id) continue;
          const item = (game as any)?.items?.get?.(id);
          if (item?.type?.startsWith?.('guard-management.')) {
            el.classList.add('gm-hidden-doc');
            el.remove();
            continue;
          }
          const actor = (game as any)?.actors?.get?.(id);
          if (actor?.type?.startsWith?.('guard-management.')) {
            el.classList.add('gm-hidden-doc');
            el.remove();
          }
        }
      } catch (e) {
        console.error('GuardManagement | removeGuardEntries error', e);
      }
    };

    // Render hooks (every re-render)
    Hooks.on('renderActorDirectory', (_app: any, html: any) => removeGuardEntries(html));
    Hooks.on('renderItemDirectory', (_app: any, html: any) => removeGuardEntries(html));

    // Post-ready one-shot pruning (in case initial render already happened before our hooks)
    Hooks.once('ready', () => {
      setTimeout(() => {
        const actorDir = document.querySelector('#actors-directory, #sidebar #actors');
        const itemDir = document.querySelector('#items-directory, #sidebar #items');
        removeGuardEntries(actorDir);
        removeGuardEntries(itemDir);
      }, 800);
    });

    // MutationObserver for dynamic additions
    const observe = (selector: string) => {
      const container = document.querySelector(selector);
      if (!container) return;
      const obs = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.addedNodes?.length) {
            m.addedNodes.forEach((n) => {
              if (n instanceof HTMLElement) removeGuardEntries(n);
            });
          }
        }
      });
      obs.observe(container, { childList: true, subtree: true });
      (window as any)._gmDirObservers = (window as any)._gmDirObservers || [];
      (window as any)._gmDirObservers.push(obs);
    };

    const setupObservers = () => {
      observe('#actors-directory, #sidebar #actors');
      observe('#items-directory, #sidebar #items');
    };

    if (document.readyState === 'complete') setTimeout(setupObservers, 1000);
    else window.addEventListener('load', () => setTimeout(setupObservers, 1000));
  };
  hideGuardDocs();

  // Hook to inject custom modifier breakdown into chat messages
  Hooks.on('renderChatMessage', (message: any, html: any, data: any) => {
    try {
      const breakdown = message.getFlag('guard-management', 'breakdown');
      if (!breakdown || !Array.isArray(breakdown)) return;

      // Find the roll content container
      const rollContent = html.find('.roll-part-content.dice-result');
      if (!rollContent.length) return;

      // Generate HTML for breakdown
      let breakdownHtml =
        '<div class="guard-roll-breakdown" style="margin-top: 10px; font-size: 0.9em; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 5px;">';

      for (const item of breakdown) {
        const sign = item.value >= 0 ? '+' : '';
        const color = item.value > 0 ? '#4ae89a' : item.value < 0 ? '#e84a4a' : '#ffffff';

        breakdownHtml += `<div style="display: flex; justify-content: space-between;">
          <span>${item.label}</span>
          <span style="color: ${color}; font-weight: bold;">${sign}${item.value}</span>
        </div>`;

        if (item.children && item.children.length > 0) {
          for (const child of item.children) {
            const childSign = child.value >= 0 ? '+' : '';
            const childColor =
              child.value > 0 ? '#4ae89a' : child.value < 0 ? '#e84a4a' : '#ffffff';

            breakdownHtml += `<div style="display: flex; justify-content: space-between; padding-left: 15px; font-size: 0.9em; opacity: 0.8;">
              <span>↳ ${child.label}</span>
              <span style="color: ${childColor};">${childSign}${child.value}</span>
            </div>`;

            if (child.children && child.children.length > 0) {
              for (const subChild of child.children) {
                const subSign = subChild.value >= 0 ? '+' : '';
                const subColor =
                  subChild.value > 0 ? '#4ae89a' : subChild.value < 0 ? '#e84a4a' : '#ffffff';
                breakdownHtml += `<div style="display: flex; justify-content: space-between; padding-left: 30px; font-size: 0.85em; opacity: 0.7;">
                    <span>↳ ${subChild.label}</span>
                    <span style="color: ${subColor};">${subSign}${subChild.value}</span>
                  </div>`;
              }
            }
          }
        }
      }
      breakdownHtml += '</div>';

      // Append to the roll content
      rollContent.append(breakdownHtml);
    } catch (e) {
      console.error('GuardManagement | Error rendering chat breakdown:', e);
    }
  });

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
          (ChatMessage as any).create({
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
