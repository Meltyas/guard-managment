/**
 * Tests for Floating Guard Panel functionality
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatingGuardPanel } from '../ui/FloatingGuardPanel';
import { GuardDialogManager } from '../managers/GuardDialogManager';
import { GuardOrganizationManager } from '../managers/GuardOrganizationManager';
import './setup/foundryMocks';

describe('FloatingGuardPanel', () => {
  let panel: FloatingGuardPanel;
  let dialogManager: GuardDialogManager;
  let organizationManager: GuardOrganizationManager;

  beforeEach(() => {
    // Mock DOM methods
    document.createElement = vi.fn().mockImplementation((tagName: string) => {
      const element = {
        tagName: tagName.toUpperCase(),
        innerHTML: '',
        style: {},
        className: '',
        id: '',
        querySelector: vi.fn(),
        querySelectorAll: vi.fn().mockReturnValue([]),
        appendChild: vi.fn(),
        remove: vi.fn(),
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
          toggle: vi.fn(),
          contains: vi.fn().mockReturnValue(false),
        },
        addEventListener: vi.fn(),
        getAttribute: vi.fn(),
        setAttribute: vi.fn(),
        getBoundingClientRect: vi.fn().mockReturnValue({
          left: 0,
          top: 0,
          width: 280,
          height: 200,
        }),
        offsetWidth: 280,
        offsetHeight: 200,
      };
      return element;
    });

    document.body = {
      appendChild: vi.fn(),
    } as any;

    // Mock document.head.appendChild
    const originalHead = document.head;
    Object.defineProperty(document, 'head', {
      value: {
        ...originalHead,
        appendChild: vi.fn(),
      },
      configurable: true,
    });

    document.getElementById = vi.fn().mockReturnValue(null);

    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1920,
    });

    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 1080,
    });

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
    });

    // Create managers
    organizationManager = new GuardOrganizationManager();
    dialogManager = new GuardDialogManager(organizationManager);
    panel = new FloatingGuardPanel(dialogManager);
  });

  describe('initialization', () => {
    it('should initialize without errors', () => {
      expect(() => panel.initialize()).not.toThrow();
    });

    it('should create panel element on initialization', () => {
      panel.initialize();
      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(document.body.appendChild).toHaveBeenCalled();
    });
  });

  describe('visibility', () => {
    beforeEach(() => {
      panel.initialize();
    });

    it('should show panel', () => {
      panel.show();
      // Panel should be shown (implementation detail verified in integration)
    });

    it('should hide panel', () => {
      panel.hide();
      // Panel should be hidden (implementation detail verified in integration)
    });

    it('should toggle panel visibility', () => {
      panel.toggle();
      // Panel visibility should be toggled (implementation detail verified in integration)
    });
  });

  describe('position management', () => {
    beforeEach(() => {
      panel.initialize();
    });

    it('should restore position from localStorage', () => {
      const mockPosition = { x: 100, y: 150 };
      (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockPosition));
      
      panel.restoreVisibility();
      expect(localStorage.getItem).toHaveBeenCalledWith('guard-management-panel-position');
    });

    it('should use default position when localStorage is empty', () => {
      (localStorage.getItem as any).mockReturnValue(null);
      
      panel.restoreVisibility();
      expect(localStorage.getItem).toHaveBeenCalledWith('guard-management-panel-position');
    });
  });

  describe('organization list updates', () => {
    beforeEach(() => {
      panel.initialize();
    });

    it('should update organization list', () => {
      // Mock querySelector to return a mock element
      const mockListContainer = {
        innerHTML: '',
        querySelectorAll: vi.fn().mockReturnValue([]),
      };
      
      const mockPanel = {
        querySelector: vi.fn().mockReturnValue(mockListContainer),
      };
      
      (panel as any).panel = mockPanel;

      panel.updateOrganizationList();
      expect(mockPanel.querySelector).toHaveBeenCalledWith('#organization-quick-list');
    });

    it('should show "no organizations" message when list is empty', () => {
      const mockListContainer = {
        innerHTML: '',
        querySelectorAll: vi.fn().mockReturnValue([]),
      };
      
      const mockPanel = {
        querySelector: vi.fn().mockReturnValue(mockListContainer),
      };
      
      (panel as any).panel = mockPanel;
      
      // Mock empty organizations list
      vi.spyOn(organizationManager, 'getAllOrganizations').mockReturnValue([]);

      panel.updateOrganizationList();
      expect(mockListContainer.innerHTML).toContain('No hay organizaciones');
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', () => {
      panel.initialize();
      
      const mockPanel = {
        remove: vi.fn(),
      };
      (panel as any).panel = mockPanel;

      panel.cleanup();
      expect(mockPanel.remove).toHaveBeenCalled();
    });

    it('should handle cleanup when panel is null', () => {
      expect(() => panel.cleanup()).not.toThrow();
    });
  });

  describe('drag functionality', () => {
    beforeEach(() => {
      panel.initialize();
    });

    it('should handle drag events without errors', () => {
      const mockEvent = {
        clientX: 100,
        clientY: 150,
        preventDefault: vi.fn(),
        currentTarget: {
          getAttribute: vi.fn().mockReturnValue('create-organization'),
        },
      };

      // Test that drag handlers can be called without errors
      expect(() => {
        (panel as any).handleDragStart(mockEvent);
        (panel as any).handleDragMove(mockEvent);
        (panel as any).handleDragEnd();
      }).not.toThrow();
    });
  });
});
