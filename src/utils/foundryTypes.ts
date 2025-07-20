/**
 * Foundry Type Extensions and Utilities
 * Solves TypeScript issues with Foundry VTT API
 */

// Extend the global game type to support our module settings
declare global {
  namespace Game {
    interface Settings {
      register(namespace: string, key: string, data: SettingSubmenuConfig | SettingConfig): void;
      get(namespace: string, key: string): any;
      set(namespace: string, key: string, value: any): Promise<any>;
    }
  }

  interface Game {
    settings: Game.Settings;
  }
}

// Helper function to safely access game settings
export function safeGameSettings() {
  if (!game?.settings) {
    throw new Error(
      'Game settings not available. Module must be initialized after Foundry is ready.'
    );
  }
  return game.settings;
}

// Type-safe setting registration
export function registerSetting(
  namespace: string,
  key: string,
  config: SettingSubmenuConfig | SettingConfig
): void {
  const settings = safeGameSettings();
  settings.register(namespace, key, config);
}

// Type-safe setting getter
export function getSetting<T = any>(namespace: string, key: string): T {
  const settings = safeGameSettings();
  return settings.get(namespace, key);
}

// Type-safe setting setter
export async function setSetting<T = any>(namespace: string, key: string, value: T): Promise<T> {
  const settings = safeGameSettings();
  return settings.set(namespace, key, value);
}

export {};
