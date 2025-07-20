/**
 * Main entry point for the Guard Management module
 * Handles initialization and data synchronization between Player and GM
 */

import { GuardManager } from './managers/GuardManager';
import { SyncManager } from './managers/SyncManager';
import { registerSettings } from './settings';
import { registerHooks } from './hooks';
import './styles/main.css';

// Global module reference
let guardManagementModule: GuardManagementModule;

class GuardManagementModule {
  public guardManager: GuardManager;
  public syncManager: SyncManager;

  constructor() {
    this.guardManager = new GuardManager();
    this.syncManager = new SyncManager();
  }

  /**
   * Initialize the module
   */
  public async initialize(): Promise<void> {
    console.log('Guard Management | Initializing module...');
    
    // Register module settings
    registerSettings();
    
    // Register Foundry hooks
    registerHooks();
    
    // Initialize managers
    await this.guardManager.initialize();
    await this.syncManager.initialize();
    
    console.log('Guard Management | Module initialized successfully');
  }

  /**
   * Clean up resources when the module is disabled
   */
  public cleanup(): void {
    console.log('Guard Management | Cleaning up module...');
    this.syncManager.cleanup();
    this.guardManager.cleanup();
  }
}

// Foundry VTT Hooks
Hooks.once('init', async () => {
  guardManagementModule = new GuardManagementModule();
  await guardManagementModule.initialize();
});

Hooks.once('ready', () => {
  console.log('Guard Management | Foundry is ready, module is active');
});

// Export for global access
(window as any).GuardManagement = guardManagementModule;
