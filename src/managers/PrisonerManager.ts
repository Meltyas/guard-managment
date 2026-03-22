/**
 * Prisoner Manager - Manages prisoners using game.settings
 * History is stored per-prisoner, not as a global log.
 */
import type {
  PrisonConfig,
  Prisoner,
  PrisonerAction,
  PrisonerHistoryEntry,
} from '../types/entities';

export class PrisonerManager {
  private prisoners: Map<string, Prisoner> = new Map();
  private config: PrisonConfig = { cellCount: 4, cellCapacity: 1 };

  public async initialize(): Promise<void> {
    await this.loadFromSettings();
    await this.loadConfigFromSettings();
    console.log('PrisonerManager | Initialized');
  }

  // --- Settings persistence ---

  public async loadFromSettings(): Promise<void> {
    try {
      const prisoners = game?.settings?.get('guard-management', 'prisoners' as any) as
        | Prisoner[]
        | null;
      if (prisoners && Array.isArray(prisoners)) {
        this.prisoners.clear();
        for (const p of prisoners) {
          // Migration: ensure history array exists
          if (!p.history) p.history = [];
          // Migration: ensure crimes is an array (was string in older versions)
          if (!Array.isArray(p.crimes)) p.crimes = [];
          // Migration: ensure sentence tracking fields exist
          if (typeof p.sentencePhases !== 'number') p.sentencePhases = 0;
          if (p.sentenceStartPhase === undefined) p.sentenceStartPhase = null;
          // Migration: convert legacy releaseTurn to sentence system
          if (p.releaseTurn !== null && p.releaseTurn > 0 && p.sentencePhases === 0) {
            p.sentenceStartPhase = 1;
            p.sentencePhases = Math.max(0, p.releaseTurn - 1);
            p.releaseTurn = null;
          }
          this.prisoners.set(p.id, p);
        }
        console.log(`PrisonerManager | Loaded ${prisoners.length} prisoners from settings`);
      }
    } catch (e) {
      console.warn('PrisonerManager | loadFromSettings failed:', e);
    }
  }

  public async loadConfigFromSettings(): Promise<void> {
    try {
      const config = game?.settings?.get(
        'guard-management',
        'prisonConfig' as any
      ) as PrisonConfig | null;
      if (config) {
        // Migration: ensure cellCapacity exists
        if (typeof config.cellCapacity !== 'number') config.cellCapacity = 1;
        this.config = config;
      }
    } catch (e) {
      console.warn('PrisonerManager | loadConfigFromSettings failed:', e);
    }
  }

  private async _saveToSettingsAsync(): Promise<void> {
    try {
      if (!game?.ready) return;
      const data = Array.from(this.prisoners.values());
      await game?.settings?.set('guard-management', 'prisoners' as any, data);
      console.log(`PrisonerManager | Saved ${data.length} prisoners to settings`);
    } catch (error) {
      console.error('PrisonerManager | Error saving prisoners:', error);
    }
  }

  private async _saveConfigToSettings(): Promise<void> {
    try {
      if (!game?.ready) return;
      await game?.settings?.set('guard-management', 'prisonConfig' as any, this.config);
    } catch (error) {
      console.error('PrisonerManager | Error saving prison config:', error);
    }
  }

  // --- Helpers ---

  private getUserName(): string {
    return (game as any)?.user?.name || 'Unknown';
  }

  private addHistoryEntry(prisoner: Prisoner, action: PrisonerAction, details?: string): void {
    const gm = (window as any).GuardManagement;
    const currentTurn = gm?.phaseManager?.getCurrentTurn() ?? undefined;
    const entry: PrisonerHistoryEntry = {
      action,
      timestamp: Date.now(),
      performedBy: this.getUserName(),
      details,
      phase: currentTurn,
    };
    prisoner.history.push(entry);
  }

