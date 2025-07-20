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
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      baseStats: {
        robustismo: 12,
        analitica: 10,
        subterfugio: 8,
        elocuencia: 11,
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
          robustismo: 10,
          analitica: 10,
          subterfugio: 10,
          elocuencia: 10,
        }),
      };

      const result = await dialog.show('create');
      expect(result?.name).toBe('New Guard Organization');
      expect(result?.baseStats.robustismo).toBe(10);
    });
  });

  describe('edit mode', () => {
    it('should open dialog in edit mode with existing data', async () => {
      // Mock DialogV2.query to return updated data
      (globalThis as any).DialogV2 = {
        query: vi.fn().mockResolvedValue({
          name: 'Updated Guard Organization',
          subtitle: 'Updated Unit',
          robustismo: 15,
          analitica: 12,
          subterfugio: 10,
          elocuencia: 13,
        }),
      };

      const result = await dialog.show('edit', mockGuardOrganization);
      expect(result?.name).toBe('Updated Guard Organization');
      expect(result?.baseStats.robustismo).toBe(15);
    });

    it('should populate fields with existing organization data', () => {
      const content = dialog.generateContent('edit', mockGuardOrganization);
      expect(content).toContain('Test Guard Organization');
      expect(content).toContain('Testing Unit');
      expect(content).toContain('12'); // robustismo value
    });
  });

  describe('validation', () => {
    it('should validate required fields', () => {
      const isValid = dialog.validateData({
        name: '',
        subtitle: 'Test',
        robustismo: 10,
        analitica: 10,
        subterfugio: 10,
        elocuencia: 10,
      });
      expect(isValid).toBe(false);
    });

    it('should validate stat ranges', () => {
      const isValid = dialog.validateData({
        name: 'Test Organization',
        subtitle: 'Test',
        robustismo: -5, // Invalid negative value
        analitica: 10,
        subterfugio: 10,
        elocuencia: 10,
      });
      expect(isValid).toBe(false);
    });

    it('should pass validation with valid data', () => {
      const isValid = dialog.validateData({
        name: 'Test Organization',
        subtitle: 'Test',
        robustismo: 10,
        analitica: 10,
        subterfugio: 10,
        elocuencia: 10,
      });
      expect(isValid).toBe(true);
    });
  });

  describe('content generation', () => {
    it('should generate form HTML content', () => {
      const content = dialog.generateContent('create');
      expect(content).toContain('guard-organization-form');
      expect(content).toContain('Nombre de la Organización');
    });

    it('should populate fields with existing data in edit mode', () => {
      const content = dialog.generateContent('edit', mockGuardOrganization);
      expect(content).toContain('Test Guard Organization');
      expect(content).toContain('Testing Unit');
      expect(content).toContain('12'); // robustismo value
    });

    it('should include all stat input fields', () => {
      const content = dialog.generateContent('create');
      expect(content).toContain('name="robustismo"');
      expect(content).toContain('name="analitica"');
      expect(content).toContain('name="subterfugio"');
      expect(content).toContain('name="elocuencia"');
    });

    it('should include name and subtitle fields', () => {
      const content = dialog.generateContent('create');
      expect(content).toContain('name="name"');
      expect(content).toContain('name="subtitle"');
    });
  });
});
