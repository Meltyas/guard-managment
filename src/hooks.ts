/**
 * Foundry VTT hooks registration
 */

export function registerHooks(): void {
  console.log('GuardManagement | Registering hooks...');

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

  // Hook to inject custom modifier breakdown into chat messages
  Hooks.on('renderChatMessageHTML', (message: any, html: HTMLElement, _data: any) => {
    // Inject roll breakdown if present
    try {
      const breakdown = message.getFlag('guard-management', 'breakdown');
      if (breakdown && Array.isArray(breakdown)) {
        const rollContent = html.querySelector('.roll-part-content.dice-result');
        if (rollContent) {
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
          rollContent.insertAdjacentHTML('beforeend', breakdownHtml);
        }
      }
    } catch (e) {
      console.error('GuardManagement | Error rendering chat breakdown:', e);
    }

    // Activate toggleable description sections in guard chat messages (runs for ALL messages)
    html.querySelectorAll('.guard-chat-toggle-header').forEach((header) => {
      header.addEventListener('click', () => {
        const body = header.nextElementSibling as HTMLElement;
        if (!body) return;
        const isHidden = body.style.display === 'none';
        body.style.display = isHidden ? 'block' : 'none';
        const icon = header.querySelector('i');
        if (icon) {
          icon.className = isHidden ? 'fas fa-caret-down' : 'fas fa-caret-right';
        }
      });
    });
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
      const OWH =
        gm.OfficerWarehouseDialog ?? (window as any).GuardManagement?.OfficerWarehouseDialog;
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
