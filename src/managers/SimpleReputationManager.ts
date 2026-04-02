/**
 * Simple Reputation Manager - Manages reputations using game.settings
 * Migrated from Document-based to settings-based storage
 */

import type { Reputation } from '../types/entities';

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
  }): Promise<Reputation> {
    const id = foundry.utils.randomID();
    const now = new Date();

    const reputation: Reputation = {
      id,
      name: data.name,
      description: data.description,
      level: data.level,
      organizationId: data.organizationId,
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

    const updated: Reputation = {
      ...reputation,
      ...updates,
      id: reputation.id,
      version: reputation.version + 1,
    };

    this.reputations.set(id, updated);
    await this._saveToSettingsAsync();

    return updated;
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
