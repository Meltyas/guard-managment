/**
 * PhaseCalendar — navigable calendar showing phase events and reports.
 *
 * Usage:
 *   PhaseCalendar.mount(containerEl)           // embed in tab/dialog
 *   PhaseCalendar.openWindow()                 // singleton floating GuardModal
 *   PhaseCalendar.rerender()                   // refresh all mounted instances
 *   PhaseCalendar.showEventDialog(id?, turn?)  // create/edit event form
 */

import { GuardModal } from '../GuardModal.js';
import type { EventCategory, PhaseEvent, PhaseReport } from '../../types/phaseEvents.js';
import {
  EVENT_CATEGORIES,
  EVENT_CATEGORY_ICONS,
  EVENT_CATEGORY_LABELS,
  EVENT_VISIBILITY_LABELS,
  RECURRENCE_LABELS,
} from '../../types/phaseEvents.js';

const TEMPLATE = 'modules/guard-management/templates/panels/phase-calendar.hbs';
const LS_VIEW_KEY = 'guard-management-phase-calendar-view';

// ── module-level state ───────────────────────────────────────────────────────
type ViewMode = 'agenda' | 'grid';
let viewMode: ViewMode = ((localStorage.getItem(LS_VIEW_KEY) as ViewMode) || 'agenda');
let centerTurn: number | null = null; // null = follow current turn
let filterQuery = '';
let activeCategories: Set<string> = new Set(); // empty = all categories
let onlyEvents = false;

const AGENDA_WINDOW = 12;
const GRID_WINDOW = 20;
const AGENDA_BACK = 3; // past turns shown in agenda

const mountedContainers: Set<HTMLElement> = new Set();
let windowModal: GuardModal | null = null;
let globalListenersRegistered = false;

// ── helpers ──────────────────────────────────────────────────────────────────
function phaseForTurn(turn: number): 'day' | 'night' {
  return turn % 2 === 1 ? 'day' : 'night';
}
function phaseLabel(phase: string): string {
  return phase === 'night' ? 'Noche' : 'Día';
}
function phaseIcon(phase: string): string {
  return phase === 'night' ? 'fas fa-moon' : 'fas fa-sun';
}
function phaseClass(phase: string): string {
  return phase === 'night' ? 'phase-night' : 'phase-day';
}
function relLabel(turn: number, current: number): string {
  const d = turn - current;
  if (d === 0) return 'Ahora';
  if (d < 0) return `Hace ${-d}`;
  return `En ${d}`;
}
function recurrenceLabel(ev: PhaseEvent): string {
  const rec = ev.recurrence;
  if (!rec || rec.mode === 'none') return '';
  if (rec.mode === 'everyNTurns') return `Cada ${Math.max(1, rec.interval || 1)} turnos`;
  return RECURRENCE_LABELS[rec.mode];
}

/** Project ghost occurrences of a recurring event within [startTurn, endTurn] */
function projectGhosts(ev: PhaseEvent, startTurn: number, endTurn: number): number[] {
  const rec = ev.recurrence;
  if (!rec || rec.mode === 'none') return [];
  const ghosts: number[] = [];
  let t = ev.triggerTurn;

  const nextT = (): number | null => {
    switch (rec.mode) {
      case 'everyNTurns': return t + Math.max(1, rec.interval || 1);
      case 'everyDay': { let n = t + 1; while (n % 2 !== 1) n++; return n; }
      case 'everyNight': { let n = t + 1; while (n % 2 !== 0) n++; return n; }
      default: return null;
    }
  };

  let next = nextT();
  while (next !== null && next <= endTurn) {
    if (typeof rec.endTurn === 'number' && rec.endTurn !== null && next > rec.endTurn) break;
    if (next >= startTurn) ghosts.push(next);
    t = next;
    next = nextT();
    if (ghosts.length > 50) break;
  }
  return ghosts;
}

// ── data types ───────────────────────────────────────────────────────────────
interface CalEventItem {
  id: string;
  title: string;
  category: EventCategory;
  icon: string;
  categoryLabel: string;
  visibility: string;
  visibilityLabel: string;
  isGhost: boolean;
  status: string;
  recurrenceLabel: string;
  isPending: boolean;
  searchText: string;
}

