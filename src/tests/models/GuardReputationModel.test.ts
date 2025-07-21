/**
 * Tests for GuardReputationModel DataModel
 * Following TDD principles
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../setup/foundryMocks';
import { GuardReputationModel } from '../../documents/models/GuardReputationModel';
import { ReputationLevel } from '../../types/entities';

describe('GuardReputationModel', () => {
  let model: GuardReputationModel;
  let mockParent: any;

  beforeEach(() => {
    // Mock parent document
    mockParent = {
      id: 'test-reputation-id',
      name: 'Test Reputation',
      update: vi.fn().mockResolvedValue(true),
    };

    // Create model instance with mock data
    const testData = {
      description: 'Test reputation description',
      level: ReputationLevel.Neutrales,
      organizationId: 'test-org-id',
      version: 1,
    };

    model = new GuardReputationModel(testData);
    (model as any).parent = mockParent;

    // Manually assign organizationId for proper testing
    (model as any).organizationId = testData.organizationId;

    // Mock game.actors
    (global as any).game = {
      actors: {
        get: vi.fn((id: string) => ({ id, type: 'guard-management.guard-organization' })),
      },
    };
  });

  describe('Schema Definition', () => {
    it('should define correct schema structure', () => {
      const schema = GuardReputationModel.defineSchema();

      expect(schema).toHaveProperty('description');
      expect(schema).toHaveProperty('level');
      expect(schema).toHaveProperty('organizationId');
      expect(schema).toHaveProperty('version');
    });

    it('should accept all valid reputation levels', () => {
      const validLevels = [
        ReputationLevel.Enemigos,
        ReputationLevel.Hostiles,
        ReputationLevel.Desconfiados,
        ReputationLevel.Neutrales,
        ReputationLevel.Amistosos,
        ReputationLevel.Confiados,
        ReputationLevel.Aliados,
      ];

      validLevels.forEach((level) => {
        const testData = {
          description: 'Test',
          level,
          organizationId: 'test-org',
          version: 1,
        };

        expect(() => new GuardReputationModel(testData)).not.toThrow();
      });
    });
  });

  describe('Data Preparation', () => {
    it('should enforce level bounds in prepareBaseData', () => {
      // Test lower bound
      (model as any).level = 0;
      model.prepareBaseData();
      expect(model.level).toBe(ReputationLevel.Enemigos);

      // Test upper bound
      (model as any).level = 10;
      model.prepareBaseData();
      expect(model.level).toBe(ReputationLevel.Aliados);

      // Test valid value
      model.level = ReputationLevel.Amistosos;
      model.prepareBaseData();
      expect(model.level).toBe(ReputationLevel.Amistosos);
    });

    it('should calculate derived properties correctly', () => {
      // Test hostile reputation
      model.level = ReputationLevel.Hostiles;
      model.prepareDerivedData();
      expect((model as any).levelLabel).toBe('Hostiles');
      expect((model as any).isHostile).toBe(true);
      expect((model as any).isFriendly).toBe(false);
      expect((model as any).isNeutral).toBe(false);

      // Test neutral reputation
      model.level = ReputationLevel.Neutrales;
      model.prepareDerivedData();
      expect((model as any).levelLabel).toBe('Neutrales');
      expect((model as any).isHostile).toBe(false);
      expect((model as any).isFriendly).toBe(false);
      expect((model as any).isNeutral).toBe(true);

      // Test friendly reputation
      model.level = ReputationLevel.Amistosos;
      model.prepareDerivedData();
      expect((model as any).levelLabel).toBe('Amistosos');
      expect((model as any).isHostile).toBe(false);
      expect((model as any).isFriendly).toBe(true);
      expect((model as any).isNeutral).toBe(false);

      // Test enemy reputation
      model.level = ReputationLevel.Enemigos;
      model.prepareDerivedData();
      expect((model as any).levelLabel).toBe('Enemigos');
      expect((model as any).isHostile).toBe(true);
      expect((model as any).isFriendly).toBe(false);
      expect((model as any).isNeutral).toBe(false);

      // Test ally reputation
      model.level = ReputationLevel.Aliados;
      model.prepareDerivedData();
      expect((model as any).levelLabel).toBe('Aliados');
      expect((model as any).isHostile).toBe(false);
      expect((model as any).isFriendly).toBe(true);
      expect((model as any).isNeutral).toBe(false);
    });
  });

  describe('Reputation Modification', () => {
    it('should improve reputation by one level', async () => {
      model.level = ReputationLevel.Neutrales;
      model.version = 1;

      const result = await model.improve();

      expect(result).toBe(true);
      expect(mockParent.update).toHaveBeenCalledWith({
        'system.level': ReputationLevel.Amistosos,
        'system.version': 2,
      });
    });

    it('should not improve beyond maximum level', async () => {
      model.level = ReputationLevel.Aliados;

      const result = await model.improve();

      expect(result).toBe(false);
      expect(mockParent.update).not.toHaveBeenCalled();
    });

    it('should worsen reputation by one level', async () => {
      model.level = ReputationLevel.Neutrales;
      model.version = 1;

      const result = await model.worsen();

      expect(result).toBe(true);
      expect(mockParent.update).toHaveBeenCalledWith({
        'system.level': ReputationLevel.Desconfiados,
        'system.version': 2,
      });
    });

    it('should not worsen below minimum level', async () => {
      model.level = ReputationLevel.Enemigos;

      const result = await model.worsen();

      expect(result).toBe(false);
      expect(mockParent.update).not.toHaveBeenCalled();
    });

    it('should set reputation to specific level', async () => {
      model.level = ReputationLevel.Neutrales;
      model.version = 1;

      const result = await model.setLevel(ReputationLevel.Confiados);

      expect(result).toBe(true);
      expect(mockParent.update).toHaveBeenCalledWith({
        'system.level': ReputationLevel.Confiados,
        'system.version': 2,
      });
    });

    it('should not set invalid reputation levels', async () => {
      model.level = ReputationLevel.Neutrales;

      let result = await model.setLevel(0 as any);
      expect(result).toBe(false);

      result = await model.setLevel(10 as any);
      expect(result).toBe(false);

      expect(mockParent.update).not.toHaveBeenCalled();
    });
  });

  describe('Modifiers and Colors', () => {
    it('should return correct modifiers for each level', () => {
      expect(model.getModifier()).toBe(0); // Neutrales by default

      model.level = ReputationLevel.Enemigos;
      expect(model.getModifier()).toBe(-3);

      model.level = ReputationLevel.Hostiles;
      expect(model.getModifier()).toBe(-2);

      model.level = ReputationLevel.Desconfiados;
      expect(model.getModifier()).toBe(-1);

      model.level = ReputationLevel.Neutrales;
      expect(model.getModifier()).toBe(0);

      model.level = ReputationLevel.Amistosos;
      expect(model.getModifier()).toBe(1);

      model.level = ReputationLevel.Confiados;
      expect(model.getModifier()).toBe(2);

      model.level = ReputationLevel.Aliados;
      expect(model.getModifier()).toBe(3);
    });

    it('should return correct colors for reputation levels', () => {
      // Hostile (red)
      model.level = ReputationLevel.Enemigos;
      model.prepareDerivedData();
      expect(model.getColor()).toBe('#dc3545');

      model.level = ReputationLevel.Hostiles;
      model.prepareDerivedData();
      expect(model.getColor()).toBe('#dc3545');

      // Neutral (gray)
      model.level = ReputationLevel.Desconfiados;
      model.prepareDerivedData();
      expect(model.getColor()).toBe('#6c757d');

      model.level = ReputationLevel.Neutrales;
      model.prepareDerivedData();
      expect(model.getColor()).toBe('#6c757d');

      // Friendly (green)
      model.level = ReputationLevel.Amistosos;
      model.prepareDerivedData();
      expect(model.getColor()).toBe('#28a745');

      model.level = ReputationLevel.Confiados;
      model.prepareDerivedData();
      expect(model.getColor()).toBe('#28a745');

      model.level = ReputationLevel.Aliados;
      model.prepareDerivedData();
      expect(model.getColor()).toBe('#28a745');
    });
  });

  describe('Action Permissions', () => {
    it('should check trade permissions correctly', () => {
      model.level = ReputationLevel.Enemigos;
      expect(model.canTrade()).toBe(false);

      model.level = ReputationLevel.Hostiles;
      expect(model.canTrade()).toBe(false);

      model.level = ReputationLevel.Desconfiados;
      expect(model.canTrade()).toBe(false);

      model.level = ReputationLevel.Neutrales;
      expect(model.canTrade()).toBe(true);

      model.level = ReputationLevel.Amistosos;
      expect(model.canTrade()).toBe(true);

      model.level = ReputationLevel.Confiados;
      expect(model.canTrade()).toBe(true);

      model.level = ReputationLevel.Aliados;
      expect(model.canTrade()).toBe(true);
    });

    it('should check aid request permissions correctly', () => {
      model.level = ReputationLevel.Enemigos;
      expect(model.canRequestAid()).toBe(false);

      model.level = ReputationLevel.Hostiles;
      expect(model.canRequestAid()).toBe(false);

      model.level = ReputationLevel.Desconfiados;
      expect(model.canRequestAid()).toBe(false);

      model.level = ReputationLevel.Neutrales;
      expect(model.canRequestAid()).toBe(false);

      model.level = ReputationLevel.Amistosos;
      expect(model.canRequestAid()).toBe(true);

      model.level = ReputationLevel.Confiados;
      expect(model.canRequestAid()).toBe(true);

      model.level = ReputationLevel.Aliados;
      expect(model.canRequestAid()).toBe(true);
    });

    it('should check alliance formation permissions correctly', () => {
      model.level = ReputationLevel.Enemigos;
      expect(model.canFormAlliance()).toBe(false);

      model.level = ReputationLevel.Hostiles;
      expect(model.canFormAlliance()).toBe(false);

      model.level = ReputationLevel.Desconfiados;
      expect(model.canFormAlliance()).toBe(false);

      model.level = ReputationLevel.Neutrales;
      expect(model.canFormAlliance()).toBe(false);

      model.level = ReputationLevel.Amistosos;
      expect(model.canFormAlliance()).toBe(false);

      model.level = ReputationLevel.Confiados;
      expect(model.canFormAlliance()).toBe(true);

      model.level = ReputationLevel.Aliados;
      expect(model.canFormAlliance()).toBe(true);
    });
  });

  describe('Organization Retrieval', () => {
    it('should get organization document', () => {
      const org = model.getOrganization();

      expect(org).toBeDefined();
      expect(org.id).toBe('test-org-id');
      expect((global as any).game.actors.get).toHaveBeenCalledWith('test-org-id');
    });

    it('should return null when organization not found', () => {
      (global as any).game.actors.get = vi.fn(() => null);

      const org = model.getOrganization();

      expect(org).toBeNull();
    });

    it('should handle missing game gracefully', () => {
      (global as any).game = undefined;

      const org = model.getOrganization();

      expect(org).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle reputation progression through all levels', async () => {
      model.level = ReputationLevel.Enemigos;
      model.version = 1;

      // Improve through all levels
      for (let i = ReputationLevel.Enemigos; i < ReputationLevel.Aliados; i++) {
        const result = await model.improve();
        expect(result).toBe(true);
        model.level = i + 1;
        model.version++;
      }

      expect(model.level).toBe(ReputationLevel.Aliados);
    });

    it('should handle reputation degradation through all levels', async () => {
      model.level = ReputationLevel.Aliados;
      model.version = 1;

      // Worsen through all levels
      for (let i = ReputationLevel.Aliados; i > ReputationLevel.Enemigos; i--) {
        const result = await model.worsen();
        expect(result).toBe(true);
        model.level = i - 1;
        model.version++;
      }

      expect(model.level).toBe(ReputationLevel.Enemigos);
    });

    it('should maintain version consistency across operations', async () => {
      model.level = ReputationLevel.Neutrales;
      model.version = 5;

      await model.improve();
      expect(mockParent.update).toHaveBeenCalledWith(
        expect.objectContaining({ 'system.version': 6 })
      );

      mockParent.update.mockClear();
      model.version = 6;
      model.level = ReputationLevel.Amistosos;

      await model.worsen();
      expect(mockParent.update).toHaveBeenCalledWith(
        expect.objectContaining({ 'system.version': 7 })
      );
    });
  });
});
