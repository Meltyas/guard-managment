/**
 * Guard Statistics Manager - Enhanced implementation for Guard Management System
 * Implements full CRUD operations for Guard Statistics with validation
 */

import { GuardStatistics, GuardStats, ValidationError, ValidationResult } from '../types/entities';

export interface CreateGuardData {
  name: string;
  subtitle: string;
  baseStats: GuardStats;
}

export interface UpdateGuardData {
  name?: string;
  subtitle?: string;
  baseStats?: GuardStats;
}

export class GuardStatisticsManager {
  private guards: Map<string, GuardStatistics> = new Map();
  private isInitialized = false;

  /**
   * Initialize the Guard Statistics Manager
   */
  public async initialize(): Promise<void> {
    console.log('GuardStatisticsManager | Initializing...');

    // Load existing data if any
    await this.loadGuardData();

    this.isInitialized = true;
    console.log('GuardStatisticsManager | Initialized successfully');
  }

  /**
   * Create a new guard with validation
   */
  public createGuard(data: CreateGuardData): GuardStatistics {
    // Validate input data
    const validation = this.validateGuardData(data);
    if (!validation.isValid) {
      throw new Error(validation.errors[0].message);
    }

    const guard: GuardStatistics = {
      id: foundry.utils.randomID(),
      name: data.name,
      subtitle: data.subtitle,
      baseStats: { ...data.baseStats },
      activeModifiers: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };

    this.guards.set(guard.id, guard);
    this.saveGuardData();

    console.log(`GuardStatisticsManager | Created guard: ${guard.name} (${guard.id})`);
    return guard;
  }

  /**
   * Get a guard by ID
   */
  public getGuard(id: string): GuardStatistics | null {
    return this.guards.get(id) || null;
  }

  /**
   * Get all guards
   */
  public getAllGuards(): GuardStatistics[] {
    return Array.from(this.guards.values());
  }

  /**
   * Update an existing guard
   */
  public updateGuard(id: string, updates: UpdateGuardData): GuardStatistics {
    const guard = this.guards.get(id);
    if (!guard) {
      throw new Error('Guard not found');
    }

    // Validate updates
    const validation = this.validateGuardData(updates, true);
    if (!validation.isValid) {
      throw new Error(validation.errors[0].message);
    }

    // Apply updates
    const updated: GuardStatistics = {
      ...guard,
      ...updates,
      updatedAt: new Date(),
      version: guard.version + 1,
    };

    this.guards.set(id, updated);
    this.saveGuardData();

    console.log(`GuardStatisticsManager | Updated guard: ${updated.name} (${id})`);
    return updated;
  }

  /**
   * Delete a guard
   */
  public deleteGuard(id: string): boolean {
    const guard = this.guards.get(id);
    if (!guard) {
      throw new Error('Guard not found');
    }

    // TODO: Check if guard has active patrols (will implement when PatrolManager exists)

    this.guards.delete(id);
    this.saveGuardData();

    console.log(`GuardStatisticsManager | Deleted guard: ${guard.name} (${id})`);
    return true;
  }

  /**
   * Calculate effective stats (base + modifiers)
   */
  public calculateEffectiveStats(id: string): GuardStats {
    const guard = this.guards.get(id);
    if (!guard) {
      throw new Error('Guard not found');
    }

    // For now, return base stats (modifiers will be implemented later)
    // TODO: Apply active modifiers when GuardModifier system is implemented
    return { ...guard.baseStats };
  }

  /**
   * Validate guard data
   */
  private validateGuardData(data: Partial<CreateGuardData>, isUpdate = false): ValidationResult {
    const errors: ValidationError[] = [];

    // Name validation
    if (data.name !== undefined) {
      if (!data.name || data.name.trim() === '') {
        errors.push({ field: 'name', message: 'Guard name is required' });
      }
    } else if (!isUpdate) {
      errors.push({ field: 'name', message: 'Guard name is required' });
    }

    // Subtitle validation
    if (data.subtitle !== undefined) {
      if (!data.subtitle || data.subtitle.trim() === '') {
        errors.push({ field: 'subtitle', message: 'Guard subtitle is required' });
      }
    } else if (!isUpdate) {
      errors.push({ field: 'subtitle', message: 'Guard subtitle is required' });
    }

    // Stats validation
    if (data.baseStats) {
      const stats = data.baseStats;
      const statNames = ['robustismo', 'analitica', 'subterfugio', 'elocuencia'];

      for (const statName of statNames) {
        const value = stats[statName as keyof GuardStats];
        if (value < 0) {
          errors.push({ field: 'baseStats', message: 'Stat values must be positive' });
          break;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Load guard data from Foundry settings
   */
  private async loadGuardData(): Promise<void> {
    try {
      const data =
        (game.settings.get('guard-management', 'guardStatistics') as GuardStatistics[]) || [];
      this.guards.clear();

      for (const guard of data) {
        this.guards.set(guard.id, guard);
      }

      console.log(`GuardStatisticsManager | Loaded ${data.length} guards`);
    } catch (error) {
      console.warn('GuardStatisticsManager | Error loading guard data:', error);
    }
  }

  /**
   * Save guard data to Foundry settings
   */
  private async saveGuardData(): Promise<void> {
    try {
      const data = Array.from(this.guards.values());
      await game.settings.set('guard-management', 'guardStatistics', data);
      console.log(`GuardStatisticsManager | Saved ${data.length} guards`);
    } catch (error) {
      console.error('GuardStatisticsManager | Error saving guard data:', error);
    }
  }

  /**
   * Create sample guards for testing
   */
  public createSampleGuards(): GuardStatistics[] {
    const samples = [
      {
        name: 'Elite Palace Guard',
        subtitle: 'Royal Protection Unit',
        baseStats: { robustismo: 15, analitica: 10, subterfugio: 8, elocuencia: 12 },
      },
      {
        name: 'City Watch',
        subtitle: 'Street Patrol',
        baseStats: { robustismo: 12, analitica: 8, subterfugio: 10, elocuencia: 10 },
      },
      {
        name: 'Harbor Guard',
        subtitle: 'Port Security',
        baseStats: { robustismo: 10, analitica: 12, subterfugio: 15, elocuencia: 8 },
      },
    ];

    return samples.map((sample) => this.createGuard(sample));
  }
}
