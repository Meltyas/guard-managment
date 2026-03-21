// @ts-nocheck
import { DEFAULT_GUARD_STATS } from '../../types/entities.js';

/**
 * DataModel for Guard Modifiers
 */
export class GuardModifierModel extends foundry.abstract.TypeDataModel {
  /** Daggerheart compatibility metadata – exposed on both the class and instances */
  static get metadata() {
    return {
      label: 'Guard Modifier',
      type: 'guard-management.guard-modifier',
      hasDescription: false,
      hasResource: false,
      isQuantifiable: false,
      isInventoryItem: false,
      hasActions: false,
      hasAttribution: false,
    };
  }
  get metadata() {
    return (this.constructor as any).metadata;
  }

  /** Daggerheart compatibility */
  getRollData() {
    return { ...this };
  }

  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      description: new fields.StringField({ required: false, blank: true }),
      type: new fields.StringField({
        required: true,
        initial: 'neutral',
        choices: ['positive', 'negative', 'neutral'],
      }),
      image: new fields.StringField({ required: false, blank: true }),
      organizationId: new fields.StringField({ required: false, blank: true }),
      statModifications: new fields.ArrayField(
        new fields.SchemaField({
          statName: new fields.StringField({
            required: true,
            choices: Object.keys(DEFAULT_GUARD_STATS),
          }),
          value: new fields.NumberField({ required: true, integer: true }),
        }),
        { initial: [] }
      ),
      version: new fields.NumberField({ required: true, initial: 1, integer: true }),
      createdAt: new fields.NumberField({ required: false }),
      updatedAt: new fields.NumberField({ required: false }),
    };
  }
}
