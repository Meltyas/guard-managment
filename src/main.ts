/**
 * Main entry point for the Guard Management module
 * Handles initialization and data synchronization between Player and GM
 */

import { GMWarehouseDialog } from './dialogs/GMWarehouseDialog';
import { OfficerWarehouseDialog } from './dialogs/OfficerWarehouseDialog';
import { registerDataModels } from './documents/index';
import { registerHooks } from './hooks';
import { CrimeManager } from './managers/CrimeManager';
import { GuardDialogManager } from './managers/GuardDialogManager';
import { GuardOrganizationManager } from './managers/GuardOrganizationManager';
import { OfficerManager } from './managers/OfficerManager';
import { CivilianManager } from './managers/CivilianManager';
import { PrisonerManager } from './managers/PrisonerManager';
import { PhaseManager } from './managers/PhaseManager';
import { SentenceConfigManager } from './managers/SentenceConfigManager';
import { SimpleModifierManager } from './managers/SimpleModifierManager';
import { SimplePatrolEffectManager } from './managers/SimplePatrolEffectManager';
import { SimpleReputationManager } from './managers/SimpleReputationManager';
import { SimpleResourceManager } from './managers/SimpleResourceManager';
import { runMigrationIfNeeded } from './migration';
import { registerSettings } from './settings';
import './styles/custom-info-dialog.css';
import './styles/gm-warehouse.css';
import './styles/main.css';
import './styles/officers.css';
import './styles/prisoners.css';
import './styles/crimes.css';
import { FloatingGuardPanel } from './ui/FloatingGuardPanel';
import { DayNightDecoration } from './ui/DayNightDecoration';
import { PatrolOverlayManager } from './ui/PatrolOverlayManager';
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
  public modifierManager: SimpleModifierManager;
  public patrolEffectManager: SimplePatrolEffectManager;
  public guardOrganizationManager: GuardOrganizationManager;
  public guardDialogManager: GuardDialogManager;
  public officerManager: OfficerManager;
  public civilianManager: CivilianManager;
  public prisonerManager: PrisonerManager;
  public crimeManager: CrimeManager;
  public sentenceConfigManager: SentenceConfigManager;
  public resourceManager: SimpleResourceManager;
  public reputationManager: SimpleReputationManager;
  public floatingPanel: FloatingGuardPanel;
  public patrolOverlayManager: PatrolOverlayManager;
  public phaseManager: PhaseManager;
  public dayNightDecoration: DayNightDecoration;
  public isInitialized: boolean = false;

  constructor() {
    this.modifierManager = new SimpleModifierManager();
    this.patrolEffectManager = new SimplePatrolEffectManager();
    this.guardOrganizationManager = new GuardOrganizationManager();
    this.guardDialogManager = new GuardDialogManager(this.guardOrganizationManager);
    this.officerManager = new OfficerManager();
    this.civilianManager = new CivilianManager();
    this.prisonerManager = new PrisonerManager();
    this.crimeManager = new CrimeManager();
    this.sentenceConfigManager = new SentenceConfigManager();
    this.resourceManager = new SimpleResourceManager();
    this.reputationManager = new SimpleReputationManager();
    this.floatingPanel = new FloatingGuardPanel(this.guardDialogManager);
    this.patrolOverlayManager = new PatrolOverlayManager();
    this.phaseManager = new PhaseManager();
    this.dayNightDecoration = new DayNightDecoration();
  }

  /**
   * Initialize the module
   */
  public async initialize(): Promise<void> {
    // Register custom types (for migration, no DataModels)
    registerDataModels();

    // Register module settings
    registerSettings();

    // Register Foundry hooks
    registerHooks();

    // Initialize managers
    await this.guardOrganizationManager.initialize();
    await this.guardDialogManager.initialize();
    await this.officerManager.initialize();
    await this.civilianManager.initialize();
    await this.prisonerManager.initialize();
    await this.crimeManager.initialize();
    await this.sentenceConfigManager.initialize();
    await this.resourceManager.initialize();
    await this.reputationManager.initialize();
    await this.modifierManager.initialize();
    await this.patrolEffectManager.initialize();
    await this.phaseManager.initialize();

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
        this.patrolOverlayManager.restoreActiveOverlays();
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
      modifierManager: !!this.modifierManager,
      patrolEffectManager: !!this.patrolEffectManager,
      guardOrganizationManager: !!this.guardOrganizationManager,
      guardDialogManager: !!this.guardDialogManager,
      prisonerManager: !!this.prisonerManager,
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
   * Clean up resources when the module is disabled
   */
  public cleanup(): void {
    // Clear the watchdog interval
    const watchdogInterval = (this as any)._watchdogInterval;
    if (watchdogInterval) {
      clearInterval(watchdogInterval);
    }

    this.floatingPanel.cleanup();
    this.patrolOverlayManager.cleanup();
    this.guardDialogManager.cleanup();
    this.guardOrganizationManager?.cleanup?.();
    this.dayNightDecoration.destroy();
  }
}