  public async removeHistoryEntry(prisonerId: string, timestamp: number): Promise<boolean> {
    const prisoner = this.prisoners.get(prisonerId);
    if (!prisoner) return false;
    const idx = prisoner.history.findIndex((e) => e.timestamp === timestamp);
    if (idx === -1) return false;
    prisoner.history.splice(idx, 1);
    prisoner.updatedAt = Date.now();
    this.prisoners.set(prisonerId, prisoner);
    await this._saveToSettingsAsync();
    return true;
  }

  // --- CRUD ---

  public getAllPrisoners(): Prisoner[] {
    return Array.from(this.prisoners.values());
  }

  public getActivePrisoners(): Prisoner[] {
    return this.getAllPrisoners().filter(
      (p) => p.status === 'imprisoned' || p.status === 'forced_labor'
    );
  }

  public getPrisoner(id: string): Prisoner | null {
    return this.prisoners.get(id) || null;
  }

  public getPrisonersByCell(cellIndex: number): Prisoner[] {
    return this.getActivePrisoners().filter((p) => p.cellIndex === cellIndex);
  }

  public async addPrisoner(data: {
    actorId: string;
    tokenId?: string;
    name: string;
    img?: string;
    cellIndex: number;
    notes?: string;
    releaseTurn?: number | null;
    crimes?: string;
  }): Promise<Prisoner> {
    const id = foundry.utils.randomID();
    const now = Date.now();
    const prisoner: Prisoner = {
      id,
      actorId: data.actorId,
      tokenId: data.tokenId,
      name: data.name,
      img: data.img,
      cellIndex: data.cellIndex,
      notes: data.notes || '',
      releaseTurn: data.releaseTurn ?? null,
      sentencePhases: 0,
      sentenceStartPhase: null,
      crimes: Array.isArray(data.crimes) ? data.crimes : [],
      status: 'imprisoned',
      history: [],
      createdAt: now,
      updatedAt: now,
    };
    this.addHistoryEntry(prisoner, 'entered', `Ingresado en celda ${data.cellIndex + 1}`);
    this.prisoners.set(id, prisoner);
    await this._saveToSettingsAsync();
    return prisoner;
  }

  public async updatePrisoner(id: string, updates: Partial<Prisoner>): Promise<Prisoner | null> {
    const prisoner = this.prisoners.get(id);
    if (!prisoner) return null;
    const updated: Prisoner = {
      ...prisoner,
      ...updates,
      id: prisoner.id,
      history: prisoner.history,
      updatedAt: Date.now(),
    };
    this.prisoners.set(id, updated);
    await this._saveToSettingsAsync();
    return updated;
  }

  public async removePrisoner(id: string): Promise<boolean> {
    const deleted = this.prisoners.delete(id);
    if (deleted) {
      await this._saveToSettingsAsync();
    }
    return deleted;
  }

  // --- Notes & Turn updates (with history) ---

  public async updateNotes(id: string, notes: string): Promise<Prisoner | null> {
    const prisoner = this.prisoners.get(id);
    if (!prisoner) return null;
    this.addHistoryEntry(prisoner, 'notes_updated', 'Notas actualizadas');
    prisoner.notes = notes;
    prisoner.updatedAt = Date.now();
    this.prisoners.set(id, prisoner);
    await this._saveToSettingsAsync();
    return prisoner;
  }

  public async updateReleaseTurn(id: string, releaseTurn: number | null): Promise<Prisoner | null> {
    const prisoner = this.prisoners.get(id);
    if (!prisoner) return null;
    const oldTurn = prisoner.releaseTurn;
    let detail: string;
    if (oldTurn !== null && releaseTurn !== null) {
      detail = `Cambiado turnos de ${oldTurn} a ${releaseTurn}`;
    } else if (releaseTurn !== null) {
      detail = `Cambiado turnos a ${releaseTurn}`;
    } else {
      detail = 'Turno de liberación eliminado';
    }
    this.addHistoryEntry(prisoner, 'release_turn_updated', detail);
    prisoner.releaseTurn = releaseTurn;
    prisoner.updatedAt = Date.now();
    this.prisoners.set(id, prisoner);
    await this._saveToSettingsAsync();
    return prisoner;
  }

