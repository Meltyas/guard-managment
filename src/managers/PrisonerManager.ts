/**
 * Prisoner Manager - Manages prisoners using game.settings
 * History is stored per-prisoner, not as a global log.
 */
import type { Prisoner, PrisonConfig, PrisonerAction, PrisonerHistoryEntry } from '../types/entities';

export class PrisonerManager {
  private prisoners: Map<string, Prisoner> = new Map();
  private config: PrisonConfig = { cellCount: 4 };

  public async initialize(): Promise<void> {
    await this.loadFromSettings();
    await this.loadConfigFromSettings();
    console.log('PrisonerManager | Initialized');
  }

  // --- Settings persistence ---

  public async loadFromSettings(): Promise<void> {
    try {
      const prisoners = game?.settings?.get('guard-management', 'prisoners' as any) as Prisoner[] | null;
      if (prisoners && Array.isArray(prisoners)) {
        this.prisoners.clear();
        for (const p of prisoners) {
          // Migration: ensure history array exists
          if (!p.history) p.history = [];
          // Migration: ensure crimes is an array (was string in older versions)
          if (!Array.isArray(p.crimes)) p.crimes = [];
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
      const config = game?.settings?.get('guard-management', 'prisonConfig' as any) as PrisonConfig | null;
      if (config) {
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
    const entry: PrisonerHistoryEntry = {
      action,
      timestamp: Date.now(),
      performedBy: this.getUserName(),
      details,
    };
    prisoner.history.push(entry);
  }

  // --- CRUD ---

  public getAllPrisoners(): Prisoner[] {
    return Array.from(this.prisoners.values());
  }

  public getActivePrisoners(): Prisoner[] {
    return this.getAllPrisoners().filter(p => p.status === 'imprisoned' || p.status === 'forced_labor');
  }

  public getPrisoner(id: string): Prisoner | null {
    return this.prisoners.get(id) || null;
  }

  public getPrisonerByCell(cellIndex: number): Prisoner | null {
    return this.getActivePrisoners().find(p => p.cellIndex === cellIndex) || null;
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

  // --- Prison Config ---

  public getCellCount(): number {
    return this.config.cellCount;
  }

  public async setCellCount(count: number): Promise<void> {
    this.config.cellCount = Math.max(1, Math.min(20, count));
    await this._saveConfigToSettings();
  }
}
