/**
 * DataModel for Guard Organization Actor sub-type
 */

import { DEFAULT_GUARD_STATS, GuardStats } from '../../types/entities.js';

export class GuardOrganizationModel extends foundry.abstract.TypeDataModel {
  // Declare schema properties that will be available at runtime
  declare subtitle: string;
  declare baseStats: GuardStats;
  declare activeModifiers: string[];
  declare resources: string[];
  declare reputation: string[];
  declare patrols: string[];
  declare version: number;

  // Derived properties (calculated)
  declare totalStats: number;
  declare effectiveStats: GuardStats;
  declare resourceCount: number;
  declare reputationCount: number;
  declare patrolCount: number;
  declare modifierCount: number;

  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      subtitle: new fields.StringField({
        required: false,
        blank: true,
        initial: '',
      }),

      baseStats: new fields.SchemaField({
        robustismo: new fields.NumberField({
          required: true,
          initial: DEFAULT_GUARD_STATS.robustismo,
          min: -99,
          max: 99,
          integer: true,
        }),
        analitica: new fields.NumberField({
          required: true,
          initial: DEFAULT_GUARD_STATS.analitica,
          min: -99,
          max: 99,
          integer: true,
        }),
        subterfugio: new fields.NumberField({
          required: true,
          initial: DEFAULT_GUARD_STATS.subterfugio,
          min: -99,
          max: 99,
          integer: true,
        }),
        elocuencia: new fields.NumberField({
          required: true,
          initial: DEFAULT_GUARD_STATS.elocuencia,
          min: -99,
          max: 99,
          integer: true,
        }),
      }),

      activeModifiers: new fields.ArrayField(new fields.StringField({ blank: false }), {
        required: false,
        initial: [],
      }),

      resources: new fields.ArrayField(new fields.StringField({ blank: false }), {
        required: false,
        initial: [],
      }),

      reputation: new fields.ArrayField(new fields.StringField({ blank: false }), {
        required: false,
        initial: [],
      }),

      patrols: new fields.ArrayField(new fields.StringField({ blank: false }), {
        required: false,
        initial: [],
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
   * Prepare base data for the guard organization
   */
  prepareBaseData() {
    // Calculate any base-level derived data here
    this.totalStats =
      this.baseStats.robustismo +
      this.baseStats.analitica +
      this.baseStats.subterfugio +
      this.baseStats.elocuencia;
  }

  /**
   * Prepare derived data for the guard organization
   */
  prepareDerivedData() {
    // Calculate derived stats with modifiers applied
    this.effectiveStats = this._calculateEffectiveStats();
    this.resourceCount = this.resources.length;
    this.reputationCount = this.reputation.length;
    this.patrolCount = this.patrols.length;
    this.modifierCount = this.activeModifiers.length;
  }

  /**
   * Calculate effective stats with all modifiers applied
   * @private
   */
  _calculateEffectiveStats(): GuardStats {
    // Start with base stats
    const effective = { ...this.baseStats };

    // TODO: Apply modifiers from activeModifiers
    // This would require looking up the actual modifier documents
    // and applying their stat modifications

    return effective;
  }

  /**
   * Add a patrol to this organization
   */
  async addPatrol(patrolId: string) {
    if (!this.patrols.includes(patrolId)) {
      await this.parent.update({
        'system.patrols': [...this.patrols, patrolId],
        'system.version': this.version + 1,
      });
    }
  }

  /**
   * Remove a patrol from this organization
   */
  async removePatrol(patrolId: string) {
    const updatedPatrols = this.patrols.filter((id) => id !== patrolId);
    await this.parent.update({
      'system.patrols': updatedPatrols,
      'system.version': this.version + 1,
    });
  }

  /**
   * Add a resource to this organization
   */
  async addResource(resourceId: string) {
    if (!this.resources.includes(resourceId)) {
      await this.parent.update({
        'system.resources': [...this.resources, resourceId],
        'system.version': this.version + 1,
      });
    }
  }

  /**
   * Remove a resource from this organization
   */
  async removeResource(resourceId: string) {
    const updatedResources = this.resources.filter((id) => id !== resourceId);
    await this.parent.update({
      'system.resources': updatedResources,
      'system.version': this.version + 1,
    });
  }

  /**
   * Add reputation entry to this organization
   */
  async addReputation(reputationId: string) {
    if (!this.reputation.includes(reputationId)) {
      await this.parent.update({
        'system.reputation': [...this.reputation, reputationId],
        'system.version': this.version + 1,
      });
    }
  }

  /**
   * Remove a reputation from this organization
   */
  async removeReputation(reputationId: string) {
    const updatedReputation = this.reputation.filter((id) => id !== reputationId);
    await this.parent.update({
      'system.reputation': updatedReputation,
      'system.version': this.version + 1,
    });
  }

  /**
   * Get all related patrol documents
   */
  getPatrols() {
    if (!game?.actors) return [];
    return this.patrols.map((id) => game.actors?.get(id)).filter(Boolean);
  }

  /**
   * Get all related resource documents
   */
  getResources() {
    if (!game?.items) return [];
    return this.resources.map((id) => game.items?.get(id)).filter(Boolean);
  }

  /**
   * Get all related reputation documents
   */
  getReputations() {
    if (!game?.items) return [];
    return this.reputation.map((id) => game.items?.get(id)).filter(Boolean);
  }
}
