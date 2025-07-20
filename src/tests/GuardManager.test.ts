/**
 * Guard Statistics CRUD Tests
 * Testing basic entity creation, reading, updating, and deletion
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { GuardStatisticsManager } from '../managers/GuardStatisticsManager';
import { DEFAULT_GUARD_STATS, GuardStats } from '../types/entities';
import './setup/foundryMocks';

describe('Guard Statistics CRUD Operations', () => {
  let guardManager: GuardStatisticsManager;

  beforeEach(() => {
    guardManager = new GuardStatisticsManager();
  });

  describe('Create Guard', () => {
    it('should create a new guard with basic information', () => {
      // RED: Test fails because GuardStatisticsManager doesn't exist yet
      const guardData = {
        name: 'Elite Guard Unit',
        subtitle: 'Palace Guards',
        baseStats: DEFAULT_GUARD_STATS,
      };

      const guard = guardManager.createGuard(guardData);

      expect(guard).toBeDefined();
      expect(guard.id).toBeDefined();
      expect(guard.name).toBe('Elite Guard Unit');
      expect(guard.subtitle).toBe('Palace Guards');
      expect(guard.baseStats).toEqual(DEFAULT_GUARD_STATS);
      expect(guard.activeModifiers).toEqual([]);
      expect(guard.createdAt).toBeInstanceOf(Date);
      expect(guard.updatedAt).toBeInstanceOf(Date);
      expect(guard.version).toBe(1);
    });

    it('should create guard with custom stats', () => {
      const customStats: GuardStats = {
        robustismo: 15,
        analitica: 8,
        subterfugio: 12,
        elocuencia: 10,
      };

      const guard = guardManager.createGuard({
        name: 'Specialized Unit',
        subtitle: 'Combat Specialists',
        baseStats: customStats,
      });

      expect(guard.baseStats).toEqual(customStats);
    });

    it('should validate required fields', () => {
      expect(() => {
        guardManager.createGuard({
          name: '',
          subtitle: 'Test',
          baseStats: DEFAULT_GUARD_STATS,
        });
      }).toThrow('Guard name is required');

      expect(() => {
        guardManager.createGuard({
          name: 'Test Guard',
          subtitle: '',
          baseStats: DEFAULT_GUARD_STATS,
        });
      }).toThrow('Guard subtitle is required');
    });

    it('should validate stat values are positive', () => {
      expect(() => {
        guardManager.createGuard({
          name: 'Test Guard',
          subtitle: 'Test',
          baseStats: {
            robustismo: -5,
            analitica: 10,
            subterfugio: 10,
            elocuencia: 10,
          },
        });
      }).toThrow('Stat values must be positive');
    });
  });

  describe('Read Guard', () => {
    it('should retrieve an existing guard by ID', () => {
      const guard = guardManager.createGuard({
        name: 'Test Guard',
        subtitle: 'Test Unit',
        baseStats: DEFAULT_GUARD_STATS,
      });

      const retrieved = guardManager.getGuard(guard.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(guard.id);
      expect(retrieved!.name).toBe('Test Guard');
    });

    it('should return null for non-existent guard', () => {
      const retrieved = guardManager.getGuard('non-existent-id');
      expect(retrieved).toBeNull();
    });

    it('should retrieve all guards', () => {
      guardManager.createGuard({
        name: 'Guard 1',
        subtitle: 'Unit 1',
        baseStats: DEFAULT_GUARD_STATS,
      });

      guardManager.createGuard({
        name: 'Guard 2',
        subtitle: 'Unit 2',
        baseStats: DEFAULT_GUARD_STATS,
      });

      const allGuards = guardManager.getAllGuards();
      expect(allGuards).toHaveLength(2);
      expect(allGuards[0].name).toBe('Guard 1');
      expect(allGuards[1].name).toBe('Guard 2');
    });
  });

  describe('Update Guard', () => {
    it('should update guard basic information', async () => {
      const guard = guardManager.createGuard({
        name: 'Original Name',
        subtitle: 'Original Subtitle',
        baseStats: DEFAULT_GUARD_STATS,
      });

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 1));

      const updated = guardManager.updateGuard(guard.id, {
        name: 'Updated Name',
        subtitle: 'Updated Subtitle',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.subtitle).toBe('Updated Subtitle');
      expect(updated.version).toBe(2);
      expect(updated.updatedAt.getTime()).toBeGreaterThan(guard.createdAt.getTime());
    });

    it('should update individual stats', () => {
      const guard = guardManager.createGuard({
        name: 'Test Guard',
        subtitle: 'Test',
        baseStats: DEFAULT_GUARD_STATS,
      });

      const updated = guardManager.updateGuard(guard.id, {
        baseStats: {
          ...guard.baseStats,
          robustismo: 15,
        },
      });

      expect(updated.baseStats.robustismo).toBe(15);
      expect(updated.baseStats.analitica).toBe(DEFAULT_GUARD_STATS.analitica);
    });

    it('should fail to update non-existent guard', () => {
      expect(() => {
        guardManager.updateGuard('non-existent-id', {
          name: 'New Name',
        });
      }).toThrow('Guard not found');
    });

    it('should validate updated data', () => {
      const guard = guardManager.createGuard({
        name: 'Test Guard',
        subtitle: 'Test',
        baseStats: DEFAULT_GUARD_STATS,
      });

      expect(() => {
        guardManager.updateGuard(guard.id, {
          name: '',
        });
      }).toThrow('Guard name is required');
    });
  });

  describe('Delete Guard', () => {
    it('should delete an existing guard', () => {
      const guard = guardManager.createGuard({
        name: 'To Delete',
        subtitle: 'Test',
        baseStats: DEFAULT_GUARD_STATS,
      });

      const deleted = guardManager.deleteGuard(guard.id);
      expect(deleted).toBe(true);

      const retrieved = guardManager.getGuard(guard.id);
      expect(retrieved).toBeNull();
    });

    it('should fail to delete non-existent guard', () => {
      expect(() => {
        guardManager.deleteGuard('non-existent-id');
      }).toThrow('Guard not found');
    });
  });

  describe('Guard Statistics Calculations', () => {
    it('should calculate effective stats with modifiers', () => {
      const guard = guardManager.createGuard({
        name: 'Test Guard',
        subtitle: 'Test',
        baseStats: DEFAULT_GUARD_STATS,
      });

      // This will be implemented when GuardModifier functionality is added
      const effectiveStats = guardManager.calculateEffectiveStats(guard.id);

      // For now, should return base stats when no modifiers
      expect(effectiveStats).toEqual(DEFAULT_GUARD_STATS);
    });
  });
});
