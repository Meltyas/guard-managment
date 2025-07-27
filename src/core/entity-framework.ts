/**
 * Entity Framework - Unified system for entity management
 * Provides composable traits and extensible architecture
 */

import { html, TemplateResult } from 'lit-html';
import {
  ActionButton,
  ChatContext,
  Chattable,
  EntityConfig,
  Identifiable,
  Renderable,
  RenderOptions,
  Validateable,
  ValidationResult,
} from './traits';

// ============================================================================
// Generic Entity Template Renderer
// ============================================================================

export class EntityTemplateRenderer<T extends Identifiable> implements Renderable<T> {
  constructor(private config: EntityConfig<T>) {}

  renderItem(entity: T, options: RenderOptions = {}): TemplateResult | null {
    const {
      showActions = false,
      showSendToChat = false,
      compact = false,
      contextId = '',
      customActions = [],
      cssClasses = [],
    } = options;

    if (!entity) {
      return null;
    }

    const entityType = this.config.entityType;
    const defaultActions = this.config.renderer?.defaultActions || [];
    const allActions = [...defaultActions, ...customActions];

    // Generate CSS classes
    const itemClasses = [`${entityType}-item`, ...(compact ? ['compact'] : []), ...cssClasses].join(
      ' '
    );

    // Render main content using configured field renderers
    const mainContent = this.renderMainContent(entity, options);

    return html`
      <div class="${itemClasses}" data-entity-id="${entity.id}" data-entity-type="${entityType}">
        ${mainContent}
        ${showActions || showSendToChat || allActions.length > 0
          ? this.renderActions(entity, {
              showSendToChat,
              customActions: allActions,
              contextId,
            })
          : ''}
      </div>
    `;
  }

  renderCompact(entity: T, options: RenderOptions = {}): TemplateResult | null {
    return this.renderItem(entity, { ...options, compact: true });
  }

  private renderMainContent(entity: T, options: RenderOptions): TemplateResult {
    const renderer = this.config.renderer;

    // Check for template overrides first
    if (renderer?.templateOverrides?.has('main')) {
      const override = renderer.templateOverrides.get('main')!;
      return override(entity, options);
    }

    // Default rendering logic
    return html`
      ${this.renderImage(entity)}
      <div class="${this.config.entityType}-info">${this.renderFields(entity, options)}</div>
    `;
  }

  private renderImage(entity: T): TemplateResult {
    const imageField = 'image' as keyof T;
    const image = entity[imageField];

    if (!image || typeof image !== 'string') {
      return html``;
    }

    return html`
      <div class="${this.config.entityType}-image">
        <img src="${image}" alt="${entity.name}" onerror="this.style.display='none'" />
      </div>
    `;
  }

  private renderFields(entity: T, _options: RenderOptions): TemplateResult[] {
    const renderer = this.config.renderer;
    const fields: TemplateResult[] = [];

    // Always render name first
    fields.push(html` <span class="${this.config.entityType}-name">${entity.name}</span> `);

    // Render other fields using configured renderers
    if (renderer?.fieldRenderers) {
      for (const [field, fieldRenderer] of renderer.fieldRenderers) {
        if (field !== 'name' && field !== 'image' && entity[field] !== undefined) {
          fields.push(fieldRenderer.render(entity[field], entity, field));
        }
      }
    }

    return fields;
  }

  private renderActions(
    entity: T,
    options: {
      showSendToChat?: boolean;
      customActions?: ActionButton[];
      contextId?: string;
    }
  ): TemplateResult {
    const { showSendToChat = false, customActions = [], contextId = '' } = options;
    const actions: TemplateResult[] = [];

    // Send to chat action
    if (showSendToChat) {
      actions.push(html`
        <button
          type="button"
          class="send-to-chat-btn btn-icon"
          title="Enviar al chat"
          data-entity-id="${entity.id}"
          data-entity-name="${entity.name}"
          data-entity-type="${this.config.entityType}"
          data-context-id="${contextId}"
        >
          <i class="fas fa-comment"></i>
        </button>
      `);
    }

    // Custom actions
    for (const action of customActions) {
      const dataAttrs = Object.entries(action.data || {})
        .map(([key, value]) => `data-${key}="${value}"`)
        .join(' ');

      actions.push(html`
        <button
          type="button"
          class="${action.cssClass || 'btn-icon'}"
          title="${action.title}"
          data-action="${action.action}"
          data-entity-id="${entity.id}"
          data-entity-name="${entity.name}"
          data-entity-type="${this.config.entityType}"
          ${dataAttrs}
        >
          <i class="${action.icon}"></i>
        </button>
      `);
    }

    return html` <div class="${this.config.entityType}-actions">${actions}</div> `;
  }
}

// ============================================================================
// Generic Chat Integration
// ============================================================================

export class EntityChatIntegration<T extends Identifiable> implements Chattable<T> {
  constructor(private config: EntityConfig<T>) {}

  generateChatHTML(entity: T, context: ChatContext = {}): string {
    const chatIntegration = this.config.chatIntegration;

    if (chatIntegration?.chatTemplate) {
      return chatIntegration.chatTemplate(entity, context);
    }

    // Default chat template
    return this.generateDefaultChatHTML(entity, context);
  }