  // --- Status changes ---

  public async releasePrisoner(id: string): Promise<Prisoner | null> {
    const prisoner = this.prisoners.get(id);
    if (!prisoner) return null;
    this.addHistoryEntry(prisoner, 'released');
    prisoner.status = 'released';
    prisoner.sentencePhases = 0;
    prisoner.sentenceStartPhase = null;
    prisoner.releaseTurn = null;
    prisoner.updatedAt = Date.now();
    this.prisoners.set(id, prisoner);
    await this._saveToSettingsAsync();
    return prisoner;
  }

  public async sendToForcedLabor(id: string): Promise<Prisoner | null> {
    const prisoner = this.prisoners.get(id);
    if (!prisoner) return null;
    this.addHistoryEntry(prisoner, 'forced_labor');
    prisoner.status = 'forced_labor';
    prisoner.updatedAt = Date.now();
    this.prisoners.set(id, prisoner);
    await this._saveToSettingsAsync();
    return prisoner;
  }

  public async transferToPrison(id: string): Promise<Prisoner | null> {
    const prisoner = this.prisoners.get(id);
    if (!prisoner) return null;
    this.addHistoryEntry(prisoner, 'transferred_to_prison');
    prisoner.status = 'transferred_to_prison';
    prisoner.updatedAt = Date.now();
    this.prisoners.set(id, prisoner);
    await this._saveToSettingsAsync();
    return prisoner;
  }

  public async sendToDeathRow(id: string): Promise<Prisoner | null> {
    const prisoner = this.prisoners.get(id);
    if (!prisoner) return null;
    this.addHistoryEntry(prisoner, 'sent_to_death_row');
    prisoner.status = 'death_row';
    prisoner.updatedAt = Date.now();
    this.prisoners.set(id, prisoner);
    await this._saveToSettingsAsync();
    return prisoner;
  }

  public async executePrisoner(id: string): Promise<Prisoner | null> {
    const prisoner = this.prisoners.get(id);
    if (!prisoner) return null;
    this.addHistoryEntry(prisoner, 'executed');
    prisoner.status = 'executed';
    prisoner.updatedAt = Date.now();
    this.prisoners.set(id, prisoner);
    await this._saveToSettingsAsync();
    return prisoner;
  }

  public async returnToCell(id: string, cellIndex: number): Promise<Prisoner | null> {
    const prisoner = this.prisoners.get(id);
    if (!prisoner) return null;
    this.addHistoryEntry(prisoner, 'entered', `Devuelto a celda ${cellIndex + 1}`);
    prisoner.status = 'imprisoned';
    prisoner.cellIndex = cellIndex;
    prisoner.updatedAt = Date.now();
    this.prisoners.set(id, prisoner);
    await this._saveToSettingsAsync();
    return prisoner;
  }

  // --- Crime assignment ---

  public async assignCrime(id: string, crimeId: string): Promise<Prisoner | null> {
    const prisoner = this.prisoners.get(id);
    if (!prisoner) return null;
    if (!Array.isArray(prisoner.crimes)) prisoner.crimes = [];
    if (prisoner.crimes.includes(crimeId)) return prisoner; // already assigned
    prisoner.crimes.push(crimeId);
    prisoner.updatedAt = Date.now();
    this.prisoners.set(id, prisoner);
    await this._saveToSettingsAsync();
    return prisoner;
  }

  public async removeCrime(id: string, crimeId: string): Promise<Prisoner | null> {
    const prisoner = this.prisoners.get(id);
    if (!prisoner) return null;
    if (!Array.isArray(prisoner.crimes)) prisoner.crimes = [];
    prisoner.crimes = prisoner.crimes.filter((c) => c !== crimeId);
    prisoner.updatedAt = Date.now();
    this.prisoners.set(id, prisoner);
    await this._saveToSettingsAsync();
    return prisoner;
  }

  // --- Sentence tracking ---

