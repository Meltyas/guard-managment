/**
 * Main entry point for the Guard Management module
 * Handles initialization and data synchronization between Player and GM
 */

import { registerDataModels } from './documents/index';
import { registerHooks } from './hooks';
import { DocumentBasedManager } from './managers/DocumentBasedManager';
import { DocumentEventManager } from './managers/DocumentEventManager';
import { GuardDialogManager } from './managers/GuardDialogManager';
import { GuardOrganizationManager } from './managers/GuardOrganizationManager';
import { registerSettings } from './settings';
import './styles/custom-info-dialog.css';
import './styles/gm-warehouse.css';
import './styles/main.css';
import { FloatingGuardPanel } from './ui/FloatingGuardPanel';
import { GuardManagementHelpers } from './utils/console-helpers';
import { TooltipGenerator } from './utils/TooltipGenerator';

// Global module reference
let guardManagementModule: GuardManagementModule;

/**
 * Set up a watchdog to detect if something deletes our module from window
 */
function setupModuleWatchdog(moduleInstance: GuardManagementModule): void {
  // Store a backup reference
  (globalThis as any)._guardManagementBackup = moduleInstance;

  // Set up immediate monitoring using Object.defineProperty
  try {
    let currentValue = moduleInstance;

    Object.defineProperty(window, 'GuardManagement', {
      get() {
        return currentValue;
      },
      set(newValue) {
        if (newValue === null || newValue === undefined) {
          // Don't allow deletion - keep the original value
          return;
        } else if (newValue !== moduleInstance) {
          // Don't allow replacement with different object
          return;
        } else {
          // Allow setting to the same instance
          currentValue = newValue;
        }
      },
      configurable: false, // Prevent deletion of the property
      enumerable: true,
    });
  } catch (error) {
    console.error(
      'Guard Management | Failed to set up property protection, falling back to interval:',
      error
    );

    // Fallback to interval-based monitoring
    const watchdogInterval = setInterval(() => {
      const currentModule = (window as any).GuardManagement;

      if (!currentModule) {
        // Restore the module
        (window as any).GuardManagement = moduleInstance;

        // Notify the user
        if ((globalThis as any).ui?.notifications) {
          (globalThis as any).ui.notifications.warn(
            'Guard Management module was unexpectedly removed and has been restored.'
          );
        }
      } else if (currentModule !== moduleInstance) {
        // Restore our module
        (window as any).GuardManagement = moduleInstance;
      }
    }, 1000);

    // Store the interval ID so we can clear it if needed
    (moduleInstance as any)._watchdogInterval = watchdogInterval;
  }
}

class GuardManagementModule {
  public documentManager: DocumentBasedManager;
  public documentEventManager: DocumentEventManager;
  public guardOrganizationManager: GuardOrganizationManager;
  public guardDialogManager: GuardDialogManager;
  public floatingPanel: FloatingGuardPanel;
  public isInitialized: boolean = false;

  constructor() {
    this.documentManager = new DocumentBasedManager();
    this.documentEventManager = new DocumentEventManager(this.documentManager);
    this.guardOrganizationManager = new GuardOrganizationManager();
    this.guardDialogManager = new GuardDialogManager(this.guardOrganizationManager);
    this.floatingPanel = new FloatingGuardPanel(this.guardDialogManager);
  }

  /**
   * Initialize the module
   */
  public async initialize(): Promise<void> {
    // Register custom DataModels
    registerDataModels();

    // Register module settings
    registerSettings();

    // Register Foundry hooks
    registerHooks();

    // Initialize managers
    await this.documentManager.initialize();
    await this.documentEventManager.initialize();
    await this.guardOrganizationManager.initialize();
    await this.guardDialogManager.initialize();

    // Initialize floating panel (but don't show it yet)
    this.floatingPanel.initialize();

    // Set up event listeners for panel updates
    this.setupEventListeners();

    this.isInitialized = true;
  }

