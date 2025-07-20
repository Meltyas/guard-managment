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
  });

  // Reputation data storage
  game?.settings?.register('guard-management', 'reputations', {
    name: 'Reputation Data',
    hint: 'Stored reputation information',
    scope: 'world',
    config: false,
    type: Array,
    default: [],
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
  return game?.settings?.get('guard-management', key);
}

export function setSetting(key: string, value: unknown): Promise<unknown> | undefined {
  return game?.settings?.set('guard-management', key, value);
}
