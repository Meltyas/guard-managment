/**
 * Resource Entity Configuration
 * Defines how Resources should be rendered, validated, and managed
 */

import {
  ActionButton,
  ChatContext,
  EntityConfig,
  FieldRenderer,
  ValidationRule,
} from '../core/traits';
import type { Resource } from '../types/entities';

// ============================================================================
// Resource-specific Field Renderers
// ============================================================================

const quantityRenderer: FieldRenderer<Resource> = {
  render: (value: number, _entity: Resource) => `
    <span class="resource-quantity">Cantidad: ${value}</span>
  `,
  validate: (value: any) => typeof value === 'number' && value >= 0,
};

const descriptionRenderer: FieldRenderer<Resource> = {
  render: (value: string, _entity: Resource) => {
    if (!value || !value.trim()) return '';
    return ` <span class="resource-description">${value.trim()}</span> `;
  },
  validate: (value: any) => typeof value === 'string',
};

// ============================================================================
// Resource Actions
// ============================================================================

const resourceActions: ActionButton[] = [
  {
    icon: 'fas fa-edit',
    title: 'Editar recurso',
    action: 'edit',
    cssClass: 'edit-resource-btn btn-icon',
  },
  {
    icon: 'fas fa-trash',
    title: 'Remover recurso',
    action: 'remove',
    cssClass: 'remove-resource-btn btn-icon',
  },
];

// ============================================================================
// Resource Chat Integration
// ============================================================================

function generateResourceChatTemplate(entity: Resource, context: ChatContext): string {
  const MODULE_PATH = 'modules/guard-management';
  const hasImage = !!entity.image;
  const image = entity.image || '';
  const noImageClass = hasImage ? '' : ' dh-card--no-image';

  return `
    <div class="dh-card-chat-wrapper">
      <div class="dh-card dh-card--resource${noImageClass}">
        <div class="dh-card-inner">
          <div class="dh-card-header">
            ${hasImage ? `
            <div class="dh-card-header-image">
              <img alt="${entity.name}" src="${image}" />
            </div>
            <img class="dh-card-divider" src="${MODULE_PATH}/assets/card/card-type-middle-deco.png" />
            ` : ''}
            <div class="dh-card-type">recurso</div>
            <div class="dh-card-quantity-badge">×${entity.quantity}</div>
          </div>
          <div class="dh-card-body">
            <div class="dh-card-title-block">
              <div class="dh-card-title-wrapper">
                <h1 class="dh-card-title">${entity.name}</h1>
              </div>
              ${
                entity.description?.trim()
                  ? `
              <div class="dh-card-subtitle">
                <p>${entity.description.trim()}</p>
              </div>
              `
                  : ''
              }
            </div>
            <div class="dh-card-content">
              <p><strong>Cantidad:</strong> ${entity.quantity}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
}

function generateResourceChatFlags(entity: Resource): Record<string, any> {
  return {
    resourceId: entity.id,
    resourceName: entity.name,
    quantity: entity.quantity,
  };
}

// ============================================================================
// Resource Validation Rules
// ============================================================================

const resourceValidationRules: ValidationRule<Resource>[] = [
  {
    field: 'name',
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 100,
    message: 'El nombre del recurso es requerido y debe tener entre 1 y 100 caracteres',
  },
  {
    field: 'quantity',
    required: true,
    type: 'number',
    min: 0,
    message: 'La cantidad debe ser un número mayor o igual a 0',
  },
  {
    field: 'description',
    type: 'string',
    maxLength: 500,
    message: 'La descripción no puede tener más de 500 caracteres',
  },
  {
    field: 'organizationId',
    required: true,
    type: 'string',
    minLength: 1,
    message: 'El ID de organización es requerido',
  },
];

// ============================================================================
// Complete Resource Configuration
// ============================================================================

export const resourceConfig: EntityConfig<Resource> = {
  entityType: 'resource',
  displayName: 'Recurso',
  pluralName: 'Recursos',

  renderer: {
    fieldRenderers: new Map([
      ['quantity', quantityRenderer],
      ['description', descriptionRenderer],
    ]),
    defaultActions: resourceActions,
  },

  chatIntegration: {
    chatTemplate: generateResourceChatTemplate,
    chatFlags: generateResourceChatFlags,
    beforeSend: (_entity: Resource, context: ChatContext) => {
      // Add any resource-specific logic before sending to chat
      return context;
    },
  },

  validator: {
    rules: resourceValidationRules,
  },

  manager: {
    storageKey: 'guard-resources',
    documentType: 'JournalEntry',
    cacheEnabled: true,
    syncStrategy: 'immediate',
  },

  extensions: [
    // Future resource-specific extensions can be added here
  ],
};
