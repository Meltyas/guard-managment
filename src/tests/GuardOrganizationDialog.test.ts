/**
 * Tests for Guard Organization Dialog functionality
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuardOrganizationDialog } from '../dialogs/GuardOrganizationDialog';
import type { GuardOrganization } from '../types/entities';
import './setup/foundryMocks';

describe('GuardOrganizationDialog', () => {
  let dialog: GuardOrganizationDialog;
  let mockGuardOrganization: GuardOrganization;

  beforeEach(() => {
    dialog = new GuardOrganizationDialog();

    mockGuardOrganization = {
      id: 'test-org-1',
      name: 'Test Guard Organization',
      subtitle: 'Testing Unit',
      version: 1,
      baseStats: {
        agility: 12,
        strength: 10,
        finesse: 8,
        instinct: 11,
        presence: 10,
        knowledge: 9,
      },
      activeModifiers: [],
      resources: [],
      reputation: [],
      patrols: [],
    };
  });

  describe('create mode', () => {
    it('should open dialog in create mode', async () => {
      const result = await dialog.show('create');
      expect(result).toBeDefined();
    });

    it('should have default stats when creating new organization', async () => {
      // Mock DialogV2.query to return create data
      (globalThis as any).DialogV2 = {
        query: vi.fn().mockResolvedValue({
          name: 'New Guard Organization',
          subtitle: 'New Unit',
          agility: 10,
          strength: 10,
          finesse: 10,
          instinct: 10,
          presence: 10,
          knowledge: 10,
        }),
      };

      const result = await dialog.show('create');
      expect(result?.name).toBe('New Guard Organization');
      expect(result?.baseStats.agility).toBe(10);
    });
  });

  describe('edit mode', () => {
    it('should open dialog in edit mode with existing data', async () => {
      // Mock DialogV2.query to return updated data
      (globalThis as any).DialogV2 = {
        query: vi.fn().mockResolvedValue({
          name: 'Updated Guard Organization',
          subtitle: 'Updated Unit',
          agility: 15,
          strength: 12,
          finesse: 10,
          instinct: 13,
          presence: 10,
          knowledge: 12,
        }),
      };

      const result = await dialog.show('edit', mockGuardOrganization);
      expect(result?.name).toBe('Updated Guard Organization');
      expect(result?.baseStats.agility).toBe(15);
    });

    it('should populate fields with existing organization data', () => {
      const content = dialog.generateContent('edit', mockGuardOrganization);
      expect(content).toContain('Test Guard Organization');
      expect(content).toContain('Testing Unit');
    });
  });

  describe('validation', () => {
    it('should validate required fields', () => {
      const isValid = dialog.validateData({
        name: '',
        subtitle: 'Test',
        agility: 0,
        strength: 0,
        finesse: 0,
        instinct: 0,
        presence: 0,
        knowledge: 0,
      });
      expect(isValid).toBe(false);
    });

    it('should validate stat ranges', () => {
      const isValid = dialog.validateData({
        name: 'Test Organization',
        subtitle: 'Test',
        agility: -100, // Invalid: outside valid range (-99 to 99)
        strength: 10,
        finesse: 10,
        instinct: 10,
        presence: 10,
        knowledge: 10,
      });
      expect(isValid).toBe(false);
    });

    it('should pass validation with valid data', () => {
      const isValid = dialog.validateData({
        name: 'Test Organization',
        subtitle: 'Test',
        agility: 0,
        strength: 0,
        finesse: 0,
        instinct: 0,
        presence: 0,
        knowledge: 0,
      });
      expect(isValid).toBe(true);
    });

    it('should accept valid negative stat values', () => {
      const isValid = dialog.validateData({
        name: 'Test Organization',
        subtitle: 'Test',
        agility: -5,
        strength: -10,
        finesse: -99, // Valid boundary value
        instinct: 15,
        presence: 0,
        knowledge: 0,
      });
      expect(isValid).toBe(true);
    });
  });

  describe('content generation', () => {
    it('should populate fields with existing data in edit mode', () => {
      const content = dialog.generateContent('edit', mockGuardOrganization);
      expect(content).toContain('Test Guard Organization');
      expect(content).toContain('Testing Unit');
      expect(content).toContain('12'); // agility value
    });

    it('should include all stat input fields', () => {
      const content = dialog.generateContent('create');
      expect(content).toContain('name="agility"');
      expect(content).toContain('name="strength"');
      expect(content).toContain('name="finesse"');
      expect(content).toContain('name="instinct"');
      expect(content).toContain('name="presence"');
      expect(content).toContain('name="knowledge"');
    });

    it('should include name and subtitle fields', () => {
      const content = dialog.generateContent('create');
      expect(content).toContain('name="name"');
      expect(content).toContain('name="subtitle"');
    });
  });
});