interface CalReportData {
  totalCount: number;
  playerEntries: { text: string; icon: string; category: string; searchText: string }[];
  gmEntries: { text: string; icon: string; category: string; searchText: string }[];
}

interface CalPrisonerRelease {
  id: string;
  name: string;
  searchText: string;
}

interface CalCell {
  turn: number;
  phase: string;
  phaseLabel: string;
  phaseIcon: string;
  phaseClass: string;
  isCurrent: boolean;
  isPast: boolean;
  isFuture: boolean;
  turnClass: string;
  relLabel: string;
  events: CalEventItem[];
  prisonerReleases: CalPrisonerRelease[];
  report: CalReportData | null;
  hasEvents: boolean;
  searchAttr: string;
}

// ── data building ─────────────────────────────────────────────────────────────
function buildData() {
  const gm = (window as any).GuardManagement;
  const mgr = gm?.phaseEventManager;
  const phaseMgr = gm?.phaseManager;
  const isGM = !!(game as any)?.user?.isGM;

  const currentTurn: number = phaseMgr?.getCurrentTurn?.() ?? 1;
  const currentPhase: string = phaseMgr?.getCurrentPhase?.() ?? 'day';

  const anchor = centerTurn ?? currentTurn;
  const windowSize = viewMode === 'agenda' ? AGENDA_WINDOW : GRID_WINDOW;
  const startTurn = viewMode === 'agenda'
    ? Math.max(1, anchor - AGENDA_BACK)
    : Math.max(1, anchor - Math.floor(GRID_WINDOW / 2));
  const endTurn = startTurn + windowSize - 1;

  const allEvents: PhaseEvent[] = mgr?.getAllEvents?.() ?? [];
  const allReports: PhaseReport[] = mgr?.getAllReports?.() ?? [];

  // Index real events and ghosts by turn
  const eventsByTurn = new Map<number, CalEventItem[]>();
  const ghostsByTurn = new Map<number, CalEventItem[]>();

  for (const ev of allEvents) {
    const item: CalEventItem = {
      id: ev.id,
      title: ev.title,
      category: ev.category,
      icon: EVENT_CATEGORY_ICONS[ev.category] || EVENT_CATEGORY_ICONS.otro,
      categoryLabel: EVENT_CATEGORY_LABELS[ev.category] || ev.category,
      visibility: ev.visibility,
      visibilityLabel: EVENT_VISIBILITY_LABELS[ev.visibility] || ev.visibility,
      isGhost: false,
      status: ev.status,
      recurrenceLabel: recurrenceLabel(ev),
      isPending: ev.status === 'pending',
      searchText: `${ev.title} ${(ev.description || '').replace(/<[^>]*>/g, '')}`.toLowerCase(),
    };
    const t = ev.triggerTurn;
    if (t >= startTurn && t <= endTurn) {
      if (!eventsByTurn.has(t)) eventsByTurn.set(t, []);
      eventsByTurn.get(t)!.push(item);
    }
    if (ev.status === 'pending' && ev.recurrence?.mode !== 'none') {
      for (const gt of projectGhosts(ev, startTurn, endTurn)) {
        const ghost: CalEventItem = { ...item, id: `ghost-${ev.id}-${gt}`, isGhost: true, isPending: false };
        if (!ghostsByTurn.has(gt)) ghostsByTurn.set(gt, []);
        ghostsByTurn.get(gt)!.push(ghost);
      }
    }
  }

  const reportsByTurn = new Map<number, PhaseReport>();
  for (const r of allReports) {
    if (r.turn >= startTurn && r.turn <= endTurn) reportsByTurn.set(r.turn, r);
  }

  // Prisoner releases (GM-only) — indexed by their release turn
  const prisonerReleasesByTurn = new Map<number, CalPrisonerRelease[]>();
  if (isGM) {
    const prisonerMgr = gm?.prisonerManager;
    const activePrisoners: any[] = prisonerMgr?.getActivePrisoners?.() ?? [];
    for (const p of activePrisoners) {
      // Sentence system: release at sentenceStartPhase + sentencePhases
      let relTurn: number | null = null;
      if (p.sentenceStartPhase !== null && p.sentenceStartPhase !== undefined && p.sentencePhases > 0) {
        relTurn = p.sentenceStartPhase + p.sentencePhases;
      } else if (p.releaseTurn !== null && p.releaseTurn !== undefined && p.releaseTurn > 0) {
        relTurn = p.releaseTurn;
      }
      if (relTurn !== null && relTurn >= startTurn && relTurn <= endTurn) {
        const entry: CalPrisonerRelease = {
          id: p.id,
          name: p.name,
          searchText: `liberación ${(p.name || '').toLowerCase()}`,
        };
        if (!prisonerReleasesByTurn.has(relTurn)) prisonerReleasesByTurn.set(relTurn, []);
        prisonerReleasesByTurn.get(relTurn)!.push(entry);
      }
    }
  }

  const mapEntry = (en: any) => ({
    text: en.text,
    icon: en.icon || EVENT_CATEGORY_ICONS[en.category as EventCategory] || EVENT_CATEGORY_ICONS.otro,
    category: en.category || 'sistema',
    searchText: (en.text || '').toLowerCase(),
  });

  const cells: CalCell[] = [];
  for (let t = startTurn; t <= endTurn; t++) {
    const ph = phaseForTurn(t);
    const evs = [...(eventsByTurn.get(t) || []), ...(ghostsByTurn.get(t) || [])];
    const prisonerReleases = prisonerReleasesByTurn.get(t) ?? [];
    const rep = reportsByTurn.get(t) ?? null;
    const isCurrent = t === currentTurn;
    const isPast = t < currentTurn;
    const isFuture = t > currentTurn;
    const calReport: CalReportData | null = rep ? {
      totalCount: rep.playerEntries.length + (isGM ? rep.gmEntries.length : 0),
      playerEntries: rep.playerEntries.map(mapEntry),
      gmEntries: isGM ? rep.gmEntries.map(mapEntry) : [],
    } : null;
    const turnClass = [isCurrent && 'is-current', isPast && 'is-past', isFuture && 'is-future'].filter(Boolean).join(' ');
    const searchAttr = [
      ...evs.map(e => e.searchText),
      ...prisonerReleases.map(p => p.searchText),
      ...(rep?.playerEntries || []).map(e => (e.text || '').toLowerCase()),
      ...(isGM ? (rep?.gmEntries || []) : []).map((e: any) => (e.text || '').toLowerCase()),
    ].join(' ');
    cells.push({ turn: t, phase: ph, phaseLabel: phaseLabel(ph), phaseIcon: phaseIcon(ph),
      phaseClass: phaseClass(ph), isCurrent, isPast, isFuture, turnClass, relLabel: relLabel(t, currentTurn),
      events: evs, prisonerReleases, report: calReport,
      hasEvents: evs.length > 0 || prisonerReleases.length > 0, searchAttr });
  }

  const categories = EVENT_CATEGORIES.map(c => ({
    value: c, label: EVENT_CATEGORY_LABELS[c], active: activeCategories.has(c),
  }));

  return {
    isGM, isAgenda: viewMode === 'agenda', isGrid: viewMode === 'grid',
    currentTurn, currentPhaseLabel: phaseLabel(currentPhase), currentPhaseIcon: phaseIcon(currentPhase),
    pendingCount: allEvents.filter(e => e.status === 'pending').length,
    filterQuery, onlyEvents, allActive: activeCategories.size === 0,
    categories, cells, isFollowing: centerTurn === null,
    startTurn, endTurn,
  };
}

