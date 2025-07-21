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
    actors?: {
      get: (id: string) => any;
      filter: (predicate: (actor: any) => boolean) => any[];
    };
    items?: {
      get: (id: string) => any;
      filter: (predicate: (item: any) => boolean) => any[];
    };
    scenes?: {
      active?: any;
    };
    world?: any;
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
    close(): void;
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
  const ui: {
    notifications?: {
      info: (message: string) => void;
      warn: (message: string) => void;
      error: (message: string) => void;
    };
  };

  // jQuery types
  interface JQuery {
    find: (selector: string) => JQuery;
    on: (event: string, handler: (event: any) => void) => JQuery;
    val: () => string | number;
    data: (key: string) => any;
  }

  const $: (selector: any) => JQuery;

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
    abstract: {
      TypeDataModel: typeof TypeDataModel;
      DataModel: typeof DataModel;
    };
    data: {
      fields: {
        StringField: typeof StringField;
        NumberField: typeof NumberField;
        BooleanField: typeof BooleanField;
        ArrayField: typeof ArrayField;
        SchemaField: typeof SchemaField;
        HTMLField: typeof HTMLField;
        FilePathField: typeof FilePathField;
      };
    };
  };

  // DataModel types
  abstract class DataModel {
    constructor(data?: any, options?: any);
    prepareBaseData(): void;
    prepareDerivedData(): void;
    parent: any;
  }

  abstract class TypeDataModel extends DataModel {
    static defineSchema(): any;
  }

  // Field types
  class StringField {
    constructor(options?: any);
  }

  class NumberField {
    constructor(options?: any);
  }

  class BooleanField {
    constructor(options?: any);
  }

  class ArrayField {
    constructor(element: any, options?: any);
  }

  class SchemaField {
    constructor(fields: Record<string, any>, options?: any);
  }

  class HTMLField {
    constructor(options?: any);
  }

  class FilePathField {
    constructor(options?: any);
  }

  // Document classes
  class Actor {
    static create(data: any): Promise<any>;
    name: string;
    type: string;
    system: any;
    update(data: any): Promise<any>;
  }

  class Item {
    static create(data: any): Promise<any>;
    name: string;
    type: string;
    system: any;
    update(data: any): Promise<any>;
  }

  // CONFIG object
  const CONFIG: {
    Actor: {
      dataModels: Record<string, any>;
    };
    Item: {
      dataModels: Record<string, any>;
    };
  };

  // Hooks system
  const Hooks: {
    on: (event: string, callback: (...args: any[]) => void) => void;
    once: (event: string, callback: (...args: any[]) => void) => void;
    off: (event: string, callback: (...args: any[]) => void) => void;
  };

  const Dialog: typeof Dialog;
}

export {};
