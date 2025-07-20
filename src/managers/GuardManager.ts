/**
 * Guard Manager - Handles guard data and operations
 */

import { GuardData } from '../types/sync';

export class GuardManager {
  private guards: Map<string, GuardData> = new Map();
  private isInitialized = false;

  /**
   * Initialize the Guard Manager
   */
  public async initialize(): Promise<void> {
    console.log('GuardManager | Initializing...');
    
    // Load existing guard data from game settings
    await this.loadGuardData();
    
    this.isInitialized = true;
    console.log('GuardManager | Initialized successfully');
  }

  /**
   * Create a new guard
   */
  public createGuard(guardData: Omit<GuardData, 'id' | 'lastUpdate'>): GuardData {
    const guard: GuardData = {
      id: foundry.utils.randomID(),
      lastUpdate: Date.now(),
      ...guardData
    };

    this.guards.set(guard.id, guard);
    this.saveGuardData();

    console.log(`GuardManager | Created guard: ${guard.name} (${guard.id})`);
    return guard;
  }

  /**
   * Update an existing guard
   */
  public updateGuard(id: string, updates: Partial<GuardData>): GuardData | null {
    const guard = this.guards.get(id);
    if (!guard) {
      console.warn(`GuardManager | Guard not found: ${id}`);
      return null;
    }

    const updatedGuard: GuardData = {
      ...guard,
      ...updates,
      id, // Ensure ID doesn't change
      lastUpdate: Date.now()
    };

    this.guards.set(id, updatedGuard);
    this.saveGuardData();

    console.log(`GuardManager | Updated guard: ${updatedGuard.name} (${id})`);
    return updatedGuard;
  }

  /**
   * Get a guard by ID
   */
  public getGuard(id: string): GuardData | null {
    return this.guards.get(id) || null;
  }

  /**
   * Get all guards
   */
  public getAllGuards(): GuardData[] {
    return Array.from(this.guards.values());
  }

  /**
   * Delete a guard
   */
  public deleteGuard(id: string): boolean {
    const success = this.guards.delete(id);
    if (success) {
      this.saveGuardData();
      console.log(`GuardManager | Deleted guard: ${id}`);
    }
    return success;
  }

  /**
   * Load guard data from game settings
   */
  private async loadGuardData(): Promise<void> {
    try {
      const guardData = game.settings.get('guard-management', 'guardData') as GuardData[] || [];
      this.guards.clear();
      
      guardData.forEach(guard => {
        this.guards.set(guard.id, guard);
      });

      console.log(`GuardManager | Loaded ${guardData.length} guards from settings`);
    } catch (error) {
      console.error('GuardManager | Error loading guard data:', error);
    }
  }

  /**
   * Save guard data to game settings
   */
  private async saveGuardData(): Promise<void> {
    try {
      const guardData = Array.from(this.guards.values());
      await game.settings.set('guard-management', 'guardData', guardData);
      console.log(`GuardManager | Saved ${guardData.length} guards to settings`);
    } catch (error) {
      console.error('GuardManager | Error saving guard data:', error);
    }
  }

  /**
   * Test method for creating sample guards
   */
  public createSampleGuards(): void {
    const sampleGuards = [
      {
        name: 'Guard Alpha',
        position: { x: 100, y: 100 },
        status: 'active' as const,
        assignedArea: 'North Gate'
      },
      {
        name: 'Guard Beta',
        position: { x: 200, y: 150 },
        status: 'active' as const,
        assignedArea: 'South Tower'
      },
      {
        name: 'Guard Charlie',
        position: { x: 150, y: 200 },
        status: 'inactive' as const,
        assignedArea: 'East Wall'
      }
    ];

    sampleGuards.forEach(guardData => {
      this.createGuard(guardData);
    });

    console.log('GuardManager | Created sample guards for testing');
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.guards.clear();
    this.isInitialized = false;
    console.log('GuardManager | Cleaned up');
  }
}
