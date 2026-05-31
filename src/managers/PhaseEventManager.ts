/**
 * PhaseEventManager
 *
 * Manages scheduled phase events ("avisos") and the auto-generated reports that
 * are produced every time the day/night phase advances.
 *
 * Data is stored in world settings under `guard-management.phaseEventsData`
 * following the standard manager pattern (Map-like in-memory state, sync reads,
 * async writes).
 */

import type { DayNightPhase } from '../types/entities';
import type {
  EventCategory,
  EventVisibility,
  PhaseEvent,
  PhaseEventRecurrence,
  PhaseEventsData,
  PhaseReport,
  PhaseReportEntry,
} from '../types/phaseEvents';
import { EVENT_CATEGORY_ICONS } from '../types/phaseEvents';

export interface CreatePhaseEventInput {
  title: string;
  description?: string;
  triggerTurn: number;
  visibility?: EventVisibility;
  category?: EventCategory;
  recurrence?: PhaseEventRecurrence;
  rollTableId?: string;
  notifyChat?: boolean;
  linkedId?: string;
}

export interface ReportSearchFilters {
  text?: string;
  category?: EventCategory | 'sistema';
  visibility?: 'players' | 'gm';
  turnFrom?: number;
  turnTo?: number;
}

export interface EventSearchFilters {
  text?: string;
  category?: EventCategory;
  visibility?: EventVisibility;
  status?: PhaseEvent['status'];
  turnFrom?: number;
  turnTo?: number;
}

export class PhaseEventManager {
  private events: Map<string, PhaseEvent> = new Map();
  private reports: Map<number, PhaseReport> = new Map();

  public async initialize(): Promise<void> {
    await this.loadFromSettings();
    console.log(
      `PhaseEventManager | Initialized: ${this.events.size} events, ${this.reports.size} reports`
    );
  }

  // --- Persistence ---

  public async loadFromSettings(): Promise<void> {
    try {
      const stored = game?.settings?.get(
        'guard-management',
        'phaseEventsData' as any
      ) as PhaseEventsData | null;
      this.events.clear();
      this.reports.clear();
      if (stored && typeof stored === 'object') {
        if (Array.isArray(stored.events)) {
          for (const e of stored.events) this.events.set(e.id, this._migrateEvent(e));
        }
        if (Array.isArray(stored.reports)) {
          for (const r of stored.reports) this.reports.set(r.turn, r);
        }
      }
    } catch (e) {
      console.warn('PhaseEventManager | loadFromSettings failed:', e);
    }
  }

  private _migrateEvent(e: PhaseEvent): PhaseEvent {
    if (!e.recurrence) e.recurrence = { mode: 'none' };
    if (typeof e.notifyChat !== 'boolean') e.notifyChat = true;
    if (!e.category) e.category = 'aviso';
    if (!e.visibility) e.visibility = 'all';
    if (!e.status) e.status = 'pending';
    if (typeof e.version !== 'number') e.version = 1;
    return e;
  }

  private async _saveToSettingsAsync(): Promise<void> {
    try {
      if (!game?.ready) return;
      const data: PhaseEventsData = {
        events: Array.from(this.events.values()),
        reports: Array.from(this.reports.values()).sort((a, b) => a.turn - b.turn),
      };
      await game?.settings?.set('guard-management', 'phaseEventsData' as any, data);
    } catch (error) {
      console.error('PhaseEventManager | Error saving:', error);
    }
  }

  private _emit(): void {
    window.dispatchEvent(new CustomEvent('guard-phase-events-updated'));
  }

  // --- Event CRUD ---

  public getAllEvents(): PhaseEvent[] {
    return Array.from(this.events.values()).sort((a, b) => {
      if (a.triggerTurn !== b.triggerTurn) return a.triggerTurn - b.triggerTurn;
      return a.createdAt - b.createdAt;
    });
  }

  public getEvent(id: string): PhaseEvent | null {
    return this.events.get(id) || null;
  }

  public getPendingEvents(): PhaseEvent[] {
    return this.getAllEvents().filter((e) => e.status === 'pending');
  }

