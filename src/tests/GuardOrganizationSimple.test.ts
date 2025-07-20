/**
 * Guard Organization CRUD Tests - Working Version
 */

import { describe, expect, it } from 'vitest';
import { GuardOrganizationManager } from '../managers/GuardOrganizationManagerSimple';
import { DEFAULT_GUARD_STATS } from '../types/entities';

// Setup mocks inline
(global as any).foundry = {
  utils: {
    randomID: () => 'test-id-' + Date.now(),
  },
};

(global as any).game = {
  settings: {
    get: () => [],
    set: () => Promise.resolve(),
  },
};

describe('Guard Organization CRUD Operations', () => {
  describe('Create Organization', () => {
    it('should create a new organization with basic information', async () => {
      const guardManager = new GuardOrganizationManager();

      const organizationData = {
        name: 'Elite Guard Organization',
        subtitle: 'Palace Guards',
        baseStats: DEFAULT_GUARD_STATS,
      };

      const organization = await guardManager.createOrganization(organizationData);

      expect(organization).toBeDefined();
      expect(organization.id).toBeDefined();
      expect(organization.name).toBe('Elite Guard Organization');
      expect(organization.subtitle).toBe('Palace Guards');
      expect(organization.baseStats).toEqual(DEFAULT_GUARD_STATS);
      expect(organization.activeModifiers).toEqual([]);
      expect(organization.resources).toEqual([]);
      expect(organization.reputation).toEqual([]);
      expect(organization.patrols).toEqual([]);
      expect(organization.createdAt).toBeInstanceOf(Date);
      expect(organization.updatedAt).toBeInstanceOf(Date);
      expect(organization.version).toBe(1);
    });
  });
});
