/**
 * Guard Organization Dialog - Create/Edit Guard Organizations using DialogV2
 */

import { html, TemplateResult } from 'lit-html';
import type { GuardOrganization, GuardStats } from '../types/entities';
import { DEFAULT_GUARD_STATS } from '../types/entities';
import { renderTemplateToString } from '../utils/template-renderer.js';

export interface GuardOrganizationDialogData {
  name: string;
  subtitle: string;
  robustismo: number;
  analitica: number;
  subterfugio: number;
  elocuencia: number;
}

export class GuardOrganizationDialog {
  constructor() {
    // Constructor
  }

  /**
   * Show the dialog in create or edit mode
   */
  public async show(
    mode: 'create' | 'edit',
    existingOrganization?: GuardOrganization
  ): Promise<GuardOrganization | null> {
    const content = this.generateContent(mode, existingOrganization);
    const title =
      mode === 'create' ? 'Nueva Organización de Guardias' : 'Editar Organización de Guardias';

    try {
      // Usar la forma oficial de acceder a DialogV2 en Foundry V13
      const DialogV2Class = foundry.applications.api.DialogV2;

      if (!DialogV2Class) {
        console.warn('DialogV2 no está disponible, usando Dialog estándar como fallback');
        return this.showWithStandardDialog(mode, existingOrganization);
      }

      const result = await DialogV2Class.wait({
        window: {
          title,
          resizable: true,
        },
        content,
        buttons: [
          {
            action: 'save',
            icon: 'fas fa-save',
            label: mode === 'create' ? 'Crear' : 'Guardar',
            default: true,
            callback: (event: Event, button: any, dialog: any) => {
              try {
                console.log('Dialog callback triggered', { dialog, event, button });
                console.log('Dialog properties:', Object.keys(dialog));
                console.log('Event target:', event.target);
                console.log('Event currentTarget:', event.currentTarget);

                // En DialogV2, necesitamos usar diferentes métodos para acceder al contenido
                let form: HTMLFormElement | null = null;

                // Primero intentar con el event target
                if (event.target && event.target instanceof Element) {
                  form = event.target.closest('form') as HTMLFormElement;
                  if (!form) {
                    // Buscar el formulario en el elemento padre
                    const dialogElement = event.target.closest('.dialog');
                    if (dialogElement) {
                      form = dialogElement.querySelector('form.guard-organization-form');
                    }
                  }
                }

                // Si no encontramos el formulario con el event, intentar con el dialog
                if (!form && dialog.form) {
                  form = dialog.form;
                } else if (!form && dialog.element) {
                  form = dialog.element.querySelector('form.guard-organization-form');
                } else if (!form && dialog.contentElement) {
                  form = dialog.contentElement.querySelector('form.guard-organization-form');
                } else if (!form) {
                  // Buscar en el DOM usando el ID del diálogo
                  const dialogElement =
                    document.querySelector(`[data-appid="${dialog.id}"]`) ||
                    document.querySelector('.dialog.window-app:last-child') ||
                    document.querySelector('[data-app-id]:last-child');

                  if (dialogElement) {
                    form = dialogElement.querySelector('form.guard-organization-form');
                  }

                  // Último recurso: buscar en todo el documento
                  if (!form) {
                    const allForms = document.querySelectorAll('form.guard-organization-form');
                    form = allForms[allForms.length - 1] as HTMLFormElement; // Tomar el último formulario
                  }
                }

                console.log('Form found:', form);
                console.log('Form element type:', form?.constructor.name);

                if (!form || !(form instanceof HTMLFormElement)) {
                  console.error('No se encontró un HTMLFormElement válido', {
                    form,
                    dialog,
                    dialogId: dialog.id,
                    dialogElement: dialog.element,
                    allForms: document.querySelectorAll('form'),
                    allGuardForms: document.querySelectorAll('form.guard-organization-form'),
                  });

                  // Alternativa: extraer datos directamente por ID de campos
                  console.log('Intentando extraer datos directamente por ID de campos...');
                  const nameInput = document.getElementById('name') as HTMLInputElement;
                  const subtitleInput = document.getElementById('subtitle') as HTMLInputElement;
                  const robustismoInput = document.getElementById('robustismo') as HTMLInputElement;
                  const analiticaInput = document.getElementById('analitica') as HTMLInputElement;
                  const subterfugioInput = document.getElementById(
                    'subterfugio'
                  ) as HTMLInputElement;
                  const elocuenciaInput = document.getElementById('elocuencia') as HTMLInputElement;

                  if (
                    nameInput &&
                    robustismoInput &&
                    analiticaInput &&
                    subterfugioInput &&
                    elocuenciaInput
                  ) {
                    console.log('Datos extraídos directamente de los campos');
                    const data = {
                      name: nameInput.value || '',
                      subtitle: subtitleInput?.value || '',
                      robustismo:
                        robustismoInput.value !== ''
                          ? parseInt(robustismoInput.value)
                          : DEFAULT_GUARD_STATS.robustismo,
                      analitica:
                        analiticaInput.value !== ''
                          ? parseInt(analiticaInput.value)
                          : DEFAULT_GUARD_STATS.analitica,
                      subterfugio:
                        subterfugioInput.value !== ''
                          ? parseInt(subterfugioInput.value)
                          : DEFAULT_GUARD_STATS.subterfugio,
                      elocuencia:
                        elocuenciaInput.value !== ''
                          ? parseInt(elocuenciaInput.value)
                          : DEFAULT_GUARD_STATS.elocuencia,
                    };

                    console.log('Data extracted directly:', data);

                    // Validar datos
                    const validationResult = this.validateDataWithDetails(data);
                    if (!validationResult.isValid) {
                      console.error('Validation failed:', validationResult);
                      ui?.notifications?.error(validationResult.errorMessage);
                      return false;
                    }

                    return data;
                  }

                  ui?.notifications?.error('No se pudo encontrar el formulario ni los campos');
                  return false;
                }

                const formData = new FormData(form);
                console.log('FormData created:', formData);

                // Log de todos los valores del formulario para debug
                for (const [key, value] of formData.entries()) {
                  console.log(`FormData ${key}:`, value);
                }

                const data = this.extractFormData(formData);
                console.log('Data extracted:', data);

                // Validar datos
                const validationResult = this.validateDataWithDetails(data);
                if (!validationResult.isValid) {
                  console.error('Validation failed:', validationResult);

                  // Resaltar campos con errores
                  this.highlightErrorFields(form, validationResult.errorFields);

                  ui?.notifications?.error(validationResult.errorMessage);
                  return false;
                }

                return data;
              } catch (error) {
                console.error('Error in dialog callback:', error);
                if (error instanceof Error) {
                  console.error('Error stack:', error.stack);
                }
                ui?.notifications?.error('Error al procesar el formulario');
                return false;
              }
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

      if (result) {
        return this.createOrganizationFromData(result, mode, existingOrganization);
      }

      return null;
    } catch (error) {
      console.error('GuardOrganizationDialog | Error showing dialog:', error);
      ui?.notifications?.error('Error al mostrar el diálogo de organización');
      return null;
    }
  }

  /**
   * Generate the HTML content for the dialog
   */
  public generateContent(_mode: 'create' | 'edit', organization?: GuardOrganization): string {
    const data = organization || {
      name: '',
      subtitle: '',
      baseStats: { ...DEFAULT_GUARD_STATS },
    };

    const template = this.renderOrganizationForm(data);
    // Convert TemplateResult to string for DialogV2
    return renderTemplateToString(template);
  }

  /**
   * Render the complete organization form
   */
  private renderOrganizationForm(data: any): TemplateResult {
    return html` ${this.renderFormContent(data)} ${this.renderFormStyles()} `;
  }

  /**
   * Render form content section
   */
  private renderFormContent(data: any): TemplateResult {
    return html`
      <form class="guard-organization-form">
        ${this.renderBasicInfoSection(data)} ${this.renderStatsSection(data)}
        ${this.renderInfoSection()}
      </form>
    `;
  }

  /**
   * Render basic information section
   */
  private renderBasicInfoSection(data: any): TemplateResult {
    return html`
      <div class="form-group">
        <label for="name">Nombre de la Organización *</label>
        <input
          type="text"
          name="name"
          id="name"
          value="${data.name}"
          placeholder="ej: Guardia de la Ciudad"
          required
        />
      </div>

      <div class="form-group">
        <label for="subtitle">Subtítulo</label>
        <input
          type="text"
          name="subtitle"
          id="subtitle"
          value="${data.subtitle}"
          placeholder="ej: Protectores del Reino"
        />
      </div>
    `;
  }

  /**
   * Render stats section
   */
  private renderStatsSection(data: any): TemplateResult {
    return html`
      <div class="stats-section">
        <h3>Estadísticas Base</h3>
        <div class="stats-grid">
          ${this.renderStatInput('robustismo', 'Robustismo', data)}
          ${this.renderStatInput('analitica', 'Analítica', data)}
          ${this.renderStatInput('subterfugio', 'Subterfugio', data)}
          ${this.renderStatInput('elocuencia', 'Elocuencia', data)}
        </div>
      </div>
    `;
  }

  /**
   * Render individual stat input
   */
  private renderStatInput(statName: string, label: string, data: any): TemplateResult {
    const value =
      data.baseStats?.[statName] !== undefined
        ? data.baseStats[statName]
        : (DEFAULT_GUARD_STATS as any)[statName];

    return html`
      <div class="stat-input">
        <label for="${statName}">${label}</label>
        <input
          type="number"
          name="${statName}"
          id="${statName}"
          value="${value}"
          min="-99"
          max="99"
          required
        />
      </div>
    `;
  }

  /**
   * Render information section
   */
  private renderInfoSection(): TemplateResult {
    return html`
      <div class="dialog-info">
        <p><small>* Campos requeridos</small></p>
        <p>
          <small
            >Las estadísticas pueden ser de -99 a 99 y modificadas más tarde mediante modificadores
            de organización.</small
          >
        </p>
      </div>
    `;
  }

  /**
   * Render form styles
   */
  private renderFormStyles(): TemplateResult {
    return html`
      <style>
        .guard-organization-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          font-weight: bold;
          color: #f0f0e0;
        }

        .form-group input {
          padding: 0.5rem;
          border: 1px solid #666;
          border-radius: 4px;
          background: rgba(0, 0, 0, 0.3);
          color: white;
        }

        .stats-section h3 {
          margin: 1rem 0 0.5rem 0;
          color: #f0f0e0;
          border-bottom: 2px solid #444;
          padding-bottom: 0.5rem;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .stat-input {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .stat-input label {
          font-size: 0.9rem;
          font-weight: bold;
          color: #d0d0c0;
        }

        .stat-input input {
          padding: 0.5rem;
          border: 1px solid #666;
          border-radius: 4px;
          background: rgba(0, 0, 0, 0.3);
          color: white;
          text-align: center;
          transition:
            border-color 0.3s ease,
            background-color 0.3s ease;
        }

        .stat-input input.error,
        .form-group input.error {
          border-color: #ff4444 !important;
          background-color: rgba(255, 68, 68, 0.1) !important;
          animation: shake 0.5s ease-in-out;
        }

        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-5px);
          }
          75% {
            transform: translateX(5px);
          }
        }

        .dialog-info {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #444;
        }

        .dialog-info p {
          margin: 0.25rem 0;
          color: #bbb;
        }
      </style>
    `;
  }

  /**
   * Extract form data and convert to typed object
   */
  private extractFormData(formData: FormData): GuardOrganizationDialogData {
    const robustismoValue = formData.get('robustismo') as string;
    const analiticaValue = formData.get('analitica') as string;
    const subterfugioValue = formData.get('subterfugio') as string;
    const elocuenciaValue = formData.get('elocuencia') as string;

    return {
      name: (formData.get('name') as string) || '',
      subtitle: (formData.get('subtitle') as string) || '',
      robustismo:
        robustismoValue !== null && robustismoValue !== ''
          ? parseInt(robustismoValue)
          : DEFAULT_GUARD_STATS.robustismo,
      analitica:
        analiticaValue !== null && analiticaValue !== ''
          ? parseInt(analiticaValue)
          : DEFAULT_GUARD_STATS.analitica,
      subterfugio:
        subterfugioValue !== null && subterfugioValue !== ''
          ? parseInt(subterfugioValue)
          : DEFAULT_GUARD_STATS.subterfugio,
      elocuencia:
        elocuenciaValue !== null && elocuenciaValue !== ''
          ? parseInt(elocuenciaValue)
          : DEFAULT_GUARD_STATS.elocuencia,
    };
  }

  /**
   * Validate the form data
   */
  public validateData(data: GuardOrganizationDialogData): boolean {
    return this.validateDataWithDetails(data).isValid;
  }

  /**
   * Validate the form data with detailed error information
   */
  public validateDataWithDetails(data: GuardOrganizationDialogData): {
    isValid: boolean;
    errorMessage: string;
    errorFields: string[];
  } {
    const errorFields: string[] = [];
    const errors: string[] = [];

    // Check required fields
    if (!data.name || data.name.trim().length === 0) {
      errorFields.push('name');
      errors.push('El nombre es requerido');
    }

    // Check stat ranges
    const statChecks = [
      { value: data.robustismo, name: 'robustismo', label: 'Robustismo' },
      { value: data.analitica, name: 'analitica', label: 'Analítica' },
      { value: data.subterfugio, name: 'subterfugio', label: 'Subterfugio' },
      { value: data.elocuencia, name: 'elocuencia', label: 'Elocuencia' },
    ];

    for (const stat of statChecks) {
      if (stat.value < -99 || stat.value > 99 || isNaN(stat.value)) {
        errorFields.push(stat.name);
        errors.push(`${stat.label} debe estar entre -99 y 99`);
      }
    }

    return {
      isValid: errors.length === 0,
      errorMessage: errors.length > 0 ? errors.join('. ') : '',
      errorFields,
    };
  }

  /**
   * Highlight error fields in the form
   */
  private highlightErrorFields(form: HTMLFormElement, errorFields: string[]): void {
    // Clear previous error highlights
    const allInputs = form.querySelectorAll('input');
    allInputs.forEach((input) => {
      input.classList.remove('error');
      input.style.borderColor = '';
    });

    // Highlight error fields
    errorFields.forEach((fieldName) => {
      const field = form.querySelector(`input[name="${fieldName}"]`) as HTMLInputElement;
      if (field) {
        field.classList.add('error');
        field.style.borderColor = '#ff4444';
        field.style.backgroundColor = 'rgba(255, 68, 68, 0.1)';
      }
    });
  }

  /**
   * Create a GuardOrganization object from dialog data
   */
  private createOrganizationFromData(
    data: GuardOrganizationDialogData,
    mode: 'create' | 'edit',
    existingOrganization?: GuardOrganization
  ): GuardOrganization {
    const baseStats: GuardStats = {
      robustismo: data.robustismo,
      analitica: data.analitica,
      subterfugio: data.subterfugio,
      elocuencia: data.elocuencia,
    };

    if (mode === 'edit' && existingOrganization) {
      return {
        ...existingOrganization,
        name: data.name.trim(),
        subtitle: data.subtitle.trim(),
        baseStats,
        version: existingOrganization.version + 1,
      };
    } else {
      return {
        id: foundry.utils.randomID(),
        name: data.name.trim(),
        subtitle: data.subtitle.trim(),
        version: 1,
        baseStats,
        activeModifiers: [],
        resources: [],
        reputation: [],
        patrols: [],
      };
    }
  }

  /**
   * Fallback method using standard Dialog when DialogV2 is not available
   */
  private async showWithStandardDialog(
    mode: 'create' | 'edit',
    existingOrganization?: GuardOrganization
  ): Promise<GuardOrganization | null> {
    const content = this.generateContent(mode, existingOrganization);
    const title =
      mode === 'create' ? 'Nueva Organización de Guardias' : 'Editar Organización de Guardias';

    return new Promise((resolve) => {
      const dialog = new Dialog({
        title,
        content,
        buttons: {
          save: {
            icon: 'fas fa-save',
            label: mode === 'create' ? 'Crear' : 'Guardar',
            callback: (html: JQuery) => {
              const formData = new FormData(html.find('form')[0] as HTMLFormElement);
              const data = this.extractFormData(formData);

              // Validar con detalles
              const validationResult = this.validateDataWithDetails(data);
              if (!validationResult.isValid) {
                ui?.notifications?.error(validationResult.errorMessage);

                // Resaltar campos con errores
                const form = html.find('form')[0] as HTMLFormElement;
                this.highlightErrorFields(form, validationResult.errorFields);

                // No cerrar el diálogo - crear uno nuevo
                setTimeout(() => {
                  this.showWithStandardDialog(mode, existingOrganization).then(resolve);
                }, 100);
                return;
              }

              const organization = this.createOrganizationFromData(
                data,
                mode,
                existingOrganization
              );
              resolve(organization);
            },
          },
          cancel: {
            icon: 'fas fa-times',
            label: 'Cancelar',
            callback: () => resolve(null),
          },
        },
        default: 'save',
      });

      dialog.render(true);
    });
  }
}