// ── DOM filtering (preserves focus, no rerender) ──────────────────────────────
function applyFilters(container: HTMLElement): void {
  const q = filterQuery.trim().toLowerCase();
  const showAllCats = activeCategories.size === 0;

  container.querySelectorAll<HTMLElement>('.cal-agenda-cell, .cal-grid-cell').forEach(cell => {
    let visibleEvents = 0;
    cell.querySelectorAll<HTMLElement>('.cal-event, .cal-grid-event').forEach(ev => {
      const matchesCat = showAllCats || activeCategories.has(ev.dataset.category || '');
      const matchesQ = !q || (ev.dataset.search || '').includes(q);
      const show = matchesCat && matchesQ;
      ev.style.display = show ? '' : 'none';
      if (show) visibleEvents++;
    });
    // Prisoner release rows always visible (GM-only, not category-filtered)
    cell.querySelectorAll<HTMLElement>('.cal-prisoner-release').forEach(el => {
      const matchesQ = !q || (el.dataset.search || '').includes(q);
      el.style.display = matchesQ ? '' : 'none';
      if (matchesQ) visibleEvents++;
    });

    let visibleEntries = 0;
    cell.querySelectorAll<HTMLElement>('.cal-rep-entry').forEach(entry => {
      const cat = entry.dataset.category || '';
      const matchesCat = showAllCats || activeCategories.has(cat) || cat === 'sistema';
      const matchesQ = !q || (entry.dataset.search || '').includes(q);
      const show = matchesCat && matchesQ;
      entry.style.display = show ? '' : 'none';
      if (show) visibleEntries++;
    });

    const hasContent = visibleEvents > 0 || visibleEntries > 0;
    const isCurrent = cell.classList.contains('is-current');
    if (onlyEvents && !hasContent && !isCurrent) {
      cell.style.display = 'none';
    } else {
      cell.style.display = '';
    }
  });

  // Sync toggle active state
  container.querySelectorAll<HTMLElement>('.cal-toggle').forEach(btn => {
    const f = btn.dataset.filter || '';
    if (f === 'all') btn.classList.toggle('active', activeCategories.size === 0 && !onlyEvents);
    else if (f === 'only-events') btn.classList.toggle('active', onlyEvents);
    else btn.classList.toggle('active', activeCategories.has(f));
  });
}

