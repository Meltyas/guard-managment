/**
 * Tests for GuardResourceModel DataModel
 * Following TDD principles
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../setup/foundryMocks';
import { GuardResourceModel } from '../../documents/models/GuardResourceModel';

describe('GuardResourceModel', () => {
  let model: GuardResourceModel;
  let mockParent: any;

  beforeEach(() => {
    // Mock parent document
    mockParent = {
      id: 'test-resource-id',
      name: 'Test Resource',
      update: vi.fn().mockResolvedValue(true),
    };

    // Create model instance with mock data
    const testData = {
      description: 'Test resource description',
      quantity: 10,
      organizationId: 'test-org-id',
      version: 1,
    };

    model = new GuardResourceModel(testData);
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
      const schema = GuardResourceModel.defineSchema();

      expect(schema).toHaveProperty('description');
      expect(schema).toHaveProperty('quantity');
      expect(schema).toHaveProperty('organizationId');
      expect(schema).toHaveProperty('version');
    });

    it('should validate quantity minimum value', () => {
      const testData = {
        description: 'Test',
        quantity: 0,
        organizationId: 'test-org',
        version: 1,
      };

      expect(() => new GuardResourceModel(testData)).not.toThrow();
    });
  });

  describe('Data Preparation', () => {
    it('should enforce non-negative quantity in prepareBaseData', () => {
      model.quantity = -5;
      model.prepareBaseData();
      expect(model.quantity).toBe(0);

      model.quantity = 10;
      model.prepareBaseData();
      expect(model.quantity).toBe(10);
    });

    it('should calculate derived properties in prepareDerivedData', () => {
      // Test empty resource
      model.quantity = 0;
      model.prepareDerivedData();
      expect((model as any).isEmpty).toBe(true);
      expect((model as any).isLow).toBe(true);

      // Test low resource
      model.quantity = 3;
      model.prepareDerivedData();
      expect((model as any).isEmpty).toBe(false);
      expect((model as any).isLow).toBe(true);

      // Test adequate resource
      model.quantity = 10;
      model.prepareDerivedData();
      expect((model as any).isEmpty).toBe(false);
      expect((model as any).isLow).toBe(false);

      // Test boundary case
      model.quantity = 5;
      model.prepareDerivedData();
      expect((model as any).isEmpty).toBe(false);
      expect((model as any).isLow).toBe(true); // exactly 5 is considered low
    });
  });

  describe('Resource Operations', () => {
    it('should consume resources successfully', async () => {
      model.quantity = 10;
      model.version = 1;

      const result = await model.consume(3);

      expect(result).toBe(true);
      expect(mockParent.update).toHaveBeenCalledWith({
        'system.quantity': 7,
        'system.version': 2,
      });
    });

    it('should not consume more than available', async () => {
      model.quantity = 5;

      const result = await model.consume(10);

      expect(result).toBe(false);
      expect(mockParent.update).not.toHaveBeenCalled();
    });

    it('should not consume zero or negative amounts', async () => {
      model.quantity = 10;

      let result = await model.consume(0);
      expect(result).toBe(false);

      result = await model.consume(-5);
      expect(result).toBe(false);

      expect(mockParent.update).not.toHaveBeenCalled();
    });

    it('should consume all resources when consuming exact amount', async () => {
      model.quantity = 5;
      model.version = 1;

      const result = await model.consume(5);

      expect(result).toBe(true);
      expect(mockParent.update).toHaveBeenCalledWith({
        'system.quantity': 0,
        'system.version': 2,
      });
    });

    it('should add resources successfully', async () => {
      model.quantity = 5;
      model.version = 1;

      const result = await model.add(3);

      expect(result).toBe(true);
      expect(mockParent.update).toHaveBeenCalledWith({
        'system.quantity': 8,
        'system.version': 2,
      });
    });

    it('should not add zero or negative amounts', async () => {
      model.quantity = 5;

      let result = await model.add(0);
      expect(result).toBe(false);

      result = await model.add(-3);
      expect(result).toBe(false);

      expect(mockParent.update).not.toHaveBeenCalled();
    });

    it('should set quantity directly', async () => {
      model.quantity = 5;
      model.version = 1;

      const result = await model.setQuantity(15);

      expect(result).toBe(true);
      expect(mockParent.update).toHaveBeenCalledWith({
        'system.quantity': 15,
        'system.version': 2,
      });
    });

    it('should not set negative quantity', async () => {
      model.quantity = 5;

      const result = await model.setQuantity(-3);

      expect(result).toBe(false);
      expect(mockParent.update).not.toHaveBeenCalled();
    });

    it('should set quantity to zero', async () => {
      model.quantity = 5;
      model.version = 1;

      const result = await model.setQuantity(0);

      expect(result).toBe(true);
      expect(mockParent.update).toHaveBeenCalledWith({
        'system.quantity': 0,
        'system.version': 2,
      });
    });
  });

  describe('Transfer Operations', () => {
    it('should transfer resources to another organization', async () => {
      model.quantity = 10;
      model.version = 1;

      const result = await model.transferTo('target-org-id', 3);

      expect(result).toBe(true);
      expect(mockParent.update).toHaveBeenCalledWith({
        'system.quantity': 7,
        'system.version': 2,
      });
    });

    it('should not transfer more than available', async () => {
      model.quantity = 5;

      const result = await model.transferTo('target-org-id', 10);

      expect(result).toBe(false);
      expect(mockParent.update).not.toHaveBeenCalled();
    });

    it('should not transfer zero or negative amounts', async () => {
      model.quantity = 10;

      let result = await model.transferTo('target-org-id', 0);
      expect(result).toBe(false);

      result = await model.transferTo('target-org-id', -5);
      expect(result).toBe(false);

      expect(mockParent.update).not.toHaveBeenCalled();
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
    it('should handle large quantities correctly', async () => {
      model.quantity = 1000000;
      model.version = 1;

      const result = await model.consume(500000);

      expect(result).toBe(true);
      expect(mockParent.update).toHaveBeenCalledWith({
        'system.quantity': 500000,
        'system.version': 2,
      });
    });

    it('should handle exact consumption to zero', async () => {
      model.quantity = 1;
      model.version = 1;

      const result = await model.consume(1);

      expect(result).toBe(true);
      expect(mockParent.update).toHaveBeenCalledWith({
        'system.quantity': 0,
        'system.version': 2,
      });
    });

    it('should maintain version consistency across operations', async () => {
      model.quantity = 10;
      model.version = 5;

      await model.consume(2);
      expect(mockParent.update).toHaveBeenCalledWith(
        expect.objectContaining({ 'system.version': 6 })
      );

      mockParent.update.mockClear();
      model.version = 6;

      await model.add(3);
      expect(mockParent.update).toHaveBeenCalledWith(
        expect.objectContaining({ 'system.version': 7 })
      );
    });
  });
});
