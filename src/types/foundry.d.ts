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

  interface DialogData {
    title?: string;
    content?: string;
    buttons?: Record<string, DialogButton>;
    default?: string;
    render?: (html: JQuery) => void;
    close?: () => void;
  }

  interface DialogButton {
    icon?: string;
    label?: string;
    callback?: (html: JQuery) => any;
  }

  class Dialog {
    constructor(data: DialogData, options?: any);
    render(force?: boolean): void;
    static confirm(config: {
      title: string;
      content: string;
      yes?: () => void;
      no?: () => void;
      defaultYes?: boolean;
    }): Promise<boolean>;
  }

  // DialogV2 types based on official Foundry V13 documentation
  interface DialogV2ButtonConfig {
    action: string;
    icon?: string;
    label: string;
    default?: boolean;
    callback?: (event: Event, button: any, dialog: any) => any;
  }

  interface DialogV2WindowConfig {
    title: string;
    resizable?: boolean;
  }

  interface DialogV2Config {
    window: DialogV2WindowConfig;
    content: string;
    buttons: DialogV2ButtonConfig[];
  }

  // Foundry V13 globals
  const game: Game | undefined;
  const ui: any;
  const foundry: {
    applications: {
      api: {
        DialogV2: {
          wait(config: DialogV2Config): Promise<any>;
          prompt(config: DialogV2Config): Promise<any>;
          confirm(config: DialogV2Config): Promise<any>;
        };
      };
    };
    utils: {
      randomID(): string;
    };
  };

  const Dialog: typeof Dialog;
}

export {};
