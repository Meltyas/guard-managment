/**
 * Example: Patrol Entity Configuration
 * Shows how to create a complex entity with unique features using the framework
 */

import {
  ActionButton,
  ChatContext,
  EntityConfig,
  EntityExtension,
  FieldRenderer,
  ValidationRule,
} from '../core/traits';
import type { Patrol } from '../types/entities';

// Define an extended interface for this specific configuration example
// This demonstrates how to add custom fields to the base entity type
interface ExtendedPatrol extends Patrol {
  currentLocation?: string;
  memberCount?: number; // In this example, we track count explicitly
}

// ============================================================================
// Patrol-specific Field Renderers (Complex Fields)
// ============================================================================

const patrolStatsRenderer: FieldRenderer<ExtendedPatrol> = {
  render: (value: any, _entity: ExtendedPatrol) => {
    if (!value || typeof value !== 'object') return '';

    return `
      <div class="patrol-stats">
        <div class="stat-row">
          <span class="stat-label">Robustismo:</span>
          <span class="stat-value">${value.robustismo ?? 0}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Analítica:</span>
          <span class="stat-value">${value.analitica ?? 0}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Subterfugio:</span>
          <span class="stat-value">${value.subterfugio ?? 0}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Elocuencia:</span>
          <span class="stat-value">${value.elocuencia ?? 0}</span>
        </div>
      </div>
    `;
  },
  validate: (value: any) => value && typeof value === 'object',
};

const patrolMembersRenderer: FieldRenderer<ExtendedPatrol> = {
  render: (value: number, _entity: ExtendedPatrol) => `
    <div class="patrol-members">
      <i class="fas fa-users"></i>
      <span>${value} miembros</span>
    </div>
  `,
  validate: (value: any) => typeof value === 'number' && value >= 1 && value <= 12,
};

const patrolLeaderRenderer: FieldRenderer<ExtendedPatrol> = {
  render: (value: string, _entity: ExtendedPatrol) => {
    if (!value) return `<span class="no-leader">Sin líder asignado</span>`;

    return `
      <div class="patrol-leader">
        <i class="fas fa-crown"></i>
        <span class="leader-name">${value}</span>
        <button
          type="button"
          class="view-leader-btn btn-icon"
          data-leader-id="${value}"
          title="Ver detalles del líder"
        >
          <i class="fas fa-eye"></i>
        </button>
      </div>
    `;
  },
  validate: (value: any) => typeof value === 'string',
};

// ============================================================================
// Patrol-specific Actions (More Complex)
// ============================================================================

const patrolActions: ActionButton[] = [
  {
    icon: 'fas fa-edit',
    title: 'Editar patrulla',
    action: 'edit',
    cssClass: 'edit-patrol-btn btn-icon',
  },
  {
    icon: 'fas fa-route',
    title: 'Establecer ruta',
    action: 'set-route',
    cssClass: 'set-route-btn btn-icon',
  },
  {
    icon: 'fas fa-plus-circle',
    title: 'Añadir efecto',
    action: 'add-effect',
    cssClass: 'add-effect-btn btn-icon',
  },
  {
    icon: 'fas fa-dice-d20',
    title: 'Tirar dados',
    action: 'roll-dice',
    cssClass: 'roll-dice-btn btn-icon',
  },
  {
    icon: 'fas fa-trash',
    title: 'Eliminar patrulla',
    action: 'delete',
    cssClass: 'delete-patrol-btn btn-icon btn-danger',
  },
];

// ============================================================================
// Complex Chat Integration
// ============================================================================

