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
    const officer = p.officer
      ? `<img src="${escapeHtml(p.officer.img || '')}" alt="oficial" />`
      : `<span class="empty">Sin Oficial</span>`;
    const lastOrder = p.lastOrder;
    const ageClass = lastOrder ? classifyLastOrderAge({ issuedAt: lastOrder.issuedAt }) : 'normal';
    const lastOrderHtml = `
      <div class="last-order-line ${ageClass}" data-action="edit-last-order" data-patrol-id="${p.id}" title="Click para editar la última orden">
        <i class="fas fa-scroll"></i>
        <span class="last-order-label">Orden:</span>
        <span class="last-order-text">${escapeHtml(lastOrder ? lastOrder.text : '— (sin orden)')}</span>
        ${lastOrder ? `<span class="age-indicator ${ageClass}"></span>` : ''}
      </div>`;
    return `
      <div class="patrol-card" data-patrol-id="${p.id}">
        <div class="header"><span class="name">${name}</span>${subtitle}</div>
        <div class="stats-mini">${stats}</div>
        <div class="officer-slot">${officer}</div>
        <div class="soldiers-count">Soldados: ${p.soldiers?.length || 0}</div>
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
