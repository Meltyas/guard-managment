/**
 * Simple Reputation Manager - Manages reputations using game.settings
 * Migrated from Document-based to settings-based storage
 */

import type { Reputation, ReputationChangelogEntry, FactionRelation, ReputationFavor } from '../types/entities';

/** Campos que NO se registran en el changelog (metadatos internos) */
const CHANGELOG_SKIP_FIELDS = new Set([
  'id', 'version', 'createdAt', 'updatedAt', 'changelog', 'organizationId',
]);

/** Etiquetas legibles para los campos de una reputación */
const FIELD_LABELS: Record<string, string> = {
  name: 'Nombre',
  description: 'Descripción',
  level: 'Nivel',
  image: 'Imagen',
  faction: 'Facción',
  trend: 'Tendencia',
  category: 'Categoría',
  contact: 'Contacto',
  gmNotes: 'Notas GM',
  hidden: 'Visibilidad',
  favors: 'Favores',
  factionRelations: 'Relaciones',
};

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

function fieldValue(key: string, val: unknown): string {
  if (val === undefined || val === null) return '—';
  if (key === 'hidden') return val ? 'oculta' : 'visible';
  if (Array.isArray(val)) return `(${(val as unknown[]).length} entradas)`;
  return String(val);
}

function buildChanges(
  before: Reputation,
  updates: Partial<Reputation>
): { field: string; from: string; to: string }[] {
  const changes: { field: string; from: string; to: string }[] = [];
  for (const key of Object.keys(updates)) {
    if (CHANGELOG_SKIP_FIELDS.has(key)) continue;
    const from = fieldValue(key, (before as any)[key]);
    const to = fieldValue(key, (updates as any)[key]);
    if (from !== to) {
      changes.push({ field: fieldLabel(key), from, to });
    }
  }
  return changes;
}

export class SimpleReputationManager {
  private reputations: Map<string, Reputation> = new Map();

  public async initialize(): Promise<void> {
    await this.loadFromSettings();
  }

  /**
   * Load reputations from world settings (public for onChange callback)
   */
  public async loadFromSettings(): Promise<void> {
    try {
      const reputations = game?.settings?.get(
        'guard-management',
        'reputations'
      ) as Reputation[] | null;
      if (reputations && Array.isArray(reputations)) {
        this.reputations.clear();
        for (const r of reputations) {
          this.reputations.set(r.id, r);
        }
        console.log(
          `SimpleReputationManager | Loaded ${reputations.length} reputations from settings`
        );
      }
    } catch (e) {
      console.warn('SimpleReputationManager | loadFromSettings failed:', e);
    }
  }

  /**
   * Save reputations to world settings
   */
  private async _saveToSettingsAsync(): Promise<void> {
    try {
      // Don't save if game is not ready yet
      if (!game?.ready) {
        console.log('SimpleReputationManager | Skipping save - game not ready yet');
        return;
      }

      const data = Array.from(this.reputations.values());
      await game?.settings?.set('guard-management', 'reputations', data);
      console.log(`SimpleReputationManager | Saved ${data.length} reputations to settings`);
    } catch (error) {
      console.error('SimpleReputationManager | Error saving reputations:', error);
    }
  }

  /**
   * Create a new reputation
   */
  public async createReputation(data: {
    name: string;
    description: string;
    level: number;
    organizationId: string;
    image?: string;
    faction?: string;
    trend?: string;
    category?: string;
    contact?: string;
    gmNotes?: string;
    factionRelations?: FactionRelation[];
    favors?: ReputationFavor[];
  }): Promise<Reputation> {
    const id = foundry.utils.randomID();
    const now = new Date();

    const reputation: Reputation = {
      id,
      name: data.name,
      description: data.description,
      level: data.level,
      organizationId: data.organizationId,
      image: data.image,
      faction: data.faction,
      trend: data.trend as any,
      category: data.category as any,
      contact: data.contact,
      gmNotes: data.gmNotes,
      factionRelations: data.factionRelations ?? [],
      favors: data.favors ?? [],
      hidden: true,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    this.reputations.set(id, reputation);
    await this._saveToSettingsAsync();

    return reputation;
  }

  /**
   * Get a reputation by ID
   */
  public getReputation(id: string): Reputation | null {
    return this.reputations.get(id) || null;
  }

  /**
   * Get all reputations
   */
  public getAllReputations(): Reputation[] {
    return Array.from(this.reputations.values());
  }

  /**
   * Get reputations for an organization
   */
  public getReputationsByOrganization(organizationId: string): Reputation[] {
    return this.getAllReputations().filter((r) => r.organizationId === organizationId);
  }

  /**
   * Update an existing reputation
   */
  public async updateReputation(
    id: string,
    updates: Partial<Reputation>
  ): Promise<Reputation | null> {
    const reputation = this.reputations.get(id);
    if (!reputation) return null;

    // Build changelog entry
    const changes = buildChanges(reputation, updates);
    const existingLog: ReputationChangelogEntry[] = reputation.changelog ?? [];
    const newLog = existingLog;
    if (changes.length > 0) {
      const entry: ReputationChangelogEntry = {
        id: foundry.utils.randomID(),
        timestamp: Date.now(),
        userId: (game as any)?.user?.id ?? '',
        userName: (game as any)?.user?.name ?? 'Desconocido',
        changes,
      };
      newLog.unshift(entry); // más reciente primero
    }

    const updated: Reputation = {
      ...reputation,
      ...updates,
      id: reputation.id,
      changelog: newLog,
      version: reputation.version + 1,
    };

    this.reputations.set(id, updated);
    await this._saveToSettingsAsync();

    return updated;
  }

  /**
   * Delete a single changelog entry from a reputation (GM only)
   */
  public async deleteReputationLogEntry(
    reputationId: string,
    entryId: string
  ): Promise<boolean> {
    const rep = this.reputations.get(reputationId);
    if (!rep) return false;
    const log = rep.changelog ?? [];
    const filtered = log.filter((e) => e.id !== entryId);
    if (filtered.length === log.length) return false;
    const updated: Reputation = { ...rep, changelog: filtered };
    this.reputations.set(reputationId, updated);
    await this._saveToSettingsAsync();
    return true;
  }

  /**
   * Delete a reputation
   */
  public async deleteReputation(id: string): Promise<boolean> {
    const deleted = this.reputations.delete(id);
    if (deleted) {
      await this._saveToSettingsAsync();
    }
    return deleted;
  }
}
