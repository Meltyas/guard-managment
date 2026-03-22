/**
 * POI Manager - Manages People of Interest using game.settings
 * History is stored per-POI, not as a global log.
 */
import type { PersonOfInterest, PoiAction, PoiHistoryEntry, PoiStatus } from '../types/poi';

export class PoiManager {
  private pois: Map<string, PersonOfInterest> = new Map();

  public async initialize(): Promise<void> {
    await this.loadFromSettings();
    console.log('PoiManager | Initialized');
  }

  // --- Settings persistence ---

  public async loadFromSettings(): Promise<void> {
    try {
      const pois = game?.settings?.get('guard-management', 'poi' as any) as
        | PersonOfInterest[]
        | null;
      if (pois && Array.isArray(pois)) {
        this.pois.clear();
        for (const p of pois) {
          // Migration: ensure arrays/fields exist
          if (!p.history) p.history = [];
          if (!Array.isArray(p.possibleCrimes)) p.possibleCrimes = [];
          if (!Array.isArray(p.gangIds)) p.gangIds = [];
          if (typeof p.notes !== 'string') p.notes = '';
          if (!p.status) p.status = 'active';
          this.pois.set(p.id, p);
        }
        console.log(`PoiManager | Loaded ${pois.length} POIs from settings`);
      }
    } catch (e) {
      console.warn('PoiManager | loadFromSettings failed:', e);
    }
  }

  private async _saveToSettingsAsync(): Promise<void> {
    try {
      if (!game?.ready) return;
      const data = Array.from(this.pois.values());
      await game?.settings?.set('guard-management', 'poi' as any, data);
      console.log(`PoiManager | Saved ${data.length} POIs to settings`);
    } catch (error) {
      console.error('PoiManager | Error saving POIs:', error);
    }
  }

  // --- Helpers ---

  private getUserName(): string {
    return (game as any)?.user?.name || 'Unknown';
  }

  private addHistoryEntry(poi: PersonOfInterest, action: PoiAction, details?: string): void {
    const gm = (window as any).GuardManagement;
    const currentTurn = gm?.phaseManager?.getCurrentTurn() ?? undefined;
    const entry: PoiHistoryEntry = {
      action,
      timestamp: Date.now(),
      performedBy: this.getUserName(),
      details,
      phase: currentTurn,
    };
    poi.history.push(entry);
  }

  public async removeHistoryEntry(poiId: string, timestamp: number): Promise<boolean> {
    const poi = this.pois.get(poiId);
    if (!poi) return false;
    const idx = poi.history.findIndex((e) => e.timestamp === timestamp);
    if (idx === -1) return false;
    poi.history.splice(idx, 1);
    poi.updatedAt = Date.now();
    this.pois.set(poiId, poi);
    await this._saveToSettingsAsync();
    return true;
  }

  // --- CRUD ---

  public getAllPois(): PersonOfInterest[] {
    return Array.from(this.pois.values());
  }

  public getActivePois(): PersonOfInterest[] {
    return this.getAllPois().filter((p) => p.status === 'active');
  }

  public getPoi(id: string): PersonOfInterest | null {
    return this.pois.get(id) || null;
  }

  public searchPois(query: string): PersonOfInterest[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.getAllPois();
    return this.getAllPois().filter((p) => p.name.toLowerCase().includes(q));
  }

  public getCount(): number {
    return this.pois.size;
  }

  public async addPoi(data: {
    name: string;
    img?: string;
    actorId?: string;
    notes?: string;
  }): Promise<PersonOfInterest> {
    const id = foundry.utils.randomID();
    const now = Date.now();
    const poi: PersonOfInterest = {
      id,
      name: data.name,
      actorId: data.actorId,
      img: data.img,
      notes: data.notes || '',
      possibleCrimes: [],
      gangIds: [],
      status: 'active',
      history: [],
      createdAt: now,
      updatedAt: now,
    };
    this.addHistoryEntry(poi, 'created', `"${data.name}" registrado como persona de interés`);
    this.pois.set(id, poi);
    await this._saveToSettingsAsync();
    return poi;
  }

  public async updatePoi(
    id: string,
    updates: Partial<PersonOfInterest>
  ): Promise<PersonOfInterest | null> {
    const poi = this.pois.get(id);
    if (!poi) return null;
    const updated: PersonOfInterest = {
      ...poi,
      ...updates,
      id: poi.id,
      history: poi.history,
      updatedAt: Date.now(),
    };
    this.pois.set(id, updated);
    await this._saveToSettingsAsync();
    return updated;
  }

