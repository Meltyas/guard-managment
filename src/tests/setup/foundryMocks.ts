/**
 * Foundry VTT Test Mocks
 * Mock implementations for testing without Foundry environment
 */

import { vi } from 'vitest';

// Mock global foundry object
(global as any).foundry = {
  utils: {
    randomID: () => Math.random().toString(36).substring(2, 15),
  },
};

// Mock global game object
(global as any).game = {
  settings: {
    get: vi.fn(() => []),
    set: vi.fn(() => Promise.resolve()),
  },
};

export {};
