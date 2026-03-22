/**
 * CrimeManager - Manages crime catalog using game.settings
 * Follows SimpleResourceManager pattern
 */

import type { Crime, OffenseType } from '../types/crimes';
import { OFFENSE_SEVERITY } from '../types/crimes';

export class CrimeManager {
  private crimes: Map<string, Crime> = new Map();

  public async initialize(): Promise<void> {
    await this.loadFromSettings();
  }

  /**
   * Load crimes from world settings (public for onChange callback)
   */
  public async loadFromSettings(): Promise<void> {
    try {
      const crimes = game?.settings?.get('guard-management', 'crimes' as any) as Crime[] | null;
      if (crimes && Array.isArray(crimes)) {
        this.crimes.clear();
        for (const c of crimes) {
          // Migration: ensure description and customSentence exist
          if (!c.description) c.description = '';
          if (!c.customSentence) c.customSentence = '';
          this.crimes.set(c.id, c);
        }
        console.log(`CrimeManager | Loaded ${crimes.length} crimes from settings`);
      }
    } catch (e) {
      console.warn('CrimeManager | loadFromSettings failed:', e);
    }
  }

  /**
   * Save crimes to world settings
   */
  private async _saveToSettingsAsync(): Promise<void> {
    try {
      if (!game?.ready) {
        console.log('CrimeManager | Skipping save - game not ready yet');
        return;
      }
      const data = Array.from(this.crimes.values());
      await game?.settings?.set('guard-management', 'crimes' as any, data);
      console.log(`CrimeManager | Saved ${data.length} crimes to settings`);
    } catch (error) {
      console.error('CrimeManager | Error saving crimes:', error);
    }
  }

  /**
   * Create a new crime (checks for duplicate names)
   */
  public async createCrime(
    name: string,
    offenseType: OffenseType,
    description: string = '',
    customSentence: string = ''
  ): Promise<Crime | null> {
    const normalizedName = name.trim().toLowerCase();
    const existing = this.getAllCrimes().find(
      (c) => c.name.trim().toLowerCase() === normalizedName
    );
    if (existing) return null; // duplicate

    const id = foundry.utils.randomID();
    const crime: Crime = {
      id,
      name: name.trim(),
      description,
      offenseType,
      customSentence,
      version: 1,
    };
    this.crimes.set(id, crime);
    await this._saveToSettingsAsync();
    return crime;
  }

  /**
   * Bulk create or update crimes. If a crime with the same name exists, update it.
   * Returns { created: number, updated: number }
   */
  public async bulkUpsertCrimes(
    entries: {
      name: string;
      offenseType: OffenseType;
      description?: string;
      customSentence?: string;
    }[]
  ): Promise<{ created: number; updated: number }> {
    // Build a map of existing crimes by normalized name
    const existingByName = new Map<string, Crime>();
    for (const c of this.crimes.values()) {
      existingByName.set(c.name.trim().toLowerCase(), c);
    }

    let created = 0;
    let updated = 0;
    const seenNames = new Set<string>();

    for (const entry of entries) {
      const normalized = entry.name.trim().toLowerCase();
      if (!normalized || seenNames.has(normalized)) continue;
      seenNames.add(normalized);

      const existing = existingByName.get(normalized);
      if (existing) {
        // Update existing crime
        existing.offenseType = entry.offenseType;
        if (entry.description) existing.description = entry.description;
        if (entry.customSentence) existing.customSentence = entry.customSentence;
        existing.version++;
        this.crimes.set(existing.id, existing);
        updated++;
      } else {
        const id = foundry.utils.randomID();
        const crime: Crime = {
          id,
          name: entry.name.trim(),
          description: entry.description || '',
          offenseType: entry.offenseType,
          customSentence: entry.customSentence || '',
          version: 1,
        };
        this.crimes.set(id, crime);
        existingByName.set(normalized, crime);
        created++;
      }
    }

    if (created > 0 || updated > 0) {
      await this._saveToSettingsAsync();
    }

    return { created, updated };
  }

  /**
   * Get a crime by ID
   */
  public getCrime(id: string): Crime | null {
    return this.crimes.get(id) || null;
  }

  /**
   * Get all crimes sorted by severity (lowest to highest), then alphabetically
   */
  public getAllCrimes(): Crime[] {
    return Array.from(this.crimes.values()).sort((a, b) => {
      const sevDiff = OFFENSE_SEVERITY[a.offenseType] - OFFENSE_SEVERITY[b.offenseType];
      if (sevDiff !== 0) return sevDiff;
      return a.name.localeCompare(b.name, 'es');
    });
  }

  /**
   * Get crimes filtered by offense type
   */
  public getCrimesByType(type: OffenseType): Crime[] {
    return this.getAllCrimes().filter((c) => c.offenseType === type);
  }

  /**
   * Search crimes by name (case-insensitive)
   */
  public searchCrimes(query: string): Crime[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.getAllCrimes();
    return this.getAllCrimes().filter((c) => c.name.toLowerCase().includes(q));
  }

  /**
   * Update an existing crime
   */
  public async updateCrime(id: string, updates: Partial<Crime>): Promise<Crime | null> {
    const crime = this.crimes.get(id);
    if (!crime) return null;

    // Check duplicate name if name is changing
    if (updates.name && updates.name.trim().toLowerCase() !== crime.name.trim().toLowerCase()) {
      const normalizedNew = updates.name.trim().toLowerCase();
      const duplicate = this.getAllCrimes().find(
        (c) => c.id !== id && c.name.trim().toLowerCase() === normalizedNew
      );
      if (duplicate) return null;
    }

    const updated: Crime = {
      ...crime,
      ...updates,
      id: crime.id,
      version: crime.version + 1,
    };

    this.crimes.set(id, updated);
    await this._saveToSettingsAsync();
    return updated;
  }

  /**
   * Delete a crime
   */
  public async deleteCrime(id: string): Promise<boolean> {
    const deleted = this.crimes.delete(id);
    if (deleted) {
      await this._saveToSettingsAsync();
    }
    return deleted;
  }

  /**
   * Get count of crimes
   */
  public getCount(): number {
    return this.crimes.size;
  }
}