  async sendToChat(entity: T, context: ChatContext = {}): Promise<void> {
    const chatHTML = this.generateChatHTML(entity, context);

    if (!chatHTML) {
      console.error(`Failed to generate chat HTML for ${this.config.entityType}:`, entity.id);
      return;
    }

    const chatIntegration = this.config.chatIntegration;
    const flags = {
      'guard-management': {
        type: this.config.entityType,
        entityId: entity.id,
        ...(chatIntegration?.chatFlags?.(entity) || {}),
        ...context.additionalData,
      },
    };

    // Apply beforeSend hook if configured
    const finalContext = chatIntegration?.beforeSend?.(entity, context) || context;

    try {
      await (ChatMessage as any).create({
        content: chatHTML,
        whisper: finalContext.whisperTo || [],
        flags,
      });
    } catch (error) {
      console.error(`Error sending ${this.config.entityType} to chat:`, error);
    }
  }

  private generateDefaultChatHTML(entity: T, context: ChatContext): string {
    const entityType = this.config.entityType;

    return `
      <div class="guard-${entityType}-chat">
        <div class="${entityType}-item">
          <div class="${entityType}-info">
            <span class="${entityType}-name">${entity.name}</span>
          </div>
        </div>
        ${context.organizationName ? `<div class="${entityType}-source">Desde: <strong>${context.organizationName}</strong></div>` : ''}
      </div>
    `;
  }
}

// ============================================================================
// Generic Entity Validator
// ============================================================================

export class EntityValidator<T extends Identifiable> implements Validateable<T> {
  constructor(private config: EntityConfig<T>) {}

  validate(entity: T): ValidationResult {
    const validator = this.config.validator;
    const errors: import('./traits.js').ValidationError[] = [];
    const warnings: import('./traits.js').ValidationWarning[] = [];

    if (!validator?.rules) {
      return { isValid: true, errors, warnings };
    }

    // Apply validation rules
    for (const rule of validator.rules) {
      const value = entity[rule.field];
      const result = this.validateField(value, entity, rule);

      if (!result.isValid) {
        errors.push(...result.errors);
      }
      if (result.warnings) {
        warnings.push(...result.warnings);
      }
    }

    // Apply custom validators
    if (validator.customValidators) {
      for (const [field, customValidator] of validator.customValidators) {
        const value = entity[field];
        const result = customValidator(value, entity);

        if (!result.isValid) {
          errors.push(...result.errors);
        }
        if (result.warnings) {
          warnings.push(...result.warnings);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  validatePartial(partial: Partial<T>): ValidationResult {
    // Create a minimal entity for validation
    const tempEntity = { ...partial } as T;
    return this.validate(tempEntity);
  }

  private validateField(
    value: any,
    entity: T,
    rule: import('./traits.js').ValidationRule<T>
  ): ValidationResult {
    const errors: import('./traits.js').ValidationError[] = [];

    // Required check
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field: String(rule.field),
        message: rule.message,
        code: 'REQUIRED',
      });
      return { isValid: false, errors };
    }

    // Skip further validation if value is empty and not required
    if (value === undefined || value === null || value === '') {
      return { isValid: true, errors };
    }

    // Type validation
    if (rule.type && typeof value !== rule.type) {
      errors.push({
        field: String(rule.field),
        message: rule.message,
        code: 'INVALID_TYPE',
      });
    }

    // String validations
    if (rule.type === 'string' && typeof value === 'string') {
      if (rule.minLength && value.length < rule.minLength) {
        errors.push({
          field: String(rule.field),
          message: rule.message,
          code: 'MIN_LENGTH',
        });
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push({
          field: String(rule.field),
          message: rule.message,
          code: 'MAX_LENGTH',
        });
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push({
          field: String(rule.field),
          message: rule.message,
          code: 'PATTERN_MISMATCH',
        });
      }
    }

    // Number validations
    if (rule.type === 'number' && typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        errors.push({
          field: String(rule.field),
          message: rule.message,
          code: 'MIN_VALUE',
        });
      }
      if (rule.max !== undefined && value > rule.max) {
        errors.push({
          field: String(rule.field),
          message: rule.message,
          code: 'MAX_VALUE',
        });
      }
    }

    // Custom validation
    if (rule.custom && !rule.custom(value, entity)) {
      errors.push({
        field: String(rule.field),
        message: rule.message,
        code: 'CUSTOM_VALIDATION',
      });
    }

    return { isValid: errors.length === 0, errors };
  }
}

// ============================================================================
// Entity Factory - Creates configured entities
// ============================================================================

export class EntityFactory {
  static createRenderer<T extends Identifiable>(
    config: EntityConfig<T>
  ): EntityTemplateRenderer<T> {
    return new EntityTemplateRenderer(config);
  }

  static createChatIntegration<T extends Identifiable>(
    config: EntityConfig<T>
  ): EntityChatIntegration<T> {
    return new EntityChatIntegration(config);
  }

  static createValidator<T extends Identifiable>(config: EntityConfig<T>): EntityValidator<T> {
    return new EntityValidator(config);
  }
}
