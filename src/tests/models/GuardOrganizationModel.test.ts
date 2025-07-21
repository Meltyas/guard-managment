/**
 * Tests for GuardOrganizationModel DataModel
 * Following TDD principles
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../setup/foundryMocks';
import { GuardOrganizationModel } from '../../documents/models/GuardOrganizationModel';

describe('GuardOrganizationModel', () => {
  let model: GuardOrganizationModel;
  let mockParent: any;

  beforeEach(() => {
    // Mock parent document
    mockParent = {
      id: 'test-org-id',
      name: 'Test Organization',
      update: vi.fn().mockResolvedValue(true),
    };

    // Create model instance with mock data
    const testData = {
      subtitle: 'Test Subtitle',
      baseStats: {
        robustismo: 0,
        analitica: 0,
        subterfugio: 0,
        elocuencia: 0,
      },
      activeModifiers: [],
      resources: [],
      reputation: [],
      patrols: [],
      version: 1,
    };

    model = new GuardOrganizationModel(testData);
    (model as any).parent = mockParent;
  });

  describe('Schema Definition', () => {
    it('should define correct schema structure', () => {
      const schema = GuardOrganizationModel.defineSchema();

      expect(schema).toHaveProperty('subtitle');
      expect(schema).toHaveProperty('baseStats');
      expect(schema).toHaveProperty('activeModifiers');
      expect(schema).toHaveProperty('resources');
      expect(schema).toHaveProperty('reputation');
      expect(schema).toHaveProperty('patrols');
      expect(schema).toHaveProperty('version');
    });

    it('should have correct schema structure with proper types', () => {
      const schema = GuardOrganizationModel.defineSchema();

      // Test that the schema has the expected properties
      expect(schema).toHaveProperty('subtitle');
      expect(schema).toHaveProperty('baseStats');
      expect(schema).toHaveProperty('activeModifiers');
      expect(schema).toHaveProperty('resources');
      expect(schema).toHaveProperty('reputation');
      expect(schema).toHaveProperty('patrols');
      expect(schema).toHaveProperty('version');

      // Test field types (in our mock environment, these are simple objects)
      expect(schema.subtitle).toHaveProperty('type');
      expect(schema.baseStats).toHaveProperty('type');
      expect(schema.version).toHaveProperty('type');
    });

    it('should validate minimum stat values through model instance', () => {
      // Test that we can create a model with zero stats (minimum allowed)
      const testData = {
        subtitle: '',
        baseStats: {
          robustismo: 0,
          analitica: 0,
          subterfugio: 0,
          elocuencia: 0,
        },
        activeModifiers: [],
        resources: [],
        reputation: [],
        patrols: [],
        version: 1,
      };

      expect(() => new GuardOrganizationModel(testData)).not.toThrow();
    });

    it('should accept negative stat values', () => {
      // Test that we can create a model with negative stats (allowed for modifiers/effects)
      const testData = {
        subtitle: 'Debuffed Organization',
        baseStats: {
          robustismo: -5,
          analitica: -10,
          subterfugio: -3,
          elocuencia: -7,
        },
        activeModifiers: [],
        resources: [],
        reputation: [],
        patrols: [],
        version: 1,
      };

      expect(() => new GuardOrganizationModel(testData)).not.toThrow();
    });
  });

  describe('Data Preparation', () => {
    it('should calculate total stats in prepareBaseData', () => {
      model.baseStats = {
        robustismo: 5,
        analitica: 3,
        subterfugio: 7,
        elocuencia: 2,
      };

      model.prepareBaseData();

      expect((model as any).totalStats).toBe(17);
    });

    it('should calculate total stats correctly with negative values', () => {
      model.baseStats = {
        robustismo: -5,
        analitica: 10,
        subterfugio: -3,
        elocuencia: 8,
      };

      model.prepareBaseData();

      expect((model as any).totalStats).toBe(10); // -5 + 10 + (-3) + 8 = 10
    });

    it('should calculate derived data in prepareDerivedData', () => {
      model.resources = ['res1', 'res2'];
      model.reputation = ['rep1'];
      model.patrols = ['patrol1', 'patrol2', 'patrol3'];
      model.activeModifiers = ['mod1'];

      model.prepareDerivedData();

      expect((model as any).resourceCount).toBe(2);
      expect((model as any).reputationCount).toBe(1);
      expect((model as any).patrolCount).toBe(3);
      expect((model as any).modifierCount).toBe(1);
    });
  });

  describe('Patrol Management', () => {
    it('should add patrol if not already present', async () => {
      model.patrols = ['existing-patrol'];
      model.version = 1; // Ensure version is set

      await model.addPatrol('new-patrol');

      expect(mockParent.update).toHaveBeenCalledWith({
        'system.patrols': ['existing-patrol', 'new-patrol'],
        'system.version': 2,
      });
    });

    it('should not add patrol if already present', async () => {
      model.patrols = ['existing-patrol'];

      await model.addPatrol('existing-patrol');

      expect(mockParent.update).not.toHaveBeenCalled();
    });

    it('should remove patrol correctly', async () => {
      model.patrols = ['patrol1', 'patrol2', 'patrol3'];
      model.version = 1;

      await model.removePatrol('patrol2');

      expect(mockParent.update).toHaveBeenCalledWith({
        'system.patrols': ['patrol1', 'patrol3'],
        'system.version': 2,
      });
    });
  });

  describe('Resource Management', () => {
    it('should add resource if not already present', async () => {
      model.resources = ['existing-resource'];
      model.version = 1; // Ensure version is set

      await model.addResource('new-resource');

      expect(mockParent.update).toHaveBeenCalledWith({
        'system.resources': ['existing-resource', 'new-resource'],
        'system.version': 2,
      });
    });

    it('should not add resource if already present', async () => {
      model.resources = ['existing-resource'];

      await model.addResource('existing-resource');

      expect(mockParent.update).not.toHaveBeenCalled();
    });
  });

  describe('Reputation Management', () => {
    it('should add reputation if not already present', async () => {
      model.reputation = ['existing-reputation'];
      model.version = 1; // Ensure version is set

      await model.addReputation('new-reputation');

      expect(mockParent.update).toHaveBeenCalledWith({
        'system.reputation': ['existing-reputation', 'new-reputation'],
        'system.version': 2,
      });
    });

    it('should not add reputation if already present', async () => {
      model.reputation = ['existing-reputation'];

      await model.addReputation('existing-reputation');

      expect(mockParent.update).not.toHaveBeenCalled();
    });
  });

  describe('Document Retrieval', () => {
    beforeEach(() => {
      // Mock game.actors and game.items
      (global as any).game = {
        actors: {
          get: vi.fn((id: string) => ({ id, type: 'mock-actor' })),
        },
        items: {
          get: vi.fn((id: string) => ({ id, type: 'mock-item' })),
        },
      };
    });

    it('should get patrols from game.actors', () => {
      model.patrols = ['patrol1', 'patrol2'];

      const patrols = model.getPatrols();

      expect(patrols).toHaveLength(2);
      expect((global as any).game.actors.get).toHaveBeenCalledWith('patrol1');
      expect((global as any).game.actors.get).toHaveBeenCalledWith('patrol2');
    });

    it('should get resources from game.items', () => {
      model.resources = ['resource1', 'resource2'];

      const resources = model.getResources();

      expect(resources).toHaveLength(2);
      expect((global as any).game.items.get).toHaveBeenCalledWith('resource1');
      expect((global as any).game.items.get).toHaveBeenCalledWith('resource2');
    });

    it('should get reputations from game.items', () => {
      model.reputation = ['rep1', 'rep2'];

      const reputations = model.getReputations();

      expect(reputations).toHaveLength(2);
      expect((global as any).game.items.get).toHaveBeenCalledWith('rep1');
      expect((global as any).game.items.get).toHaveBeenCalledWith('rep2');
    });

    it('should return empty arrays when game is not available', () => {
      (global as any).game = undefined;

      expect(model.getPatrols()).toEqual([]);
      expect(model.getResources()).toEqual([]);
      expect(model.getReputations()).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero stats correctly', () => {
      model.baseStats = {
        robustismo: 0,
        analitica: 0,
        subterfugio: 0,
        elocuencia: 0,
      };

      model.prepareBaseData();
      expect((model as any).totalStats).toBe(0);
    });

    it('should handle empty arrays correctly', () => {
      model.resources = [];
      model.reputation = [];
      model.patrols = [];
      model.activeModifiers = [];

      model.prepareDerivedData();

      expect((model as any).resourceCount).toBe(0);
      expect((model as any).reputationCount).toBe(0);
      expect((model as any).patrolCount).toBe(0);
      expect((model as any).modifierCount).toBe(0);
    });
  });
});
