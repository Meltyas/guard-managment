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

    // Skills toggle
    el.querySelectorAll('[data-action="toggle-overlay-skills"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const list = (btn as HTMLElement).nextElementSibling as HTMLElement | null;
        const chevron = (btn as HTMLElement).querySelector('.overlay-skills-chevron');
        if (list) {
          const isHidden = list.style.display === 'none';
          list.style.display = isHidden ? 'block' : 'none';
          chevron?.classList.toggle('open', isHidden);
        }
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
      .patrol-overlay {
        position: fixed;
        width: 260px;
        background: rgba(24, 22, 46, 0.92);
        border: 1px solid #f3c267;
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
        z-index: 60;
        font-family: 'Signika', sans-serif;
        backdrop-filter: blur(10px);
        user-select: none;
        color: #ddd;
        font-size: 0.82rem;
      }

      .patrol-overlay.dragging {
        opacity: 0.8;
        cursor: grabbing;
      }

      /* Header */
      .patrol-overlay-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-bottom: 1px solid rgba(243, 194, 103, 0.4);
        cursor: move;
      }

      .patrol-overlay-name {
        flex: 1;
        font-family: 'Cinzel', serif;
        font-weight: bold;
        font-size: 0.85rem;
        color: #f3c267;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .patrol-overlay-subtitle {
        font-size: 0.7rem;
        color: #aaa;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 80px;
      }

      .patrol-overlay-close {
        background: none;
        border: none;
        color: #ccc;
        cursor: pointer;
        padding: 2px 4px;
        font-size: 0.8rem;
        border-radius: 3px;
        transition: all 0.2s;
        line-height: 1;
      }

      .patrol-overlay-close:hover {
        background: rgba(255, 80, 80, 0.3);
        color: #ff6b6b;
      }

      /* Body */
      .patrol-overlay-body {
        padding: 8px 10px;
      }

      /* Stats */
      .patrol-overlay-stats {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 8px;
        margin-bottom: 6px;
      }

      .overlay-stat {
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 3px;
        transition: all 0.2s;
        font-size: 0.8rem;
      }

      .overlay-stat:hover {
        background: rgba(243, 194, 103, 0.15);
        transform: scale(1.05);
        box-shadow: 0 0 6px rgba(243, 194, 103, 0.3);
      }

      .overlay-stat .stat-positive { color: #4ae89a; }
      .overlay-stat .stat-negative { color: #e84a4a; }
      .overlay-stat .stat-mixed { color: #f3c267; }

      /* Hope */
      .patrol-overlay-hope {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
      }

      .patrol-overlay-hope .hope-pips {
        display: flex;
        gap: 3px;
      }

      .patrol-overlay-hope .hope-pip {
        cursor: pointer;
        font-size: 0.75rem;
        color: #666;
        transition: all 0.2s;
      }

      .patrol-overlay-hope .hope-pip.filled {
        color: #f3c267;
      }

      .patrol-overlay-hope .hope-pip:hover {
        transform: scale(1.2);
      }

      .patrol-overlay-hope .hope-label {
        font-family: 'Cinzel', serif;
        font-size: 0.65rem;
        color: #f3c267;
        letter-spacing: 0.1em;
        opacity: 0.7;
      }

      /* Skills */
      .patrol-overlay-skills-section {
        margin-top: 4px;
      }

      .patrol-overlay-skills-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        padding: 4px 8px;
        background: rgba(243, 194, 103, 0.1);
        border: 1px solid rgba(243, 194, 103, 0.25);
        border-radius: 4px;
        color: #f3c267;
        font-family: 'Cinzel', serif;
        font-size: 0.75rem;
        cursor: pointer;
        transition: all 0.2s;
      }

      .patrol-overlay-skills-toggle:hover {
        background: rgba(243, 194, 103, 0.2);
      }

      .overlay-skills-chevron {
        margin-left: auto;
        transition: transform 0.2s;
        font-size: 0.65rem;
      }

      .overlay-skills-chevron.open {
        transform: rotate(180deg);
      }

      .patrol-overlay-skills-list {
        padding: 4px 0;
      }

      .overlay-skill-item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 8px;
        cursor: pointer;
        border-radius: 3px;
        transition: background 0.15s;
      }

      .overlay-skill-item:hover {
        background: rgba(255, 255, 255, 0.08);
      }

      .overlay-skill-img {
        width: 20px;
        height: 20px;
        border-radius: 3px;
        object-fit: cover;
        border: none;
      }

      .overlay-skill-name {
        flex: 1;
        font-size: 0.78rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .overlay-skill-hope {
        font-size: 0.7rem;
        color: #f3c267;
        opacity: 0.8;
      }

      /* Toggle button in patrol card */
      .toggle-overlay {
        background: none;
        border: 1px solid transparent;
        color: #aaa;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        transition: all 0.2s;
      }

      .toggle-overlay:hover {
        color: #f3c267;
        border-color: rgba(243, 194, 103, 0.3);
      }

      .toggle-overlay.overlay-active {
        color: #f3c267;
        border-color: rgba(243, 194, 103, 0.5);
        background: rgba(243, 194, 103, 0.1);
      }
    `;

    document.head.appendChild(style);
  }
}
