/**
 * GM Warehouse Dialog Tests
 * Testing the GM-only warehouse interface with tabs system
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GMWarehouseDialog } from '../../dialogs/GMWarehouseDialog';
import '../setup/foundryMocks';
import { clearMockData } from '../setup/foundryMocks';

describe('GMWarehouseDialog', () => {
  let dialog: GMWarehouseDialog;

  beforeEach(() => {
    clearMockData();
    // Mock GM user by default
    (global as any).game.user.isGM = true;
    dialog = new GMWarehouseDialog();
  });

  describe('Dialog Creation', () => {
    it('should create dialog with GM permissions', () => {
      expect(dialog).toBeDefined();
    });

    it('should throw error if user is not GM', () => {
      (global as any).game.user.isGM = false;

      expect(() => new GMWarehouseDialog()).toThrow('Only GM can access the warehouse');
    });
  });

  describe('Content Generation', () => {
    it('should generate content with all tabs', () => {
      const content = (dialog as any).generateContent();

      expect(content).toContain('Resources');
      expect(content).toContain('Reputation');
      expect(content).toContain('Patrol Effects');
      expect(content).toContain('Guard Modifiers');
    });

    it('should have Resources tab active by default', () => {
      const content = (dialog as any).generateContent();

      // Check if the content contains the expected active tab structure
      expect(content).toContain('class="item tab active" data-tab="resources"');
      expect(content).toContain('class="tab-content active" data-tab="resources"');
    });

    it('should include all expected tabs', () => {
      const content = (dialog as any).generateContent();

      // Check that all tab data-tab attributes are present
      expect(content).toContain('data-tab="resources"');
      expect(content).toContain('data-tab="reputation"');
      expect(content).toContain('data-tab="patrol-effects"');
      expect(content).toContain('data-tab="guard-modifiers"');
    });

    it('should include add buttons for each tab', () => {
      const content = (dialog as any).generateContent();

      expect(content).toContain('add-resource-btn');
      expect(content).toContain('add-reputation-btn');
      expect(content).toContain('add-patrol-effect-btn');
      expect(content).toContain('add-guard-modifier-btn');
    });

    it('should include empty state messages', () => {
      const content = (dialog as any).generateContent();

      expect(content).toContain('No resource templates created yet');
      expect(content).toContain('No reputation templates created yet');
      expect(content).toContain('No patrol effect templates created yet');
      expect(content).toContain('No guard modifier templates created yet');
    });

    it('should include tab switching script', () => {
      const content = (dialog as any).generateContent();

      expect(content).toContain('<script>');
      expect(content).toContain('document.addEventListener');
      expect(content).toContain('data-tab');
    });
  });

  describe('Show Dialog Method', () => {
    it('should call generateContent when showing dialog', async () => {
      const generateContentSpy = vi.spyOn(dialog as any, 'generateContent');

      // Mock DialogV2 to avoid actual dialog rendering
      (global as any).foundry = {
        applications: {
          api: {
            DialogV2: {
              wait: vi.fn().mockResolvedValue('close'),
            },
          },
        },
      };

      await dialog.show();

      expect(generateContentSpy).toHaveBeenCalled();
    });

    it('should use standard dialog fallback if DialogV2 unavailable', async () => {
      // Mock missing DialogV2
      (global as any).foundry = {};

      const standardDialogSpy = vi.spyOn(dialog as any, 'showWithStandardDialog');
      standardDialogSpy.mockResolvedValue(true);

      await dialog.show();

      expect(standardDialogSpy).toHaveBeenCalled();
    });
  });

  describe('Static Show Method', () => {
    it('should create and show dialog', async () => {
      // Mock DialogV2
      (global as any).foundry = {
        applications: {
          api: {
            DialogV2: {
              wait: vi.fn().mockResolvedValue('close'),
            },
          },
        },
      };

      const result = await GMWarehouseDialog.show();

      expect(result).toBe(true);
    });

    it('should handle permission error gracefully', async () => {
      (global as any).game.user.isGM = false;

      // Mock ui.notifications
      (global as any).ui = {
        notifications: {
          error: vi.fn(),
        },
      };

      const result = await GMWarehouseDialog.show();

      expect(result).toBe(false);
      expect((global as any).ui.notifications.error).toHaveBeenCalledWith(
        'Solo el GM puede acceder al almacén de plantillas'
      );
    });
  });

  describe('Content Sections', () => {
    it('should have correct structure for each tab content', () => {
      const content = (dialog as any).generateContent();

      // Check that each section header is present
      expect(content).toContain('Resources Templates');
      expect(content).toContain('Reputation Templates');
      expect(content).toContain('Patrol Effects Templates');
      expect(content).toContain('Guard Modifiers Templates');

      // Check that each tab content section is present
      expect(content).toContain('data-tab="resources"');
      expect(content).toContain('data-tab="reputation"');
      expect(content).toContain('data-tab="patrol-effects"');
      expect(content).toContain('data-tab="guard-modifiers"');
    });
  });
});
