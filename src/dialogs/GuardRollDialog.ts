import { GuardOrganization, GuardStats, Patrol } from '../types/entities';

// @ts-ignore
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

interface GuardRollDialogConfig {
  roll: {
    dice: {
      dHope: string;
      dFear: string;
      advantageNumber: number;
      advantageFaces: string;
    };
    advantage: number; // 1 for advantage, -1 for disadvantage, 0 for none
    trait: string;
  };
  extraFormula: string;
  selectedRollMode: string;
  entity: GuardOrganization | Patrol;
  activeModifiers: { name: string; value: number }[];
}

export class GuardRollDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  config: GuardRollDialogConfig;
  submitted: boolean = false;

  constructor(config: GuardRollDialogConfig, options = {}) {
    super(options);
    this.config = config;
  }

  static DEFAULT_OPTIONS = {
    tag: 'form',
    classes: ['daggerheart', 'dialog', 'dh-style', 'views', 'roll-selection', 'guard-roll-dialog'],
    position: {
      width: 400,
      height: 'auto',
    },
    window: {
      icon: 'fa-solid fa-dice',
      title: 'Guard Roll',
    },
    actions: {
      updateIsAdvantage: this.updateIsAdvantage,
      submitRoll: this.submitRoll,
    },
    form: {
      handler: this.updateRollConfiguration,
      submitOnChange: true,
      submitOnClose: false,
    },
  };

  static PARTS = {
    content: {
      template: 'modules/guard-management/templates/dialogs/guard-roll-dialog.hbs',
    },
  };

  async _prepareContext(_options: any) {
    const context = await super._prepareContext(_options);

    context.roll = this.config.roll;
    context.advantage = this.config.roll.advantage === 1;
    context.disadvantage = this.config.roll.advantage === -1;
    context.extraFormula = this.config.extraFormula;
    context.selectedRollMode = this.config.selectedRollMode;
    context.selectedTrait = this.config.roll.trait;

    context.diceOptions = {
      d4: 'd4',
      d6: 'd6',
      d8: 'd8',
      d10: 'd10',
      d12: 'd12',
      d20: 'd20',
    };

    context.advantageNumbers = {};
    for (let i = 1; i <= 10; i++) {
      context.advantageNumbers[i] = i;
    }

    context.rollModes = Object.entries((CONFIG as any).Dice.rollModes).map(
      ([action, { label }]: [string, any]) => ({
        action,
        label: (game as any).i18n.localize(label),
      })
    );

    // Prepare traits from entity stats
    const stats = this.getStats();
    context.traits = [
      { id: 'robustismo', label: 'Robustismo', value: stats.robustismo },
      { id: 'analitica', label: 'Analítica', value: stats.analitica },
      { id: 'subterfugio', label: 'Subterfugio', value: stats.subterfugio },
      { id: 'elocuencia', label: 'Elocuencia', value: stats.elocuencia },
    ];

    context.activeModifiers = this.config.activeModifiers;
    context.formula = this.constructFormula();

    return context;
  }

  getStats(): GuardStats {
    if ('baseStats' in this.config.entity) {
      // It's a GuardOrganization or Patrol
      // For Patrol, we might want derivedStats if available, otherwise baseStats
      // But the interface says derivedStats is optional.
      // Let's assume we use what's available.
      const entity = this.config.entity as any;
      return (
        entity.derivedStats ||
        entity.baseStats || { robustismo: 0, analitica: 0, subterfugio: 0, elocuencia: 0 }
      );
    }
    return { robustismo: 0, analitica: 0, subterfugio: 0, elocuencia: 0 };
  }

  constructFormula(): string {
    const parts = [];

    // Duality Dice
    parts.push(`1${this.config.roll.dice.dHope}`);
    parts.push(`1${this.config.roll.dice.dFear}`);

    // Advantage/Disadvantage
    if (this.config.roll.advantage !== 0) {
      const op = this.config.roll.advantage === 1 ? '+' : '-';
      const num = this.config.roll.dice.advantageNumber;
      const faces = this.config.roll.dice.advantageFaces;
      // Daggerheart logic: if num > 1, keep highest?
      // The DualityRoll code says: if (this.advantageNumber > 1) advDie.modifiers = ['kh'];
      const mod = num > 1 ? 'kh' : '';
      parts.push(`${op} ${num}${faces}${mod}`);
    }

    // Trait
    if (this.config.roll.trait) {
      const stats = this.getStats();
      const val = stats[this.config.roll.trait as keyof GuardStats] || 0;
      if (val !== 0) {
        parts.push(`${val >= 0 ? '+' : '-'} ${Math.abs(val)}`);
      }
    }

    // Extra Formula
    if (this.config.extraFormula) {
      parts.push(`+ ${this.config.extraFormula}`);
    }

    return parts.join(' ');
  }

  static updateRollConfiguration(
    this: GuardRollDialog,
    _event: Event,
    _element: HTMLElement,
    formData: FormData
  ) {
    const expanded = (foundry.utils as any).expandObject(Object.fromEntries(formData));

    // Update config based on form data
    if (expanded.roll?.dice) {
      this.config.roll.dice = { ...this.config.roll.dice, ...expanded.roll.dice };
    }
    if (expanded.trait !== undefined) {
      this.config.roll.trait = expanded.trait;
    }
    if (expanded.extraFormula !== undefined) {
      this.config.extraFormula = expanded.extraFormula;
    }
    if (expanded.selectedRollMode !== undefined) {
      this.config.selectedRollMode = expanded.selectedRollMode;
    }

    (this as any).render();
  }

  static updateIsAdvantage(this: GuardRollDialog, _event: Event, button: HTMLElement) {
    const advantage = Number(button.dataset.advantage);
    // Toggle logic
    if (this.config.roll.advantage === advantage) {
      this.config.roll.advantage = 0;
    } else {
      this.config.roll.advantage = advantage;
    }
    (this as any).render();
  }

  static async submitRoll(this: GuardRollDialog) {
    this.submitted = true;
    await (this as any).close();
  }

  _onClose(options: any = {}) {
    if (!options.submitted) {
      // Handle cancellation if needed
    }
  }

  static async create(
    entity: GuardOrganization | Patrol,
    activeModifiers: { name: string; value: number }[] = [],
    initialTrait: string = ''
  ) {
    const config: GuardRollDialogConfig = {
      roll: {
        dice: {
          dHope: 'd12',
          dFear: 'd12',
          advantageNumber: 1,
          advantageFaces: 'd6',
        },
        advantage: 0,
        trait: initialTrait,
      },
      extraFormula: '',
      selectedRollMode: (game as any).settings.get('core', 'rollMode'),
      entity,
      activeModifiers,
    };

    return new Promise((resolve) => {
      const app = new this(config) as any;
      app.addEventListener(
        'close',
        () => {
          if (app.submitted) {
            // Actually ApplicationV2 close doesn't pass data easily like that unless we store it.
            // But we can access app.config after close if we keep the reference.
            resolve(app.config);
          } else {
            resolve(null);
          }
        },
        { once: true }
      );

      app.render({ force: true });
    });
  }
}
