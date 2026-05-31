/**
 * PatrolOverlayManager – Manages floating patrol overlays on the canvas.
 * Multiple overlays can be active simultaneously, each draggable and persistent.
 */

import { PatrolsPanel, type PanelUnitType } from './panels/PatrolsPanel';

interface ActiveOverlayEntry {
  patrolId: string;
  unitType: PanelUnitType;
}

const OVERLAYS_STORAGE_KEY = 'guard-management-active-overlays';
const TEMPLATE_PATH = 'modules/guard-management/templates/overlays/patrol-overlay.hbs';

export class PatrolOverlayManager {
  private overlays = new Map<string, HTMLElement>();
  private dragState: {
    element: HTMLElement | null;
    offsetX: number;
    offsetY: number;
  } | null = null;
  private boundDragMove: (e: MouseEvent) => void;
  private boundDragEnd: () => void;
  private stylesInjected = false;

  constructor() {
    this.boundDragMove = this.handleDragMove.bind(this);
    this.boundDragEnd = this.handleDragEnd.bind(this);
  }

  /** Composite key for the overlay map */
  private key(patrolId: string, unitType: PanelUnitType): string {
    return `${unitType}::${patrolId}`;
  }

  /** localStorage key for overlay position */
  private posKey(patrolId: string, unitType: PanelUnitType): string {
    return `guard-management-overlay-pos-${unitType}-${patrolId}`;
  }

  // ─── Public API ──────────────────────────────────────────

  /** Toggle an overlay on/off */
  public async toggleOverlay(patrolId: string, unitType: PanelUnitType): Promise<void> {
    const k = this.key(patrolId, unitType);
    if (this.overlays.has(k)) {
      this.removeOverlay(patrolId, unitType);
    } else {
      await this.createOverlay(patrolId, unitType);
    }
  }

  /** Check if an overlay is currently active */
  public isActive(patrolId: string, unitType: PanelUnitType): boolean {
    return this.overlays.has(this.key(patrolId, unitType));
  }

  /** Refresh all active overlays (e.g. after data change) */
  public async refreshAll(): Promise<void> {
    const entries = this.getStoredOverlays();
    for (const entry of entries) {
      const k = this.key(entry.patrolId, entry.unitType);
      const el = this.overlays.get(k);
      if (!el) continue;

      // If the patrol no longer exists, remove the overlay
      const data = await PatrolsPanel.getData(entry.unitType);
      const patrol = data.patrols.find((p: any) => p.id === entry.patrolId);
      if (!patrol) {
        this.removeOverlay(entry.patrolId, entry.unitType);
        continue;
      }

      // Re-render content
      const html = await foundry.applications.handlebars.renderTemplate(TEMPLATE_PATH, { patrol });
      el.innerHTML = html;
      this.attachOverlayListeners(el, entry.patrolId, entry.unitType);
    }
  }

  /** Restore overlays that were active in previous session */
  public async restoreActiveOverlays(): Promise<void> {
    const entries = this.getStoredOverlays();
    for (const entry of entries) {
      await this.createOverlay(entry.patrolId, entry.unitType);
    }
  }

  /** Remove all overlays and clean up */
  public cleanup(): void {
    for (const [, el] of this.overlays) {
      el.remove();
    }
    this.overlays.clear();
    document.removeEventListener('mousemove', this.boundDragMove);
    document.removeEventListener('mouseup', this.boundDragEnd);
  }

  // ─── Internal ────────────────────────────────────────────

  private async createOverlay(patrolId: string, unitType: PanelUnitType): Promise<void> {
    const k = this.key(patrolId, unitType);
    if (this.overlays.has(k)) return; // already open

    // Fetch enriched patrol data
    const data = await PatrolsPanel.getData(unitType);
    const patrol = data.patrols.find((p: any) => p.id === patrolId);
    if (!patrol) return;

    this.addStyles();

    const el = document.createElement('div');
    el.className = 'patrol-overlay';
    el.dataset.patrolId = patrolId;
    el.dataset.unitType = unitType;

    const html = await foundry.applications.handlebars.renderTemplate(TEMPLATE_PATH, { patrol });
    el.innerHTML = html;

    document.body.appendChild(el);
    this.overlays.set(k, el);

    this.attachOverlayListeners(el, patrolId, unitType);
    this.restorePosition(el, patrolId, unitType);
    this.persistActiveList();
  }

