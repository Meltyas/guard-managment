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
  (Hooks as any).on(
    'preCreateActor',
    async (document: any, _data: any, options: any, _userId: string) => {
      if (document.type?.startsWith('guard-management.')) {
        console.log(`GuardManagement | Intercepting actor creation: ${document.type}`);
        // Mark as handled so we don't create it again
        options._guardManagementHandled = true;
        // Allow the creation to proceed without Daggerheart interference
        return true;
      }
    }
  );

  (Hooks as any).on(
    'preCreateItem',
    async (document: any, _data: any, options: any, _userId: string) => {
      if (document.type?.startsWith('guard-management.')) {
        console.log(`GuardManagement | Intercepting item creation: ${document.type}`);
        // Mark as handled
        options._guardManagementHandled = true;
        // Allow the creation to proceed without Daggerheart interference
        return true;
      }
    }
  );

  // Patch ChatMessage.getRollData to return {} for Guard Management messages.
  // Foundry V13's speakerActor getter falls back to this.author?.character even when
  // speaker fields are null, which causes DhpActor.getRollData to crash for some
  // Daggerheart actor system types that don't implement getRollData.
  Hooks.once('ready', () => {
    try {
      const ChatMessageImpl =
        (ChatMessage as any).implementation ||
        (CONFIG as any)?.ChatMessage?.documentClass ||
        ChatMessage;
      const originalGetRollData = ChatMessageImpl.prototype.getRollData;
      if (typeof originalGetRollData === 'function') {
        ChatMessageImpl.prototype.getRollData = function (this: any) {
          if (this.flags?.['guard-management']) return {};
          try {
            return originalGetRollData.call(this);
          } catch (e) {
            // Gracefully handle deleted actors or Daggerheart system types
            // that don't implement getRollData (e.g. after actor deletion)
            return {};
          }
        };
        console.log(
          'GuardManagement | Patched ChatMessage.getRollData to skip actor resolution for module messages'
        );
      }
    } catch (e) {
      console.warn('GuardManagement | Could not patch ChatMessage.getRollData:', e);
    }
  });

  // Patch Actor.items getter to filter out Guard Management items when accessed by Daggerheart
  // This prevents Daggerheart from trying to process our custom item types
  // Execute this twice with a delay to handle race conditions with Daggerheart initialization
  const patchActorItemsGetter = () => {
    try {
      const OriginalActorClass = CONFIG.Actor.documentClass;
      const originalItemsGetter = Object.getOwnPropertyDescriptor(OriginalActorClass.prototype, 'items');

      if (originalItemsGetter?.get) {
        const originalGet = originalItemsGetter.get;
        Object.defineProperty(OriginalActorClass.prototype, 'items', {
          get(this: any) {
            const items = originalGet.call(this);
            // Filter out Guard Management items from the collection to prevent Daggerheart processing
            // Return a new Collection (not Array) so .get() and other Collection methods still work
            if (items && typeof items.filter === 'function') {
              const filtered = new (foundry as any).utils.Collection() as any;
              for (const item of items) {
                if (!item?.type?.startsWith('guard-management.')) {
                  filtered.set(item.id, item);
                }
              }
              return filtered;
            }
            return items;
          },
          configurable: true,
          enumerable: true,
        });
        console.log('GuardManagement | Patched Actor.items getter to filter Guard Management items');
      }
    } catch (e) {
      console.warn('GuardManagement | Could not patch Actor.items getter:', e);
    }
  };

  Hooks.once('ready', () => {
    patchActorItemsGetter();

    // Patch again after a delay to handle race conditions
    setTimeout(patchActorItemsGetter, 500);
  });

  // Also clean up any legacy Guard Management items from actors
  Hooks.once('ready', async () => {
    try {
      const itemsToDelete: any[] = [];

      // Search all actors for Guard Management items
      for (const actor of game?.actors || []) {
        for (const item of actor?.items || []) {
          if (item?.type?.startsWith('guard-management.')) {
            itemsToDelete.push({ actorId: actor.id, itemId: item.id, itemName: item.name });
          }
        }
      }

      if (itemsToDelete.length > 0) {
        console.warn(
          `GuardManagement | Found ${itemsToDelete.length} legacy Guard Management items in actors. Removing...`,
          itemsToDelete
        );

        // Delete them
        for (const { actorId, itemId } of itemsToDelete) {
          const actor = game?.actors?.get(actorId);
          if (actor) {
            try {
              await actor.deleteEmbeddedDocuments('Item', [itemId]);
              console.log(`GuardManagement | Deleted legacy item ${itemId} from actor ${actorId}`);
            } catch (e) {
              console.error(`GuardManagement | Error deleting item ${itemId}:`, e);
            }
          }
        }

        if (ui?.notifications) {
          ui.notifications.notify(
            `Guard Management: Limpiados ${itemsToDelete.length} items legacy del sistema.`
          );
        }
      }
    } catch (e) {
      console.warn('GuardManagement | Error during legacy item cleanup:', e);
    }
  });

  // Register keybindings during init (Foundry requires this before ready)
  registerKeybindings();

  // Hook for when the game is ready - register macro and keybindings
  Hooks.once('ready', () => {
    console.log('GuardManagement | Game ready, setting up Guard Management');

    // Add body class for GM/player CSS scoping
    if (game?.user?.isGM) {
      document.body.classList.add('guard-is-gm');
    }

    const guardManagement = (window as any).GuardManagement;

    // Setup socket listener for organization sync
    if (game?.socket && guardManagement?.guardOrganizationManager) {
      game.socket.on('module.guard-management', async (data: any) => {
        await guardManagement.guardOrganizationManager.handleSocketMessage(data);
      });
      console.log('GuardManagement | Socket listener registered for organization sync');
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

  // When an actor is deleted, clean up any patrol references to it
  Hooks.on('deleteActor', async (actor: any) => {
    try {
      const gm = (window as any).GuardManagement;
      if (!gm) return;

      const deletedActorId: string = actor.id;
      const orgMgr = gm?.guardOrganizationManager;
      const pMgr = orgMgr?.getPatrolManager?.();
      if (!pMgr) return;

      for (const patrol of pMgr.list() as any[]) {
        const updates: Record<string, any> = {};

        // Clear officer slot if it references the deleted actor
        if (patrol.officer?.actorId === deletedActorId) {
          updates.officer = null;
        }

        // Remove soldiers that reference the deleted actor
        const before = (patrol.soldiers as any[]).length;
        const filteredSoldiers = (patrol.soldiers as any[]).filter(
          (s: any) => s.actorId !== deletedActorId
        );
        if (filteredSoldiers.length !== before) {
          updates.soldiers = filteredSoldiers;
        }

        if (Object.keys(updates).length > 0) {
          await pMgr.updatePatrol(patrol.id, updates);
          console.log(
            `GuardManagement | Cleaned patrol "${patrol.name}" after actor deletion (${deletedActorId})`
          );
        }
      }
    } catch (e) {
      console.warn('GuardManagement | Error cleaning up after actor deletion:', e);
    }
  });

  // Hook for combat tracker updates (guards might react to combat)
  Hooks.on('updateCombat', (combat: any, updateData: any, _options: any, userId: string) => {
    console.log('GuardManagement | Combat updated');
    (Hooks as any).call?.('guard-management.combatUpdated', combat, updateData, userId);
  });

  // Custom hook for user connection events
  (Hooks as any).on('guard-management.userConnected', (user: any) => {
    console.log('GuardManagement | Processing new user connection:', user?.name);
  });

  // Custom hook for guard token updates
  (Hooks as any).on(
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
  Hooks.on('renderChatMessageHTML', (message: any, html: HTMLElement, _data: any) => {
    try {
      const breakdown = message.getFlag('guard-management', 'breakdown');
      if (!breakdown || !Array.isArray(breakdown)) return;

      // Find the roll content container
      const rollContent = html.querySelector('.roll-part-content.dice-result');
      if (!rollContent) return;

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
      rollContent.insertAdjacentHTML('beforeend', breakdownHtml);
    } catch (e) {
      console.error('GuardManagement | Error rendering chat breakdown:', e);
    }
  });

  // ---- F5 Session Persistence ----
  const SESSION_KEY = 'guard-management.session';

  /** Collect which dialogs are open and their positions, save to localStorage */
  function saveSessionState() {
    try {
      const gm = (window as any).GuardManagement;
      if (!gm) return;
      const session: Record<string, any> = {};

      // Organization info dialog
      const infoDialog = gm.guardDialogManager?.customInfoDialog;
      if (infoDialog?.isOpen?.() && infoDialog.element) {
        const r = infoDialog.element.getBoundingClientRect();
        session.orgDialog = { open: true, x: r.left, y: r.top, width: r.width, height: r.height };
      }

      // Officer warehouse
      const OWH = gm.OfficerWarehouseDialog ?? (window as any).GuardManagement?.OfficerWarehouseDialog;
      const offInst = OWH?.instance;
      if (offInst?.isOpen?.() && offInst.element) {
        const r = offInst.element.getBoundingClientRect();
        session.officerWarehouse = { open: true, x: r.left, y: r.top };
      }

      // GM warehouse
      const GMWH = gm.GMWarehouseDialog ?? (window as any).GuardManagement?.GMWarehouseDialog;
      const gmInst = GMWH?.instance;
      if (gmInst?.isOpen?.() && gmInst.element) {
        const r = gmInst.element.getBoundingClientRect();
        session.gmWarehouse = { open: true, x: r.left, y: r.top, width: r.width, height: r.height };
      }

      if (Object.keys(session).length > 0) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch (e) {
      console.warn('GuardManagement | Error saving session state:', e);
    }
  }

  /** Restore open dialogs from saved session state */
  async function restoreSessionState() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      localStorage.removeItem(SESSION_KEY);
      const session = JSON.parse(raw);

      const gm = (window as any).GuardManagement;
      if (!gm?.isInitialized) return;

      if (session.orgDialog?.open) {
        await gm.guardDialogManager?.showManageOrganizationsDialog({
          x: session.orgDialog.x,
          y: session.orgDialog.y,
          width: session.orgDialog.width,
          height: session.orgDialog.height,
        });
      }

      if (session.officerWarehouse?.open) {
        const OWH = gm.OfficerWarehouseDialog;
        if (OWH) {
          await OWH.show({ x: session.officerWarehouse.x, y: session.officerWarehouse.y });
        }
      }

      if (session.gmWarehouse?.open) {
        const GMWH = gm.GMWarehouseDialog;
        if (GMWH) {
          await GMWH.show({
            x: session.gmWarehouse.x,
            y: session.gmWarehouse.y,
            width: session.gmWarehouse.width,
            height: session.gmWarehouse.height,
          });
        }
      }
    } catch (e) {
      console.warn('GuardManagement | Error restoring session state:', e);
    }
  }

  Hooks.once('ready', () => {
    // Register beforeunload to save open dialogs
    window.addEventListener('beforeunload', saveSessionState);
    // Restore after a brief delay to let the module finish initializing
    setTimeout(() => restoreSessionState(), 800);
  });

  console.log('GuardManagement | Hooks registered successfully');
}

/**
 * Register keybindings for Guard Management
 */
function registerKeybindings(): void {
  // Register keybinding to toggle floating panel
  game?.keybindings?.register('guard-management', 'togglePanel', {
    name: 'Alternar Panel de Guardias',
    hint: 'Muestra u oculta el panel flotante de gestión de guardias',
    editable: [
      {
        key: 'KeyG',
        modifiers: ['CONTROL', 'SHIFT'],
      },
    ],
    onDown: () => {
      (window as any).GuardManagement?.toggleFloatingPanel();
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
        modifiers: ['CONTROL', 'SHIFT'],
      },
    ],
    onDown: () => {
      (window as any).GuardManagement?.showCreateOrganizationDialog();
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
            speaker: { scene: null, actor: null, token: null, alias: 'Guard Management' },
            flags: { 'guard-management': { type: 'help' } },
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