  /**
   * Refresh floating panel when game is ready
   */
  public refreshFloatingPanel(): void {
    if (this.floatingPanel) {
      this.floatingPanel.refreshPanel();
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Listen for organization updates to refresh floating panel
    window.addEventListener('guard-organizations-updated', () => {
      this.floatingPanel.updateOrganizationList();
    });

    // Listen for canvas ready to ensure panel positioning
    Hooks.once('canvasReady', () => {
      setTimeout(() => {
        this.floatingPanel.show(); // Ensure panel is visible
        this.floatingPanel.updateOrganizationList();
      }, 1000);
    });
  }

  /**
   * Show/hide the floating panel
   */
  public toggleFloatingPanel(): void {
    this.floatingPanel.toggle();
  }

  /**
   * Show the management dialog
   */
  public async showManageOrganizationsDialog(): Promise<void> {
    await this.guardDialogManager.showManageOrganizationsDialog();
  }

  /**
   * Debug method to check module state
   */
  public debugModuleState(): void {
    console.log('=== GUARD MANAGEMENT MODULE DEBUG ===');
    console.log('Module instance:', {
      documentManager: !!this.documentManager,
      guardOrganizationManager: !!this.guardOrganizationManager,
      guardDialogManager: !!this.guardDialogManager,
      floatingPanel: !!this.floatingPanel,
      isInitialized: this.isInitialized,
    });
    console.log('Window export:', {
      windowGuardManagement: !!(window as any).GuardManagement,
      sameInstance: (window as any).GuardManagement === this,
    });
    console.log('Foundry state:', {
      game: !!game,
      user: !!(game as any)?.user,
      isGM: !!(game as any)?.user?.isGM,
      ready: game?.ready,
    });
  }

  /**
   * Fix permissions for all Guard Management documents
   * This ensures all users can edit all entities
   */
  public async fixDocumentPermissions(): Promise<void> {
    if (!this.isInitialized || !this.documentManager) {
      console.error('Guard Management | Module not initialized - cannot fix permissions');
      return;
    }

    await this.documentManager.fixAllDocumentPermissions();
  }

  /**
   * Clean up resources when the module is disabled
   */
  public cleanup(): void {
    // Clear the watchdog interval
    const watchdogInterval = (this as any)._watchdogInterval;
    if (watchdogInterval) {
      clearInterval(watchdogInterval);
    }

    this.floatingPanel.cleanup();
    this.guardDialogManager.cleanup();
    this.guardOrganizationManager?.cleanup?.();
    this.documentManager.cleanup();
  }
}

// Foundry VTT Hooks
Hooks.once('init', async () => {
  try {
    // Preload Handlebars templates
    await loadTemplates([
      'modules/guard-management/templates/panels/general.hbs',
      'modules/guard-management/templates/panels/patrols.hbs',
      'modules/guard-management/templates/panels/resources.hbs',
      'modules/guard-management/templates/panels/reputation.hbs',
    ]);

    // Register Handlebars helpers
    Handlebars.registerHelper('guardTooltip', (item, type) => {
      if (type === 'resource') {
        return TooltipGenerator.generateResourceTooltip(item);
      } else if (type === 'reputation') {
        return TooltipGenerator.generateReputationTooltip(item);
      } else {
        // Default to patrol effect
        return TooltipGenerator.generatePatrolEffectTooltip(item);
      }
    });

    Handlebars.registerHelper('patrolStatTooltip', (stat) => {
      const orgSign = stat.org >= 0 ? '+' : '';
      const effSign = stat.effects >= 0 ? '+' : '';

      let html = `<table style="border-collapse: collapse; width: 100%; font-size: 0.9em;">`;

      // Base
      html += `<tr>
        <td style="text-align: center; padding: 2px 8px 2px 0; font-weight: bold; min-width: 25px;">${stat.base}</td>
        <td style="padding: 2px 0;">Base</td>
      </tr>`;

      // Organization
      html += `<tr>
        <td style="text-align: center; padding: 2px 8px 2px 0; font-weight: bold;">${orgSign}${stat.org}</td>
        <td style="padding: 2px 0;">Organización</td>
      </tr>`;

      // Effects Header
      html += `<tr>
        <td style="text-align: center; padding: 2px 8px 2px 0; font-weight: bold;">${effSign}${stat.effects}</td>
        <td style="padding: 2px 0;">Efectos:</td>
      </tr>`;

      // Effects List
      if (stat.effectList && stat.effectList.length > 0) {
        for (const eff of stat.effectList) {
          const valStr = eff.value >= 0 ? `+${eff.value}` : `${eff.value}`;
          const imgHtml = eff.img
            ? `<img src='${eff.img}' style='width: 24px; height: 24px; border: none; object-fit: cover; vertical-align: middle;' />`
            : '';

          html += `<tr>
                <td style="text-align: center; padding: 2px 8px 2px 0; font-size: 0.9em; opacity: 0.8;">${valStr}</td>
                <td style="padding: 1px 0;">
                    <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px; width: 100%; box-sizing: border-box;">
                        ${imgHtml}
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${eff.name}</span>
                    </div>
                </td>
            </tr>`;
        }
      }

      // Total
      html += `<tr style="border-top: 1px solid rgba(255,255,255,0.3);">
        <td style="text-align: center; padding: 6px 8px 2px 0; font-weight: bold; font-size: 1.1em;">${stat.total}</td>
        <td style="padding: 6px 0 2px 0; font-weight: bold;">Total</td>
      </tr>`;

      html += `</table>`;

      return html;
    });

    guardManagementModule = new GuardManagementModule();
    await guardManagementModule.initialize();

    // Export for global access
    (window as any).GuardManagement = guardManagementModule;

    // Set up a watchdog to detect if something deletes our module
    setupModuleWatchdog(guardManagementModule);

    // Initialize console helpers
    GuardManagementHelpers.help();
  } catch (error) {
    console.error('Guard Management | CRITICAL ERROR during initialization:', error);

    if (error instanceof Error) {
      console.error('Guard Management | Error stack:', error.stack);
      console.error('Guard Management | Error name:', error.name);
      console.error('Guard Management | Error message:', error.message);

      // Try to export a minimal version to avoid complete failure
      (window as any).GuardManagement = {
        isInitialized: false,
        error: error.message,
        documentManager: null,
      };
    } else {
      console.error('Guard Management | Unknown error type:', typeof error);

      // Try to export a minimal version to avoid complete failure
      (window as any).GuardManagement = {
        isInitialized: false,
        error: 'Unknown initialization error',
        documentManager: null,
      };
    }
  }
});

Hooks.once('ready', async () => {
  // Check if module was properly initialized
  const gm = (window as any).GuardManagement;
  if (!gm || !gm.isInitialized) {
    console.error('Guard Management | Module not properly initialized');
    return;
  }

  // Refresh floating panel to ensure GM status is correct
  if (guardManagementModule && guardManagementModule.floatingPanel) {
    guardManagementModule.refreshFloatingPanel();
    guardManagementModule.floatingPanel.show();

    // Check if there are any organizations, if not create sample data
    const organizations = guardManagementModule.documentManager.getGuardOrganizations();
    if (organizations.length === 0) {
      try {
        await guardManagementModule.documentManager.createSampleData();

        // Update the floating panel to show the new organizations
        setTimeout(() => {
          guardManagementModule.floatingPanel.updateOrganizationList();
        }, 500);
      } catch (error) {
        console.error('Guard Management | Error creating sample data:', error);
      }
    }
  }
});
