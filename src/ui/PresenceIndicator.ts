/**
 * PresenceIndicator - Shows which players are viewing which tab
 * in the Guard Management organization dialog.
 *
 * Uses Foundry User Flags for cross-client sync.
 */

interface PresenceData {
  tab: string;
  timestamp: number;
  dialogOpen: boolean;
}

const MODULE_ID = 'guard-management';
const FLAG_KEY = 'presence';
const INACTIVITY_MS = 3 * 60 * 1000; // 3 minutes
const TAB_LS_KEY = 'guard-management.infoDialog.selectedTab';

export class PresenceIndicator {
  private container: HTMLElement | null = null;
  private dialogElement: HTMLElement;
  private hookId: number | null = null;
  private inactivityTimer: number | null = null;
  private boundBeforeUnload: (() => void) | null = null;

  constructor(dialogElement: HTMLElement) {
    this.dialogElement = dialogElement;
  }

  /** Create the floating container, register hooks, set initial presence */
  public attach(): void {
    this.container = document.createElement('div');
    this.container.className = 'gm-presence-container';
    document.body.appendChild(this.container);

    // Set initial presence
    const currentTab = localStorage.getItem(TAB_LS_KEY) || 'general';
    this.setPresence(currentTab);

    // Listen for other users' flag changes
    this.hookId = Hooks.on('updateUser', (_user: any, changes: any) => {
      if (
        changes?.flags?.[MODULE_ID]?.[FLAG_KEY] !== undefined ||
        changes?.flags?.[MODULE_ID]?.[`-=${FLAG_KEY}`] !== undefined
      ) {
        this.render();
      }
    });

    // Initial render & position
    this.reposition();
    this.render();

    // Start inactivity timer
    this.resetInactivityTimer();

    // Clean up on page unload
    this.boundBeforeUnload = () => this.clearPresence();
    window.addEventListener('beforeunload', this.boundBeforeUnload);
  }

  /** Remove container, unregister hooks, clear presence flag */
  public detach(): void {
    this.clearPresence();

    if (this.hookId !== null) {
      Hooks.off('updateUser', this.hookId);
      this.hookId = null;
    }

    if (this.inactivityTimer !== null) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }

    if (this.boundBeforeUnload) {
      window.removeEventListener('beforeunload', this.boundBeforeUnload);
      this.boundBeforeUnload = null;
    }

    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  /** Called on tab switch or any dialog interaction */
  public notifyInteraction(tab: string): void {
    this.setPresence(tab);
    this.resetInactivityTimer();
  }

  /** Reposition the container relative to the dialog's current bounds */
  public reposition(): void {
    if (!this.container || !this.dialogElement) return;
    const dialogRect = this.dialogElement.getBoundingClientRect();
    const spaceRight = window.innerWidth - dialogRect.right;

    if (spaceRight >= 44) {
      this.container.style.left = `${dialogRect.right + 4}px`;
    } else {
      this.container.style.left = `${dialogRect.left - 40}px`;
    }

    this.container.style.top = `${dialogRect.top}px`;
    this.container.style.height = `${dialogRect.height}px`;

    // Re-render to update avatar vertical alignment
    this.render();
  }

  /** Rebuild the avatar DOM from all users' flags */
  private render(): void {
    if (!this.container || !this.dialogElement) return;
    this.container.innerHTML = '';

    const tabButtons = Array.from(
      this.dialogElement.querySelectorAll('.org-tab-btn'),
    ) as HTMLButtonElement[];
    const dialogRect = this.dialogElement.getBoundingClientRect();
    const currentUserId = (game as any)?.user?.id;

    // Group presence data by tab
    const presenceByTab = new Map<string, Array<{ user: any; active: boolean }>>();

    for (const user of (game as any).users) {
      if (user.id === currentUserId) continue;
      if (!user.active) continue;

      const presence = user.getFlag(MODULE_ID, FLAG_KEY) as PresenceData | undefined;
      if (!presence?.dialogOpen) continue;

      const isActive = Date.now() - presence.timestamp < INACTIVITY_MS;
      const tab = presence.tab;

      if (!presenceByTab.has(tab)) presenceByTab.set(tab, []);
      presenceByTab.get(tab)!.push({ user, active: isActive });
    }

    // For each tab with users, create avatar row aligned to the tab button
    for (const [tab, users] of presenceByTab) {
      const btn = tabButtons.find((b) => b.dataset.tab === tab);
      if (!btn) continue;

      const btnRect = btn.getBoundingClientRect();
      const rowDiv = document.createElement('div');
      rowDiv.className = 'gm-presence-row';
      rowDiv.style.top = `${btnRect.top - dialogRect.top + btnRect.height / 2 - 13}px`;

      for (const { user, active } of users) {
        const avatar = document.createElement('img');
        avatar.className = `gm-presence-avatar${active ? '' : ' inactive'}`;
        avatar.src = user.avatar || 'icons/svg/mystery-man.svg';
        avatar.alt = user.name;
        avatar.title = `${user.name} — ${active ? 'Activo' : 'Inactivo (3min+)'}`;
        avatar.style.borderColor = user.color || '#f3c267';
        rowDiv.appendChild(avatar);
      }

      this.container.appendChild(rowDiv);
    }
  }

  private resetInactivityTimer(): void {
    if (this.inactivityTimer !== null) {
      clearTimeout(this.inactivityTimer);
    }
    // After INACTIVITY_MS, stop updating the timestamp.
    // Other clients compute staleness from the old timestamp.
    this.inactivityTimer = window.setTimeout(() => {
      this.inactivityTimer = null;
    }, INACTIVITY_MS);
  }

  private setPresence(tab: string): void {
    try {
      (game as any)?.user?.setFlag(MODULE_ID, FLAG_KEY, {
        tab,
        timestamp: Date.now(),
        dialogOpen: true,
      });
    } catch (e) {
      console.warn('GuardManagement | Error setting presence flag:', e);
    }
  }

  private clearPresence(): void {
    try {
      (game as any)?.user?.unsetFlag(MODULE_ID, FLAG_KEY);
    } catch (e) {
      console.warn('GuardManagement | Error clearing presence flag:', e);
    }
  }
}
