/**
 * Main entry point for the Guard Management module
 * Handles initialization and data synchronization between Player and GM
 */

import { registerDataModels } from './documents/index';
import { registerHooks } from './hooks';
import { DocumentBasedManager } from './managers/DocumentBasedManager';
import { SimpleGuardDialogManager } from './managers/SimpleGuardDialogManager';
import { SyncManager } from './managers/SyncManager';
import { registerSettings } from './settings';
import './styles/custom-info-dialog.css';
import './styles/main.css';
import { FloatingGuardPanel } from './ui/FloatingGuardPanel';
import { GuardManagementHelpers } from './utils/console-helpers';

// Global module reference
let guardManagementModule: GuardManagementModule;

class GuardManagementModule {
  public documentManager: DocumentBasedManager;
  public guardDialogManager: SimpleGuardDialogManager;
  public syncManager: SyncManager;
  public floatingPanel: FloatingGuardPanel;

  constructor() {
    this.documentManager = new DocumentBasedManager();
    this.guardDialogManager = new SimpleGuardDialogManager(this.documentManager);
    this.syncManager = new SyncManager();
    this.floatingPanel = new FloatingGuardPanel(this.guardDialogManager as any);
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
    await this.guardDialogManager.initialize();
    await this.syncManager.initialize();

    // Initialize floating panel
    this.floatingPanel.initialize();
    this.floatingPanel.show(); // Always show the panel on startup

    // Set up event listeners for panel updates
    this.setupEventListeners();

    console.log('Guard Management | Module initialized successfully');
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
    this.syncManager.cleanup();
    this.guardDialogManager.cleanup();
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

Hooks.once('ready', () => {
  console.log('Guard Management | Foundry is ready, module is active');

  // Ensure the floating panel is visible when Foundry is ready
  if (guardManagementModule && guardManagementModule.floatingPanel) {
    guardManagementModule.floatingPanel.show();
  }
});
