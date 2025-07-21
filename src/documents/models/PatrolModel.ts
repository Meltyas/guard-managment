/**
 * DataModel for Patrol Actor sub-type
 */

import {
  DEFAULT_GUARD_STATS,
  GuardStats,
  PatrolStatus,
  StatModification,
} from '../../types/entities.js';

export class PatrolModel extends foundry.abstract.TypeDataModel {
  // Declare schema properties
  declare leaderId: string;
  declare unitCount: number;
  declare organizationId: string;
  declare customModifiers: StatModification[];
  declare activeEffects: string[];
  declare status: PatrolStatus;
  declare version: number;

  // Derived properties
  declare calculatedStats: GuardStats;

  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      leaderId: new fields.StringField({
        required: true,
        blank: false,
        initial: '',
      }),

      unitCount: new fields.NumberField({
        required: true,
        initial: 1,
        min: 1,
        max: 12,
        integer: true,
      }),

      organizationId: new fields.StringField({
        required: true,
        blank: false,
        initial: '',
      }),

      customModifiers: new fields.ArrayField(
        new fields.SchemaField({
          statName: new fields.StringField({
            required: true,
            choices: ['robustismo', 'analitica', 'subterfugio', 'elocuencia'],
          }),
          value: new fields.NumberField({
            required: true,
            integer: true,
          }),
        }),
        {
          required: false,
          initial: [],
        }
      ),

      activeEffects: new fields.ArrayField(new fields.StringField({ blank: false }), {
        required: false,
        initial: [],
      }),

      status: new fields.StringField({
        required: true,
        initial: 'idle',
        choices: ['idle', 'deployed', 'recalled'],
      }),

      version: new fields.NumberField({
        required: true,
        initial: 1,
        min: 1,
        integer: true,
      }),
    };
  }

  /**
   * Prepare base data for the patrol
   */
  prepareBaseData() {
    // Basic validation and setup
    if (this.unitCount < 1) this.unitCount = 1;
    if (this.unitCount > 12) this.unitCount = 12;
  }

  /**
   * Prepare derived data for the patrol
   */
  prepareDerivedData() {
    // Calculate stats based on organization + modifiers + effects
    this.calculatedStats = this._calculatePatrolStats();
  }

  /**
   * Calculate patrol stats based on organization stats and modifiers
   * @private
   */
  _calculatePatrolStats(): GuardStats {
    // Get organization stats
    const organization = this.getOrganization();
    const baseStats = organization?.system?.baseStats || DEFAULT_GUARD_STATS;

    // Start with organization base stats or defaults
    const stats = { ...baseStats };

    // Apply custom modifiers
    for (const modifier of this.customModifiers || []) {
      if (stats.hasOwnProperty(modifier.statName)) {
        stats[modifier.statName as keyof GuardStats] += modifier.value;
      }
    }

    // TODO: Apply active effects
    // This would require looking up the actual effect documents

    // Ensure no negative stats
    Object.keys(stats).forEach((key) => {
      if (stats[key as keyof GuardStats] < 0) {
        stats[key as keyof GuardStats] = 0;
      }
    });

    return stats;
  }

  /**
   * Get the organization this patrol belongs to
   */
  getOrganization() {
    if (!game?.actors) return null;
    return game.actors.get(this.organizationId);
  }

  /**
   * Get the leader actor
   */
  getLeader() {
    if (!game?.actors) return null;
    return game.actors.get(this.leaderId);
  }

  /**
   * Get all active effect documents
   */
  getActiveEffects() {
    if (!game?.items) return [];
    return this.activeEffects.map((id) => game.items?.get(id)).filter(Boolean);
  }

  /**
   * Deploy this patrol
   */
  async deploy() {
    if (this.status !== 'idle') return false;

    await this.parent.update({
      'system.status': 'deployed',
      'system.version': this.version + 1,
    });

    return true;
  }

  /**
   * Recall this patrol
   */
  async recall() {
    if (this.status !== 'deployed') return false;

    await this.parent.update({
      'system.status': 'recalled',
      'system.version': this.version + 1,
    });

    return true;
  }

  /**
   * Return to idle status
   */
  async returnToIdle() {
    await this.parent.update({
      'system.status': 'idle',
      'system.version': this.version + 1,
    });

    return true;
  }

  /**
   * Add a custom modifier
   */
  async addCustomModifier(statName: keyof GuardStats, value: number) {
    const newModifier: StatModification = { statName, value };

    await this.parent.update({
      'system.customModifiers': [...this.customModifiers, newModifier],
      'system.version': this.version + 1,
    });
  }

  /**
   * Remove a custom modifier by index
   */
  async removeCustomModifier(index: number) {
    if (index < 0 || index >= this.customModifiers.length) return;

    const updatedModifiers = [...this.customModifiers];
    updatedModifiers.splice(index, 1);

    await this.parent.update({
      'system.customModifiers': updatedModifiers,
      'system.version': this.version + 1,
    });
  }

  /**
   * Apply an effect to this patrol
   */
  async applyEffect(effectId: string) {
    if (!this.activeEffects.includes(effectId)) {
      await this.parent.update({
        'system.activeEffects': [...this.activeEffects, effectId],
        'system.version': this.version + 1,
      });
    }
  }

  /**
   * Remove an effect from this patrol
   */
  async removeEffect(effectId: string) {
    const updatedEffects = this.activeEffects.filter((id) => id !== effectId);
    await this.parent.update({
      'system.activeEffects': updatedEffects,
      'system.version': this.version + 1,
    });
  }
}
