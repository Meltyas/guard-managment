/**
 * Tests for PatrolModel DataModel
 * Following TDD principles
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatrolModel } from '../../documents/models/PatrolModel';
import { PatrolStatus } from '../../types/entities';
import '../setup/foundryMocks';

describe('PatrolModel', () => {
  let model: PatrolModel;
  let mockParent: any;
  let mockOrganization: any;

  beforeEach(() => {
    // Mock parent document
    mockParent = {
      id: 'test-patrol-id',
      name: 'Test Patrol',
      update: vi.fn().mockResolvedValue(true),
    };

    // Mock organization
    mockOrganization = {
      id: 'test-org-id',
      type: 'guard-management.guard-organization',
      system: {
        baseStats: {
          robustismo: 5,
          analitica: 3,
          subterfugio: 7,
          elocuencia: 4,
        },
      },
    };

    // Create model instance with mock data
    const testData = {
      leaderId: 'test-leader-id',
      unitCount: 4,
      organizationId: 'test-org-id',
      customModifiers: [],
      activeEffects: [],
      status: 'idle' as PatrolStatus,
      version: 1,
    };

    model = new PatrolModel(testData);
    (model as any).parent = mockParent;

    // Manually assign properties that may not be set by mock TypeDataModel
    model.organizationId = 'test-org-id';
    model.leaderId = 'test-leader-id';
    model.unitCount = 4;
    model.customModifiers = [];
    model.activeEffects = [];
    model.status = 'idle' as PatrolStatus;
    model.version = 1;

    // Mock game.actors
    (global as any).game = {
      actors: {
        get: vi.fn((id: string) => {
          if (id === 'test-org-id') return mockOrganization;
          if (id === 'test-leader-id') return { id, type: 'character', name: 'Test Leader' };
          return null;
        }),
      },
      items: {
        get: vi.fn((id: string) => ({ id, type: 'mock-item' })),
      },
    };
  });

  describe('Schema Definition', () => {
    it('should define correct schema structure', () => {
      const schema = PatrolModel.defineSchema();

      expect(schema).toHaveProperty('leaderId');
      expect(schema).toHaveProperty('unitCount');
      expect(schema).toHaveProperty('organizationId');
      expect(schema).toHaveProperty('customModifiers');
      expect(schema).toHaveProperty('activeEffects');
      expect(schema).toHaveProperty('status');
      expect(schema).toHaveProperty('version');
    });

    it('should validate unit count range', () => {
      // Test minimum unit count
      const testDataMin = {
        leaderId: 'test-leader',
        unitCount: 1,
        organizationId: 'test-org',
        customModifiers: [],
        activeEffects: [],
        status: 'idle' as PatrolStatus,
        version: 1,
      };

      expect(() => new PatrolModel(testDataMin)).not.toThrow();

      // Test maximum unit count
      const testDataMax = {
        leaderId: 'test-leader',
        unitCount: 12,
        organizationId: 'test-org',
        customModifiers: [],
        activeEffects: [],
        status: 'idle' as PatrolStatus,
        version: 1,
      };

      expect(() => new PatrolModel(testDataMax)).not.toThrow();
    });

    it('should have valid status choices', () => {
      const validStatuses: PatrolStatus[] = ['idle', 'deployed', 'recalled'];

      validStatuses.forEach((status) => {
        const testData = {
          leaderId: 'test-leader',
          unitCount: 4,
          organizationId: 'test-org',
          customModifiers: [],
          activeEffects: [],
          status,
          version: 1,
        };

        expect(() => new PatrolModel(testData)).not.toThrow();
      });
    });
  });

  describe('Data Preparation', () => {
    beforeEach(() => {
      // Re-setup game mock for data preparation tests
      (global as any).game = {
        actors: {
          get: vi.fn((id: string) => {
            if (id === 'test-org-id') return mockOrganization;
            return null;
          }),
        },
      };
    });

    it('should enforce unit count bounds in prepareBaseData', () => {
      // Test lower bound
      model.unitCount = -5;
      model.prepareBaseData();
      expect(model.unitCount).toBe(1);

      // Test upper bound
      model.unitCount = 20;
      model.prepareBaseData();
      expect(model.unitCount).toBe(12);

      // Test valid value
      model.unitCount = 6;
      model.prepareBaseData();
      expect(model.unitCount).toBe(6);
    });

    it('should calculate patrol stats in prepareDerivedData', () => {
      model.prepareDerivedData();

      expect((model as any).calculatedStats).toBeDefined();
      expect((model as any).calculatedStats.robustismo).toBe(5);
      expect((model as any).calculatedStats.analitica).toBe(3);
      expect((model as any).calculatedStats.subterfugio).toBe(7);
      expect((model as any).calculatedStats.elocuencia).toBe(4);
    });
  });

  describe('Stat Calculation', () => {
    beforeEach(() => {
      // Re-setup game mock for stat calculation tests
      (global as any).game = {
        actors: {
          get: vi.fn((id: string) => {
            if (id === 'test-org-id') return mockOrganization;
            return null;
          }),
        },
      };
    });

    it('should use organization base stats when organization exists', () => {
      const stats = (model as any)._calculatePatrolStats();

      expect(stats.robustismo).toBe(5);
      expect(stats.analitica).toBe(3);
      expect(stats.subterfugio).toBe(7);
      expect(stats.elocuencia).toBe(4);
    });

    it('should use default stats when organization does not exist', () => {
      (global as any).game.actors.get = vi.fn(() => null);

      const stats = (model as any)._calculatePatrolStats();

      expect(stats.robustismo).toBe(0); // Updated to match new DEFAULT_GUARD_STATS
      expect(stats.analitica).toBe(0);
      expect(stats.subterfugio).toBe(0);
      expect(stats.elocuencia).toBe(0);
    });

    it('should apply custom modifiers to stats', () => {
      model.customModifiers = [
        { statName: 'robustismo', value: 3 },
        { statName: 'analitica', value: -1 },
        { statName: 'subterfugio', value: 2 },
      ];

      const stats = (model as any)._calculatePatrolStats();

      expect(stats.robustismo).toBe(8); // 5 + 3
      expect(stats.analitica).toBe(2); // 3 - 1
      expect(stats.subterfugio).toBe(9); // 7 + 2
      expect(stats.elocuencia).toBe(4); // unchanged
    });

    it('should prevent negative stats', () => {
      model.customModifiers = [
        { statName: 'robustismo', value: -10 },
        { statName: 'analitica', value: -5 },
      ];

      const stats = (model as any)._calculatePatrolStats();

      expect(stats.robustismo).toBe(0); // Would be -5, but clamped to 0
      expect(stats.analitica).toBe(0); // Would be -2, but clamped to 0
    });
  });

  describe('Status Management', () => {
    it('should deploy patrol from idle status', async () => {
      model.status = 'idle';
      model.version = 1;

      const result = await model.deploy();

      expect(result).toBe(true);
      expect(mockParent.update).toHaveBeenCalledWith({
        'system.status': 'deployed',
        'system.version': 2,
      });
    });

    it('should not deploy patrol if not idle', async () => {
      model.status = 'deployed';

      const result = await model.deploy();

      expect(result).toBe(false);
      expect(mockParent.update).not.toHaveBeenCalled();
    });

    it('should recall patrol from deployed status', async () => {
      model.status = 'deployed';
      model.version = 1;

      const result = await model.recall();

      expect(result).toBe(true);
      expect(mockParent.update).toHaveBeenCalledWith({
        'system.status': 'recalled',
        'system.version': 2,
      });
    });

    it('should not recall patrol if not deployed', async () => {
      model.status = 'idle';

      const result = await model.recall();

      expect(result).toBe(false);
      expect(mockParent.update).not.toHaveBeenCalled();
    });

    it('should return to idle from any status', async () => {
      model.status = 'recalled';
      model.version = 1;

      const result = await model.returnToIdle();

      expect(result).toBe(true);
      expect(mockParent.update).toHaveBeenCalledWith({
        'system.status': 'idle',
        'system.version': 2,
      });
    });
  });

  describe('Custom Modifiers Management', () => {
    it('should add custom modifier', async () => {
      model.customModifiers = [];
      model.version = 1;

      await model.addCustomModifier('robustismo', 5);

      expect(mockParent.update).toHaveBeenCalledWith({
        'system.customModifiers': [{ statName: 'robustismo', value: 5 }],
        'system.version': 2,
      });
    });

    it('should remove custom modifier by index', async () => {
      model.customModifiers = [
        { statName: 'robustismo', value: 3 },
        { statName: 'analitica', value: -1 },
        { statName: 'subterfugio', value: 2 },
      ];
      model.version = 1;

      await model.removeCustomModifier(1); // Remove analitica modifier

      expect(mockParent.update).toHaveBeenCalledWith({
        'system.customModifiers': [
          { statName: 'robustismo', value: 3 },
          { statName: 'subterfugio', value: 2 },
        ],
        'system.version': 2,
      });
    });

    it('should not remove modifier with invalid index', async () => {
      model.customModifiers = [{ statName: 'robustismo', value: 3 }];

      await model.removeCustomModifier(5); // Invalid index
      await model.removeCustomModifier(-1); // Invalid index

      expect(mockParent.update).not.toHaveBeenCalled();
    });
  });

  describe('Effects Management', () => {
    it('should apply effect if not already applied', async () => {
      model.activeEffects = ['effect1'];
      model.version = 1;

      await model.applyEffect('effect2');

      expect(mockParent.update).toHaveBeenCalledWith({
        'system.activeEffects': ['effect1', 'effect2'],
        'system.version': 2,
      });
    });

    it('should not apply effect if already applied', async () => {
      model.activeEffects = ['effect1', 'effect2'];

      await model.applyEffect('effect1');

      expect(mockParent.update).not.toHaveBeenCalled();
    });

    it('should remove effect correctly', async () => {
      model.activeEffects = ['effect1', 'effect2', 'effect3'];
      model.version = 1;

      await model.removeEffect('effect2');

      expect(mockParent.update).toHaveBeenCalledWith({
        'system.activeEffects': ['effect1', 'effect3'],
        'system.version': 2,
      });
    });
  });

  describe('Document Retrieval', () => {
    beforeEach(() => {
      // Re-setup game mock for this section
      (global as any).game = {
        actors: {
          get: vi.fn((id: string) => {
            if (id === 'test-org-id') return mockOrganization;
            if (id === 'test-leader-id') return { id, name: 'Test Leader' };
            return null;
          }),
        },
        items: {
          get: vi.fn((id: string) => ({ id, type: 'mock-item' })),
        },
      };
    });

    it('should get organization document', () => {
      const org = model.getOrganization();

      expect(org).toBe(mockOrganization);
      expect((global as any).game.actors.get).toHaveBeenCalledWith('test-org-id');
    });

    it('should get leader document', () => {
      const leader = model.getLeader();

      expect(leader).toBeDefined();
      expect(leader.id).toBe('test-leader-id');
      expect((global as any).game.actors.get).toHaveBeenCalledWith('test-leader-id');
    });

    it('should get active effects', () => {
      model.activeEffects = ['effect1', 'effect2'];

      const effects = model.getActiveEffects();

      expect(effects).toHaveLength(2);
      expect((global as any).game.items.get).toHaveBeenCalledWith('effect1');
      expect((global as any).game.items.get).toHaveBeenCalledWith('effect2');
    });

    it('should handle missing game objects gracefully', () => {
      (global as any).game = undefined;

      expect(model.getOrganization()).toBeNull();
      expect(model.getLeader()).toBeNull();
      expect(model.getActiveEffects()).toEqual([]);
    });
  });
});
