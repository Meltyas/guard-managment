/**
 * Reputation Manager - Manages organizational reputation with factions
 */

import { Reputation, ReputationLevel, ValidationError, ValidationResult } from '../types/entities';

export interface CreateReputationData {
  name: string;
  description: string;
  level: ReputationLevel;
  organizationId: string;
}

export interface UpdateReputationData {
  name?: string;
  description?: string;
  level?: ReputationLevel;
}

export class ReputationManager {
  private reputations: Map<string, Reputation> = new Map();

  /**
   * Initialize the Reputation Manager
   */
  public async initialize(): Promise<void> {
    console.log('ReputationManager | Initializing...');
    await this.loadReputationData();
    console.log('ReputationManager | Initialized successfully');
  }

  /**
   * Create a new reputation entry
   */
  public createReputation(data: CreateReputationData): Reputation {
    const validation = this.validateReputationData(data);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`);
    }

    const reputation: Reputation = {
      id: this.generateId(),
      name: data.name,
      description: data.description,
      level: data.level,
      organizationId: data.organizationId,
      version: 1,
    };

    this.reputations.set(reputation.id, reputation);
    this.saveReputationData();

    console.log(`ReputationManager | Created reputation: ${reputation.name} (${reputation.id})`);
    return reputation;
  }

  /**
   * Get a reputation by ID
   */
  public getReputation(id: string): Reputation | null {
    return this.reputations.get(id) || null;
  }

  /**
   * Get all reputations for an organization
   */
  public getReputationsByOrganization(organizationId: string): Reputation[] {
    return Array.from(this.reputations.values()).filter((r) => r.organizationId === organizationId);
  }

  /**
   * Get all reputations
   */
  public getAllReputations(): Reputation[] {
    return Array.from(this.reputations.values());
  }

  /**
   * Update an existing reputation
   */
  public updateReputation(id: string, updates: UpdateReputationData): Reputation {
    const reputation = this.reputations.get(id);
    if (!reputation) {
      throw new Error(`Reputation not found: ${id}`);
    }

    const validation = this.validateReputationData(updates, true);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`);
    }

    const updated: Reputation = {
      ...reputation,
      ...updates,
      version: reputation.version + 1,
    };

    this.reputations.set(id, updated);
    this.saveReputationData();

    console.log(`ReputationManager | Updated reputation: ${updated.name} (${id})`);
    return updated;
  }

  /**
   * Delete a reputation
   */
  public deleteReputation(id: string): boolean {
    const reputation = this.reputations.get(id);
    if (!reputation) {
      console.warn(`ReputationManager | Reputation not found: ${id}`);
      return false;
    }

    this.reputations.delete(id);
    this.saveReputationData();

    console.log(`ReputationManager | Deleted reputation: ${reputation.name} (${id})`);
    return true;
  }

  /**
   * Improve reputation (increase level)
   */
  public improveReputation(id: string, levels = 1): Reputation {
    const reputation = this.reputations.get(id);
    if (!reputation) {
      throw new Error(`Reputation not found: ${id}`);
    }

    if (levels <= 0) {
      throw new Error('Improvement levels must be positive');
    }

    const newLevel = Math.min(ReputationLevel.Aliados, reputation.level + levels);
    return this.updateReputation(id, { level: newLevel });
  }

  /**
   * Degrade reputation (decrease level)
   */
  public degradeReputation(id: string, levels = 1): Reputation {
    const reputation = this.reputations.get(id);
    if (!reputation) {
      throw new Error(`Reputation not found: ${id}`);
    }

    if (levels <= 0) {
      throw new Error('Degradation levels must be positive');
    }

    const newLevel = Math.max(ReputationLevel.Enemigos, reputation.level - levels);
    return this.updateReputation(id, { level: newLevel });
  }

  /**
   * Get reputation level name
   */
  public getLevelName(level: ReputationLevel): string {
    const names = {
      [ReputationLevel.Enemigos]: 'Enemigos',
      [ReputationLevel.Hostiles]: 'Hostiles',
      [ReputationLevel.Desconfiados]: 'Desconfiados',
      [ReputationLevel.Neutrales]: 'Neutrales',
      [ReputationLevel.Amistosos]: 'Amistosos',
      [ReputationLevel.Confiados]: 'Confiados',
      [ReputationLevel.Aliados]: 'Aliados',
    };
    return names[level] || 'Unknown';
  }

  /**
   * Validate reputation data
   */
  private validateReputationData(
    data: Partial<CreateReputationData>,
    isUpdate = false
  ): ValidationResult {
    const errors: ValidationError[] = [];

    // Name validation
    if (!isUpdate || data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        errors.push({ field: 'name', message: 'Faction name is required' });
      } else if (data.name.length > 100) {
        errors.push({ field: 'name', message: 'Faction name must be less than 100 characters' });
      }
    }

    // Description validation
    if (!isUpdate || data.description !== undefined) {
      if (!data.description || data.description.trim().length === 0) {
        errors.push({ field: 'description', message: 'Reputation description is required' });
      } else if (data.description.length > 500) {
        errors.push({
          field: 'description',
          message: 'Reputation description must be less than 500 characters',
        });
      }
    }

    // Level validation
    if (!isUpdate || data.level !== undefined) {
      if (typeof data.level !== 'number' || data.level < 1 || data.level > 7) {
        errors.push({ field: 'level', message: 'Reputation level must be between 1 and 7' });
      }
    }

    // Organization ID validation (only for create)
    if (!isUpdate && (!data.organizationId || data.organizationId.trim().length === 0)) {
      errors.push({ field: 'organizationId', message: 'Organization ID is required' });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }

  /**
   * Load reputation data from Foundry settings
   */
  private async loadReputationData(): Promise<void> {
    try {
      const data = (game?.settings?.get('guard-management', 'reputations') as Reputation[]) || [];
      this.reputations.clear();

      for (const reputation of data) {
        this.reputations.set(reputation.id, reputation);
      }

      console.log(`ReputationManager | Loaded ${data.length} reputations`);
    } catch (error) {
      console.warn('ReputationManager | Error loading reputation data:', error);
    }
  }

  /**
   * Save reputation data to Foundry settings
   */
  private async saveReputationData(): Promise<void> {
    try {
      const data = Array.from(this.reputations.values());
      await game?.settings?.set('guard-management', 'reputations', data);
      console.log(`ReputationManager | Saved ${data.length} reputations`);
    } catch (error) {
      console.error('ReputationManager | Error saving reputation data:', error);
    }
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.reputations.clear();
    console.log('ReputationManager | Cleaned up');
  }
}
