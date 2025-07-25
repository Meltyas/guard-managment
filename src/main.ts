/**
 * Main entry point for the Guard Management module
 * Handles initialization and data synchronization between Player and GM
 */

import { registerDataModels } from './documents/index';
import { registerHooks } from './hooks';
import { DocumentBasedManager } from './managers/DocumentBasedManager';
import { GuardDialogManager } from './managers/GuardDialogManager';
import { GuardOrganizationManager } from './managers/GuardOrganizationManager';
import { registerSettings } from './settings';
import './styles/custom-info-dialog.css';
import './styles/gm-warehouse.css';
import './styles/main.css';
import { FloatingGuardPanel } from './ui/FloatingGuardPanel';
import { GuardManagementHelpers } from './utils/console-helpers';

// Global module reference
let guardManagementModule: GuardManagementModule;

class GuardManagementModule {
  public documentManager: DocumentBasedManager;
  public guardOrganizationManager: GuardOrganizationManager;
  public guardDialogManager: GuardDialogManager;
  public floatingPanel: FloatingGuardPanel;

  constructor() {
    this.documentManager = new DocumentBasedManager();
    this.guardOrganizationManager = new GuardOrganizationManager();
    this.guardDialogManager = new GuardDialogManager(this.guardOrganizationManager);
    this.floatingPanel = new FloatingGuardPanel(this.guardDialogManager);
  }

  /**
   * Initialize the module
   */
  public async initialize(): Promise<void> {
    console.log('Guard Management | Initializing module...');

    // Register custom DataModels
    registerDataModels();

    // Register module settings
    registerSettings();

    // Register Foundry hooks
    registerHooks();

    // Initialize managers
    await this.documentManager.initialize();
    await this.guardOrganizationManager.initialize();
    await this.guardDialogManager.initialize();

    // Initialize floating panel
    this.floatingPanel.initialize();
    this.floatingPanel.show(); // Always show the panel on startup

    // Set up event listeners for panel updates
    this.setupEventListeners();

    console.log('Guard Management | Module initialized successfully');
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
   * Clean up resources when the module is disabled
   */
  public cleanup(): void {
    console.log('Guard Management | Cleaning up module...');
    this.floatingPanel.cleanup();
    this.guardDialogManager.cleanup();
    this.guardOrganizationManager?.cleanup?.();
    this.documentManager.cleanup();
  }
}

// Foundry VTT Hooks
Hooks.once('init', async () => {
  guardManagementModule = new GuardManagementModule();
  await guardManagementModule.initialize();

  // Export for global access
  (window as any).GuardManagement = guardManagementModule;

  // Initialize console helpers
  GuardManagementHelpers.help();
});

Hooks.once('ready', async () => {
  console.log('Guard Management | Foundry is ready, module is active');

  // Refresh floating panel to ensure GM status is correct
  if (guardManagementModule && guardManagementModule.floatingPanel) {
    guardManagementModule.refreshFloatingPanel();
    guardManagementModule.floatingPanel.show();

    // Check if there are any organizations, if not create sample data
    const organizations = guardManagementModule.documentManager.getGuardOrganizations();
    if (organizations.length === 0) {
      console.log('Guard Management | No organizations found, creating sample data...');
      try {
        await guardManagementModule.documentManager.createSampleData();
        console.log('Guard Management | Sample data created successfully');

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
