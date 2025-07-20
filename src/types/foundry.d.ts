/**
 * Foundry VTT type declarations for Guard Management module
 */

declare global {
  interface Game {
    settings?: {
      register: (namespace: string, key: string, data: any) => void;
      get: (namespace: string, key: string) => any;
      set: (namespace: string, key: string, value: any) => Promise<any>;
    };
  }

  const game: Game | undefined;
}

export {};
