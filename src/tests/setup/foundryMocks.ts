/**
 * Foundry VTT Test Mocks
 * Mock implementations for testing without Foundry environment
 */

import { vi } from 'vitest';

// Base type data model mock
class MockTypeDataModel {
  static defineSchema(): any {
    return {};
  }

  prepareBaseData(): void {}
  prepareDerivedData(): void {}

  updateSource(changes: any): void {
    Object.assign(this, changes);
  }

  static migrateData(source: any): any {
    return source;
  }

  static validateJoint(_data: any): boolean {
    return true;
  }
}

// Mock global foundry object
(global as any).foundry = {
  utils: {
    randomID: () => Math.random().toString(36).substring(2, 15),
  },
  abstract: {
    TypeDataModel: MockTypeDataModel,
  },
  data: {
    fields: {
      StringField: vi.fn(() => ({ type: 'string' })),
      NumberField: vi.fn(() => ({ type: 'number' })),
      BooleanField: vi.fn(() => ({ type: 'boolean' })),
      ObjectField: vi.fn(() => ({ type: 'object' })),
      ArrayField: vi.fn(() => ({ type: 'array' })),
      SchemaField: vi.fn(() => ({ type: 'schema' })),
    },
  },
  applications: {
    api: {
      DialogV2: {
        wait: vi.fn(async (options: any) => {
          // Mock implementation that simulates user input
          const callback = options.buttons?.[0]?.callback;

          if (callback) {
            // Create a mock event and dialog context
            const mockEvent = { target: { closest: vi.fn(() => null) } };
            const mockDialog = {
              form: null,
              element: { querySelector: vi.fn(() => null) },
            };

            // Check if globalThis.DialogV2 has a mocked query response
            if ((globalThis as any).DialogV2?.query) {
              const queryResult = await (globalThis as any).DialogV2.query();
              return queryResult;
            }

            return callback(mockEvent, {}, mockDialog);
          }

          return null;
        }),
      },
    },
  },
};

// In-memory storage for test documents
const mockActors = new Map();
const mockItems = new Map();

// Generate unique IDs for test documents
let nextId = 1;
function generateId() {
  return `test-${nextId++}`;
}

// Function to clear all mock data (useful for test cleanup)
export function clearMockData() {
  mockActors.clear();
  mockItems.clear();
  nextId = 1;
}

// Mock global game object
(global as any).game = {
  settings: {
    get: vi.fn(() => []),
    set: vi.fn(() => Promise.resolve()),
  },
  actors: {
    filter: vi.fn((filterFn: any) => Array.from(mockActors.values()).filter(filterFn)),
    get: vi.fn((id: string) => mockActors.get(id) || null),
  },
  items: {
    filter: vi.fn((filterFn: any) => Array.from(mockItems.values()).filter(filterFn)),
    get: vi.fn((id: string) => mockItems.get(id) || null),
  },
  i18n: {
    localize: vi.fn((key: string) => key),
    format: vi.fn((key: string, data?: any) => `${key} ${data ? JSON.stringify(data) : ''}`),
  },
  user: {
    id: 'test-user',
    isGM: true,
  },
};

// Mock global ui object
(global as any).ui = {
  notifications: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
};

// Mock DialogV2
(global as any).DialogV2 = {
  query: vi.fn(() => Promise.resolve(null)),
  wait: vi.fn(() => Promise.resolve()),
  prompt: vi.fn(() => Promise.resolve('')),
  confirm: vi.fn(() => Promise.resolve(true)),
};

// Mock Actor
(global as any).Actor = {
  create: vi.fn((data: any) => {
    const id = generateId();
    const actor = {
      id,
      name: data.name,
      type: data.type,
      system: data.system || {},
      update: vi.fn(async (updateData: any) => {
        // Apply updates to the mock actor
        if (updateData.name) actor.name = updateData.name;
        if (updateData.system) {
          Object.assign(actor.system, updateData.system);
        }
        // Apply direct system field updates
        Object.keys(updateData).forEach((key) => {
          if (key.startsWith('system.')) {
            const systemKey = key.replace('system.', '');
            actor.system[systemKey] = updateData[key];
          }
        });
        return true;
      }),
      delete: vi.fn(async () => {
        mockActors.delete(id);
        return true;
      }),
    };

    mockActors.set(id, actor);
    return Promise.resolve(actor);
  }),
};

// Mock Item
(global as any).Item = {
  create: vi.fn((data: any) => {
    const id = generateId();
    const item = {
      id,
      name: data.name,
      type: data.type,
      system: data.system || {},
      update: vi.fn(async (updateData: any) => {
        // Apply updates to the mock item
        if (updateData.name) item.name = updateData.name;
        if (updateData.system) {
          Object.assign(item.system, updateData.system);
        }
        // Apply direct system field updates
        Object.keys(updateData).forEach((key) => {
          if (key.startsWith('system.')) {
            const systemKey = key.replace('system.', '');
            item.system[systemKey] = updateData[key];
          }
        });
        return true;
      }),
      delete: vi.fn(async () => {
        mockItems.delete(id);
        return true;
      }),
    };

    mockItems.set(id, item);
    return Promise.resolve(item);
  }),
};

// Mock Hooks
(global as any).Hooks = {
  on: vi.fn(),
  call: vi.fn(),
  callAll: vi.fn(),
};

// Mock window and document
(global as any).window = {
  dispatchEvent: vi.fn(),
  localStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
};

// Also mock global localStorage
(global as any).localStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

(global as any).document = {
  createElement: vi.fn((tag: string) => ({
    tagName: tag.toUpperCase(),
    innerHTML: '',
    style: {},
    appendChild: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    remove: vi.fn(),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(() => []),
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn(() => false),
    },
  })),
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
  },
  getElementById: vi.fn(() => null),
  querySelector: vi.fn(() => null),
  querySelectorAll: vi.fn(() => []),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

export {};
