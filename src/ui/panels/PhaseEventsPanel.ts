/**
 * PhaseEventsPanel - "Fases" tab.
 * Manages scheduled phase events (avisos) and browses generated phase reports,
 * with a combined search box and category filtering.
 */

import { ConfirmService } from '../../utils/services/ConfirmService.js';
import { NotificationService } from '../../utils/services/NotificationService.js';
import { GuardModal } from '../GuardModal.js';
import type {
  EventCategory,
  EventVisibility,
  PhaseEvent,
  PhaseReport,
  RecurrenceMode,
} from '../../types/phaseEvents.js';
import {
  EVENT_CATEGORIES,
  EVENT_CATEGORY_ICONS,
  EVENT_CATEGORY_LABELS,
  EVENT_VISIBILITIES,
  EVENT_VISIBILITY_LABELS,
  RECURRENCE_LABELS,
} from '../../types/phaseEvents.js';

const STATUS_LABELS: Record<PhaseEvent['status'], string> = {
  pending: 'Pendiente',
  fired: 'Disparado',
  cancelled: 'Cancelado',
};

function phaseLabel(phase: string): string {
  return phase === 'night' ? 'Noche' : 'Día';
}
function phaseIcon(phase: string): string {
  return phase === 'night' ? 'fas fa-moon' : 'fas fa-sun';
}

function recurrenceLabel(ev: PhaseEvent): string {
  const rec = ev.recurrence;
  if (!rec || rec.mode === 'none') return '';
  if (rec.mode === 'everyNTurns') return `Cada ${Math.max(1, rec.interval || 1)} turnos`;
  return RECURRENCE_LABELS[rec.mode];
}

export class PhaseEventsPanel {
  static get template() {
    return 'modules/guard-management/templates/panels/phase-events.hbs';
  }

  static async getData() {
    const gm = (window as any).GuardManagement;
    const mgr = gm?.phaseEventManager;
    const phaseMgr = gm?.phaseManager;
    if (!mgr) {
      return {
        currentTurn: 1,
        phaseLabel: 'Día',
        phaseIcon: 'fas fa-sun',
        pendingCount: 0,
        reportCount: 0,
        categories: [],
        events: [],
        reports: [],
      };
    }

    const currentTurn = phaseMgr?.getCurrentTurn?.() ?? 1;
    const currentPhase = phaseMgr?.getCurrentPhase?.() ?? 'day';

    const events = (mgr.getAllEvents() as PhaseEvent[]).map((e) => ({
      id: e.id,
      title: e.title,
      description: (e.description || '').replace(/<[^>]*>/g, ''),
      triggerTurn: e.triggerTurn,
      category: e.category,
      visibility: e.visibility,
      status: e.status,
      icon: EVENT_CATEGORY_ICONS[e.category] || EVENT_CATEGORY_ICONS.otro,
      categoryLabel: EVENT_CATEGORY_LABELS[e.category] || e.category,
      visibilityLabel: EVENT_VISIBILITY_LABELS[e.visibility] || e.visibility,
      statusLabel: STATUS_LABELS[e.status] || e.status,
      recurrenceLabel: recurrenceLabel(e),
      isPending: e.status === 'pending',
      searchText: `${e.title} ${e.description}`.toLowerCase(),
    }));

    const reports = (mgr.getAllReports() as PhaseReport[]).map((r, idx) => {
      const mapEntry = (en: any) => ({
        text: en.text,
        icon: en.icon || EVENT_CATEGORY_ICONS[en.category as EventCategory] || EVENT_CATEGORY_ICONS.otro,
        category: en.category,
        searchText: (en.text || '').toLowerCase(),
      });
      const playerEntries = (r.playerEntries || []).map(mapEntry);
      const gmEntries = (r.gmEntries || []).map(mapEntry);
      return {
        turn: r.turn,
        phaseLabel: phaseLabel(r.phase),
        phaseIcon: phaseIcon(r.phase),
        playerEntries,
        gmEntries,
        totalEntries: playerEntries.length + gmEntries.length,
        open: idx === 0, // newest report expanded by default
      };
    });

    return {
      currentTurn,
      phaseLabel: phaseLabel(currentPhase),
      phaseIcon: phaseIcon(currentPhase),
      pendingCount: events.filter((e) => e.status === 'pending').length,
      reportCount: reports.length,
      categories: EVENT_CATEGORIES.map((c) => ({ value: c, label: EVENT_CATEGORY_LABELS[c] })),
      events,
      reports,
    };
  }

