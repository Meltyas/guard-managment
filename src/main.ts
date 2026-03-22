/**
 * Main entry point for the Guard Management module
 * Handles initialization and data synchronization between Player and GM
 */

import { GMWarehouseDialog } from './dialogs/GMWarehouseDialog';
import { OfficerWarehouseDialog } from './dialogs/OfficerWarehouseDialog';
import { registerDataModels } from './documents/index';
import { registerHooks } from './hooks';
import { CrimeManager } from './managers/CrimeManager';
import { BuildingManager } from './managers/BuildingManager';
import { GangManager } from './managers/GangManager';
import { PoiManager } from './managers/PoiManager';
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
import './styles/gangs.css';
import './styles/buildings.css';
import './styles/poi.css';
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
  public gangManager: GangManager;
  public buildingManager: BuildingManager;
  public poiManager: PoiManager;
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
    this.gangManager = new GangManager();
    this.buildingManager = new BuildingManager();
    this.poiManager = new PoiManager();
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
    await this.gangManager.initialize();
    await this.buildingManager.initialize();
    await this.poiManager.initialize();
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

    // Listen for phase advances to check for prisoners ready for release
    window.addEventListener('guard-phase-advanced', async (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail.turn > detail.previousTurn) {
        await this.checkReleaseAlerts();
        // Only GM rolls for overcrowding
        if ((game as any)?.user?.isGM) {
          await this.checkOvercrowdingRolls();
        }
      }
      // Refresh prisoners panel so remaining sentence numbers update
      this.guardDialogManager.customInfoDialog?.refreshPrisonersPanel();
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
   * Check if any active prisoners have completed their sentence and show an alert.
   */
  private async checkReleaseAlerts(): Promise<void> {
    if (!this.prisonerManager) return;

    // Log sentence_completed for newly expired prisoners
    await this.prisonerManager.logSentenceCompletions();

    const readyForRelease = this.prisonerManager.getPrisonersReadyForRelease();
    if (readyForRelease.length === 0) return;

    const prisonerList = readyForRelease
      .map((p: any) => `<li><strong>${p.name}</strong> (Celda ${p.cellIndex + 1})</li>`)
      .join('');

    const currentTurn = this.phaseManager.getCurrentTurn();
    const phaseLabel = currentTurn % 2 === 1 ? 'Día' : 'Noche';

    try {
      const DialogV2Class = (foundry as any).applications?.api?.DialogV2;
      if (!DialogV2Class) return;

      await DialogV2Class.wait({
        window: { title: 'Prisioneros Listos para Liberación' },
        content: `
          <div style="padding: 10px; text-align: center;">
            <p style="margin-bottom: 8px;">
              <i class="fas fa-exclamation-triangle" style="color: #f3c267; font-size: 1.2em;"></i>
              <strong>Fase ${currentTurn} (${phaseLabel})</strong>
            </p>
            <p>Los siguientes prisioneros han cumplido su sentencia:</p>
            <ul style="text-align: left; margin: 10px 0;">${prisonerList}</ul>
            <p style="font-size: 0.85em; color: #ccc;">
              Libéralos desde el panel de Celdas Temporales.
            </p>
          </div>
        `,
        buttons: [
          { action: 'ok', label: 'Entendido', icon: 'fas fa-check', default: true },
        ],
        modal: false,
      });
    } catch (error) {
      console.error('GuardManagement | Release alert error:', error);
    }
  }

  /**
   * Check overcrowded cells and roll Hope/Fear for each.
   * Only called by GM on phase advance.
   */
  private async checkOvercrowdingRolls(): Promise<void> {
    if (!this.prisonerManager) return;

    const overcrowdedCells = this.prisonerManager.getOvercrowdedCells();
    if (overcrowdedCells.length === 0) return;

    const g = game as any;
    const gmUserIds: string[] = g?.users?.filter((u: any) => u.isGM)?.map((u: any) => u.id) || [];
    const currentTurn = this.phaseManager.getCurrentTurn();
    const phaseLabel = currentTurn % 2 === 1 ? 'Día' : 'Noche';

    for (const { cellIndex, prisoners, excess } of overcrowdedCells) {
      const prisonerNames = prisoners.map((p: any) => p.name).join(', ');
      const capacity = this.prisonerManager.getCellCapacity();

      let resultHtml = '';
      let isFear = false;

      if (excess > 4) {
        // Automatic Fear — too overcrowded
        isFear = true;
        resultHtml = `
          <div style="border:1px solid rgba(232,74,74,0.4);border-radius:6px;padding:8px;background:rgba(232,74,74,0.1);margin-bottom:6px;">
            <p style="margin:0 0 6px 0;">
              <i class="fas fa-skull" style="color:#ff6b6b;"></i>
              <strong>Celda ${cellIndex + 1} — FEAR AUTOMÁTICO</strong>
            </p>
            <p style="margin:0 0 4px 0;font-size:0.9em;">
              Hacinamiento extremo: <strong>${prisoners.length}/${capacity}</strong> (${excess} de más)
            </p>
            <p style="margin:0;font-size:0.85em;color:#ccc;">
              Prisioneros: ${prisonerNames}
            </p>
            <p style="margin:6px 0 0 0;color:#ff6b6b;font-weight:bold;">
              <i class="fas fa-exclamation-triangle"></i> +1 Fear Token otorgado automáticamente
            </p>
          </div>
        `;
      } else {
        // Roll Hope/Fear: 2d12
        const roll = new (Roll as any)('1d12 + 1d12');
        await roll.evaluate();
        const hopeDie = roll.terms[0].results[0].result;
        const fearDie = roll.terms[2].results[0].result;

        // Modifier: +2 per extra person beyond the first excess
        const fearModifier = excess > 1 ? (excess - 1) * 2 : 0;
        const effectiveFear = fearDie + fearModifier;

        // Hope wins only if strictly greater
        isFear = hopeDie <= effectiveFear;

        const modText = fearModifier > 0 ? ` + ${fearModifier} mod` : '';
        const resultColor = isFear ? '#ff6b6b' : '#7ec87e';
        const resultIcon = isFear ? 'fas fa-skull' : 'fas fa-sun';
        const resultLabel = isFear ? 'FEAR' : 'HOPE';

        resultHtml = `
          <div style="border:1px solid ${isFear ? 'rgba(232,74,74,0.4)' : 'rgba(126,200,126,0.4)'};border-radius:6px;padding:8px;background:${isFear ? 'rgba(232,74,74,0.1)' : 'rgba(126,200,126,0.1)'};margin-bottom:6px;">
            <p style="margin:0 0 6px 0;">
              <i class="${resultIcon}" style="color:${resultColor};"></i>
              <strong>Celda ${cellIndex + 1} — Tirada de Hacinamiento</strong>
            </p>
            <p style="margin:0 0 4px 0;font-size:0.9em;">
              Hacinamiento: <strong>${prisoners.length}/${capacity}</strong> (${excess} de más)
            </p>
            <p style="margin:0 0 4px 0;font-size:0.9em;">
              <span style="color:#7ec87e;">Hope: ${hopeDie}</span> vs
              <span style="color:#ff6b6b;">Fear: ${fearDie}${modText} = ${effectiveFear}</span>
            </p>
            <p style="margin:0 0 4px 0;font-size:0.85em;color:#ccc;">
              Prisioneros: ${prisonerNames}
            </p>
            <p style="margin:6px 0 0 0;color:${resultColor};font-weight:bold;">
              <i class="${resultIcon}"></i> Resultado: ${resultLabel}
              ${isFear ? ' — +1 Fear Token' : ''}
            </p>
          </div>
        `;
      }

      // Send whisper to GM
      const chatContent = `
        <div style="border-left:3px solid ${isFear ? '#ff6b6b' : '#7ec87e'};padding-left:8px;">
          <p style="margin:0 0 4px 0;font-size:0.8em;color:#888;">
            <i class="fas fa-dungeon"></i> Fase ${currentTurn} (${phaseLabel}) — Hacinamiento
          </p>
          ${resultHtml}
        </div>
      `;

      try {
        await (ChatMessage as any).create({
          content: chatContent,
          speaker: { scene: null, actor: null, token: null, alias: 'Guard Management' },
          whisper: gmUserIds,
          flags: { 'guard-management': { type: 'overcrowding-roll', cellIndex, isFear } },
        });
      } catch (err) {
        console.error('GuardManagement | Overcrowding chat error:', err);
      }

      // Add Fear token to Daggerheart tracker
      if (isFear) {
        try {
          const currentFear = g?.settings?.get('daggerheart', 'ResourcesFear') as number;
          if (typeof currentFear === 'number') {
            await g.settings.set('daggerheart', 'ResourcesFear', currentFear + 1);
          }
        } catch (err) {
          console.warn('GuardManagement | Could not update Daggerheart Fear:', err);
        }
      }
    }
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
      'modules/guard-management/templates/panels/gangs.hbs',
      'modules/guard-management/templates/panels/buildings.hbs',
      'modules/guard-management/templates/panels/poi.hbs',
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