// ── render ────────────────────────────────────────────────────────────────────
async function renderInto(container: HTMLElement): Promise<void> {
  const data = buildData();
  const html = await (foundry as any).applications.handlebars.renderTemplate(TEMPLATE, data);
  container.innerHTML = html;
  attachListeners(container);
  applyFilters(container);
}

// ── event listeners ───────────────────────────────────────────────────────────
function attachListeners(container: HTMLElement): void {
  const $c = $(container);

  // Navigation
  $c.off('click', '[data-action="prev"]').on('click', '[data-action="prev"]', () => {
    const ws = viewMode === 'agenda' ? AGENDA_WINDOW : GRID_WINDOW;
    const cur = (window as any).GuardManagement?.phaseManager?.getCurrentTurn?.() ?? 1;
    centerTurn = Math.max(1, (centerTurn ?? cur) - Math.floor(ws / 2));
    PhaseCalendar.rerender();
  });

  $c.off('click', '[data-action="next"]').on('click', '[data-action="next"]', () => {
    const ws = viewMode === 'agenda' ? AGENDA_WINDOW : GRID_WINDOW;
    const cur = (window as any).GuardManagement?.phaseManager?.getCurrentTurn?.() ?? 1;
    centerTurn = (centerTurn ?? cur) + Math.floor(ws / 2);
    PhaseCalendar.rerender();
  });

  $c.off('click', '[data-action="today"]').on('click', '[data-action="today"]', () => {
    centerTurn = null;
    PhaseCalendar.rerender();
  });

  // Jump to turn (Enter key)
  $c.off('keydown', '.cal-jump-input').on('keydown', '.cal-jump-input', ev => {
    (ev as any).stopPropagation();
    if ((ev as any).key === 'Enter') {
      const val = parseInt(((ev.currentTarget) as HTMLInputElement).value, 10);
      if (val >= 1) { centerTurn = val; PhaseCalendar.rerender(); }
    }
  });
  $c.off('keyup', '.cal-jump-input').on('keyup', '.cal-jump-input', ev => (ev as any).stopPropagation());

  // View toggle
  $c.off('click', '[data-action="toggle-view"]').on('click', '[data-action="toggle-view"]', () => {
    viewMode = viewMode === 'agenda' ? 'grid' : 'agenda';
    localStorage.setItem(LS_VIEW_KEY, viewMode);
    PhaseCalendar.rerender();
  });

  // Add event (GM)
  $c.off('click', '[data-action="add-event"]').on('click', '[data-action="add-event"]', async () => {
    await PhaseCalendar.showEventDialog();
  });
  $c.off('click', '[data-action="add-event-turn"]').on('click', '[data-action="add-event-turn"]', async ev => {
    const turn = parseInt((ev.currentTarget as HTMLElement).dataset.turn || '0', 10);
    await PhaseCalendar.showEventDialog(undefined, turn || undefined);
  });

  // Edit / cancel event
  $c.off('click', '.cal-event-edit').on('click', '.cal-event-edit', async ev => {
    (ev as any).stopPropagation();
    const id = (ev.currentTarget as HTMLElement).dataset.eventId;
    if (id) await PhaseCalendar.showEventDialog(id);
  });
  $c.off('click', '.cal-event-cancel').on('click', '.cal-event-cancel', async ev => {
    (ev as any).stopPropagation();
    const id = (ev.currentTarget as HTMLElement).dataset.eventId;
    if (id) await (window as any).GuardManagement?.phaseEventManager?.cancelEvent(id);
  });

  // Grid cell click → edit (GM, non-ghost)
  $c.off('click', '.cal-grid-event').on('click', '.cal-grid-event', async ev => {
    const el = ev.currentTarget as HTMLElement;
    if (el.dataset.ghost === 'true') return;
    const id = el.dataset.eventId;
    if (id && !!(game as any)?.user?.isGM) await PhaseCalendar.showEventDialog(id);
  });

  // Search
  $c.off('input', '.cal-search-input').on('input', '.cal-search-input', ev => {
    filterQuery = (ev.currentTarget as HTMLInputElement).value;
    applyFilters(container);
  });
  $c.off('keydown', '.cal-search-input').on('keydown', '.cal-search-input', ev => (ev as any).stopPropagation());
  $c.off('keyup', '.cal-search-input').on('keyup', '.cal-search-input', ev => (ev as any).stopPropagation());

  // Category + onlyEvents toggles
  $c.off('click', '.cal-toggle').on('click', '.cal-toggle', ev => {
    const f = (ev.currentTarget as HTMLElement).dataset.filter || 'all';
    if (f === 'all') { activeCategories.clear(); onlyEvents = false; }
    else if (f === 'only-events') { onlyEvents = !onlyEvents; }
    else { activeCategories.has(f) ? activeCategories.delete(f) : activeCategories.add(f); }
    applyFilters(container);
  });
}

