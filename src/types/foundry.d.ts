/**
 * Foundry VTT custom type declarations for Guard Management module
 *
 * Core types come from @league-of-foundry-developers/foundry-vtt-types.
 * This file augments what the package does not cover or where v13 beta types
 * have overly strict declarations that don't match the real v13 runtime.
 */

declare global {
  /**
   * Register all guard-management settings with Foundry's ClientSettings type system.
   * ClientSettings.Namespace is derived from `keyof SettingConfig`, so every
   * "namespace.key" entry here unlocks that namespace for game.settings calls.
   * This is the correct v13 pattern for module settings type registration.
   */
  interface SettingConfig {
    // Core data storage (world-scoped, synced across clients)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    'guard-management.guardOrganization': any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    'guard-management.guardOrganizations': any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    'guard-management.patrols': any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    'guard-management.guardData': any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    'guard-management.resources': any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    'guard-management.reputations': any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    'guard-management.officers': any;
    // Configuration settings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    'guard-management.syncOptions': any;
    'guard-management.debugMode': boolean;
    'guard-management.syncStrategy': string;
    'guard-management.autoSyncInterval': number;
    'guard-management.enableAutoSync': boolean;
  }

  /**
   * Extend Game with runtime properties not yet in the package.
   */
  interface Game {
    tooltip?: {
      activationTime: number;
    };
    socket?: {
      emit: (event: string, data: unknown) => void;
      on: (event: string, handler: (data: unknown) => void) => void;
    };
    ready?: boolean;
  }

  /**
   * DialogV2 extended config properties used by our dialogs.
   * `rejectClose` and the `render` callback are valid at runtime but not
   * fully typed in the current beta.
   */
  interface DialogV2WaitOptions {
    rejectClose?: boolean;
    render?: (event: Event, html: HTMLElement) => void;
  }
}

export {};