  private removeOverlay(patrolId: string, unitType: PanelUnitType): void {
    const k = this.key(patrolId, unitType);
    const el = this.overlays.get(k);
    if (el) {
      this.savePosition(el, patrolId, unitType);
      el.remove();
      this.overlays.delete(k);
    }
    this.persistActiveList();
  }

  private attachOverlayListeners(el: HTMLElement, patrolId: string, unitType: PanelUnitType): void {
    // Drag
    const header = el.querySelector('[data-drag-handle]') as HTMLElement | null;
    if (header) {
      header.addEventListener('mousedown', (e: MouseEvent) => {
        // Ignore clicks on buttons inside the header
        if ((e.target as HTMLElement).closest('button')) return;
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        this.dragState = {
          element: el,
          offsetX: e.clientX - rect.left,
          offsetY: e.clientY - rect.top,
        };
        el.classList.add('dragging');
        document.addEventListener('mousemove', this.boundDragMove);
        document.addEventListener('mouseup', this.boundDragEnd);
      });
    }

    // Close
    el.querySelectorAll('[data-action="close-overlay"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.removeOverlay(patrolId, unitType);
      });
    });

    // Roll stat
    el.querySelectorAll('[data-action="overlay-roll-stat"]').forEach((statEl) => {
      statEl.addEventListener('click', (e) => {
        e.preventDefault();
        const statKey = (statEl as HTMLElement).dataset.stat;
        if (!statKey) return;
        const gm = (window as any).GuardManagement;
        const orgMgr = gm?.guardOrganizationManager;
        const pMgr =
          unitType === 'auxiliary' ? orgMgr?.getAuxiliaryManager?.() : orgMgr?.getPatrolManager?.();
        pMgr?.rollStat?.(patrolId, statKey);
      });
    });

    // Hope pips
    el.querySelectorAll('[data-action="overlay-hope-pip"]').forEach((pip) => {
      pip.addEventListener('click', (e) => {
        e.preventDefault();
        const index = parseInt((pip as HTMLElement).dataset.value || '0', 10);
        if (index) {
          PatrolsPanel.handleHopePip(patrolId, index, () => this.refreshAll(), unitType);
        }
      });
    });

    // Deploy button – place patrol tokens on canvas
    el.querySelectorAll('[data-action="overlay-deploy"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        PatrolsPanel.handleCallPatrol(patrolId, unitType);
      });
    });

    // Section toggles (soldier / magic / order)
    el.querySelectorAll('[data-action="toggle-section"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const target = (btn as HTMLElement).dataset.target;
        if (!target) return;
        const section = el.querySelector(`.patrol-overlay-section-${target}`) as HTMLElement | null;
        if (!section) return;
        const isHidden = section.style.display === 'none' || !section.style.display;
        section.style.display = isHidden ? 'block' : 'none';
        (btn as HTMLElement).classList.toggle('active', isHidden);
      });
    });

    // Skill to chat
    el.querySelectorAll('[data-action="overlay-skill-to-chat"]').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const el = item as HTMLElement;
        PatrolsPanel.handleSkillToChat({
          name: el.dataset.skillName || '',
          image: el.dataset.skillImage || '',
          hopeCost: parseInt(el.dataset.skillHopeCost || '0', 10),
          officerName: el.dataset.officerName || '',
        });
      });
    });
  }

  // ─── Drag Logic ──────────────────────────────────────────

  private handleDragMove(e: MouseEvent): void {
    if (!this.dragState?.element) return;
    const el = this.dragState.element;
    const x = e.clientX - this.dragState.offsetX;
    const y = e.clientY - this.dragState.offsetY;
    const maxX = window.innerWidth - el.offsetWidth;
    const maxY = window.innerHeight - el.offsetHeight;
    el.style.left = `${Math.max(0, Math.min(maxX, x))}px`;
    el.style.top = `${Math.max(0, Math.min(maxY, y))}px`;
  }

  private handleDragEnd(): void {
    if (this.dragState?.element) {
      const el = this.dragState.element;
      el.classList.remove('dragging');
      const pid = el.dataset.patrolId || '';
      const ut = (el.dataset.unitType || 'patrol') as PanelUnitType;
      this.savePosition(el, pid, ut);
    }
    this.dragState = null;
    document.removeEventListener('mousemove', this.boundDragMove);
    document.removeEventListener('mouseup', this.boundDragEnd);
  }

  // ─── Position Persistence ────────────────────────────────

  private savePosition(el: HTMLElement, patrolId: string, unitType: PanelUnitType): void {
    const pos = { x: parseInt(el.style.left) || 100, y: parseInt(el.style.top) || 100 };
    localStorage.setItem(this.posKey(patrolId, unitType), JSON.stringify(pos));
  }

  private restorePosition(el: HTMLElement, patrolId: string, unitType: PanelUnitType): void {
    try {
      const raw = localStorage.getItem(this.posKey(patrolId, unitType));
      const pos = raw
        ? JSON.parse(raw)
        : { x: 100 + this.overlays.size * 30, y: 100 + this.overlays.size * 30 };
      const maxX = window.innerWidth - el.offsetWidth;
      const maxY = window.innerHeight - el.offsetHeight;
      el.style.left = `${Math.max(0, Math.min(maxX, pos.x))}px`;
      el.style.top = `${Math.max(0, Math.min(maxY, pos.y))}px`;
    } catch {
      el.style.left = '100px';
      el.style.top = '100px';
    }
  }

  // ─── Active Overlays Persistence ─────────────────────────

  private persistActiveList(): void {
    const entries: ActiveOverlayEntry[] = [];
    for (const [k] of this.overlays) {
      const [unitType, patrolId] = k.split('::');
      entries.push({ patrolId, unitType: unitType as PanelUnitType });
    }
    localStorage.setItem(OVERLAYS_STORAGE_KEY, JSON.stringify(entries));
  }

  private getStoredOverlays(): ActiveOverlayEntry[] {
    try {
      return JSON.parse(localStorage.getItem(OVERLAYS_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  // ─── Styles ──────────────────────────────────────────────

  private addStyles(): void {
    if (this.stylesInjected) return;
    this.stylesInjected = true;

    const style = document.createElement('style');
    style.id = 'patrol-overlay-styles';
    if (document.getElementById(style.id)) return;

    style.textContent = `
      /* ── Overlay shell ── */
      .patrol-overlay {
        position: fixed;
        width: 320px;
        background: rgba(20, 18, 40, 0.94);
        border: 1px solid rgba(243, 194, 103, 0.55);
        border-radius: 6px;
        box-shadow: 0 6px 22px rgba(0,0,0,0.6);
        z-index: 60;
        font-family: 'Signika', sans-serif;
        backdrop-filter: blur(10px);
        user-select: none;
        color: #d4d4d4;
        font-size: 0.76rem;
        line-height: 1.2;
      }
      .patrol-overlay.dragging { opacity: 0.82; cursor: grabbing; }

      /* ── Header ── */
      .patrol-overlay-header {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 0 4px;
        cursor: move;
      }
      .patrol-overlay-name {
        flex: 1;
        font-family: 'Cinzel', serif;
        font-weight: 700;
        font-size: 0.8rem;
        color: #f3c267;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .patrol-overlay-close {
        background: none;
        border: none;
        color: #888;
        cursor: pointer;
        padding: 1px 4px;
        font-size: 0.72rem;
        border-radius: 3px;
        line-height: 1;
        transition: color 0.15s, background 0.15s;
      }
      .patrol-overlay-close:hover { background: rgba(255,80,80,0.22); color: #ff6b6b; }

      /* ── Body: two-column (deco | content) ── */
      .patrol-overlay-body {
        display: flex;
        gap: 0;
        padding: 0;
      }

      /* Officer decoration column */
      .patrol-overlay-officer-deco {
        flex-shrink: 0;
        width: 48px;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding-top: 2px;
      }
      .overlay-deco-img {
        width: 48px;
        height: 100%;
        border-radius: 0;
        object-fit: cover;
        border: 1px solid rgba(243,194,103,0.35);
        box-shadow: 0 0 8px rgba(243,194,103,0.12);
      }
      .overlay-deco-placeholder {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #555;
        font-size: 0.78rem;
      }

      /* Content column */
      .patrol-overlay-content { flex: 1; padding: 0.25rem 0.5rem; min-width: 0; }

      /* ── Stats grid ── */
      .patrol-overlay-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 4px;
        margin-bottom: 6px;
      }
      .overlay-stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
        padding: 4px 2px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.12s, border-color 0.12s, transform 0.1s;
        color: inherit;
      }
      .overlay-stat:hover {
        background: rgba(243,194,103,0.1);
        border-color: rgba(243,194,103,0.3);
        transform: translateY(-1px);
      }
      .overlay-stat:active { transform: translateY(0); }
      .overlay-stat:focus { outline: none; border-color: rgba(243,194,103,0.5); }
      .overlay-stat-key {
        font-size: 0.62rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        color: #999;
        text-transform: uppercase;
      }
      .overlay-stat-val { font-size: 0.88rem; font-weight: 700; color: #e8e8e8; }
      .stat-positive { color: #4ae89a !important; }
      .stat-negative { color: #e84a4a !important; }

      /* ── Hope + Deploy row ── */
      .patrol-overlay-hope-row {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 0 6px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        margin-bottom: 6px;
      }
      .patrol-overlay-hope {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 5px;
        min-width: 0;
      }
      .patrol-overlay-deploy-btns { flex-shrink: 0; }
      .overlay-deploy-btn {
        padding: 3px 7px;
        border-radius: 4px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.05);
        color: #bbb;
        font-size: 0.66rem;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
        transition: background 0.14s, border-color 0.14s, color 0.14s;
      }
      .overlay-deploy-btn:hover { background: rgba(255,255,255,0.1); color: #eee; }
      .overlay-deploy-btn--idle     { border-color: rgba(74,232,154,0.3); color: #4ae89a; }
      .overlay-deploy-btn--idle:hover { background: rgba(74,232,154,0.1); }
      .overlay-deploy-btn--deployed { border-color: rgba(243,194,103,0.4); color: #f3c267; }
      .overlay-deploy-btn--deployed:hover { background: rgba(243,194,103,0.1); }
      .overlay-deploy-btn--recalled { border-color: rgba(232,74,74,0.35); color: #e87a4a; }
      .overlay-deploy-btn--recalled:hover { background: rgba(232,74,74,0.1); }

      .hope-label {
        font-family: 'Cinzel', serif;
        font-size: 0.6rem;
        letter-spacing: 0.12em;
        color: #f3c267;
        opacity: 0.75;
        text-transform: uppercase;
      }
      .hope-pips { display: flex; gap: 4px; }
      .hope-pip {
        cursor: pointer;
        font-size: 0.7rem;
        color: rgba(243,194,103,0.25);
        transition: color 0.15s, transform 0.1s;
      }
      .hope-pip.filled { color: #f3c267; }
      .hope-pip:hover { transform: scale(1.25); }

      .patrol-overlay-section-toggles {
        display: flex;
        gap: 4px;
        margin-bottom: 4px;
      }
      .patrol-section-toggle {
        flex: 1;
        padding: 4px 4px;
        border-radius: 4px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.07);
        color: #999;
        font-size: 0.66rem;
        cursor: pointer;
        transition: background 0.14s, color 0.14s, border-color 0.14s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        white-space: nowrap;
      }
      .patrol-section-toggle:hover { color: #ccc; border-color: rgba(255,255,255,0.15); }
      .patrol-section-toggle.active {
        background: rgba(243,194,103,0.12);
        color: #f3c267;
        border-color: rgba(243,194,103,0.3);
      }

      /* ── Sections ── */
      .patrol-overlay-section {
        padding: 6px 6px;
        border-radius: 4px;
        background: rgba(0,0,0,0.18);
        border: 1px solid rgba(255,255,255,0.05);
        margin-top: 4px;
      }
      .overlay-empty-hint {
        margin: 0;
        padding: 2px 0;
        font-size: 0.68rem;
        color: #666;
        font-style: italic;
        text-align: center;
      }

      /* Officer row */
      .overlay-officer-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 5px;
        padding-bottom: 5px;
        border-bottom: 1px solid rgba(255,255,255,0.07);
      }
      .overlay-member-img, .overlay-slot-img {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        object-fit: cover;
        border: 1px solid rgba(243,194,103,0.3);
        flex-shrink: 0;
      }
      .overlay-member-icon { color: #888; font-size: 0.9rem; }
      .overlay-member-name { flex: 1; font-size: 0.74rem; font-weight: 600; color: #ddd; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .overlay-member-badge {
        font-size: 0.6rem;
        background: rgba(243,194,103,0.12);
        border: 1px solid rgba(243,194,103,0.25);
        color: #f3c267;
        padding: 1px 5px;
        border-radius: 10px;
        white-space: nowrap;
      }

      /* Officer skill */
      .overlay-officer-skill {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 4px 5px;
        border-radius: 4px;
        background: rgba(243,194,103,0.06);
        border: 1px solid rgba(243,194,103,0.12);
        cursor: pointer;
        transition: background 0.14s;
        margin-bottom: 6px;
      }
      .overlay-officer-skill:hover { background: rgba(243,194,103,0.14); }
      .overlay-skill-img { width: 18px; height: 18px; border-radius: 3px; object-fit: cover; border: none; flex-shrink: 0; }
      .overlay-skill-name { flex: 1; font-size: 0.72rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #d4d4d4; }
      .overlay-skill-hope { font-size: 0.66rem; color: #f3c267; opacity: 0.85; white-space: nowrap; }

      /* Soldier slots */
      .overlay-slots {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .overlay-slot {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.03);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.6rem;
        color: #555;
        overflow: hidden;
        cursor: default;
      }
      .overlay-slot.filled { border-color: rgba(243,194,103,0.35); background: rgba(243,194,103,0.06); color: #bbb; }
      .overlay-slot.filled img { width: 100%; height: 100%; object-fit: cover; }

      /* Spellcasting */
      .overlay-spellcasting-header {
        display: flex;
        align-items: center;
        gap: 7px;
        margin-bottom: 6px;
        padding-bottom: 5px;
        border-bottom: 1px solid rgba(255,255,255,0.07);
      }
      .overlay-spell-type-img { width: 24px; height: 24px; border-radius: 4px; object-fit: cover; border: none; flex-shrink: 0; }
      .overlay-spellcasting-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
      .overlay-spell-type-name { font-size: 0.74rem; font-weight: 600; color: #ddd; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .overlay-spell-type-label { font-size: 0.65rem; color: #999; }

      .overlay-spells-list { display: flex; flex-direction: column; gap: 2px; }
      .overlay-spell-item {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 3px 4px;
        border-radius: 3px;
        background: rgba(255,255,255,0.03);
      }
      .overlay-spell-name { flex: 1; font-size: 0.71rem; color: #d0d0d0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .overlay-spell-hope { font-size: 0.65rem; color: #f3c267; opacity: 0.8; white-space: nowrap; }

      /* Order */
      .overlay-order-text {
        font-size: 0.72rem;
        color: #ccc;
        font-style: italic;
        line-height: 1.4;
        margin-bottom: 5px;
      }
      .overlay-order-age {
        font-size: 0.62rem;
        color: #777;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .overlay-order-age-fresh .fas { color: #4ae89a; }
      .overlay-order-age-old .fas    { color: #f3c267; }
      .overlay-order-age-stale .fas  { color: #e84a4a; }

      /* ── Patrol card toggle button ── */
      .toggle-overlay {
        background: none;
        border: 1px solid transparent;
        color: #999;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        transition: color 0.15s, border-color 0.15s, background 0.15s;
      }
      .toggle-overlay:hover { color: #f3c267; border-color: rgba(243,194,103,0.3); }
      .toggle-overlay.overlay-active {
        color: #f3c267;
        border-color: rgba(243,194,103,0.45);
        background: rgba(243,194,103,0.1);
      }
    `;

    document.head.appendChild(style);
  }
}