  static async render(container: HTMLElement) {
    const data = await this.getData();
    const html = await foundry.applications.handlebars.renderTemplate(this.template, data);
    $(container).html(html);
    this.setupEventListeners(container);
  }

  /** Player-facing read-only template */
  static get playerTemplate() {
    return 'modules/guard-management/templates/panels/phase-reports-player.hbs';
  }

  /** Build the view-model for the player-facing reports window */
  static getPlayerData() {
    const gm = (window as any).GuardManagement;
    const mgr = gm?.phaseEventManager;
    const phaseMgr = gm?.phaseManager;
    const currentTurn = phaseMgr?.getCurrentTurn?.() ?? 1;
    const currentPhase = phaseMgr?.getCurrentPhase?.() ?? 'day';
    const isGM = !!(game as any)?.user?.isGM;

    const visible: PhaseReport[] = mgr?.getPlayerVisibleReports?.() ?? [];
    const reports = visible.map((r, idx) => {
      const playerEntries = (r.playerEntries || []).map((en: any) => ({
        text: en.text,
        icon:
          en.icon || EVENT_CATEGORY_ICONS[en.category as EventCategory] || EVENT_CATEGORY_ICONS.otro,
      }));
      return {
        turn: r.turn,
        phaseLabel: phaseLabel(r.phase),
        phaseIcon: phaseIcon(r.phase),
        playerEntries,
        totalEntries: playerEntries.length,
        open: idx === 0,
      };
    });

    const pendingEvents = isGM
      ? (mgr?.getPendingEvents?.() ?? []).map((e: any) => ({
          id: e.id,
          title: e.title,
          description: (e.description || '').replace(/<[^>]*>/g, ''),
          triggerTurn: e.triggerTurn,
          visibility: e.visibility,
          category: e.category,
          icon: EVENT_CATEGORY_ICONS[e.category as EventCategory] || EVENT_CATEGORY_ICONS.otro,
          categoryLabel: EVENT_CATEGORY_LABELS[e.category as EventCategory] || e.category,
          visibilityLabel: EVENT_VISIBILITY_LABELS[e.visibility as EventVisibility] || e.visibility,
          recurrenceLabel: recurrenceLabel(e),
        }))
      : [];

    return {
      currentTurn,
      phaseLabel: phaseLabel(currentPhase),
      phaseIcon: phaseIcon(currentPhase),
      reportCount: reports.length,
      reports,
      isGM,
      pendingEvents,
    };
  }

  /** Render the player-facing reports HTML string */
  static async renderPlayerReports(): Promise<string> {
    const data = this.getPlayerData();
    return foundry.applications.handlebars.renderTemplate(this.playerTemplate, data);
  }

  /** Attach GM interaction listeners to the player dialog DOM element */
  static attachPlayerDialogListeners(bodyEl: HTMLElement) {
    const $body = $(bodyEl);

    $body.off('click', '.phases-add-btn').on('click', '.phases-add-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      await this.showEventDialog();
    });