  /**
   * Apply sentence phases to a prisoner.
   * First sentence sets sentenceStartPhase to current turn.
   * Additional sentences accumulate onto sentencePhases.
   */
  public async applySentence(id: string, phases: number): Promise<Prisoner | null> {
    const prisoner = this.prisoners.get(id);
    if (!prisoner || phases <= 0) return null;

    const gm = (window as any).GuardManagement;
    const currentTurn = gm?.phaseManager?.getCurrentTurn() ?? 1;

    prisoner.sentenceStartPhase = currentTurn;
    prisoner.sentencePhases = phases;

    prisoner.releaseTurn = null;
    prisoner.updatedAt = Date.now();

    const detail = `Sentencia: ${phases} fases (desde fase ${currentTurn})`;
    this.addHistoryEntry(prisoner, 'sentence_applied', detail);

    this.prisoners.set(id, prisoner);
    await this._saveToSettingsAsync();
    return prisoner;
  }

  /**
   * Compute remaining sentence phases for a prisoner.
   * If currentTurn < sentenceStartPhase, returns full sentence (time hasn't started).
   */
  public getRemainingPhases(prisoner: Prisoner): number {
    if (!prisoner.sentencePhases || prisoner.sentenceStartPhase === null) return 0;

    const gm = (window as any).GuardManagement;
    const currentTurn = gm?.phaseManager?.getCurrentTurn() ?? 1;

    const elapsed = Math.max(0, currentTurn - prisoner.sentenceStartPhase);
    return Math.max(0, prisoner.sentencePhases - elapsed);
  }

  /**
   * Get active prisoners whose sentence has expired (remaining <= 0).
   */
  public getPrisonersReadyForRelease(): Prisoner[] {
    return this.getActivePrisoners().filter((p) => {
      if (!p.sentencePhases || p.sentenceStartPhase === null) return false;
      return this.getRemainingPhases(p) <= 0;
    });
  }

  /**
   * Get transferred-to-prison prisoners whose sentence has expired.
   */
  public getTransferredReadyForRelease(): Prisoner[] {
    return this.getAllPrisoners().filter((p) => {
      if (p.status !== 'transferred_to_prison') return false;
      if (!p.sentencePhases || p.sentenceStartPhase === null) return false;
      return this.getRemainingPhases(p) <= 0;
    });
  }

  /**
   * Log sentence_completed in history for prisoners who have completed their sentence
   * but don't yet have that entry. Returns how many were logged.
   */
  public async logSentenceCompletions(): Promise<number> {
    const ready = [...this.getPrisonersReadyForRelease(), ...this.getTransferredReadyForRelease()];
    let count = 0;
    for (const prisoner of ready) {
      const alreadyLogged = prisoner.history?.some((e) => e.action === 'sentence_completed');
      if (!alreadyLogged) {
        this.addHistoryEntry(prisoner, 'sentence_completed', 'Sentencia cumplida — pendiente de liberación');
        this.prisoners.set(prisoner.id, prisoner);
        count++;
      }
    }
    if (count > 0) await this._saveToSettingsAsync();
    return count;
  }

  // --- Prison Config ---

  public getCellCount(): number {
    return this.config.cellCount;
  }

  public async setCellCount(count: number): Promise<void> {
    this.config.cellCount = Math.max(1, Math.min(20, count));
    await this._saveConfigToSettings();
  }

  public getCellCapacity(): number {
    return this.config.cellCapacity ?? 1;
  }

  public async setCellCapacity(capacity: number): Promise<void> {
    this.config.cellCapacity = Math.max(1, Math.min(10, capacity));
    await this._saveConfigToSettings();
  }

  public getOvercrowdedCells(): { cellIndex: number; prisoners: Prisoner[]; excess: number }[] {
    const capacity = this.getCellCapacity();
    const result: { cellIndex: number; prisoners: Prisoner[]; excess: number }[] = [];
    for (let i = 0; i < this.config.cellCount; i++) {
      const prisoners = this.getPrisonersByCell(i);
      if (prisoners.length > capacity) {
        result.push({ cellIndex: i, prisoners, excess: prisoners.length - capacity });
      }
    }
    return result;
  }
}
