/**
 * Sync Manager - Handles data synchronization between clients
 */

import { SyncConflict, SyncData, SyncOptions } from '../types/sync';

export class SyncManager {
  private syncQueue: SyncData[] = [];
  private conflictQueue: SyncConflict[] = [];
  private options: SyncOptions;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.options = {
      strategy: 'gm-priority',
      autoSync: true,
      syncInterval: 5000, // 5 seconds
      conflictResolution: 'auto',
    };
  }

  /**
   * Initialize the Sync Manager
   */
  public async initialize(): Promise<void> {
    console.log('SyncManager | Initializing...');

    // Load sync options from settings
    this.loadSyncOptions();

    // Set up socket listener for incoming sync data
    this.setupSocketListener();

    // Start auto-sync if enabled
    if (this.options.autoSync) {
      this.startAutoSync();
    }

    console.log('SyncManager | Initialized successfully');
  }

  /**
   * Add data to sync queue
   */
  public queueSync(data: Omit<SyncData, 'timestamp' | 'userId'>): void {
    const syncData: SyncData = {
      ...data,
      timestamp: Date.now(),
      userId: game.user?.id || 'unknown',
    };

    this.syncQueue.push(syncData);
    console.log(`SyncManager | Queued sync data: ${syncData.type} (${syncData.id})`);

    // If auto-sync is disabled, we might want to sync immediately for critical data
    if (!this.options.autoSync && syncData.type === 'alert') {
      this.processSyncQueue();
    }
  }

  /**
   * Process the sync queue
   */
  public async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0) {
      return;
    }

    console.log(`SyncManager | Processing ${this.syncQueue.length} sync items`);

    for (const syncData of this.syncQueue) {
      try {
        await this.sendSyncData(syncData);
      } catch (error) {
        console.error('SyncManager | Error sending sync data:', error);
        // Keep failed items in queue for retry
        continue;
      }
    }

    // Clear successfully sent items
    this.syncQueue = [];
  }

  /**
   * Send sync data to other clients
   */
  private async sendSyncData(syncData: SyncData): Promise<void> {
    if (!game.socket) {
      throw new Error('Socket not available');
    }

    // Emit to all other clients
    game.socket.emit('module.guard-management', {
      type: 'sync-data',
      data: syncData,
    });

    console.log(`SyncManager | Sent sync data: ${syncData.type} (${syncData.id})`);
  }

  /**
   * Handle incoming sync data from other clients
   */
  private async handleIncomingSyncData(syncData: SyncData): Promise<void> {
    console.log(`SyncManager | Received sync data: ${syncData.type} (${syncData.id})`);

    // Check for conflicts
    const conflict = await this.detectConflict(syncData);
    if (conflict) {
      this.handleConflict(conflict);
      return;
    }

    // Apply the sync data
    await this.applySyncData(syncData);
  }

  /**
   * Detect sync conflicts
   */
  private async detectConflict(incomingData: SyncData): Promise<SyncConflict | null> {
    // This is a simplified conflict detection
    // In a real implementation, you'd check against local data

    // For testing purposes, let's simulate occasional conflicts
    if (Math.random() < 0.1) {
      // 10% chance of conflict
      const localData: SyncData = {
        ...incomingData,
        timestamp: incomingData.timestamp - 1000, // 1 second earlier
        userId: game.user?.id || 'local',
        version: incomingData.version - 1,
      };

      return {
        localData,
        remoteData: incomingData,
        conflictType: 'version',
      };
    }

    return null;
  }

  /**
   * Handle sync conflicts based on strategy
   */
  private handleConflict(conflict: SyncConflict): void {
    console.warn('SyncManager | Conflict detected:', conflict);

    switch (this.options.strategy) {
      case 'last-write-wins':
        this.resolveByTimestamp(conflict);
        break;
      case 'gm-priority':
        this.resolveByGMPriority(conflict);
        break;
      case 'manual-resolve':
        this.queueForManualResolution(conflict);
        break;
    }
  }

  /**
   * Resolve conflict by timestamp (last write wins)
   */
  private resolveByTimestamp(conflict: SyncConflict): void {
    const winner =
      conflict.remoteData.timestamp > conflict.localData.timestamp
        ? conflict.remoteData
        : conflict.localData;

    this.applySyncData(winner);
    console.log('SyncManager | Conflict resolved by timestamp');
  }

  /**
   * Resolve conflict by GM priority
   */
  private resolveByGMPriority(conflict: SyncConflict): void {
    const remoteUserIsGM = game.users?.get(conflict.remoteData.userId)?.isGM || false;
    const localUserIsGM = game.user?.isGM || false;

    let winner: SyncData;
    if (remoteUserIsGM && !localUserIsGM) {
      winner = conflict.remoteData;
    } else if (localUserIsGM && !remoteUserIsGM) {
      winner = conflict.localData;
    } else {
      // Both or neither are GM, fall back to timestamp
      winner =
        conflict.remoteData.timestamp > conflict.localData.timestamp
          ? conflict.remoteData
          : conflict.localData;
    }

    this.applySyncData(winner);
    console.log('SyncManager | Conflict resolved by GM priority');
  }

  /**
   * Queue conflict for manual resolution
   */
  private queueForManualResolution(conflict: SyncConflict): void {
    this.conflictQueue.push(conflict);
    console.log('SyncManager | Conflict queued for manual resolution');

    // Emit a notification to the user
    ui.notifications?.warn('Data conflict detected. Please check the sync panel for resolution.');
  }

  /**
   * Apply sync data to local state
   */
  private async applySyncData(syncData: SyncData): Promise<void> {
    // This would typically update your local data structures
    // For testing, we'll just log it
    console.log(`SyncManager | Applied sync data: ${syncData.type} (${syncData.id})`);

    // Emit a hook for other parts of the module to react
    Hooks.call('guard-management.syncDataApplied', syncData);
  }

  /**
   * Set up socket listener for incoming sync data
   */
  private setupSocketListener(): void {
    if (!game.socket) {
      console.warn('SyncManager | No socket available');
      return;
    }

    game.socket.on('module.guard-management', (data: any) => {
      if (data.type === 'sync-data') {
        this.handleIncomingSyncData(data.data);
      }
    });

    console.log('SyncManager | Socket listener set up');
  }

  /**
   * Start auto-sync interval
   */
  private startAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      this.processSyncQueue();
    }, this.options.syncInterval);

    console.log(`SyncManager | Auto-sync started (${this.options.syncInterval}ms interval)`);
  }

  /**
   * Stop auto-sync
   */
  private stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('SyncManager | Auto-sync stopped');
    }
  }

  /**
   * Load sync options from settings
   */
  private loadSyncOptions(): void {
    try {
      const savedOptions = game.settings.get(
        'guard-management',
        'syncOptions'
      ) as Partial<SyncOptions>;
      this.options = { ...this.options, ...savedOptions };
      console.log('SyncManager | Loaded sync options:', this.options);
    } catch (error) {
      console.log('SyncManager | Using default sync options');
    }
  }

  /**
   * Update sync options
   */
  public updateSyncOptions(newOptions: Partial<SyncOptions>): void {
    this.options = { ...this.options, ...newOptions };

    // Save to settings
    game.settings.set('guard-management', 'syncOptions', this.options);

    // Restart auto-sync if needed
    if (this.options.autoSync) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }

    console.log('SyncManager | Updated sync options:', this.options);
  }

  /**
   * Get current sync options
   */
  public getSyncOptions(): SyncOptions {
    return { ...this.options };
  }

  /**
   * Get pending conflicts
   */
  public getPendingConflicts(): SyncConflict[] {
    return [...this.conflictQueue];
  }

  /**
   * Manually resolve a conflict
   */
  public resolveConflict(conflictIndex: number, chooseRemote: boolean): void {
    const conflict = this.conflictQueue[conflictIndex];
    if (!conflict) {
      console.warn('SyncManager | Conflict not found at index:', conflictIndex);
      return;
    }

    const winner = chooseRemote ? conflict.remoteData : conflict.localData;
    this.applySyncData(winner);

    // Remove from queue
    this.conflictQueue.splice(conflictIndex, 1);

    console.log('SyncManager | Conflict manually resolved');
  }

  /**
   * Test method for simulating sync scenarios
   */
  public simulateSync(type: 'guard' | 'patrol' | 'alert', count: number = 1): void {
    for (let i = 0; i < count; i++) {
      const testData = {
        id: `test-${type}-${Date.now()}-${i}`,
        type,
        data: {
          test: true,
          index: i,
          randomValue: Math.random(),
        },
        version: 1,
      };

      this.queueSync(testData);
    }

    console.log(`SyncManager | Simulated ${count} sync operations of type: ${type}`);
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.stopAutoSync();
    this.syncQueue = [];
    this.conflictQueue = [];
    console.log('SyncManager | Cleaned up');
  }
}
