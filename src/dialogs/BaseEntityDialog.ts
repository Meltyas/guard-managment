/**
 * Base Entity Dialog - Generic dialog for entity CRUD operations
 * Provides consistent dialog behavior using GuardModal across all entities
 */

import { EntityConfig, Identifiable } from '../core/traits';
import { GuardModal } from '../ui/GuardModal.js';

export interface BaseDialogOptions {
  title?: string;
  width?: number;
  height?: number;
  resizable?: boolean;
}

export interface FieldConfig {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'file' | 'select' | 'checkbox';
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  options?: Array<{ value: string; label: string }>;
  fileType?: 'image' | 'imagevideo' | 'audio' | 'video';
  rows?: number;
}

/**
 * Generic Base Dialog for entities
 * Handles common dialog patterns with configurable fields
 */
export abstract class BaseEntityDialog<T extends Identifiable> {
  protected config: EntityConfig<T>;

  constructor(config: EntityConfig<T>) {
    this.config = config;
  }

  /**
   * Show the dialog in create or edit mode
   */
  public async show(
    mode: 'create' | 'edit',
    contextId: string,
    existingEntity?: T,
    options: BaseDialogOptions = {}
  ): Promise<T | null> {
    const content = await this.generateContent(mode, contextId, existingEntity);
    const title =
      options.title ||
      (mode === 'create'
        ? `Nuevo ${this.config.displayName}`
        : `Editar ${this.config.displayName}`);

    try {
      return await GuardModal.openAsync<T>({
        title,
        icon: 'fas fa-edit',
        body: content,
        width: options.width,
        saveLabel: mode === 'create' ? 'Crear' : 'Guardar',
        onRender: (bodyEl) => {
          this.setupFilePickers(bodyEl, existingEntity);
        },
        onSave: async (bodyEl) => {
          const formData = this.extractFormData(bodyEl);
          const entity = this.createEntityFromFormData(formData, mode, contextId, existingEntity);
          if (!entity) return false;
          return entity;
        },
      });
    } catch (error) {
      console.error(`Error showing ${this.config.displayName} dialog:`, error);
      return null;
    }
  }

  /**
   * Generate dialog content using field configuration
   */
  protected async generateContent(
    mode: 'create' | 'edit',
    contextId: string,
    existingEntity?: T
  ): Promise<string> {
    const fields = this.getFieldConfiguration();

    const processedFields = fields.map((field) => {
      const value = existingEntity ? (existingEntity as any)[field.name] : undefined;

      if (field.type === 'select' && field.options) {
        return {
          ...field,
          value: value || '',
          options: field.options.map((opt) => ({
            ...opt,
            selected: value === opt.value,
          })),
        };
      }

      return {
        ...field,
        value: value !== undefined ? value : '',
        rows: field.rows || 3,
        fileType: field.fileType || 'image',
      };
    });

    const templateData = {
      entityType: this.config.entityType,
      fields: processedFields,
      contextId,
      entityId: mode === 'edit' ? existingEntity?.id : '',
    };

    return foundry.applications.handlebars.renderTemplate(
      'modules/guard-management/templates/dialogs/base-entity.hbs',
      templateData
    );
  }

  /**
   * Setup file picker functionality
   */
  protected setupFilePickers(bodyEl: HTMLElement, _existingEntity?: T): void {
    const filePickerBtns = bodyEl.querySelectorAll('.file-picker-btn');

    filePickerBtns.forEach((btn) => {
      btn.addEventListener('click', (event: Event) => {
        event.preventDefault();
        event.stopPropagation();

        const target = btn.getAttribute('data-target');
        const fileType = btn.getAttribute('data-file-type') || 'image';
        const input = bodyEl.querySelector(`#${target}`) as HTMLInputElement;

        if (!input) return;

        const fp = new FilePicker({
          type: fileType as any,
          current: input.value || '',
          callback: (path: string) => {
            input.value = path;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          },
        });

        fp.render(true);
      });
    });
  }

  /**
   * Extract form data from the modal body
   */
  protected extractFormData(bodyEl: HTMLElement): Record<string, any> {
    const formData: Record<string, any> = {};
    const form = bodyEl.querySelector('form');

    if (!form) return formData;

    const formDataObj = new FormData(form);

    for (const [key, value] of formDataObj.entries()) {
      const input = form.querySelector(`[name="${key}"]`) as HTMLInputElement;
      if (input?.type === 'number') {
        formData[key] = parseFloat(value as string) || 0;
      } else if (input?.type === 'checkbox') {
        formData[key] = input.checked;
      } else {
        formData[key] = value;
      }
    }

    return formData;
  }

  // Abstract methods to be implemented by subclasses
  protected abstract getFieldConfiguration(): FieldConfig[];
  protected abstract createEntityFromFormData(
    formData: Record<string, any>,
    mode: 'create' | 'edit',
    contextId: string,
    existingEntity?: T
  ): T | null;
}
