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
  detail?: string;
  hover?: string; // CSS selector to find the hovered element, e.g. '.patrol-card[data-patrol-id="abc"]'
}

const MODULE_ID = 'guard-management';
const FLAG_KEY = 'presence';
const INACTIVITY_MS = 3 * 60 * 1000; // 3 minutes
const TAB_LS_KEY = 'guard-management.infoDialog.selectedTab';

/** Selectors to detect which entity element the user is interacting with */
const ENTITY_SELECTORS: Array<{ container: string; idAttr: string; name: string }> = [
  { container: '.patrol-card', idAttr: 'data-patrol-id', name: '.name' },
  { container: '.crime-row', idAttr: 'data-crime-id', name: '.crime-name' },
  { container: '.prisoner-cell-summary', idAttr: 'data-prisoner-id', name: '.prisoner-name' },
  { container: '.prisoner-record', idAttr: 'data-prisoner-id', name: '.record-name' },
  { container: '.gang-card', idAttr: 'data-gang-id', name: '.gang-name' },
  { container: '.building-card', idAttr: 'data-building-id', name: '.building-name' },
  { container: '.poi-card', idAttr: 'data-poi-id', name: '.poi-name' },
  { container: '.finances-entry-row', idAttr: 'data-entry-id', name: '.finances-entry-name' },
  { container: '.resource-item', idAttr: 'data-resource-id', name: '.resource-name' },
  { container: '.reputation-item', idAttr: 'data-reputation-id', name: '.reputation-name' },
  { container: '.stat-box.clickable-stat', idAttr: 'data-stat', name: '.stat-label' },
];

/**
 * Sub-sections within a patrol/auxiliary card for finer-grained hover.
 * Checked first (most specific); if none match, falls back to the whole card.
 */
const PATROL_SUB_SELECTORS: Array<{ selector: string; label: string }> = [
  { selector: '.officer-section-toggle', label: 'Oficial' },
  { selector: '.soldiers-zone', label: 'Soldados' },
  { selector: '.stats-mini', label: 'Estadísticas' },
  { selector: '.last-order-container', label: 'Última orden' },
  { selector: '.active-effects', label: 'Efectos' },
  { selector: '.patrol-officer-skills', label: 'Habilidades' },
  { selector: '.patrol-hope-section', label: 'Esperanza' },
  { selector: '.patrol-traits-section', label: 'Rasgos' },
  { selector: '.actions', label: 'Acciones' },
  { selector: '.header', label: 'Cabecera' },
];

const VISIBILITY_LS_KEY = 'guard-management.presence.visible';

export class PresenceIndicator {
  private container: HTMLElement | null = null;
  private dialogElement: HTMLElement;
  private hookId: number | null = null;
  private inactivityTimer: number | null = null;
  private boundBeforeUnload: (() => void) | null = null;
  private interactionHandler: ((e: MouseEvent) => void) | null = null;
  private hoverHandler: ((e: MouseEvent) => void) | null = null;
  private hoverLeaveHandler: (() => void) | null = null;
  private lastHoverSelector: string | null = null;
  /** Tracks current highlight overlays so we only touch DOM on actual changes */
  private activeHighlights = new Map<string, HTMLElement>(); // selector -> overlay element
  /** Toggle visibility of presence UI (local only, does NOT stop broadcasting) */
  private visible: boolean;
  private altHeld = false;
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private toggleBtn: HTMLElement | null = null;

  constructor(dialogElement: HTMLElement) {
    this.dialogElement = dialogElement;
    this.visible = localStorage.getItem(VISIBILITY_LS_KEY) !== 'false'; // default visible
  }

  /** Whether presence UI is effectively visible (considering Alt inversion) */
  private get effectivelyVisible(): boolean {
    return this.altHeld ? !this.visible : this.visible;
  }

