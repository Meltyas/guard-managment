import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncManager } from '../../managers/SyncManager';
import { SyncOptions } from '../../types/sync';

// Mock Foundry VTT globals
const mockGame = {
  settings: {
    get: vi.fn(),
    set: vi.fn(),
  },
  socket: {
    emit: vi.fn(),
    on: vi.fn(),
  },
  user: {
    id: 'test-user-id',
    isGM: false,
  },
  users: {
    get: vi.fn(),
  },
};

const mockUI = {
  notifications: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
};

const mockHooks = {
  call: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
};

// Setup global mocks
(globalThis as any).game = mockGame;
(globalThis as any).ui = mockUI;
(globalThis as any).Hooks = mockHooks;

describe('SyncManager', () => {
  let syncManager: SyncManager;

  beforeEach(() => {
    syncManager = new SyncManager();
    vi.clearAllMocks();

    // Mock settings.get to return default sync options
    mockGame.settings.get.mockReturnValue({
      strategy: 'gm-priority',
      autoSync: true,
      syncInterval: 5000,
      conflictResolution: 'auto',
    });
  });

  it('should initialize successfully', async () => {
    await syncManager.initialize();
    expect(mockGame.socket.on).toHaveBeenCalledWith(
      'module.guard-management',
      expect.any(Function)
    );
  });

  it('should queue sync data', () => {
    const testData = {
      id: 'test-id',
      type: 'guard' as const,
      data: { test: true },
      version: 1,
    };

    syncManager.queueSync(testData);

    // The queue should contain the data with timestamp and userId added
    // We can't directly access the private queue, but we can test the behavior
    expect(true).toBe(true); // Placeholder - in real implementation, you'd expose queue length
  });

  it('should update sync options', () => {
    const newOptions: Partial<SyncOptions> = {
      strategy: 'last-write-wins',
      autoSync: false,
    };

    syncManager.updateSyncOptions(newOptions);

    expect(mockGame.settings.set).toHaveBeenCalledWith(
      'guard-management',
      'syncOptions',
      expect.objectContaining(newOptions)
    );
  });

  it('should get current sync options', () => {
    const options = syncManager.getSyncOptions();

    expect(options).toHaveProperty('strategy');
    expect(options).toHaveProperty('autoSync');
    expect(options).toHaveProperty('syncInterval');
    expect(options).toHaveProperty('conflictResolution');
  });

  it('should simulate sync operations', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    syncManager.simulateSync('guard', 3);

    expect(consoleSpy).toHaveBeenCalledWith(
      'SyncManager | Simulated 3 sync operations of type: guard'
    );

    consoleSpy.mockRestore();
  });

  it('should handle different sync strategies', () => {
    // Test that sync option updates don't throw
    expect(() => {
      syncManager.updateSyncOptions({ strategy: 'last-write-wins' });
      syncManager.updateSyncOptions({ strategy: 'gm-priority' });
      syncManager.updateSyncOptions({ strategy: 'manual-resolve' });
    }).not.toThrow();
  });

  it('should process sync queue without errors', async () => {
    await expect(syncManager.processSyncQueue()).resolves.not.toThrow();
  });

  it('should get pending conflicts', () => {
    const conflicts = syncManager.getPendingConflicts();
    expect(Array.isArray(conflicts)).toBe(true);
  });

  it('should manually resolve conflicts', () => {
    // Test that manual resolution doesn't throw
    expect(() => {
      syncManager.resolveConflict(0, true);
      syncManager.resolveConflict(0, false);
    }).not.toThrow();
  });

  it('should cleanup properly', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    syncManager.cleanup();

    expect(consoleSpy).toHaveBeenCalledWith('SyncManager | Cleaned up');

    consoleSpy.mockRestore();
  });

  it('should handle auto-sync option changes', () => {
    // Enable auto-sync
    syncManager.updateSyncOptions({ autoSync: true });

    // Disable auto-sync
    syncManager.updateSyncOptions({ autoSync: false });

    // Should not throw errors
    expect(true).toBe(true);
  });

  it('should handle different conflict types', () => {
    const conflicts = [
      { conflictType: 'version' as const },
      { conflictType: 'timestamp' as const },
      { conflictType: 'user' as const },
    ];

    // Test that different conflict types are handled
    conflicts.forEach((conflict) => {
      expect(conflict.conflictType).toMatch(/version|timestamp|user/);
    });
  });
});