  public async createEvent(input: CreatePhaseEventInput): Promise<PhaseEvent> {
    const id = foundry.utils.randomID();
    const now = Date.now();
    const event: PhaseEvent = {
      id,
      title: (input.title || '').trim() || 'Aviso',
      description: input.description || '',
      triggerTurn: Math.max(1, Math.floor(input.triggerTurn || 1)),
      visibility: input.visibility || 'all',
      category: input.category || 'aviso',
      status: 'pending',
      recurrence: input.recurrence || { mode: 'none' },
      rollTableId: input.rollTableId,
      notifyChat: input.notifyChat !== false,
      linkedId: input.linkedId,
      createdBy: (game as any)?.user?.name || 'Unknown',
      createdAt: now,
      updatedAt: now,
      firedAt: null,
      version: 1,
    };
    this.events.set(id, event);
    await this._saveToSettingsAsync();
    this._emit();
    return event;
  }

  public async updateEvent(id: string, updates: Partial<PhaseEvent>): Promise<PhaseEvent | null> {
    const event = this.events.get(id);
    if (!event) return null;
    const updated: PhaseEvent = {
      ...event,
      ...updates,
      id: event.id,
      createdAt: event.createdAt,
      updatedAt: Date.now(),
      version: event.version + 1,
    };
    this.events.set(id, updated);
    await this._saveToSettingsAsync();
    this._emit();
    return updated;
  }

  public async cancelEvent(id: string): Promise<PhaseEvent | null> {
    return this.updateEvent(id, { status: 'cancelled' });
  }

  public async deleteEvent(id: string): Promise<boolean> {
    const deleted = this.events.delete(id);
    if (deleted) {
      await this._saveToSettingsAsync();
      this._emit();
    }
    return deleted;
  }

  /** Delete a single entry from a phase report by its id. scope: 'player' | 'gm' | 'any' */
  public async deleteReportEntry(
    turn: number,
    entryId: string,
    scope: 'player' | 'gm' | 'any' = 'any'
  ): Promise<boolean> {
    const report = this.reports.get(turn);
    if (!report) return false;
    const filterOut = (arr: PhaseReportEntry[]) => arr.filter((e) => e.id !== entryId);
    if (scope === 'player' || scope === 'any') report.playerEntries = filterOut(report.playerEntries);
    if (scope === 'gm' || scope === 'any') report.gmEntries = filterOut(report.gmEntries);
    await this._saveToSettingsAsync();
    this._emit();
    return true;
  }

  // --- Reports access ---

  public getAllReports(): PhaseReport[] {
    return Array.from(this.reports.values()).sort((a, b) => b.turn - a.turn);
  }

  public getReport(turn: number): PhaseReport | null {
    return this.reports.get(turn) || null;
  }

  /** Player-facing view: only player entries from all reports */
  public getPlayerVisibleReports(): PhaseReport[] {
    return this.getAllReports()
      .map((r) => ({ ...r, gmEntries: [] as PhaseReportEntry[] }))
      .filter((r) => r.playerEntries.length > 0);
  }

  public searchReports(filters: ReportSearchFilters): PhaseReport[] {
    const text = (filters.text || '').trim().toLowerCase();
    return this.getAllReports()
      .filter((r) => {
        if (typeof filters.turnFrom === 'number' && r.turn < filters.turnFrom) return false;
        if (typeof filters.turnTo === 'number' && r.turn > filters.turnTo) return false;
        return true;
      })
      .map((r) => {
        const filterEntry = (e: PhaseReportEntry) => {
          if (filters.category && e.category !== filters.category) return false;
          if (text && !e.text.toLowerCase().includes(text)) return false;
          return true;
        };
        const playerEntries =
          filters.visibility === 'gm' ? [] : r.playerEntries.filter(filterEntry);
        const gmEntries =
          filters.visibility === 'players' ? [] : r.gmEntries.filter(filterEntry);
        return { ...r, playerEntries, gmEntries };
      })
      .filter((r) => r.playerEntries.length > 0 || r.gmEntries.length > 0);
  }

  public searchEvents(filters: EventSearchFilters): PhaseEvent[] {
    const text = (filters.text || '').trim().toLowerCase();
    return this.getAllEvents().filter((e) => {
      if (filters.category && e.category !== filters.category) return false;
      if (filters.visibility && e.visibility !== filters.visibility) return false;
      if (filters.status && e.status !== filters.status) return false;
      if (typeof filters.turnFrom === 'number' && e.triggerTurn < filters.turnFrom) return false;
      if (typeof filters.turnTo === 'number' && e.triggerTurn > filters.turnTo) return false;
      if (text) {
        const hay = `${e.title} ${e.description}`.toLowerCase();
        if (!hay.includes(text)) return false;
      }
      return true;
    });
  }