  public async deletePoi(id: string): Promise<boolean> {
    const deleted = this.pois.delete(id);
    if (deleted) {
      await this._saveToSettingsAsync();
    }
    return deleted;
  }

  // --- Notes ---

  public async updateNotes(id: string, notes: string): Promise<PersonOfInterest | null> {
    const poi = this.pois.get(id);
    if (!poi) return null;
    this.addHistoryEntry(poi, 'notes_updated', 'Notas actualizadas');
    poi.notes = notes;
    poi.updatedAt = Date.now();
    this.pois.set(id, poi);
    await this._saveToSettingsAsync();
    return poi;
  }

  // --- Status changes ---

  public async changeStatus(id: string, newStatus: PoiStatus): Promise<PersonOfInterest | null> {
    const poi = this.pois.get(id);
    if (!poi) return null;
    const oldStatus = poi.status;
    if (oldStatus === newStatus) return poi;
    poi.status = newStatus;
    this.addHistoryEntry(poi, 'status_changed', `Estado: ${oldStatus} → ${newStatus}`);
    poi.updatedAt = Date.now();
    this.pois.set(id, poi);
    await this._saveToSettingsAsync();
    return poi;
  }

  // --- Crime management ---

  public async addCrime(id: string, crimeId: string): Promise<PersonOfInterest | null> {
    const poi = this.pois.get(id);
    if (!poi) return null;
    if (poi.possibleCrimes.includes(crimeId)) return poi;
    poi.possibleCrimes.push(crimeId);
    const gm = (window as any).GuardManagement;
    const crime = gm?.crimeManager?.getCrime(crimeId);
    this.addHistoryEntry(poi, 'crime_added', `Crimen añadido: ${crime?.name || crimeId}`);
    poi.updatedAt = Date.now();
    this.pois.set(id, poi);
    await this._saveToSettingsAsync();
    return poi;
  }

  public async removeCrime(id: string, crimeId: string): Promise<PersonOfInterest | null> {
    const poi = this.pois.get(id);
    if (!poi) return null;
    const gm = (window as any).GuardManagement;
    const crime = gm?.crimeManager?.getCrime(crimeId);
    poi.possibleCrimes = poi.possibleCrimes.filter((c) => c !== crimeId);
    this.addHistoryEntry(poi, 'crime_removed', `Crimen removido: ${crime?.name || crimeId}`);
    poi.updatedAt = Date.now();
    this.pois.set(id, poi);
    await this._saveToSettingsAsync();
    return poi;
  }

  // --- Gang membership ---

  public async addGang(id: string, gangId: string): Promise<PersonOfInterest | null> {
    const poi = this.pois.get(id);
    if (!poi) return null;
    if (poi.gangIds.includes(gangId)) return poi;
    poi.gangIds.push(gangId);
    const gm = (window as any).GuardManagement;
    const gang = gm?.gangManager?.getGang(gangId);
    this.addHistoryEntry(poi, 'gang_added', `Banda añadida: ${gang?.name || gangId}`);
    poi.updatedAt = Date.now();
    this.pois.set(id, poi);
    await this._saveToSettingsAsync();
    return poi;
  }

  public async removeGang(id: string, gangId: string): Promise<PersonOfInterest | null> {
    const poi = this.pois.get(id);
    if (!poi) return null;
    const gm = (window as any).GuardManagement;
    const gang = gm?.gangManager?.getGang(gangId);
    poi.gangIds = poi.gangIds.filter((g) => g !== gangId);
    this.addHistoryEntry(poi, 'gang_removed', `Banda removida: ${gang?.name || gangId}`);
    poi.updatedAt = Date.now();
    this.pois.set(id, poi);
    await this._saveToSettingsAsync();
    return poi;
  }

  // --- Actor linking ---

  public async linkActor(
    id: string,
    actorId: string,
    img?: string
  ): Promise<PersonOfInterest | null> {
    const poi = this.pois.get(id);
    if (!poi) return null;
    poi.actorId = actorId;
    if (img) poi.img = img;
    const actor = (game as any)?.actors?.get(actorId);
    this.addHistoryEntry(poi, 'actor_linked', `Actor vinculado: ${actor?.name || actorId}`);
    poi.updatedAt = Date.now();
    this.pois.set(id, poi);
    await this._saveToSettingsAsync();
    return poi;
  }
}
