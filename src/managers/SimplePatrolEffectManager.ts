/**
 * Simple Patrol Effect Manager - Manages patrol effect templates using game.settings
 * Migrated from Document-based to settings-based storage
 */

import type { PatrolEffect } from '../types/entities';

export class SimplePatrolEffectManager {
  private effects: Map<string, PatrolEffect> = new Map();

  public async initialize(): Promise<void> {
    await this.loadFromSettings();
  }

  /**
   * Load effects from world settings (public for onChange callback)
   */
  public async loadFromSettings(): Promise<void> {
    try {
      const effects = game?.settings?.get('guard-management', 'patrolEffects') as
        | PatrolEffect[]
        | null;
      if (effects && Array.isArray(effects)) {
        this.effects.clear();
        for (const e of effects) {
          this.effects.set(e.id, e);
        }
        console.log(
          `SimplePatrolEffectManager | Loaded ${effects.length} patrol effects from settings`
        );
      }
    } catch (e) {
      console.warn('SimplePatrolEffectManager | loadFromSettings failed:', e);
    }
  }

  /**
   * Save effects to world settings
   */
  private async _saveToSettingsAsync(): Promise<void> {
    try {
      if (!game?.ready) return;
      const data = Array.from(this.effects.values());
      await game?.settings?.set('guard-management', 'patrolEffects', data);
      console.log(`SimplePatrolEffectManager | Saved ${data.length} patrol effects to settings`);
    } catch (error) {
      console.error('SimplePatrolEffectManager | Error saving patrol effects:', error);
    }
  }

  /**
   * Create a new patrol effect
   */
  public async createEffect(data: Partial<PatrolEffect>): Promise<PatrolEffect> {
    const id = foundry.utils.randomID();

    const effect: PatrolEffect = {
      id,
      name: data.name || 'New Patrol Effect',
      description: data.description || '',
      type: data.type || 'neutral',
      image: data.image || '',
      targetPatrolId: data.targetPatrolId || '',
      statModifications: data.statModifications || [],
      version: 1,
    };

    this.effects.set(id, effect);
    await this._saveToSettingsAsync();

    return effect;
  }

  /**
   * Get an effect by ID
   */
  public getEffect(id: string): PatrolEffect | null {
    return this.effects.get(id) || null;
  }

  /**
   * Get all effects
   */
  public getAllEffects(): PatrolEffect[] {
    return Array.from(this.effects.values());
  }

  /**
   * Update an existing effect
   */
  public async updateEffect(
    id: string,
    updates: Partial<PatrolEffect>
  ): Promise<PatrolEffect | null> {
    const effect = this.effects.get(id);
    if (!effect) return null;

    const updated: PatrolEffect = {
      ...effect,
      ...updates,
      id: effect.id,
      version: effect.version + 1,
    };

    this.effects.set(id, updated);
    await this._saveToSettingsAsync();

    return updated;
  }

  /**
   * Delete an effect
   */
  public async deleteEffect(id: string): Promise<boolean> {
    const deleted = this.effects.delete(id);
    if (deleted) {
      await this._saveToSettingsAsync();
    }
    return deleted;
  }
}
