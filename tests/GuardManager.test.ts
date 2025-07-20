import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuardManager } from '../src/managers/GuardManager';

// Mock Foundry VTT globals
const mockGame = {
  settings: {
    get: vi.fn(),
    set: vi.fn(),
  },
};

const mockFoundry = {
  utils: {
    randomID: vi.fn(() => `test-id-${Date.now()}`),
  },
};

// Setup global mocks
(global as any).game = mockGame;
(global as any).foundry = mockFoundry;

describe('GuardManager', () => {
  let guardManager: GuardManager;

  beforeEach(() => {
    guardManager = new GuardManager();
    vi.clearAllMocks();

    // Mock settings.get to return empty array for guard data
    mockGame.settings.get.mockReturnValue([]);
  });

  it('should initialize successfully', async () => {
    await guardManager.initialize();
    expect(mockGame.settings.get).toHaveBeenCalledWith('guard-management', 'guardData');
  });

  it('should create a new guard', () => {
    const guardData = {
      name: 'Test Guard',
      position: { x: 100, y: 100 },
      status: 'active' as const,
      assignedArea: 'Test Area',
    };

    const createdGuard = guardManager.createGuard(guardData);

    expect(createdGuard).toMatchObject(guardData);
    expect(createdGuard.id).toBeDefined();
    expect(createdGuard.lastUpdate).toBeDefined();
    expect(mockFoundry.utils.randomID).toHaveBeenCalled();
  });

  it('should update an existing guard', () => {
    // First create a guard
    const guardData = {
      name: 'Test Guard',
      position: { x: 100, y: 100 },
      status: 'active' as const,
      assignedArea: 'Test Area',
    };

    const createdGuard = guardManager.createGuard(guardData);
    const originalUpdate = createdGuard.lastUpdate;

    // Wait a bit to ensure timestamp changes
    setTimeout(() => {
      const updates = {
        status: 'alert' as const,
        position: { x: 200, y: 200 },
      };

      const updatedGuard = guardManager.updateGuard(createdGuard.id, updates);

      expect(updatedGuard?.status).toBe('alert');
      expect(updatedGuard?.position).toEqual({ x: 200, y: 200 });
      expect(updatedGuard?.lastUpdate).toBeGreaterThan(originalUpdate);
    }, 10);
  });

  it('should return null when updating non-existent guard', () => {
    const result = guardManager.updateGuard('non-existent-id', { status: 'active' });
    expect(result).toBeNull();
  });

  it('should get a guard by ID', () => {
    const guardData = {
      name: 'Test Guard',
      position: { x: 100, y: 100 },
      status: 'active' as const,
      assignedArea: 'Test Area',
    };

    const createdGuard = guardManager.createGuard(guardData);
    const retrievedGuard = guardManager.getGuard(createdGuard.id);

    expect(retrievedGuard).toEqual(createdGuard);
  });

  it('should return null for non-existent guard', () => {
    const result = guardManager.getGuard('non-existent-id');
    expect(result).toBeNull();
  });

  it('should get all guards', () => {
    const guardData1 = {
      name: 'Guard 1',
      position: { x: 100, y: 100 },
      status: 'active' as const,
      assignedArea: 'Area 1',
    };

    const guardData2 = {
      name: 'Guard 2',
      position: { x: 200, y: 200 },
      status: 'inactive' as const,
      assignedArea: 'Area 2',
    };

    guardManager.createGuard(guardData1);
    guardManager.createGuard(guardData2);

    const allGuards = guardManager.getAllGuards();
    expect(allGuards).toHaveLength(2);
    expect(allGuards.some((g) => g.name === 'Guard 1')).toBe(true);
    expect(allGuards.some((g) => g.name === 'Guard 2')).toBe(true);
  });

  it('should delete a guard', () => {
    const guardData = {
      name: 'Test Guard',
      position: { x: 100, y: 100 },
      status: 'active' as const,
      assignedArea: 'Test Area',
    };

    const createdGuard = guardManager.createGuard(guardData);
    const deleteResult = guardManager.deleteGuard(createdGuard.id);

    expect(deleteResult).toBe(true);
    expect(guardManager.getGuard(createdGuard.id)).toBeNull();
  });

  it('should return false when deleting non-existent guard', () => {
    const result = guardManager.deleteGuard('non-existent-id');
    expect(result).toBe(false);
  });

  it('should create sample guards', () => {
    guardManager.createSampleGuards();
    const allGuards = guardManager.getAllGuards();

    expect(allGuards).toHaveLength(3);
    expect(allGuards.some((g) => g.name === 'Guard Alpha')).toBe(true);
    expect(allGuards.some((g) => g.name === 'Guard Beta')).toBe(true);
    expect(allGuards.some((g) => g.name === 'Guard Charlie')).toBe(true);
  });

  it('should save guard data when creating guards', () => {
    const guardData = {
      name: 'Test Guard',
      position: { x: 100, y: 100 },
      status: 'active' as const,
      assignedArea: 'Test Area',
    };

    guardManager.createGuard(guardData);

    expect(mockGame.settings.set).toHaveBeenCalledWith(
      'guard-management',
      'guardData',
      expect.any(Array)
    );
  });

  it('should cleanup properly', () => {
    guardManager.createSampleGuards();
    expect(guardManager.getAllGuards()).toHaveLength(3);

    guardManager.cleanup();
    expect(guardManager.getAllGuards()).toHaveLength(0);
  });
});