  // --- Phase report generation (called from PhaseManager on advance) ---

  /**
   * Generate the report for `turn`. Idempotent: if a report already exists for
   * the turn it is returned unchanged. GM-only side effects (finances, sentence
   * completions, event firing) run here.
   */
  public async generatePhaseReport(turn: number, phase: DayNightPhase): Promise<PhaseReport | null> {
    if (!(game as any)?.user?.isGM) return this.getReport(turn);
    if (this.reports.has(turn)) return this.reports.get(turn)!;

    const gmEntries: PhaseReportEntry[] = [];
    const playerEntries: PhaseReportEntry[] = [];
    const mkEntry = (e: Omit<PhaseReportEntry, 'id'>): PhaseReportEntry => ({
      id: foundry.utils.randomID(),
      ...e,
    });
    const chatQueue: { event: PhaseEvent; text: string }[] = [];

    const gm = (window as any).GuardManagement;

    // 1. Finances
    try {
      const finance = gm?.financeManager;
      if (finance?.processPhase) {
        await finance.processPhase(turn);
        const histEntry = (finance.getHistory?.() || []).find((h: any) => h.turn === turn);
        if (histEntry) {
          const net = histEntry.net ?? 0;
          gmEntries.push(mkEntry({
            category: 'economico',
            icon: EVENT_CATEGORY_ICONS.economico,
            text: `Finanzas procesadas: ingresos ${histEntry.recurringIncome ?? 0}, gastos ${histEntry.recurringExpenses ?? 0}, neto ${net > 0 ? '+' : ''}${net} (total ${histEntry.totalAfter ?? 0}).`,
          }));
        }
      }
    } catch (e) {
      console.warn('PhaseEventManager | finance processing failed', e);
    }

    // 2. Prisoners
    try {
      const prisoner = gm?.prisonerManager;
      if (prisoner) {
        if (prisoner.logSentenceCompletions) await prisoner.logSentenceCompletions();
        const ready = [
          ...(prisoner.getPrisonersReadyForRelease?.() || []),
          ...(prisoner.getTransferredReadyForRelease?.() || []),
        ];
        if (ready.length > 0) {
          const names = ready.map((p: any) => p.name).join(', ');
          gmEntries.push(mkEntry({
            category: 'prision',
            icon: EVENT_CATEGORY_ICONS.prision,
            text: `${ready.length} prisionero(s) con condena cumplida listos para liberar: ${names}.`,
          }));
        }
        const overcrowded = prisoner.getOvercrowdedCells?.() || [];
        if (overcrowded.length > 0) {
          const total = overcrowded.reduce((s: number, c: any) => s + (c.excess || 0), 0);
          gmEntries.push(mkEntry({
            category: 'prision',
            icon: 'fas fa-triangle-exclamation',
            text: `Hacinamiento: ${overcrowded.length} celda(s) sobrepobladas (${total} preso(s) de exceso).`,
          }));
        }
      }
    } catch (e) {
      console.warn('PhaseEventManager | prisoner processing failed', e);
    }

    // 3. Scheduled events due this turn
    const due = this.getPendingEvents().filter((e) => e.triggerTurn <= turn);
    for (const event of due) {
      try {
        const resolvedText = await this._resolveEventText(event);
        const entry: PhaseReportEntry = mkEntry({
          category: event.category,
          icon: EVENT_CATEGORY_ICONS[event.category] || EVENT_CATEGORY_ICONS.otro,
          text: resolvedText,
          sourceEventId: event.id,
          sourceId: event.linkedId,
        });
        // Visibility routing: players see player+all; gm-only goes to gmEntries
        if (event.visibility === 'gm') {
          gmEntries.push(entry);
        } else {
          playerEntries.push(entry);
        }

        // Mark fired
        event.status = 'fired';
        event.firedAt = Date.now();
        event.updatedAt = Date.now();
        this.events.set(event.id, event);

        // Recurrence: schedule next occurrence
        this._scheduleRecurrence(event, resolvedText);

        if (event.notifyChat) chatQueue.push({ event, text: resolvedText });
      } catch (e) {
        console.warn('PhaseEventManager | failed to fire event', event.id, e);
      }
    }

    const report: PhaseReport = {
      turn,
      phase,
      generatedAt: Date.now(),
      playerEntries,
      gmEntries,
    };
    this.reports.set(turn, report);
    await this._saveToSettingsAsync();
    this._emit();

    // Chat notifications (after save)
    for (const { event, text } of chatQueue) {
      this._postEventChat(event, text, turn);
    }

    window.dispatchEvent(
      new CustomEvent('guard-phase-report-generated', { detail: { turn, report } })
    );

    return report;
  }