  /** Create the floating container, register hooks, set initial presence */
  public attach(): void {
    this.container = document.createElement('div');
    this.container.className = 'gm-presence-container';
    document.body.appendChild(this.container);

    // Toggle button lives in the dialog header
    this.toggleBtn = this.dialogElement.querySelector('.gm-presence-toggle') as HTMLElement;
    if (this.toggleBtn) {
      this.updateToggleIcon();
      this.toggleBtn.addEventListener('click', () => {
        this.visible = !this.visible;
        localStorage.setItem(VISIBILITY_LS_KEY, String(this.visible));
        this.updateToggleIcon();
        this.applyVisibility();
      });
    }

    // Set initial presence
    const currentTab = localStorage.getItem(TAB_LS_KEY) || 'general';
    this.setPresence(currentTab);

    // Listen for other users' flag changes
    this.hookId = Hooks.on('updateUser', () => {
      this.renderAvatars();
      this.updateHighlights();
    });

    // Initial render & position
    this.reposition();
    this.renderAvatars();
    this.updateHighlights();

    // Start inactivity timer
    this.resetInactivityTimer();

    // Clean up on page unload
    this.boundBeforeUnload = () => this.clearPresence();
    window.addEventListener('beforeunload', this.boundBeforeUnload);

    // Alt key to temporarily invert visibility
    this.boundKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt' && !this.altHeld) {
        this.altHeld = true;
        this.updateToggleIcon();
        this.applyVisibility();
      }
    };
    this.boundKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt' && this.altHeld) {
        this.altHeld = false;
        this.updateToggleIcon();
        this.applyVisibility();
      }
    };
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);

    // Any click inside the dialog resets inactivity and detects entity detail
    this.interactionHandler = (e: MouseEvent) => {
      const tab = localStorage.getItem(TAB_LS_KEY) || 'general';
      const target = e.target as HTMLElement;
      let detail: string | undefined;

      for (const { container, name } of ENTITY_SELECTORS) {
        const el = target.closest(container);
        if (el) {
          detail = el.querySelector(name)?.textContent?.trim() || undefined;
          break;
        }
      }

      this.setPresence(tab, detail);
      this.resetInactivityTimer();
    };
    this.dialogElement.addEventListener('click', this.interactionHandler);

    // Track hover over entity elements for remote outline
    this.hoverHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      let hoverSelector: string | null = null;

      // Check patrol/auxiliary card sub-sections first (finer grained)
      const patrolCard = target.closest('.patrol-card') as HTMLElement;
      if (patrolCard) {
        const patrolId = patrolCard.getAttribute('data-patrol-id');
        if (patrolId) {
          const prefix = `.patrol-card[data-patrol-id="${patrolId}"]`;
          // Try sub-sections first
          for (const { selector } of PATROL_SUB_SELECTORS) {
            if (target.closest(selector)) {
              hoverSelector = `${prefix} ${selector}`;
              break;
            }
          }
          // Fallback to whole card
          if (!hoverSelector) hoverSelector = prefix;
        }
      } else {
        // Other entity types
        for (const { container, idAttr } of ENTITY_SELECTORS) {
          const el = target.closest(container);
          if (el) {
            const id = el.getAttribute(idAttr);
            if (id) hoverSelector = `${container}[${idAttr}="${id}"]`;
            break;
          }
        }
      }

      // Only update flag when the hovered entity changes
      if (hoverSelector !== this.lastHoverSelector) {
        this.lastHoverSelector = hoverSelector;
        this.updateHover(hoverSelector);
      }
    };
    this.hoverLeaveHandler = () => {
      if (this.lastHoverSelector !== null) {
        this.lastHoverSelector = null;
        this.updateHover(null);
      }
    };
    this.dialogElement.addEventListener('mouseover', this.hoverHandler);
    this.dialogElement.addEventListener('mouseleave', this.hoverLeaveHandler);
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

    if (this.interactionHandler) {
      this.dialogElement.removeEventListener('click', this.interactionHandler);
      this.interactionHandler = null;
    }

    if (this.hoverHandler) {
      this.dialogElement.removeEventListener('mouseover', this.hoverHandler);
      this.hoverHandler = null;
    }
    if (this.hoverLeaveHandler) {
      this.dialogElement.removeEventListener('mouseleave', this.hoverLeaveHandler);
      this.hoverLeaveHandler = null;
    }
    this.lastHoverSelector = null;

    if (this.boundKeyDown) {
      window.removeEventListener('keydown', this.boundKeyDown);
      this.boundKeyDown = null;
    }
    if (this.boundKeyUp) {
      window.removeEventListener('keyup', this.boundKeyUp);
      this.boundKeyUp = null;
    }
    this.altHeld = false;
    this.toggleBtn = null;

    // Clean up any remaining highlight overlays
    for (const [selector, overlay] of this.activeHighlights) {
      overlay.remove();
      const el = this.dialogElement.querySelector(selector) as HTMLElement;
      if (el) el.style.removeProperty('position');
    }
    this.activeHighlights.clear();

    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  /** Called on tab switch — clears detail since we're changing context */
  public notifyInteraction(tab: string): void {
    this.setPresence(tab, undefined);
    this.resetInactivityTimer();
  }

  /** Reposition the container relative to the dialog's current bounds */
  public reposition(): void {
    if (!this.container || !this.dialogElement) return;
    const dialogRect = this.dialogElement.getBoundingClientRect();

    if (dialogRect.left >= 44) {
      this.container.style.left = `${dialogRect.left - 40}px`;
    } else {
      this.container.style.left = `${dialogRect.right + 4}px`;
    }

    this.container.style.top = `${dialogRect.top}px`;
    this.container.style.height = `${dialogRect.height}px`;

    // Re-render avatars to update vertical alignment
    this.renderAvatars();
  }

  /** Collect presence data from all other users */
  private collectPresence(): {
    byTab: Map<string, Array<{ user: any; active: boolean; detail?: string }>>;
    hoversBySelector: Map<string, string[]>;
  } {
    const byTab = new Map<string, Array<{ user: any; active: boolean; detail?: string }>>();
    const hoversBySelector = new Map<string, string[]>();
    const currentUserId = (game as any)?.user?.id;

    for (const user of (game as any).users) {
      if (user.id === currentUserId) continue;
      if (!user.active) continue;

      const presence = user.getFlag(MODULE_ID, FLAG_KEY) as PresenceData | undefined;
      if (!presence?.dialogOpen) continue;

      const isActive = Date.now() - presence.timestamp < INACTIVITY_MS;
      const tab = presence.tab;

      if (!byTab.has(tab)) byTab.set(tab, []);
      byTab.get(tab)!.push({ user, active: isActive, detail: presence.detail });

      if (presence.hover) {
        if (!hoversBySelector.has(presence.hover)) hoversBySelector.set(presence.hover, []);
        hoversBySelector.get(presence.hover)!.push(user.color || '#f3c267');
      }
    }

    return { byTab, hoversBySelector };
  }

  /** Rebuild avatar DOM (lightweight — only touches the floating container) */
  private renderAvatars(): void {
    if (!this.container || !this.dialogElement) return;

    // Preserve toggle button, clear only avatar rows
    const rows = this.container.querySelectorAll('.gm-presence-row');
    rows.forEach((r) => r.remove());

    if (!this.effectivelyVisible) return;

    const tabButtons = Array.from(
      this.dialogElement.querySelectorAll('.org-tab-btn'),
    ) as HTMLButtonElement[];
    const dialogRect = this.dialogElement.getBoundingClientRect();
    const { byTab } = this.collectPresence();

    for (const [tab, users] of byTab) {
      const btn = tabButtons.find((b) => b.dataset.tab === tab);
      if (!btn) continue;

      const btnRect = btn.getBoundingClientRect();
      const rowDiv = document.createElement('div');
      rowDiv.className = 'gm-presence-row';
      rowDiv.style.top = `${btnRect.top - dialogRect.top + btnRect.height / 2 - 13}px`;

      for (const { user, active, detail } of users) {
        const avatar = document.createElement('img');
        avatar.className = `gm-presence-avatar${active ? '' : ' inactive'}`;
        avatar.src = user.avatar || 'icons/svg/mystery-man.svg';
        avatar.alt = user.name;
        let tooltip = `${user.name} — ${active ? 'Activo' : 'Inactivo (3min+)'}`;
        if (detail) tooltip += `\n${detail}`;
        avatar.title = tooltip;
        avatar.style.borderColor = user.color || '#f3c267';
        rowDiv.appendChild(avatar);
      }

      this.container.appendChild(rowDiv);
    }
  }

  /** Diff-based hover highlights using overlay divs — zero layout impact */
  private updateHighlights(): void {
    if (!this.dialogElement || !this.effectivelyVisible) return;

    const { hoversBySelector } = this.collectPresence();

    // Build new desired state: selector -> borderImage value
    const desired = new Map<string, string>();
    for (const [selector, colors] of hoversBySelector) {
      const segDeg = 360 / colors.length;
      const stops = colors
        .map((c, i) => `${c} ${i * segDeg}deg ${(i + 1) * segDeg}deg`)
        .join(', ');
      desired.set(selector, `conic-gradient(from 225deg, ${stops}) 1`);
    }

    // Remove overlays that are no longer needed
    for (const [selector, overlay] of this.activeHighlights) {
      if (!desired.has(selector)) {
        overlay.remove();
        const el = this.dialogElement.querySelector(selector) as HTMLElement;
        if (el) el.style.removeProperty('position');
        this.activeHighlights.delete(selector);
      }
    }

    // Add or update highlights that changed
    for (const [selector, borderImage] of desired) {
      const existing = this.activeHighlights.get(selector);

      if (existing) {
        // Update border image if changed
        if (existing.style.borderImage !== borderImage) {
          existing.style.borderImage = borderImage;
        }
      } else {
        // Create new overlay
        const el = this.dialogElement.querySelector(selector) as HTMLElement;
        if (!el) continue;

        // Ensure parent has position for the overlay to anchor to
        const computed = getComputedStyle(el);
        if (computed.position === 'static') {
          el.style.position = 'relative';
        }

        const overlay = document.createElement('div');
        overlay.className = 'gm-presence-hover-overlay';
        overlay.style.borderImage = borderImage;
        el.appendChild(overlay);
        this.activeHighlights.set(selector, overlay);
      }
    }
  }

  /** Update the toggle button icon based on current effective visibility */
  private updateToggleIcon(): void {
    if (!this.toggleBtn) return;
    const show = this.effectivelyVisible;
    this.toggleBtn.innerHTML = `<i class="fas fa-${show ? 'eye' : 'eye-slash'}"></i>`;
  }

  /** Show/hide avatars and overlays based on effective visibility */
  private applyVisibility(): void {
    if (!this.container) return;
    // Hide/show all avatar rows
    for (const row of this.container.querySelectorAll('.gm-presence-row') as NodeListOf<HTMLElement>) {
      row.style.display = this.effectivelyVisible ? '' : 'none';
    }
    // Remove or restore overlays
    if (this.effectivelyVisible) {
      this.updateHighlights();
    } else {
      // Remove all overlays temporarily
      for (const [selector, overlay] of this.activeHighlights) {
        overlay.remove();
        const el = this.dialogElement.querySelector(selector) as HTMLElement;
        if (el) el.style.removeProperty('position');
      }
      this.activeHighlights.clear();
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

  private setPresence(tab: string, detail?: string): void {
    const current = (game as any)?.user?.getFlag(MODULE_ID, FLAG_KEY) as PresenceData | undefined;
    (game as any)?.user
      ?.setFlag(MODULE_ID, FLAG_KEY, {
        tab,
        timestamp: Date.now(),
        dialogOpen: true,
        detail,
        hover: current?.hover ?? null,
      })
      ?.catch((e: any) => console.warn('GuardManagement | Error setting presence flag:', e));
  }

  /** Update only the hover selector in the flag without touching other fields */
  private updateHover(selector: string | null): void {
    const current = (game as any)?.user?.getFlag(MODULE_ID, FLAG_KEY) as PresenceData | undefined;
    if (!current) return;
    (game as any)?.user
      ?.setFlag(MODULE_ID, FLAG_KEY, {
        ...current,
        hover: selector,
      })
      ?.catch((e: any) => console.warn('GuardManagement | Error setting hover flag:', e));
  }

  private clearPresence(): void {
    (game as any)?.user
      ?.unsetFlag(MODULE_ID, FLAG_KEY)
      ?.catch((e: any) => console.warn('GuardManagement | Error clearing presence flag:', e));
  }
}