// Foundry VTT Hooks
Hooks.once('init', async () => {
  try {
    // Preload Handlebars templates
    await foundry.applications.handlebars.loadTemplates([
      'modules/guard-management/templates/panels/general.hbs',
      'modules/guard-management/templates/panels/patrols.hbs',
      'modules/guard-management/templates/panels/resources.hbs',
      'modules/guard-management/templates/panels/reputation.hbs',
      'modules/guard-management/templates/panels/prisoners.hbs',
      'modules/guard-management/templates/panels/crimes.hbs',
      'modules/guard-management/templates/overlays/patrol-overlay.hbs',
    ]);

    // Register Handlebars helpers
    Handlebars.registerHelper('eq', (a, b) => {
      return a === b;
    });

    Handlebars.registerHelper('subtract', (a, b) => {
      return (Number(a) || 0) - (Number(b) || 0);
    });

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

      let orgColor = '#ffffff';
      if (stat.org > 0) orgColor = '#4ae89a';
      else if (stat.org < 0) orgColor = '#e84a4a';

      let effColor = '#ffffff';
      if (stat.effects > 0) effColor = '#4ae89a';
      else if (stat.effects < 0) effColor = '#e84a4a';

      let html = `<table style="border-collapse: collapse; width: 100%; font-size: 17px;">`;

      // Base
      html += `<tr>
        <td style="text-align: center; padding: 2px 8px 2px 0; font-weight: bold; min-width: 25px;">${stat.base}</td>
        <td style="padding: 2px 0;">Base</td>
      </tr>`;

      // Organization
      html += `<tr>
        <td style="text-align: center; padding: 2px 8px 2px 0; font-weight: bold; color: ${orgColor};">${orgSign}${stat.org}</td>
        <td style="padding: 2px 0;">Organización</td>
      </tr>`;

      // Organization Modifiers List
      if (stat.orgModList && stat.orgModList.length > 0) {
        for (const mod of stat.orgModList) {
          const valStr = mod.value >= 0 ? `+${mod.value}` : `${mod.value}`;
          const imgHtml = mod.img
            ? `<img src='${mod.img}' style='width: 24px; height: 24px; border: none; object-fit: cover; vertical-align: middle;' />`
            : '';

          let color = '#ffffff'; // Neutral (white)
          if (mod.value > 0)
            color = '#4ae89a'; // Green
          else if (mod.value < 0) color = '#e84a4a'; // Red

          html += `<tr>
                <td></td>
                <td style="padding: 1px 0 1px 12px;">
                    <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(243, 194, 103, 0.1); padding: 2px 6px; border-radius: 4px; width: 100%; box-sizing: border-box; font-size: 0.9em;">
                        <span style="color: #f3c267; opacity: 0.7;">↳</span>
                        <span style="font-weight: bold; min-width: 20px; text-align: right; color: ${color};">${valStr}</span>
                        ${imgHtml}
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;">${mod.name}</span>
                    </div>
                </td>
            </tr>`;
        }
      }

      // Officer Stats
      if (stat.officer && stat.officer !== 0) {
        const offSign = stat.officer >= 0 ? '+' : '';
        let offColor = '#ffffff';
        if (stat.officer > 0) offColor = '#4ae89a';
        else if (stat.officer < 0) offColor = '#e84a4a';

        const offImgHtml = stat.officerImg
          ? `<img src='${stat.officerImg}' style='width: 24px; height: 24px; border: none; border-radius: 50%; object-fit: cover; vertical-align: middle;' />`
          : '<i class="fas fa-user-shield" style="font-size: 14px; opacity: 0.7;"></i>';

        html += `<tr>
          <td style="text-align: center; padding: 2px 8px 2px 0; font-weight: bold; color: ${offColor};">${offSign}${stat.officer}</td>
          <td style="padding: 2px 0;">
            <div style="display: inline-flex; align-items: center; gap: 6px;">
              ${offImgHtml}
              <span>${stat.officerName || 'Oficial'}</span>
            </div>
          </td>
        </tr>`;
      }

      // Effects Header
      html += `<tr>
        <td style="text-align: center; padding: 2px 8px 2px 0; font-weight: bold; color: ${effColor};">${effSign}${stat.effects}</td>
        <td style="padding: 2px 0;">Efectos:</td>
      </tr>`;

      // Effects List
      if (stat.effectList && stat.effectList.length > 0) {
        for (const eff of stat.effectList) {
          const valStr = eff.value >= 0 ? `+${eff.value}` : `${eff.value}`;
          const imgHtml = eff.img
            ? `<img src='${eff.img}' style='width: 24px; height: 24px; border: none; object-fit: cover; vertical-align: middle;' />`
            : '';

          let color = '#ffffff'; // Neutral (white)
          if (eff.value > 0)
            color = '#4ae89a'; // Green
          else if (eff.value < 0) color = '#e84a4a'; // Red

          html += `<tr>
                <td></td>
                <td style="padding: 1px 0 1px 12px;">
                    <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px; width: 100%; box-sizing: border-box; font-size: 0.9em;">
                        <span style="color: #ccc; opacity: 0.7;">↳</span>
                        <span style="font-weight: bold; min-width: 20px; text-align: right; color: ${color};">${valStr}</span>
                        ${imgHtml}
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;">${eff.name}</span>
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

    // Export OfficerWarehouseDialog for onChange callback
    (window as any).GuardManagement.OfficerWarehouseDialog = OfficerWarehouseDialog;

    // Export GMWarehouseDialog for onChange callback
    (window as any).GuardManagement.GMWarehouseDialog = GMWarehouseDialog;

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
      };
    } else {
      console.error('Guard Management | Unknown error type:', typeof error);

      // Try to export a minimal version to avoid complete failure
      (window as any).GuardManagement = {
        isInitialized: false,
        error: 'Unknown initialization error',
      };
    }
  }
});

Hooks.once('ready', async () => {
  // Configure tooltips to be fast
  if (game?.tooltip) {
    (game.tooltip as any).activationTime = 100; // 100ms delay
  }

  // CRITICAL: Allow Players to modify world settings (required for GM/Player sync)
  // Only the GM can modify core permissions - players cannot do this themselves.
  // This grants Player (1) and Trusted Player (2) roles write access to world settings,
  // which is required for scope:'world' settings to sync when a player makes a change.
  if ((game as any)?.user?.isGM) {
    try {
      const permissions = game?.settings?.get('core', 'permissions') as any;
      if (permissions && permissions.SETTINGS_MODIFY) {
        let changed = false;
        if (!permissions.SETTINGS_MODIFY.includes(1)) {
          permissions.SETTINGS_MODIFY.push(1);
          changed = true;
        }
        if (!permissions.SETTINGS_MODIFY.includes(2)) {
          permissions.SETTINGS_MODIFY.push(2);
          changed = true;
        }
        if (changed) {
          await game?.settings?.set('core', 'permissions', permissions);
          console.log('Guard Management | Configured permissions for Players to modify settings');
        }
      }
    } catch (error) {
      console.warn('Guard Management | Could not configure permissions:', error);
    }
  }

  // Check if module was properly initialized
  const gm = (window as any).GuardManagement;
  if (!gm || !gm.isInitialized) {
    console.error('Guard Management | Module not properly initialized');
    return;
  }

  // Refresh floating panel to ensure GM status is correct
  if (guardManagementModule && guardManagementModule.floatingPanel) {
    // Run migration if needed (GM-only)
    await runMigrationIfNeeded();

    guardManagementModule.refreshFloatingPanel();
    guardManagementModule.floatingPanel.show();
  }
});
