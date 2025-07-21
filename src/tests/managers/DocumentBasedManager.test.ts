/**
 * Tests for DocumentBasedManager
 * Following TDD principles
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentBasedManager } from '../../managers/DocumentBasedManager';
import '../setup/foundryMocks';

describe('DocumentBasedManager', () => {
  let manager: DocumentBasedManager;
  let mockActors: any[];
  let mockItems: any[];

  beforeEach(() => {
    manager = new DocumentBasedManager();

    // Mock actors (organizations and patrols)
    mockActors = [
      {
        id: 'org1',
        name: 'City Watch',
        type: 'guard-management.guard-organization',
        system: {
          subtitle: 'Protectors of the City',
          baseStats: { robustismo: 12, analitica: 10, subterfugio: 8, elocuencia: 11 },
          patrols: ['patrol1'],
          resources: ['resource1'],
          reputation: ['rep1'],
        },
      },
      {
        id: 'patrol1',
        name: 'Alpha Patrol',
        type: 'guard-management.patrol',
        system: {
          organizationId: 'org1',
          unitCount: 4,
          status: 'idle',
        },
      },
    ];

    // Mock items (resources and reputation)
    mockItems = [
      {
        id: 'resource1',
        name: 'Steel Weapons',
        type: 'guard-management.guard-resource',
        system: {
          organizationId: 'org1',
          quantity: 25,
        },
      },
      {
        id: 'rep1',
        name: 'Noble Houses',
        type: 'guard-management.guard-reputation',
        system: {
          organizationId: 'org1',
          level: 5,
        },
      },
    ];

    // Mock game collections
    (global as any).game = {
      actors: {
        filter: vi.fn((predicate: any) => mockActors.filter(predicate)),
        get: vi.fn((id: string) => mockActors.find((a) => a.id === id) || null),
      },
      items: {
        filter: vi.fn((predicate: any) => mockItems.filter(predicate)),
        get: vi.fn((id: string) => mockItems.find((i) => i.id === id) || null),
      },
    };

    // Mock Hooks
    (global as any).Hooks = {
      on: vi.fn(),
    };

    // Mock document creation functions
    (global as any).Actor = {
      create: vi.fn().mockImplementation((data: any) => ({
        id: `new-actor-${Math.random()}`,
        ...data,
      })),
    };

    (global as any).Item = {
      create: vi.fn().mockImplementation((data: any) => ({
        id: `new-item-${Math.random()}`,
        ...data,
      })),
    };
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await manager.initialize();

      expect((manager as any).initialized).toBe(true);
      expect((global as any).Hooks.on).toHaveBeenCalledWith('updateActor', expect.any(Function));
      expect((global as any).Hooks.on).toHaveBeenCalledWith('updateItem', expect.any(Function));
      expect((global as any).Hooks.on).toHaveBeenCalledWith('createActor', expect.any(Function));
    });

    it('should not initialize twice', async () => {
      await manager.initialize();
      const hookCallCount = ((global as any).Hooks.on as any).mock.calls.length;

      await manager.initialize(); // Second initialization

      expect(((global as any).Hooks.on as any).mock.calls.length).toBe(hookCallCount);
    });
  });

  describe('Guard Organization Management', () => {
    it('should get all guard organizations', () => {
      const organizations = manager.getGuardOrganizations();

      expect(organizations).toHaveLength(1);
      expect(organizations[0].id).toBe('org1');
      expect(organizations[0].type).toBe('guard-management.guard-organization');
    });

    it('should get guard organization by ID', () => {
      const org = manager.getGuardOrganization('org1');

      expect(org).toBeDefined();
      expect(org.id).toBe('org1');
      expect(org.name).toBe('City Watch');
    });

    it('should return null for non-existent organization', () => {
      const org = manager.getGuardOrganization('non-existent');

      expect(org).toBeNull();
    });

    it('should create guard organization', async () => {
      const orgData = {
        name: 'Test Organization',
        subtitle: 'Testing Unit',
        baseStats: {
          robustismo: 10,
          analitica: 8,
          subterfugio: 12,
          elocuencia: 9,
        },
      };

      const result = await manager.createGuardOrganization(orgData);

      expect((global as any).Actor.create).toHaveBeenCalledWith({
        name: 'Test Organization',
        type: 'guard-management.guard-organization',
        system: expect.objectContaining({
          subtitle: 'Testing Unit',
          baseStats: orgData.baseStats,
        }),
      });

      expect(result).toBeDefined();
    });

    it('should update guard organization', async () => {
      const mockUpdate = vi.fn();
      mockActors[0].update = mockUpdate;

      const updateData = {
        name: 'Updated City Watch',
        subtitle: 'Updated subtitle',
        baseStats: { robustismo: 15, analitica: 12, subterfugio: 10, elocuencia: 13 },
        version: 2,
      };

      const result = await manager.updateGuardOrganization('org1', updateData);

      expect(result).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({
        name: 'Updated City Watch',
        'system.subtitle': 'Updated subtitle',
        'system.baseStats': updateData.baseStats,
        'system.version': 2,
      });
    });

    it('should not update non-existent organization', async () => {
      const result = await manager.updateGuardOrganization('non-existent', {});

      expect(result).toBe(false);
    });

    it('should delete guard organization and cleanup references', async () => {
      const mockDelete = vi.fn();
      const mockPatrolDelete = vi.fn();
      const mockResourceDelete = vi.fn();
      const mockRepDelete = vi.fn();

      mockActors[0].delete = mockDelete;
      mockActors[1].delete = mockPatrolDelete;
      mockItems[0].delete = mockResourceDelete;
      mockItems[1].delete = mockRepDelete;

      const result = await manager.deleteGuardOrganization('org1');

      expect(result).toBe(true);
      expect(mockPatrolDelete).toHaveBeenCalled(); // Associated patrol deleted
      expect(mockResourceDelete).toHaveBeenCalled(); // Associated resource deleted
      expect(mockRepDelete).toHaveBeenCalled(); // Associated reputation deleted
      expect(mockDelete).toHaveBeenCalled(); // Organization itself deleted
    });
  });

  describe('Patrol Management', () => {
    it('should get all patrols', () => {
      const patrols = manager.getPatrols();

      expect(patrols).toHaveLength(1);
      expect(patrols[0].id).toBe('patrol1');
      expect(patrols[0].type).toBe('guard-management.patrol');
    });

    it('should get patrols for specific organization', () => {
      const patrols = manager.getPatrolsForOrganization('org1');

      expect(patrols).toHaveLength(1);
      expect(patrols[0].system.organizationId).toBe('org1');
    });

    it('should create patrol and link to organization', async () => {
      const mockAddPatrol = vi.fn();
      mockActors[0].system = { addPatrol: mockAddPatrol };

      const patrolData = {
        name: 'Test Patrol',
        organizationId: 'org1',
        unitCount: 3,
        status: 'idle' as const,
      };

      await manager.createPatrol(patrolData);

      expect((global as any).Actor.create).toHaveBeenCalledWith({
        name: 'Test Patrol',
        type: 'guard-management.patrol',
        system: expect.objectContaining({
          organizationId: 'org1',
          unitCount: 3,
          status: 'idle',
        }),
      });

      expect(mockAddPatrol).toHaveBeenCalled();
    });

    it('should update patrol', async () => {
      const mockUpdate = vi.fn();
      mockActors[1].update = mockUpdate;

      const updateData = {
        name: 'Updated Alpha Patrol',
        unitCount: 6,
        status: 'deployed' as const,
        version: 2,
      };

      const result = await manager.updatePatrol('patrol1', updateData);

      expect(result).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({
        name: 'Updated Alpha Patrol',
        'system.unitCount': 6,
        'system.status': 'deployed',
        'system.version': 2,
      });
    });

    it('should delete patrol and remove from organization', async () => {
      const mockDelete = vi.fn();
      const mockRemovePatrol = vi.fn();

      mockActors[1].delete = mockDelete;
      mockActors[0].system = { removePatrol: mockRemovePatrol };

      const result = await manager.deletePatrol('patrol1');

      expect(result).toBe(true);
      expect(mockRemovePatrol).toHaveBeenCalledWith('patrol1');
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe('Resource Management', () => {
    it('should get all guard resources', () => {
      const resources = manager.getGuardResources();

      expect(resources).toHaveLength(1);
      expect(resources[0].id).toBe('resource1');
      expect(resources[0].type).toBe('guard-management.guard-resource');
    });

    it('should get resources for specific organization', () => {
      const resources = manager.getResourcesForOrganization('org1');

      expect(resources).toHaveLength(1);
      expect(resources[0].system.organizationId).toBe('org1');
    });

    it('should create resource and link to organization', async () => {
      const mockAddResource = vi.fn();
      mockActors[0].system = { addResource: mockAddResource };

      const resourceData = {
        name: 'Test Resource',
        description: 'Test description',
        quantity: 10,
        organizationId: 'org1',
      };

      await manager.createGuardResource(resourceData);

      expect((global as any).Item.create).toHaveBeenCalledWith({
        name: 'Test Resource',
        type: 'guard-management.guard-resource',
        system: expect.objectContaining({
          description: 'Test description',
          quantity: 10,
          organizationId: 'org1',
        }),
      });

      expect(mockAddResource).toHaveBeenCalled();
    });

    it('should update guard resource', async () => {
      const mockUpdate = vi.fn();
      mockItems[0].update = mockUpdate;

      const updateData = {
        name: 'Updated Steel Weapons',
        description: 'Updated description',
        quantity: 30,
        version: 2,
      };

      const result = await manager.updateGuardResource('resource1', updateData);

      expect(result).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({
        name: 'Updated Steel Weapons',
        'system.description': 'Updated description',
        'system.quantity': 30,
        'system.version': 2,
      });
    });
  });

  describe('Reputation Management', () => {
    it('should get all guard reputations', () => {
      const reputations = manager.getGuardReputations();

      expect(reputations).toHaveLength(1);
      expect(reputations[0].id).toBe('rep1');
      expect(reputations[0].type).toBe('guard-management.guard-reputation');
    });

    it('should get reputations for specific organization', () => {
      const reputations = manager.getReputationsForOrganization('org1');

      expect(reputations).toHaveLength(1);
      expect(reputations[0].system.organizationId).toBe('org1');
    });

    it('should create reputation and link to organization', async () => {
      const mockAddReputation = vi.fn();
      mockActors[0].system = { addReputation: mockAddReputation };

      const reputationData = {
        name: 'Test Reputation',
        description: 'Test description',
        level: 4,
        organizationId: 'org1',
      };

      await manager.createGuardReputation(reputationData);

      expect((global as any).Item.create).toHaveBeenCalledWith({
        name: 'Test Reputation',
        type: 'guard-management.guard-reputation',
        system: expect.objectContaining({
          description: 'Test description',
          level: 4,
          organizationId: 'org1',
        }),
      });

      expect(mockAddReputation).toHaveBeenCalled();
    });
  });

  describe('Sample Data Creation', () => {
    it('should create sample data', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await manager.createSampleData();

      expect((global as any).Actor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'City Watch',
          type: 'guard-management.guard-organization',
        })
      );

      expect((global as any).Item.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Steel Weapons',
          type: 'guard-management.guard-resource',
        })
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        'DocumentBasedManager | Sample data created successfully'
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Event Handling', () => {
    it('should emit custom events on document updates', () => {
      const mockDispatchEvent = vi.fn();
      (global as any).window = { dispatchEvent: mockDispatchEvent };

      const mockDocument = { type: 'guard-management.guard-organization' };
      const mockData = { 'system.name': 'Updated Name' };

      // Access private method for testing
      (manager as any).onDocumentUpdate('actor', mockDocument, mockData, 'user123');

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'guard-document-updated',
          detail: {
            docType: 'actor',
            document: mockDocument,
            data: mockData,
            userId: 'user123',
            type: 'guard-management.guard-organization',
          },
        })
      );
    });

    it('should handle missing game gracefully', () => {
      (global as any).game = undefined;

      expect(manager.getGuardOrganizations()).toEqual([]);
      expect(manager.getPatrols()).toEqual([]);
      expect(manager.getGuardResources()).toEqual([]);
      expect(manager.getGuardReputations()).toEqual([]);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup properly', () => {
      manager.cleanup();

      expect((manager as any).initialized).toBe(false);
    });
  });
});
