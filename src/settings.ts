/**
 * Module settings registration
 */

export function registerSettings(): void {
  console.log('GuardManagement | Registering settings...');

  // Guard organization data storage (single organization)
  game?.settings?.register('guard-management', 'guardOrganization', {
    name: 'Guard Organization Data',
    hint: 'Stored guard organization information',
    scope: 'world',
    config: false,
    type: Object,
    default: null,
    onChange: async (_value) => {
      console.log('Settings onChange | GuardOrganization changed, reloading and refreshing UI...');
      const gm = (window as any).GuardManagement;

      // CRITICAL: Load all data SEQUENTIALLY with await to ensure it's ready
      if (gm?.guardOrganizationManager) {
        await gm.guardOrganizationManager.loadFromSettings?.();
      }

      if (gm?.resourceManager) {
        console.log('📦 Reloading resources due to organization change...');
        await gm.resourceManager.loadFromSettings?.();
      }

      if (gm?.reputationManager) {
        console.log('🏆 Reloading reputations due to organization change...');
        await gm.reputationManager.loadFromSettings?.();
      }

      // NOW refresh UI after all data is loaded
      if (gm?.guardDialogManager?.customInfoDialog) {
        const dialog = gm.guardDialogManager.customInfoDialog;
        if (dialog.isOpen?.()) {
          console.log('Settings onChange | Refreshing open CustomInfoDialog for organization');
          await dialog.refreshContent?.();
        }
      }
      // Refresh FloatingGuardPanel on all clients
      gm?.floatingPanel?.refreshPanel?.();
    },
  });

  // Guard organization data storage (legacy - multiple organizations)
  game?.settings?.register('guard-management', 'guardOrganizations', {
    name: 'Guard Organizations Data (Legacy)',
    hint: 'Legacy stored guard organization information',
    scope: 'world',
    config: false,
    type: Array,
    default: [],
  });

  // Patrols data storage
  game?.settings?.register('guard-management', 'patrols', {
    name: 'Patrols Data',
    hint: 'Stored patrol information',
    scope: 'world',
    config: false,
    type: Array,
    default: [],
    onChange: (_value) => {
      console.log('Settings onChange | Patrols changed, reloading and refreshing UI...');
      // Reload patrols when settings change
      const gm = (window as any).GuardManagement;
      if (gm?.guardOrganizationManager) {
        const patrolMgr = gm.guardOrganizationManager.getPatrolManager?.();
        if (patrolMgr) {
          patrolMgr.loadFromSettings?.();
        }
      }

      // Refresh open CustomInfoDialog if exists
      if (gm?.guardDialogManager?.customInfoDialog) {
        const dialog = gm.guardDialogManager.customInfoDialog;
        if (dialog.isOpen?.()) {
          console.log('Settings onChange | Refreshing open CustomInfoDialog for patrols');
          dialog.refreshPatrolsPanel?.();
        }
      }
      gm?.floatingPanel?.refreshPanel?.();
    },
  });

  // Guard data storage (legacy - for patrols)
  game?.settings?.register('guard-management', 'guardData', {
    name: 'Guard Data',
    hint: 'Stored guard information',
    scope: 'world',
    config: false,
    type: Array,
    default: [],
  });

  // Resources data storage
  game?.settings?.register('guard-management', 'resources', {
    name: 'Resources Data',
    hint: 'Stored resource information',
    scope: 'world',
    config: false,
    type: Array,
    default: [],
    onChange: (value) => {
      console.log('⚙️ Settings onChange | Resources changed!', {
        user: game?.user?.name,
        isGM: game?.user?.isGM,
        resourceCount: Array.isArray(value) ? value.length : 'not array',
        hasGuardManagement: !!(window as any).GuardManagement,
        hasResourceManager: !!(window as any).GuardManagement?.resourceManager,
      });
      const gm = (window as any).GuardManagement;
      if (gm?.resourceManager) {
        console.log('📦 Reloading resourceManager...');
        gm.resourceManager.loadFromSettings?.();
      }
      // Refresh CustomInfoDialog if open
      if (gm?.guardDialogManager?.customInfoDialog?.isOpen?.()) {
        console.log('🔄 Refreshing CustomInfoDialog...');
        gm.guardDialogManager.customInfoDialog.refreshContent?.();
      } else {
        console.log('ℹ️ CustomInfoDialog not open, skipping refresh');
      }
      gm?.floatingPanel?.refreshPanel?.();
      // Refresh open GMWarehouseDialog resources tab
      const gmWarehouseR = (window as any).GuardManagement?.GMWarehouseDialog;
      if (gmWarehouseR?.instance?.isOpen?.()) {
        gmWarehouseR.instance.refreshResourcesTab?.();
      }
    },
  });

  // Reputation data storage
  game?.settings?.register('guard-management', 'reputations', {
    name: 'Reputation Data',
    hint: 'Stored reputation information',
    scope: 'world',
    config: false,
    type: Array,
    default: [],
    onChange: (value) => {
      console.log('⚙️ Settings onChange | Reputations changed!', {
        user: game?.user?.name,
        isGM: game?.user?.isGM,
        reputationCount: Array.isArray(value) ? value.length : 'not array',
        hasGuardManagement: !!(window as any).GuardManagement,
        hasReputationManager: !!(window as any).GuardManagement?.reputationManager,
      });
      const gm = (window as any).GuardManagement;
      if (gm?.reputationManager) {
        console.log('🏆 Reloading reputationManager...');
        gm.reputationManager.loadFromSettings?.();
      }
      // Refresh CustomInfoDialog if open
      if (gm?.guardDialogManager?.customInfoDialog?.isOpen?.()) {
        console.log('🔄 Refreshing CustomInfoDialog...');
        gm.guardDialogManager.customInfoDialog.refreshContent?.();
      } else {
        console.log('ℹ️ CustomInfoDialog not open, skipping refresh');
      }
      gm?.floatingPanel?.refreshPanel?.();
      // Refresh open GMWarehouseDialog reputation tab
      const gmWarehouseRep = (window as any).GuardManagement?.GMWarehouseDialog;
      if (gmWarehouseRep?.instance?.isOpen?.()) {
        gmWarehouseRep.instance.refreshReputationTab?.();
      }
    },
  });

  // Officers data storage
  game?.settings?.register('guard-management', 'officers', {
    name: 'Officers Data',
    hint: 'Stored officer information',
    scope: 'world',
    config: false,
    type: Array,
    default: [],
    onChange: (_value) => {
      // Reload officers in manager when settings change
      const gm = (window as any).GuardManagement;
      if (gm?.officerManager) {
        gm.officerManager.loadFromSettings?.();
      }

      // Refresh open officer warehouse dialog
      const warehouse = (window as any).GuardManagement?.OfficerWarehouseDialog;
      if (warehouse?.instance?.isOpen?.()) {
        warehouse.instance.refresh();
      }
    },
  });

  // Sync options
  game?.settings?.register('guard-management', 'syncOptions', {
    name: 'Synchronization Options',
    hint: 'Options for data synchronization between clients',
    scope: 'world',
    config: false,
    type: Object,
    default: {
      strategy: 'gm-priority',
      autoSync: true,
      syncInterval: 5000,
      conflictResolution: 'auto',
    },
  });

  // Debug mode
  game?.settings?.register('guard-management', 'debugMode', {
    name: 'Debug Mode',
    hint: 'Enable debug logging and testing features',
    scope: 'client',
    config: true,
    type: Boolean,
    default: false,
  });

  // Sync strategy setting (user-configurable)
  game?.settings?.register('guard-management', 'syncStrategy', {
    name: 'Sync Strategy',
    hint: 'How to handle data synchronization conflicts',
    scope: 'world',
    config: true,
    type: String,
    default: 'gm-priority',
    choices: {
      'last-write-wins': 'Last Write Wins',
      'gm-priority': 'GM Priority',
      'manual-resolve': 'Manual Resolution',
    },
  });

  // Auto sync interval
  game?.settings?.register('guard-management', 'autoSyncInterval', {
    name: 'Auto Sync Interval (ms)',
    hint: 'How often to automatically sync data (in milliseconds)',
    scope: 'world',
    config: true,
    type: Number,
    default: 5000,
    range: {
      min: 1000,
      max: 30000,
      step: 1000,
    },
  });

  // Enable auto sync
  game?.settings?.register('guard-management', 'enableAutoSync', {
    name: 'Enable Auto Sync',
    hint: 'Automatically synchronize data between clients',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  // Crimes catalog
  game?.settings?.register('guard-management', 'crimes', {
    name: 'Crimes Data',
    scope: 'world',
    config: false,
    type: Array,
    default: [],
    onChange: (_value) => {
      const gm = (window as any).GuardManagement;
      if (gm?.crimeManager) gm.crimeManager.loadFromSettings?.();
      if (gm?.guardDialogManager?.customInfoDialog?.isOpen?.()) {
        gm.guardDialogManager.customInfoDialog.refreshCrimesPanel?.();
      }
    },
  });

  // Sentence configuration
  game?.settings?.register('guard-management', 'sentenceConfig', {
    name: 'Sentence Config Data',
    scope: 'world',
    config: false,
    type: Object,
    default: {},
    onChange: (_value) => {
      const gm = (window as any).GuardManagement;
      if (gm?.sentenceConfigManager) gm.sentenceConfigManager.loadFromSettings?.();
    },
  });

  // Gangs catalog
  game?.settings?.register('guard-management', 'gangs', {
    name: 'Gangs Data',
    scope: 'world',
    config: false,
    type: Array,
    default: [],
    onChange: (_value) => {
      const gm = (window as any).GuardManagement;
      if (gm?.gangManager) gm.gangManager.loadFromSettings?.();
    },
  });

  // People of Interest
  game?.settings?.register('guard-management', 'poi', {
    name: 'POI Data',
    scope: 'world',
    config: false,
    type: Array,
    default: [],
    onChange: (_value) => {
      const gm = (window as any).GuardManagement;
      if (gm?.poiManager) gm.poiManager.loadFromSettings?.();
    },
  });

  // Prisoners
  game?.settings?.register('guard-management', 'prisoners', {
    name: 'Prisoners Data',
    scope: 'world',
    config: false,
    type: Array,
    default: [],
    onChange: (_value) => {
      const gm = (window as any).GuardManagement;
      if (gm?.prisonerManager) gm.prisonerManager.loadFromSettings?.();
    },
  });

  // Prison config
  game?.settings?.register('guard-management', 'prisonConfig', {
    name: 'Prison Config Data',
    scope: 'world',
    config: false,
    type: Object,
    default: { cellCount: 4, cellCapacity: 1 },
    onChange: (_value) => {
      const gm = (window as any).GuardManagement;
      if (gm?.prisonerManager) gm.prisonerManager.loadConfigFromSettings?.();
    },
  });

  // Buildings
  game?.settings?.register('guard-management', 'buildings', {
    name: 'Buildings Data',
    scope: 'world',
    config: false,
    type: Array,
    default: [],
    onChange: (_value) => {
      const gm = (window as any).GuardManagement;
      if (gm?.buildingManager) gm.buildingManager.loadFromSettings?.();
    },
  });

  // Finances
  game?.settings?.register('guard-management', 'finances', {
    name: 'Finances Data',
    scope: 'world',
    config: false,
    type: Object,
    default: { totalBudget: 0, income: [], expenses: [], history: [] },
    onChange: (_value) => {
      const gm = (window as any).GuardManagement;
      if (gm?.financeManager) gm.financeManager.loadFromSettings?.();
    },
  });

  // Phase / turn data
  game?.settings?.register('guard-management', 'phaseData', {
    name: 'Phase Data',
    scope: 'world',
    config: false,
    type: Object,
    default: { currentPhase: 'day', currentTurn: 1, history: [] },
    onChange: (_value) => {
      const gm = (window as any).GuardManagement;
      if (gm?.phaseManager) gm.phaseManager.loadFromSettings?.();
    },
  });

  console.log('GuardManagement | Settings registered successfully');
}

// Helper functions for accessing settings
export function getSetting(key: string): unknown {
  return game?.settings?.get('guard-management', key as any);
}

export function setSetting(key: string, value: unknown): Promise<unknown> | undefined {
  return game?.settings?.set('guard-management', key as any, value);
}