  /** Resolve event display text, drawing from a RollTable for random events */
  private async _resolveEventText(event: PhaseEvent): Promise<string> {
    let text = event.title;
    if (event.description) text += ` — ${event.description}`;
    if (event.category === 'aleatorio' && event.rollTableId) {
      try {
        const table = (game as any)?.tables?.get(event.rollTableId);
        if (table?.draw) {
          const result = await table.draw({ displayChat: false });
          const drawn = (result?.results || [])
            .map((r: any) => r.text || r.name || r?.description || '')
            .filter((t: string) => t)
            .join(', ');
          if (drawn) text += ` [Resultado: ${drawn}]`;
        }
      } catch (e) {
        console.warn('PhaseEventManager | RollTable draw failed', e);
      }
    }
    return text;
  }

  /** Create the next occurrence of a recurring event */
  private _scheduleRecurrence(event: PhaseEvent, _resolvedText: string): void {
    const rec = event.recurrence;
    if (!rec || rec.mode === 'none') return;
    const nextTurn = this._nextRecurrenceTurn(event);
    if (nextTurn === null) return;
    if (typeof rec.endTurn === 'number' && rec.endTurn !== null && nextTurn > rec.endTurn) return;

    const id = foundry.utils.randomID();
    const now = Date.now();
    const clone: PhaseEvent = {
      ...event,
      id,
      triggerTurn: nextTurn,
      status: 'pending',
      firedAt: null,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    this.events.set(id, clone);
  }

  private _nextRecurrenceTurn(event: PhaseEvent): number | null {
    const base = event.triggerTurn;
    const rec = event.recurrence;
    switch (rec.mode) {
      case 'everyNTurns': {
        const interval = Math.max(1, Math.floor(rec.interval || 1));
        return base + interval;
      }
      case 'everyDay': {
        // Day phases are odd turns
        let t = base + 1;
        while (t % 2 !== 1) t++;
        return t;
      }
      case 'everyNight': {
        // Night phases are even turns
        let t = base + 1;
        while (t % 2 !== 0) t++;
        return t;
      }
      default:
        return null;
    }
  }

  private _postEventChat(event: PhaseEvent, text: string, turn: number): void {
    try {
      const icon = EVENT_CATEGORY_ICONS[event.category] || EVENT_CATEGORY_ICONS.otro;
      const content = `
        <div class="message-content">
          <div class="daggerheart chat domain-card dh-style">
            <details class="domain-card-move" open>
              <summary class="domain-card-header">
                <div class="domain-label"><h2 class="title"><i class="${icon}"></i> ${event.title}</h2></div>
                <i class="fa-solid fa-chevron-down"></i>
              </summary>
              <div class="description"><p>${event.description || text}</p></div>
            </details>
            <footer class="ability-card-footer">
              <ul class="tags">
                <li class="tag">Turno ${turn}</li>
                <li class="tag">${event.visibility === 'gm' ? 'Solo DM' : event.visibility === 'players' ? 'Jugadores' : 'Todos'}</li>
              </ul>
            </footer>
          </div>
        </div>`;

      const messageData: any = {
        content,
        speaker: { scene: null, actor: null, token: null, alias: 'Gestor de Fases' },
        flags: { 'guard-management': { type: 'phase-event', eventId: event.id, turn } },
      };

      if (event.visibility === 'gm') {
        const gmIds = (game as any)?.users
          ?.filter((u: any) => u.isGM)
          ?.map((u: any) => u.id);
        if (gmIds?.length) messageData.whisper = gmIds;
      }

      (ChatMessage as any).create(messageData);
    } catch (e) {
      console.warn('PhaseEventManager | chat post failed', e);
    }
  }

  public getCounts(): { events: number; pending: number; reports: number } {
    return {
      events: this.events.size,
      pending: this.getPendingEvents().length,
      reports: this.reports.size,
    };
  }
}