function generatePatrolChatTemplate(entity: ExtendedPatrol, context: ChatContext): string {
  const effectsList = entity.activeEffects?.length
    ? entity.activeEffects.map((effect) => `<li>${effect}</li>`).join('')
    : '<li><em>Sin efectos activos</em></li>';

  return `
    <div class="guard-patrol-chat">
      <div class="patrol-header">
        <h3 class="patrol-name">${entity.name}</h3>
        ${entity.currentLocation ? `<p class="patrol-location"><i class="fas fa-map-marker-alt"></i> ${entity.currentLocation}</p>` : ''}
      </div>

      <div class="patrol-details">
        <div class="patrol-composition">
          <p><strong>Miembros:</strong> ${entity.memberCount}</p>
          ${entity.leaderId ? `<p><strong>Líder:</strong> ${entity.leaderId}</p>` : ''}
        </div>

        <div class="patrol-stats">
          <h4>Estadísticas:</h4>
          <ul>
            <li>Robustismo: ${entity.derivedStats?.robustismo ?? 0}</li>
            <li>Analítica: ${entity.derivedStats?.analitica ?? 0}</li>
            <li>Subterfugio: ${entity.derivedStats?.subterfugio ?? 0}</li>
            <li>Elocuencia: ${entity.derivedStats?.elocuencia ?? 0}</li>
          </ul>
        </div>

        <div class="patrol-effects">
          <h4>Efectos Activos:</h4>
          <ul>${effectsList}</ul>
        </div>
      </div>

      ${context.organizationName ? `<div class="patrol-source">Organización: <strong>${context.organizationName}</strong></div>` : ''}
    </div>
  `;
}

// ============================================================================
// Advanced Validation Rules
// ============================================================================

const patrolValidationRules: ValidationRule<ExtendedPatrol>[] = [
  {
    field: 'name',
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 50,
    message: 'El nombre de la patrulla es requerido (1-50 caracteres)',
  },
  {
    field: 'memberCount',
    required: true,
    type: 'number',
    min: 1,
    max: 12,
    message: 'Una patrulla debe tener entre 1 y 12 miembros',
  },
  {
    field: 'organizationId',
    required: true,
    type: 'string',
    message: 'La patrulla debe pertenecer a una organización',
  },
  {
    field: 'currentLocation',
    type: 'string',
    maxLength: 100,
    message: 'La ubicación no puede exceder 100 caracteres',
  },
];

// ============================================================================
// Entity Extensions (Unique Complex Behaviors)
// ============================================================================

const statCalculationExtension: EntityExtension<ExtendedPatrol> = {
  name: 'statCalculation',
  priority: 1,
  canHandle: (entity: ExtendedPatrol) => !!entity.organizationId && !!entity.memberCount,
  extend: async (entity: ExtendedPatrol, _context?: any) => {
    // Complex logic to calculate derived stats from organization base stats
    const gm = (window as any).GuardManagement;
    if (!gm?.documentManager) return entity;

    try {
      const organization = await gm.documentManager.getGuardOrganization(entity.organizationId);
      if (!organization) return entity;

      // Calculate derived stats (simplified example)
      const memberBonus = Math.floor((entity.memberCount || 0) / 3); // Every 3 members add +1
      const leaderBonus = entity.leaderId ? 2 : 0;

      entity.derivedStats = {
        robustismo: organization.baseStats.robustismo + memberBonus + leaderBonus,
        analitica: organization.baseStats.analitica + memberBonus,
        subterfugio: organization.baseStats.subterfugio + memberBonus,
        elocuencia: organization.baseStats.elocuencia + memberBonus + leaderBonus,
      };

      return entity;
    } catch (error) {
      console.error('Error calculating patrol stats:', error);
      return entity;
    }
  },
};

const effectApplicationExtension: EntityExtension<ExtendedPatrol> = {
  name: 'effectApplication',
  priority: 2,
  canHandle: (entity: ExtendedPatrol) => !!entity.activeEffects?.length,
  extend: async (entity: ExtendedPatrol) => {
    // Apply active effects to modify derived stats
    // This is where complex effect logic would go
    if (!entity.derivedStats || !entity.activeEffects?.length) return entity;

    // Example: Apply effects (simplified)
    for (const effectId of entity.activeEffects) {
      // In a real implementation, you'd load the effect and apply its modifiers
      console.log(`Applying effect ${effectId} to patrol ${entity.name}`);
    }

    return entity;
  },
};