// ── global event listeners (registered once) ──────────────────────────────────
function registerGlobalListeners(): void {
  if (globalListenersRegistered) return;
  globalListenersRegistered = true;
  const rerender = () => PhaseCalendar.rerender();
  window.addEventListener('guard-phase-events-updated', rerender);
  window.addEventListener('guard-phase-report-generated', rerender);
  window.addEventListener('guard-phase-advanced', rerender);
}

// ── public API ────────────────────────────────────────────────────────────────
export class PhaseCalendar {
  /** Embed the calendar into `container`. Registers global listeners on first call. */
  static async mount(container: HTMLElement): Promise<void> {
    registerGlobalListeners();
    mountedContainers.add(container);
    await renderInto(container);
  }

  /** Re-render all mounted containers that are still in the DOM. */
  static async rerender(): Promise<void> {
    for (const c of [...mountedContainers]) {
      if (!document.body.contains(c)) { mountedContainers.delete(c); continue; }
      await renderInto(c);
    }
  }

  /**
   * Open (or bring to front) the calendar as a floating GuardModal.
   * Only one window is ever open at a time (singleton).
   */
  static openWindow(): void {
    if (windowModal && document.body.contains(windowModal.element)) {
      windowModal.element.dispatchEvent(new MouseEvent('mousedown'));
      return;
    }
    windowModal = GuardModal.open({
      title: 'Calendario de la Guardia',
      icon: 'fas fa-calendar-alt',
      body: '<div class="phase-calendar-window-body" style="min-height:300px"></div>',
      width: 580,
      showFooter: false,
      onSave: async () => true,
      onRender: (bodyEl) => {
        PhaseCalendar.mount(bodyEl);
      },
      onClose: () => { windowModal = null; },
    });
  }

  /** Open the create/edit event form (delegates to PhaseEventsPanel). */
  static async showEventDialog(eventId?: string, prefillTurn?: number): Promise<void> {
    const { PhaseEventsPanel } = await import('./PhaseEventsPanel.js');
    await PhaseEventsPanel.showEventDialog(eventId, prefillTurn);
  }
}
