/**
 * Simple Modifier Manager - Manages guard modifiers using game.settings
 * Migrated from Document-based to settings-based storage
 */

import type { GuardModifier } from '../types/entities';

export class SimpleModifierManager {
  private modifiers: Map<string, GuardModifier> = new Map();

  public async initialize(): Promise<void> {
    await this.loadFromSettings();
  }

  /**
   * Load modifiers from world settings (public for onChange callback)
   */
  public async loadFromSettings(): Promise<void> {
    try {
      const modifiers = game?.settings?.get('guard-management', 'modifiers') as
        | GuardModifier[]
        | null;
      if (modifiers && Array.isArray(modifiers)) {
        this.modifiers.clear();
        for (const m of modifiers) {
          this.modifiers.set(m.id, m);
        }
        console.log(`SimpleModifierManager | Loaded ${modifiers.length} modifiers from settings`);
      }
    } catch (e) {
      console.warn('SimpleModifierManager | loadFromSettings failed:', e);
    }
  }

  /**
   * Save modifiers to world settings
   */
  private async _saveToSettingsAsync(): Promise<void> {
    try {
      if (!game?.ready) return;
      const data = Array.from(this.modifiers.values());
      await game?.settings?.set('guard-management', 'modifiers', data);
      console.log(`SimpleModifierManager | Saved ${data.length} modifiers to settings`);
    } catch (error) {
      console.error('SimpleModifierManager | Error saving modifiers:', error);
    }
  }

  /**
   * Create a new modifier
   */
  public async createModifier(data: Partial<GuardModifier>): Promise<GuardModifier> {
    const id = foundry.utils.randomID();

    const modifier: GuardModifier = {
      id,
      name: data.name || 'New Modifier',
      description: data.description || '',
      type: data.type || 'neutral',
      image: data.image || '',
      organizationId: data.organizationId || '',
      statModifications: data.statModifications || [],
      version: 1,
    };

    this.modifiers.set(id, modifier);
    await this._saveToSettingsAsync();

    return modifier;
  }

  /**
   * Get a modifier by ID
   */
  public getModifier(id: string): GuardModifier | null {
    return this.modifiers.get(id) || null;
  }

  /**
   * Get all modifiers
   */
  public getAllModifiers(): GuardModifier[] {
    return Array.from(this.modifiers.values());
  }

  /**
   * Get modifiers for an organization
   */
  public getModifiersByOrganization(organizationId: string): GuardModifier[] {
    return this.getAllModifiers().filter((m) => m.organizationId === organizationId);
  }

  /**
   * Update an existing modifier
   */
  public async updateModifier(
    id: string,
    updates: Partial<GuardModifier>
  ): Promise<GuardModifier | null> {
    const modifier = this.modifiers.get(id);
    if (!modifier) return null;

    const updated: GuardModifier = {
      ...modifier,
      ...updates,
      id: modifier.id,
      version: modifier.version + 1,
    };

    this.modifiers.set(id, updated);
    await this._saveToSettingsAsync();

    return updated;
  }

  /**
   * Delete a modifier
   */
  public async deleteModifier(id: string): Promise<boolean> {
    const deleted = this.modifiers.delete(id);
    if (deleted) {
      await this._saveToSettingsAsync();
    }
    return deleted;
  }
}
