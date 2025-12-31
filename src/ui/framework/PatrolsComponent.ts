import { classifyLastOrderAge } from '../../utils/patrol-helpers';
import { ComponentBase, escapeHtml } from './ComponentBase';

export interface PatrolsComponentState {
  patrols: any[];
}

interface PatrolsComponentDeps {
  onCreate(): void;
  onEdit(id: string): void;
  onDelete(id: string): void;
  onEditLastOrder(id: string): void;
}

export class PatrolsComponent extends ComponentBase<PatrolsComponentState> {
  constructor(
    root: HTMLElement,
    initialState: PatrolsComponentState,
    private deps: PatrolsComponentDeps
  ) {
    super(root, initialState);
  }

  onInit(): void {
    this.root.classList.add('patrols-panel');
    // Single delegated listener
    this.root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('button[data-action]') as HTMLButtonElement | null;
      if (btn) {
        const action = btn.dataset.action;
        const id = btn.dataset.patrolId || '';
        if (action === 'create-patrol') return this.deps.onCreate();
        if (action === 'edit') return this.deps.onEdit(id);
        if (action === 'delete') return this.deps.onDelete(id);
      }
      const lastOrderEl = target.closest('[data-action="edit-last-order"]') as HTMLElement | null;
      if (lastOrderEl) {
        const id = lastOrderEl.dataset.patrolId || '';
        return this.deps.onEditLastOrder(id);
      }
    });
  }

  protected template(state: Readonly<PatrolsComponentState>): string {
    const patrols = state.patrols || [];
    const cards = patrols.map((p) => this.renderCard(p)).join('');
    return `
      <div class="panel-header">
        <h3><i class="fas fa-users"></i> Patrullas</h3>
        <button type="button" class="btn create-patrol" data-action="create-patrol">
          <i class="fas fa-plus"></i> Nueva Patrulla
        </button>
      </div>
      ${patrols.length === 0 ? `<p class="empty-state">No hay patrullas. Crea la primera.</p>` : `<div class="patrol-cards-grid">${cards}</div>`}
    `;
  }

  /** After render attach drag & drop handlers (separate officer + soldiers zones) */
  override afterRender(): void {
    const cards = Array.from(this.root.querySelectorAll('.patrol-card')) as HTMLElement[];
    cards.forEach((card) => this.setupCardZoneDnD(card));
  }

  private setupCardZoneDnD(card: HTMLElement): void {
    if ((card as any)._zonesReady) return;
    (card as any)._zonesReady = true;
    card.setAttribute('tabindex', '0');
    const pid = card.dataset.patrolId || '';

    const officerSlot = card.querySelector('.officer-slot') as HTMLElement | null;
    const soldiersZone = card.querySelector('.soldiers-zone') as HTMLElement | null;

    const bind = (el: HTMLElement, mode: 'officer' | 'soldier') => {
      const enter = (ev: DragEvent) => {
        if (!this.isActorDrag(ev)) return;
        ev.preventDefault();
        el.classList.add('dnd-hover');
        card.classList.add('dnd-active');
      };
      const over = (ev: DragEvent) => {
        if (!this.isActorDrag(ev)) return;
        ev.preventDefault();
        ev.dataTransfer!.dropEffect = 'copy';
        el.classList.add('dnd-hover');
        card.classList.add('dnd-active');
      };
      const leave = () => {
        el.classList.remove('dnd-hover');
        card.classList.remove('dnd-active');
      };
      const drop = (ev: DragEvent) => {
        if (!this.isActorDrag(ev)) return;
        ev.preventDefault();
        el.classList.remove('dnd-hover');
        card.classList.remove('dnd-active');
        try {
          const raw = ev.dataTransfer?.getData('text/plain');
          if (!raw) return;
          const data = JSON.parse(raw);

          // Handle Officer from OfficerWarehouseDialog
          if (data.type === 'Officer' && mode === 'officer') {
            const gm: any = (window as any).GuardManagement;
            const pMgr = gm?.guardOrganizationManager?.getPatrolManager?.();
            if (!pMgr) return;

            // Assign the officer by ID
            pMgr.assignOfficerById(pid, data.officerId);
            ui?.notifications?.info?.(`Oficial asignado a patrulla`);
            this.forceUpdate();
            return;
          }

          // Handle Actor (legacy)
          const g: any = (globalThis as any).game;
          const actorId = data.id || data.actorId;
          if (!actorId) return;
          const actor = g?.actors?.get?.(actorId);
          if (!actor) return ui?.notifications?.warn?.('Actor no encontrado');
          if (mode === 'officer') this.assignOfficer(pid, actor);
          else this.addSoldier(pid, actor);
        } catch (e) {
          console.warn('[PatrolsComponent] Drop error', e);
          ui?.notifications?.error?.('Error al procesar drop');
        }
      };
      el.addEventListener('dragenter', enter);
      el.addEventListener('dragover', over);
      el.addEventListener('dragleave', leave);
      el.addEventListener('drop', drop);
    };

    if (officerSlot) bind(officerSlot, 'officer');
    if (soldiersZone) bind(soldiersZone, 'soldier');
  }

  /** Detect if current drag event likely contains a Foundry Actor or Officer */
  private isActorDrag(ev: DragEvent): boolean {
    try {
      const raw = ev.dataTransfer?.getData('text/plain');
      if (!raw) return false;
      const data = JSON.parse(raw);
      return data?.type === 'Actor' || data?.type === 'Officer' || !!data?.actorId;
    } catch {
      return false;
    }
  }

  /** Assign only officer (replace if already exists) */
  private assignOfficer(patrolId: string, actor: any): void {
    try {
      const gm: any = (window as any).GuardManagement;
      const orgMgr = gm?.guardOrganizationManager;
      const pMgr = orgMgr?.getPatrolManager?.();
      if (!pMgr) return;
      const patrol = pMgr.getPatrol(patrolId);
      if (!patrol) return;
      pMgr.assignOfficer(patrolId, {
        actorId: actor.id,
        name: actor.name,
        img: actor.img,
        isLinked: actor.isOwner ?? true,
      });
      ui?.notifications?.info?.(`Oficial asignado: ${actor.name}`);
      this.forceUpdate();
    } catch (e) {
      console.warn('[PatrolsComponent] assignOfficer error', e);
    }
  }

  /** Add soldier */
  private addSoldier(patrolId: string, actor: any): void {
    try {
      const gm: any = (window as any).GuardManagement;
      const orgMgr = gm?.guardOrganizationManager;
      const pMgr = orgMgr?.getPatrolManager?.();
      if (!pMgr) return;
      const patrol = pMgr.getPatrol(patrolId);
      if (!patrol) return;
      pMgr.addSoldier(patrolId, {
        actorId: actor.id,
        name: actor.name,
        img: actor.img,
        referenceType: 'linked',
        addedAt: Date.now(),
      });
      ui?.notifications?.info?.(`Soldado añadido: ${actor.name}`);
      this.forceUpdate();
    } catch (e) {
      console.warn('[PatrolsComponent] addSoldier error', e);
    }
  }

  private renderCard(p: any): string {
    const name = escapeHtml(p.name);
    const subtitle = p.subtitle ? `<span class="subtitle">${escapeHtml(p.subtitle)}</span>` : '';
    const stats = Object.entries(p.derivedStats || p.baseStats || {})
      .map(([k, v]) => {
        const breakdown = this.computeBreakdown(p, k, v as number);
        const tip = `Base: ${breakdown.base}\nEfectos: ${breakdown.effects}\nOrganización: ${breakdown.org >= 0 ? '+' : ''}${breakdown.org}\nTotal: ${breakdown.total}`;
        return `<span class="stat" data-stat="${k}" title="${escapeHtml(tip)}">${escapeHtml(k.slice(0, 3))}: ${v}</span>`;
      })
      .join('');

    // Render officer - check if officerId exists first
    let officer = `<span class="empty">Sin Oficial</span>`;
    if (p.officerId) {
      // Get officer from OfficerManager
      const gm: any = (window as any).GuardManagement;
      const officerData = gm?.officerManager?.get(p.officerId);
      if (officerData) {
        officer = `
          <div class="officer-assigned">
            <img src="${escapeHtml(officerData.actorImg || '')}" alt="${escapeHtml(officerData.actorName)}" />
            <div class="officer-details">
              <div class="officer-name">${escapeHtml(officerData.actorName)}</div>
              <div class="officer-title">${escapeHtml(officerData.title)}</div>
            </div>
          </div>
        `;
      }
    } else if (p.officer) {
      // Fallback to legacy officer format
      officer = `<img src="${escapeHtml(p.officer.img || '')}" alt="oficial" />`;
    }

    const lastOrder = p.lastOrder;
    const ageClass = lastOrder ? classifyLastOrderAge({ issuedAt: lastOrder.issuedAt }) : 'normal';
    const lastOrderHtml = `
      <div class="last-order-line ${ageClass}" data-action="edit-last-order">
        <i class="fas fa-scroll"></i>
        <span class="last-order-label">Orden:</span>
        <span class="last-order-text">${escapeHtml(lastOrder ? lastOrder.text : '— (sin orden)')}</span>
        ${lastOrder ? `<span class="age-indicator ${ageClass}"></span>` : ''}
      </div>`;
    return `
      <div class="patrol-card" data-patrol-id="${p.id}">
        <div class="header"><span class="name">${name}</span>${subtitle}</div>
        <div class="stats-mini">${stats}</div>
        <div class="officer-slot" data-drop="officer" title="Arrastra un Oficial o Actor aquí">${officer}</div>
        <div class="soldiers-zone" data-drop="soldier" title="Arrastra Actores aquí para añadir Soldados">
          ${
            p.soldiers?.length
              ? p.soldiers
                  .slice(0, 12)
                  .map(
                    (s: any) =>
                      `<img class="soldier-avatar" src="${escapeHtml(
                        s.img || ''
                      )}" alt="${escapeHtml(s.name || 'Soldado')}" title="${escapeHtml(s.name || '')}" />`
                  )
                  .join('') +
                (p.soldiers.length > 12
                  ? `<span class="more" title="${p.soldiers.length - 12} más">+${p.soldiers.length - 12}</span>`
                  : '')
              : `<span class="placeholder">Arrastra Soldados aquí</span>`
          }
        </div>
        ${lastOrderHtml}
        <div class="actions">
          <button type="button" class="edit-patrol" data-action="edit" data-patrol-id="${p.id}"><i class="fas fa-edit"></i></button>
          <button type="button" class="delete-patrol" data-action="delete" data-patrol-id="${p.id}"><i class="fas fa-trash"></i></button>
        </div>
      </div>`;
  }

  private computeBreakdown(p: any, key: string, total: number) {
    try {
      const base = p.baseStats?.[key] ?? 0;
      const effectTotals: Record<string, number> = {};
      for (const eff of p.patrolEffects || []) {
        for (const [k, v] of Object.entries(eff.modifiers || {})) {
          effectTotals[k] = (effectTotals[k] || 0) + ((v as number) || 0);
        }
      }
      const effects = effectTotals[key] || 0;
      const org = total - base - effects;
      return { base, effects, org, total };
    } catch {
      return { base: 0, effects: 0, org: 0, total };
    }
  }
}
