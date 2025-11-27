/**
 * Base Entity Dialog - Generic dialog for entity CRUD operations
 * Provides consistent dialog behavior using DialogV2 across all entities
 */

import { EntityConfig, Identifiable } from '../core/traits';
import { DOMEventSetup } from '../utils/DOMEventSetup';

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
  rows?: number; // For textarea
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
      // Use DialogV2 if available
      const DialogV2Class = foundry.applications.api.DialogV2;

      if (!DialogV2Class) {
        console.error('DialogV2 no está disponible, usando Dialog estándar como fallback');
        return this.showWithStandardDialog(mode, contextId, existingEntity, options, content);
      }

      let entityResult: T | null = null;

      // Setup file pickers and other dynamic elements
      this.setupDynamicElements(existingEntity);

      const result = await DialogV2Class.wait({
        window: {
          title,
          resizable: options.resizable ?? true,
        },
        content,
        buttons: [
          {
            action: 'save',
            icon: 'fas fa-save',
            label: mode === 'create' ? 'Crear' : 'Guardar',
            callback: (_event: Event, _button: any, dialog: any) => {
              console.log('🔍 Dialog callback triggered');
              const formData = this.extractFormData(dialog);
              console.log('📋 Form data extracted:', formData);

              entityResult = this.createEntityFromFormData(
                formData,
                mode,
                contextId,
                existingEntity
              );
              console.log('✨ Entity result:', entityResult);
              return entityResult;
            },
          },
          {
            action: 'cancel',
            icon: 'fas fa-times',
            label: 'Cancelar',
            callback: () => null,
          },
        ],
      });

      return result === 'save' ? entityResult : null;
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

    // Prepare fields data for Handlebars
    const processedFields = fields.map((field) => {
      const value = existingEntity ? (existingEntity as any)[field.name] : undefined;

      // Handle specific field types
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

    return renderTemplate(
      'modules/guard-management/templates/dialogs/base-entity.hbs',
      templateData
    );
  }

  /**
   * Setup dynamic elements like file pickers
   */
  protected setupDynamicElements(existingEntity?: T): void {
    // Setup file pickers using centralized DOM event setup
    DOMEventSetup.observe('.file-picker-btn', () => this.setupFilePickers(existingEntity), 5000);
  }

  /**
   * Setup file picker functionality
   */
  protected setupFilePickers(_existingEntity?: T): void {
    const filePickerBtns = document.querySelectorAll('.file-picker-btn');

    filePickerBtns.forEach((btn) => {
      if (btn.hasAttribute('data-initialized')) return;

      btn.setAttribute('data-initialized', 'true');
      btn.addEventListener('click', (event: Event) => {
        event.preventDefault();
        event.stopPropagation();

        const target = btn.getAttribute('data-target');
        const fileType = btn.getAttribute('data-file-type') || 'image';
        const input = document.getElementById(target!) as HTMLInputElement;

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
   * Extract form data from dialog
   */
  protected extractFormData(dialog: any): Record<string, any> {
    const formData: Record<string, any> = {};

    // Try multiple ways to find the form
    let form = dialog.element?.querySelector('form');
    if (!form && dialog.element?.querySelector) {
      form = dialog.element.querySelector(`form.${this.config.entityType}-dialog-form`);
    }
    if (!form && dialog.window?.content?.querySelector) {
      form = dialog.window.content.querySelector('form');
    }

    console.log('🔍 Extracting form data, dialog element:', dialog.element);
    console.log('📋 Form found:', form);

    if (!form) {
      console.error('❌ No form found in dialog');
      return formData;
    }

    const formDataObj = new FormData(form);
    console.log('📝 FormData entries:', Array.from(formDataObj.entries()));

    for (const [key, value] of formDataObj.entries()) {
      // Handle number inputs
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

  /**
   * Fallback to standard Dialog if DialogV2 is not available
   */
  protected async showWithStandardDialog(
    mode: 'create' | 'edit',
    contextId: string,
    existingEntity?: T,
    options: BaseDialogOptions = {},
    content?: string
  ): Promise<T | null> {
    console.warn(`Usando Dialog estándar para ${this.config.displayName}`);

    const dialogContent = content || (await this.generateContent(mode, contextId, existingEntity));

    return new Promise((resolve) => {
      new Dialog({
        title:
          options.title ||
          (mode === 'create'
            ? `Nuevo ${this.config.displayName}`
            : `Editar ${this.config.displayName}`),
        content: dialogContent,
        buttons: {
          save: {
            icon: '<i class="fas fa-save"></i>',
            label: mode === 'create' ? 'Crear' : 'Guardar',
            callback: (html: JQuery) => {
              const formData = this.extractFormDataFromJQuery(html);
              const entity = this.createEntityFromFormData(
                formData,
                mode,
                contextId,
                existingEntity
              );
              resolve(entity);
            },
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: 'Cancelar',
            callback: () => resolve(null),
          },
        },
        default: 'save',
        render: () => this.setupDynamicElements(existingEntity),
      }).render(true);
    });
  }

  /**
   * Extract form data from jQuery (for standard Dialog fallback)
   */
  protected extractFormDataFromJQuery(html: JQuery): Record<string, any> {
    const formData: Record<string, any> = {};
    const form = html.find('form')[0];

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