    $body.off('click', '.phase-event-edit-btn').on('click', '.phase-event-edit-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = (ev.currentTarget as HTMLElement).dataset.eventId;
      if (id) await this.showEventDialog(id);
    });

    $body.off('click', '.phase-event-cancel-btn').on('click', '.phase-event-cancel-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = (ev.currentTarget as HTMLElement).dataset.eventId;
      if (!id) return;
      const gm = (window as any).GuardManagement;
      await gm.phaseEventManager.cancelEvent(id);
      NotificationService.info('Evento cancelado');
    });
  }

  private static refresh() {
    const gm = (window as any).GuardManagement;
    gm?.guardDialogManager?.customInfoDialog?.refreshPhasesPanel?.();
  }

  // --- Listeners ---

  private static setupEventListeners(container: HTMLElement) {
    const $html = $(container);

    $html.off('input', '.phases-search-input').on('input', '.phases-search-input', (ev) => {
      this.applyFilters(container, (ev.currentTarget as HTMLInputElement).value);
    });
    $html.off('keydown', '.phases-search-input').on('keydown', '.phases-search-input', (ev) => ev.stopPropagation());
    $html.off('keyup', '.phases-search-input').on('keyup', '.phases-search-input', (ev) => ev.stopPropagation());

    $html.off('click', '.phases-toggle').on('click', '.phases-toggle', (ev) => {
      ev.preventDefault();
      const btn = ev.currentTarget as HTMLElement;
      const filter = btn.dataset.filter || 'all';
      if (filter === 'all') {
        container.querySelectorAll('.phases-toggle').forEach((el) => el.classList.remove('active'));
        btn.classList.add('active');
      } else {
        btn.classList.toggle('active');
        container.querySelector('.phases-toggle[data-filter="all"]')?.classList.remove('active');
        const anyActive = container.querySelector('.phases-toggle.active:not([data-filter="all"])');
        if (!anyActive) container.querySelector('.phases-toggle[data-filter="all"]')?.classList.add('active');
      }
      const query = (container.querySelector('.phases-search-input') as HTMLInputElement)?.value || '';
      this.applyFilters(container, query);
    });

    $html.off('click', '.phases-add-btn').on('click', '.phases-add-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      await this.showEventDialog();
    });

    $html.off('click', '.phase-event-edit-btn').on('click', '.phase-event-edit-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = (ev.currentTarget as HTMLElement).dataset.eventId;
      if (id) await this.showEventDialog(id);
    });

    $html.off('click', '.phase-event-cancel-btn').on('click', '.phase-event-cancel-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = (ev.currentTarget as HTMLElement).dataset.eventId;
      if (!id) return;
      const gm = (window as any).GuardManagement;
      await gm.phaseEventManager.cancelEvent(id);
      NotificationService.info('Evento cancelado');
      this.refresh();
    });

    $html.off('click', '.phase-event-delete-btn').on('click', '.phase-event-delete-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const el = ev.currentTarget as HTMLElement;
      const id = el.dataset.eventId!;
      const title = el.dataset.eventTitle || 'este evento';
      const confirmed = await ConfirmService.confirm({
        title: 'Eliminar Evento',
        html: `<p>¿Eliminar el evento "<strong>${title}</strong>"?</p>`,
      });
      if (!confirmed) return;
      const gm = (window as any).GuardManagement;
      await gm.phaseEventManager.deleteEvent(id);
      NotificationService.info('Evento eliminado');
      this.refresh();
    });
  }

  // --- Filtering (DOM-based) ---

  private static getActiveCategories(container: HTMLElement): Set<string> {
    const set = new Set<string>();
    container.querySelectorAll('.phases-toggle.active').forEach((el) => {
      const f = (el as HTMLElement).dataset.filter;
      if (f) set.add(f);
    });
    return set;
  }

  private static applyFilters(container: HTMLElement, query: string) {
    const q = query.trim().toLowerCase();
    const cats = this.getActiveCategories(container);
    const showAll = cats.has('all') || cats.size === 0;

    // Events
    container.querySelectorAll('.phase-event-row').forEach((row) => {
      const el = row as HTMLElement;
      const cat = el.dataset.category || '';
      const search = el.dataset.search || '';
      const matchesCat = showAll || cats.has(cat);
      const matchesQuery = !q || search.includes(q);
      el.style.display = matchesCat && matchesQuery ? '' : 'none';
    });

    // Reports: filter entries, hide empty groups/reports
    container.querySelectorAll('.phase-report').forEach((reportEl) => {
      const report = reportEl as HTMLElement;
      let visibleInReport = 0;
      report.querySelectorAll('.report-group').forEach((groupEl) => {
        const group = groupEl as HTMLElement;
        let visibleInGroup = 0;
        group.querySelectorAll('.report-entry').forEach((entryEl) => {
          const entry = entryEl as HTMLElement;
          const cat = entry.dataset.category || '';
          const search = entry.dataset.search || '';
          const matchesCat = showAll || cats.has(cat) || cat === 'sistema';
          const matchesQuery = !q || search.includes(q);
          const show = matchesCat && matchesQuery;
          entry.style.display = show ? '' : 'none';
          if (show) visibleInGroup++;
        });
        group.style.display = visibleInGroup > 0 ? '' : 'none';
        visibleInReport += visibleInGroup;
      });
      // When filtering is active, hide reports with no matches
      const filtering = !!q || !showAll;
      report.style.display = filtering && visibleInReport === 0 ? 'none' : '';
    });
  }

  // --- Create / Edit dialog ---

  private static buildRollTableOptions(selectedId?: string): string {
    const tables = (game as any)?.tables?.contents || [];
    const opts = tables
      .map(
        (t: any) =>
          `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${t.name}</option>`
      )
      .join('');
    return `<option value="">— Ninguna —</option>${opts}`;
  }

  static async showEventDialog(eventId?: string, prefillTurn?: number): Promise<void> {
    const gm = (window as any).GuardManagement;
    const mgr = gm?.phaseEventManager;
    if (!mgr) return;

    const existing: PhaseEvent | null = eventId ? mgr.getEvent(eventId) : null;
    const currentTurn = gm?.phaseManager?.getCurrentTurn?.() ?? 1;
    const defaultTurn = existing?.triggerTurn ?? prefillTurn ?? currentTurn + 1;

    const catOptions = EVENT_CATEGORIES.map(
      (c) =>
        `<option value="${c}" ${existing?.category === c ? 'selected' : ''}>${EVENT_CATEGORY_LABELS[c]}</option>`
    ).join('');
    const visOptions = EVENT_VISIBILITIES.map(
      (v) =>
        `<option value="${v}" ${existing?.visibility === v ? 'selected' : ''}>${EVENT_VISIBILITY_LABELS[v]}</option>`
    ).join('');
    const recMode: RecurrenceMode = existing?.recurrence?.mode || 'none';
    const recOptions = (Object.keys(RECURRENCE_LABELS) as RecurrenceMode[])
      .map((m) => `<option value="${m}" ${recMode === m ? 'selected' : ''}>${RECURRENCE_LABELS[m]}</option>`)
      .join('');

    const plainDesc = (existing?.description || '').replace(/<[^>]*>/g, '');
    const interval = existing?.recurrence?.interval ?? 2;
    const endTurn = existing?.recurrence?.endTurn ?? '';
    const notifyChecked = existing ? existing.notifyChat : true;

    const body = `
      <div class="guard-modal-form">
        <div class="guard-modal-row">
          <label for="pe-title"><i class="fas fa-heading"></i> Título</label>
          <input type="text" id="pe-title" value="${(existing?.title || '').replace(/"/g, '&quot;')}" placeholder="Ej: Ataque al cuartel" />
        </div>
        <div class="guard-modal-row guard-modal-row-2">
          <div>
            <label for="pe-turn"><i class="fas fa-hourglass-half"></i> Turno de disparo</label>
            <input type="number" id="pe-turn" min="1" step="1" value="${defaultTurn}" />
          </div>
          <div>
            <label for="pe-visibility"><i class="fas fa-eye"></i> Visibilidad</label>
            <select id="pe-visibility">${visOptions}</select>
          </div>
        </div>
        <div class="guard-modal-row guard-modal-row-2">
          <div>
            <label for="pe-category"><i class="fas fa-tag"></i> Categoría</label>
            <select id="pe-category">${catOptions}</select>
          </div>
          <div>
            <label for="pe-recurrence"><i class="fas fa-repeat"></i> Recurrencia</label>
            <select id="pe-recurrence">${recOptions}</select>
          </div>
        </div>
        <div class="guard-modal-row guard-modal-row-2" id="pe-recurrence-extra" style="${recMode === 'none' ? 'display:none;' : ''}">
          <div id="pe-interval-wrap" style="${recMode === 'everyNTurns' ? '' : 'display:none;'}">
            <label for="pe-interval"><i class="fas fa-arrows-left-right-to-line"></i> Intervalo (turnos)</label>
            <input type="number" id="pe-interval" min="1" step="1" value="${interval}" />
          </div>
          <div>
            <label for="pe-endturn"><i class="fas fa-flag-checkered"></i> Hasta turno (opcional)</label>
            <input type="number" id="pe-endturn" min="1" step="1" value="${endTurn}" placeholder="Sin límite" />
          </div>
        </div>
        <div class="guard-modal-row" id="pe-rolltable-wrap" style="${existing?.category === 'aleatorio' ? '' : 'display:none;'}">
          <label for="pe-rolltable"><i class="fas fa-dice"></i> Tabla aleatoria (RollTable)</label>
          <select id="pe-rolltable">${this.buildRollTableOptions(existing?.rollTableId)}</select>
        </div>
        <div class="guard-modal-row">
          <label for="pe-description"><i class="fas fa-align-left"></i> Descripción</label>
          <textarea id="pe-description" rows="3" placeholder="Detalles del evento...">${plainDesc}</textarea>
        </div>
        <div class="guard-modal-row guard-modal-checkbox-row">
          <label for="pe-notify"><input type="checkbox" id="pe-notify" ${notifyChecked ? 'checked' : ''} /> <i class="fas fa-comment"></i> Anunciar en el chat al dispararse</label>
        </div>
      </div>
    `;

    GuardModal.open({
      title: existing ? `Editar: ${existing.title}` : 'Programar Evento',
      icon: existing ? 'fas fa-edit' : 'fas fa-calendar-plus',
      body,
      width: 520,
      saveLabel: 'Guardar',
      onRender: (bodyEl) => {
        const recSelect = bodyEl.querySelector('#pe-recurrence') as HTMLSelectElement;
        const extra = bodyEl.querySelector('#pe-recurrence-extra') as HTMLElement;
        const intervalWrap = bodyEl.querySelector('#pe-interval-wrap') as HTMLElement;
        recSelect?.addEventListener('change', () => {
          const mode = recSelect.value;
          extra.style.display = mode === 'none' ? 'none' : '';
          intervalWrap.style.display = mode === 'everyNTurns' ? '' : 'none';
        });
        const catSelect = bodyEl.querySelector('#pe-category') as HTMLSelectElement;
        const rtWrap = bodyEl.querySelector('#pe-rolltable-wrap') as HTMLElement;
        catSelect?.addEventListener('change', () => {
          rtWrap.style.display = catSelect.value === 'aleatorio' ? '' : 'none';
        });
        (bodyEl.querySelector('#pe-title') as HTMLInputElement)?.focus();
      },
      onSave: async (bodyEl) => {
        const title = (bodyEl.querySelector('#pe-title') as HTMLInputElement)?.value?.trim();
        if (!title) {
          NotificationService.warn('El título es obligatorio');
          return false;
        }
        const triggerTurn = parseInt((bodyEl.querySelector('#pe-turn') as HTMLInputElement)?.value || '1', 10) || 1;
        const visibility = (bodyEl.querySelector('#pe-visibility') as HTMLSelectElement)?.value as EventVisibility;
        const category = (bodyEl.querySelector('#pe-category') as HTMLSelectElement)?.value as EventCategory;
        const mode = (bodyEl.querySelector('#pe-recurrence') as HTMLSelectElement)?.value as RecurrenceMode;
        const interval = parseInt((bodyEl.querySelector('#pe-interval') as HTMLInputElement)?.value || '2', 10) || 2;
        const endRaw = (bodyEl.querySelector('#pe-endturn') as HTMLInputElement)?.value?.trim();
        const endTurn = endRaw ? parseInt(endRaw, 10) : null;
        const rollTableId = (bodyEl.querySelector('#pe-rolltable') as HTMLSelectElement)?.value || undefined;
        const description = (bodyEl.querySelector('#pe-description') as HTMLTextAreaElement)?.value?.trim() || '';
        const notifyChat = (bodyEl.querySelector('#pe-notify') as HTMLInputElement)?.checked ?? true;

        const recurrence = { mode, interval, endTurn };

        if (existing) {
          await mgr.updateEvent(existing.id, {
            title,
            description,
            triggerTurn,
            visibility,
            category,
            recurrence,
            rollTableId: category === 'aleatorio' ? rollTableId : undefined,
            notifyChat,
          });
          NotificationService.info('Evento actualizado');
        } else {
          await mgr.createEvent({
            title,
            description,
            triggerTurn,
            visibility,
            category,
            recurrence,
            rollTableId: category === 'aleatorio' ? rollTableId : undefined,
            notifyChat,
          });
          NotificationService.info('Evento programado');
        }
        this.refresh();
      },
    });
  }
}
