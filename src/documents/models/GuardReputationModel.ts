/**
 * DataModel for Guard Reputation Item sub-type
 */

import { REPUTATION_LABELS, ReputationLevel } from '../../types/entities.js';

export class GuardReputationModel extends foundry.abstract.TypeDataModel {
  // Declare schema properties
  declare description: string;
  declare level: ReputationLevel;
  declare organizationId: string;
  declare version: number;

  // Derived properties
  declare levelLabel: string;
  declare isHostile: boolean;
  declare isFriendly: boolean;
  declare isNeutral: boolean;

  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      description: new fields.StringField({
        required: false,
        blank: true,
        initial: '',
      }),

      level: new fields.NumberField({
        required: true,
        initial: ReputationLevel.Neutrales,
        min: ReputationLevel.Enemigos,
        max: ReputationLevel.Aliados,
        integer: true,
      }),

      organizationId: new fields.StringField({
        required: true,
        blank: false,
        initial: '',
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
   * Prepare base data for the reputation
   */
  prepareBaseData() {
    // Ensure level is within valid range
    if (this.level < ReputationLevel.Enemigos) this.level = ReputationLevel.Enemigos;
    if (this.level > ReputationLevel.Aliados) this.level = ReputationLevel.Aliados;
  }

  /**
   * Prepare derived data for the reputation
   */
  prepareDerivedData() {
    // Calculate derived properties
    this.levelLabel = REPUTATION_LABELS[this.level] || 'Unknown';
    this.isHostile = this.level <= ReputationLevel.Hostiles;
    this.isFriendly = this.level >= ReputationLevel.Amistosos;
    this.isNeutral = this.level === ReputationLevel.Neutrales;
  }

  /**
   * Get the organization this reputation belongs to
   */
  getOrganization() {
    if (!game?.actors) return null;
    return game.actors.get(this.organizationId);
  }

  /**
   * Improve reputation by one level
   */
  async improve() {
    if (this.level >= ReputationLevel.Aliados) return false;

    await this.parent.update({
      'system.level': this.level + 1,
      'system.version': this.version + 1,
    });

    return true;
  }

  /**
   * Worsen reputation by one level
   */
  async worsen() {
    if (this.level <= ReputationLevel.Enemigos) return false;

    await this.parent.update({
      'system.level': this.level - 1,
      'system.version': this.version + 1,
    });

    return true;
  }

  /**
   * Set reputation to a specific level
   */
  async setLevel(newLevel: ReputationLevel) {
    if (newLevel < ReputationLevel.Enemigos || newLevel > ReputationLevel.Aliados) {
      return false;
    }

    await this.parent.update({
      'system.level': newLevel,
      'system.version': this.version + 1,
    });

    return true;
  }

  /**
   * Get the modifier bonus/penalty for this reputation level
   */
  getModifier(): number {
    switch (this.level) {
      case ReputationLevel.Enemigos:
        return -3;
      case ReputationLevel.Hostiles:
        return -2;
      case ReputationLevel.Desconfiados:
        return -1;
      case ReputationLevel.Neutrales:
        return 0;
      case ReputationLevel.Amistosos:
        return 1;
      case ReputationLevel.Confiados:
        return 2;
      case ReputationLevel.Aliados:
        return 3;
      default:
        return 0;
    }
  }

  /**
   * Get the color associated with this reputation level
   */
  getColor(): string {
    if (this.isHostile) return '#dc3545'; // Red
    if (this.isFriendly) return '#28a745'; // Green
    return '#6c757d'; // Gray for neutral
  }

  /**
   * Check if actions are possible at this reputation level
   */
  canTrade(): boolean {
    return this.level >= ReputationLevel.Neutrales;
  }

  canRequestAid(): boolean {
    return this.level >= ReputationLevel.Amistosos;
  }

  canFormAlliance(): boolean {
    return this.level >= ReputationLevel.Confiados;
  }
}