// ============================================================================
// Complete Patrol Configuration
// ============================================================================

export const patrolConfig: EntityConfig<ExtendedPatrol> = {
  entityType: 'patrol',
  displayName: 'Patrulla',
  pluralName: 'Patrullas',

  renderer: {
    fieldRenderers: new Map<keyof ExtendedPatrol, FieldRenderer<ExtendedPatrol>>([
      ['derivedStats', patrolStatsRenderer],
      ['memberCount', patrolMembersRenderer],
      ['leaderId', patrolLeaderRenderer],
    ]),
    defaultActions: patrolActions,
    templateOverrides: new Map([
      // Custom main template for patrols
      [
        'main',
        (entity: ExtendedPatrol, _options) => `
          <div class="patrol-main-content">
            ${entity.currentLocation
              ? `
                  <div class="patrol-location">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${entity.currentLocation}</span>
                  </div>
                `
              : ''}
            <div class="patrol-info">
              <span class="patrol-name">${entity.name}</span>
              ${patrolMembersRenderer.render(entity.memberCount || 0, entity, 'memberCount')}
              ${entity.leaderId
                ? patrolLeaderRenderer.render(entity.leaderId, entity, 'leaderId')
                : ''}
            </div>
            ${entity.derivedStats
              ? patrolStatsRenderer.render(entity.derivedStats, entity, 'derivedStats')
              : ''}
          </div>
        `,
      ],
    ]),
  },

  chatIntegration: {
    chatTemplate: generatePatrolChatTemplate,
    chatFlags: (entity: ExtendedPatrol) => ({
      patrolId: entity.id,
      patrolName: entity.name,
      organizationId: entity.organizationId,
      memberCount: entity.memberCount,
      hasLeader: !!entity.leaderId,
    }),
    beforeSend: (_entity: ExtendedPatrol, context: ChatContext) => {
      // Add patrol-specific context
      return {
        ...context,
        additionalData: {
          ...context.additionalData,
          patrolType: 'guard-patrol',
          timestamp: Date.now(),
        },
      };
    },
  },

  validator: {
    rules: patrolValidationRules,
    customValidators: new Map([
      [
        'memberCount',
        (value: number, _entity: ExtendedPatrol) => {
          // Custom validation: member count should be reasonable for organization size
          if (value > 12) {
            return {
              isValid: false,
              errors: [
                {
                  field: 'memberCount',
                  message: 'Las patrullas no pueden tener más de 12 miembros',
                  code: 'MAX_MEMBERS_EXCEEDED',
                },
              ],
            };
          }
          return { isValid: true, errors: [] };
        },
      ],
    ]),
  },

  manager: {
    storageKey: 'guard-patrols',
    documentType: 'JournalEntry',
    cacheEnabled: true,
    syncStrategy: 'batched', // Patrols might be updated frequently
  },

  extensions: [statCalculationExtension, effectApplicationExtension],
};

// ============================================================================
// Usage Example
// ============================================================================

/*
// How to use this configuration:

import { EntityFactory } from '../core/entity-framework';
import { patrolConfig } from './patrol-config';

export class PatrolTemplate {
  private static renderer = EntityFactory.createRenderer(patrolConfig);
  private static chatIntegration = EntityFactory.createChatIntegration(patrolConfig);
  private static validator = EntityFactory.createValidator(patrolConfig);

  static async renderPatrol(patrolData: ExtendedPatrol, options: RenderOptions = {}) {
    // Apply extensions before rendering
    let processedPatrol = patrolData;
    for (const extension of patrolConfig.extensions || []) {
      if (extension.canHandle(processedPatrol)) {
        processedPatrol = await extension.extend(processedPatrol);
      }
    }

    return this.renderer.renderItem(processedPatrol, options);
  }

  static validatePatrol(patrolData: ExtendedPatrol) {
    return this.validator.validate(patrolData);
  }

  static async sendToChat(patrolData: ExtendedPatrol, context: ChatContext = {}) {
    return this.chatIntegration.sendToChat(patrolData, context);
  }
}
*/
