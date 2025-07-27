/**
 * Resource Entity Configuration
 * Defines how Resources should be rendered, validated, and managed
 */

import { html } from 'lit-html';
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
  render: (value: number, _entity: Resource) => html`
    <span class="resource-quantity">Cantidad: ${value}</span>
  `,
  validate: (value: any) => typeof value === 'number' && value >= 0,
};

const descriptionRenderer: FieldRenderer<Resource> = {
  render: (value: string, _entity: Resource) => {
    if (!value || !value.trim()) return html``;
    return html` <span class="resource-description">${value.trim()}</span> `;
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
  return `
    <div class="guard-resource-chat">
      <div class="resource-item">
        ${
          entity.image
            ? `<div class="resource-image">
                <img src="${entity.image}" alt="${entity.name}" onerror="this.style.display='none'" />
              </div>`
            : ''
        }
        <div class="resource-info">
          <span class="resource-name">${entity.name}</span>
          <span class="resource-quantity">Cantidad: ${entity.quantity}</span>
          ${
            entity.description && entity.description.trim()
              ? `<span class="resource-description">${entity.description.trim()}</span>`
              : ''
          }
        </div>
      </div>
      ${context.organizationName ? `<div class="resource-source">Desde: <strong>${context.organizationName}</strong></div>` : ''}
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
