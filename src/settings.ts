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

  // Guard Modifiers data storage
  game?.settings?.register('guard-management', 'modifiers', {
    name: 'Guard Modifiers Data',
    hint: 'Stored guard modifier information',
    scope: 'world',
    config: false,
    type: Array,
    default: [],
    onChange: (_value) => {
      const gm = (window as any).GuardManagement;
      if (gm?.modifierManager) {
        gm.modifierManager.loadFromSettings?.();
      }
      // Refresh GMWarehouseDialog modifiers tab
      const gmWarehouse = (window as any).GuardManagement?.GMWarehouseDialog;
      if (gmWarehouse?.instance?.isOpen?.()) {
        gmWarehouse.instance.refreshGuardModifiersTab?.();
      }
      // Refresh organization stats that depend on modifiers
      if (gm?.guardDialogManager?.customInfoDialog?.isOpen?.()) {
        gm.guardDialogManager.customInfoDialog.refreshContent?.();
      }
      gm?.floatingPanel?.refreshPanel?.();
    },
  });

  // Patrol Effects data storage
  game?.settings?.register('guard-management', 'patrolEffects', {
    name: 'Patrol Effects Data',
    hint: 'Stored patrol effect template information',
    scope: 'world',
    config: false,
    type: Array,
    default: [],
    onChange: (_value) => {
      const gm = (window as any).GuardManagement;
      if (gm?.patrolEffectManager) {
        gm.patrolEffectManager.loadFromSettings?.();
      }
      // Refresh GMWarehouseDialog patrol effects tab
      const gmWarehouse = (window as any).GuardManagement?.GMWarehouseDialog;
      if (gmWarehouse?.instance?.isOpen?.()) {
        gmWarehouse.instance.refreshPatrolEffectsTab?.();
      }
      gm?.floatingPanel?.refreshPanel?.();
    },
  });

  // Migration version tracking
  game?.settings?.register('guard-management', 'migrationVersion', {
    name: 'Migration Version',
    hint: 'Tracks data migration state',
    scope: 'world',
    config: false,
    type: Number,
    default: 0,
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

  console.log('GuardManagement | Settings registered successfully');
}

// Helper functions for accessing settings
export function getSetting(key: string): unknown {
  return game?.settings?.get('guard-management', key as any);
}

export function setSetting(key: string, value: unknown): Promise<unknown> | undefined {
  return game?.settings?.set('guard-management', key as any, value);
}
