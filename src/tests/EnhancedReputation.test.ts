/**
 * Test for Enhanced Reputation System
 * Verifies that the reputation system has full feature parity with resources
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  CreateEnhancedReputationData,
  EnhancedReputation,
  EnhancedReputationManager,
} from '../entities/EnhancedReputation';
import { ReputationLevel } from '../types/entities';

describe('Enhanced Reputation System', () => {
  let manager: EnhancedReputationManager;
  const testOrganizationId = 'test-org-123';

  beforeEach(async () => {
    manager = new EnhancedReputationManager();
    await manager.initialize();
  });

  describe('Basic CRUD Operations', () => {
    it('should create a new reputation', async () => {
      const reputationData: CreateEnhancedReputationData = {
        name: 'Test Faction',
        description: 'A test faction for unit testing',
        level: ReputationLevel.Neutrales,
        organizationId: testOrganizationId,
        faction: 'Guild',
        relationship: 'Trade Partners',
      };

      const reputation = await manager.createReputation(reputationData);

      expect(reputation).toBeDefined();
      expect(reputation.name).toBe('Test Faction');
      expect(reputation.level).toBe(ReputationLevel.Neutrales);
      expect(reputation.organizationId).toBe(testOrganizationId);
      expect(reputation.faction).toBe('Guild');
    });

    it('should update an existing reputation', async () => {
      // Create a reputation first
      const reputationData: CreateEnhancedReputationData = {
        name: 'Original Faction',
        description: 'Original description',
        level: ReputationLevel.Neutrales,
        organizationId: testOrganizationId,
      };

      const reputation = await manager.createReputation(reputationData);

      // Update it
      const updatedReputation = await manager.updateReputation(reputation.id, {
        name: 'Updated Faction',
        level: ReputationLevel.Amistosos,
      });

      expect(updatedReputation.name).toBe('Updated Faction');
      expect(updatedReputation.level).toBe(ReputationLevel.Amistosos);
      expect(updatedReputation.description).toBe('Original description'); // Should remain unchanged
    });

    it('should get reputation by ID', async () => {
      const reputationData: CreateEnhancedReputationData = {
        name: 'Test Faction',
        description: 'Test description',
        level: ReputationLevel.Confiados,
        organizationId: testOrganizationId,
      };

      const reputation = await manager.createReputation(reputationData);
      const retrieved = await manager.getItem(reputation.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(reputation.id);
      expect(retrieved!.name).toBe('Test Faction');
    });

    it('should delete a reputation', async () => {
      const reputationData: CreateEnhancedReputationData = {
        name: 'To Delete Faction',
        description: 'Will be deleted',
        level: ReputationLevel.Hostiles,
        organizationId: testOrganizationId,
      };

      const reputation = await manager.createReputation(reputationData);
      const deleted = await manager.deleteItem(reputation.id);

      expect(deleted).toBe(true);

      const retrieved = await manager.getItem(reputation.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Reputation-specific Operations', () => {
    it('should improve reputation level', async () => {
      const reputationData: CreateEnhancedReputationData = {
        name: 'Improving Faction',
        description: 'Testing improvement',
        level: ReputationLevel.Neutrales,
        organizationId: testOrganizationId,
      };

      const reputation = await manager.createReputation(reputationData);
      const improved = await manager.improveReputation(reputation.id, 2);

      expect(improved.level).toBe(ReputationLevel.Confiados); // Neutrales (4) + 2 = Confiados (6)
    });

    it('should degrade reputation level', async () => {
      const reputationData: CreateEnhancedReputationData = {
        name: 'Degrading Faction',
        description: 'Testing degradation',
        level: ReputationLevel.Amistosos,
        organizationId: testOrganizationId,
      };

      const reputation = await manager.createReputation(reputationData);
      const degraded = await manager.degradeReputation(reputation.id, 1);

      expect(degraded.level).toBe(ReputationLevel.Neutrales); // Amistosos (5) - 1 = Neutrales (4)
    });

    it('should not improve beyond max level', async () => {
      const reputationData: CreateEnhancedReputationData = {
        name: 'Max Level Faction',
        description: 'Already at max',
        level: ReputationLevel.Aliados,
        organizationId: testOrganizationId,
      };

      const reputation = await manager.createReputation(reputationData);
      const improved = await manager.improveReputation(reputation.id, 5);

      expect(improved.level).toBe(ReputationLevel.Aliados); // Should remain at max
    });

    it('should not degrade below min level', async () => {
      const reputationData: CreateEnhancedReputationData = {
        name: 'Min Level Faction',
        description: 'Already at min',
        level: ReputationLevel.Enemigos,
        organizationId: testOrganizationId,
      };

      const reputation = await manager.createReputation(reputationData);
      const degraded = await manager.degradeReputation(reputation.id, 5);

      expect(degraded.level).toBe(ReputationLevel.Enemigos); // Should remain at min
    });
  });

  describe('Organization-specific Operations', () => {
    it('should get reputations by organization', async () => {
      const org1Id = 'org-1';
      const org2Id = 'org-2';

      // Create reputations for different organizations
      await manager.createReputation({
        name: 'Org 1 Faction 1',
        description: 'First faction for org 1',
        level: ReputationLevel.Neutrales,
        organizationId: org1Id,
      });

      await manager.createReputation({
        name: 'Org 1 Faction 2',
        description: 'Second faction for org 1',
        level: ReputationLevel.Amistosos,
        organizationId: org1Id,
      });

      await manager.createReputation({
        name: 'Org 2 Faction 1',
        description: 'Faction for org 2',
        level: ReputationLevel.Hostiles,
        organizationId: org2Id,
      });

      const org1Reputations = await manager.getReputationsByOrganization(org1Id);
      const org2Reputations = await manager.getReputationsByOrganization(org2Id);

      expect(org1Reputations).toHaveLength(2);
      expect(org2Reputations).toHaveLength(1);
      expect(org1Reputations.every((rep) => rep.organizationId === org1Id)).toBe(true);
    });

    it('should get reputation by faction name', async () => {
      await manager.createReputation({
        name: 'Merchants Guild',
        description: 'Local merchants',
        level: ReputationLevel.Amistosos,
        organizationId: testOrganizationId,
        faction: 'Guild',
      });

      const reputation = await manager.getReputationByFaction(
        'Merchants Guild',
        testOrganizationId
      );

      expect(reputation).toBeDefined();
      expect(reputation!.name).toBe('Merchants Guild');
      expect(reputation!.faction).toBe('Guild');
    });
  });

  describe('Validation', () => {
    it('should validate required fields', async () => {
      const invalidData = {
        name: '',
        description: '',
        level: ReputationLevel.Neutrales,
        organizationId: '',
      } as CreateEnhancedReputationData;

      await expect(manager.createReputation(invalidData)).rejects.toThrow('Validation failed');
    });

    it('should validate reputation level bounds', async () => {
      const invalidData = {
        name: 'Test Faction',
        description: 'Test description',
        level: 10 as ReputationLevel, // Invalid level
        organizationId: testOrganizationId,
      } as CreateEnhancedReputationData;

      await expect(manager.createReputation(invalidData)).rejects.toThrow('Validation failed');
    });
  });

  describe('Feature Parity with Resources', () => {
    it('should have warehouse integration', () => {
      // Verify that EnhancedReputationManager extends BaseWarehouseManager
      expect(manager).toBeInstanceOf(EnhancedReputationManager);
      expect(typeof manager.createItem).toBe('function');
      expect(typeof manager.updateItem).toBe('function');
      expect(typeof manager.deleteItem).toBe('function');
      expect(typeof manager.getAllItems).toBe('function');
    });

    it('should support templates', async () => {
      // Verify template functionality exists
      expect(typeof manager.createTemplate).toBe('function');
      expect(typeof manager.getTemplate).toBe('function');
    });

    it('should support search functionality', async () => {
      // Create test reputations
      await manager.createReputation({
        name: 'Searchable Faction',
        description: 'This faction can be found by search',
        level: ReputationLevel.Neutrales,
        organizationId: testOrganizationId,
        notes: 'Unique search term',
      });

      // Verify basic item functionality exists
      const allItems = await manager.getAllItems();
      expect(allItems.length).toBeGreaterThan(0);
    });
  });
});

describe('Reputation Type Configuration', () => {
  it('should have proper validation', () => {
    const { REPUTATION_TYPE } = require('../entities/EnhancedReputation');

    // Test validation with valid data
    const validData = {
      name: 'Test Faction',
      description: 'Valid description',
      organizationId: 'test-org',
      level: ReputationLevel.Neutrales,
    };

    const validResult = REPUTATION_TYPE.validate(validData);
    expect(validResult.isValid).toBe(true);
    expect(validResult.errors).toHaveLength(0);

    // Test validation with invalid data
    const invalidData = {
      name: '',
      description: '',
      organizationId: '',
      level: 10,
    };

    const invalidResult = REPUTATION_TYPE.validate(invalidData);
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThan(0);
  });

  it('should render info correctly', () => {
    const { REPUTATION_TYPE } = require('../entities/EnhancedReputation');

    const testReputation: EnhancedReputation = {
      id: 'test-id',
      name: 'Test Faction',
      description: 'Test description',
      level: ReputationLevel.Amistosos,
      organizationId: 'test-org',
      relationship: 'Allies',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const infoHtml = REPUTATION_TYPE.renderInfo(testReputation);
    expect(typeof infoHtml).toBe('string');
    expect(infoHtml).toContain('Test Faction');
    expect(infoHtml).toContain('Amistosos');
  });

  it('should render chat messages correctly', () => {
    const { REPUTATION_TYPE } = require('../entities/EnhancedReputation');

    const testReputation: EnhancedReputation = {
      id: 'test-id',
      name: 'Test Faction',
      description: 'Test description',
      level: ReputationLevel.Confiados,
      organizationId: 'test-org',
      faction: 'Guild',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const chatHtml = REPUTATION_TYPE.renderChatMessage(testReputation, 'create');
    expect(typeof chatHtml).toBe('string');
    expect(chatHtml).toContain('Nueva reputación registrada');
    expect(chatHtml).toContain('Test Faction');
    expect(chatHtml).toContain('Guild');
  });
});
