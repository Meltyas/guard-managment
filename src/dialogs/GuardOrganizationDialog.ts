/**
 * Guard Organization Dialog - Create/Edit Guard Organizations using DialogV2
 */

import { html, TemplateResult } from 'lit-html';
import type { GuardOrganization, GuardStats } from '../types/entities';
import { DEFAULT_GUARD_STATS } from '../types/entities';
import { convertFoundryDocumentToResource } from '../utils/resource-converter.js';
import { renderTemplateToString } from '../utils/template-renderer.js';
import { AddOrEditResourceDialog } from './AddOrEditResourceDialog.js';

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

      // Configurar event listeners para los botones de recursos después de renderizar
      // setTimeout(() => this.setupResourceEventListeners(existingOrganization?.id), 100);

      // Setup additional listeners for drag & drop with retry mechanism
      // this.setupResourceEventListenersWithRetry(existingOrganization?.id, 5);

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
        ${this.renderResourcesSection(data)} ${this.renderInfoSection()}
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
   * Render resources management section
   */
  private renderResourcesSection(data: any): TemplateResult {
    const organizationId = data.id || 'temp-org-id';
    const resources = data.resources || [];

    return html`
      <div class="resources-info-section" data-organization-id="${organizationId}">
        <h4>Recursos de la Organización</h4>
        <div class="resources-list" data-organization-id="${organizationId}">
          ${resources.length > 0
            ? resources.map((resourceId: string) => this.renderResourceItem(resourceId))
            : html`<p class="empty-state">
                No hay recursos asignados a esta organización.
                <br />
                <small>Asigna recursos desde el diálogo de información o</small>
                <button
                  type="button"
                  class="add-resource-btn link-button"
                  data-organization-id="${organizationId}"
                >
                  Agregar el primer recurso
                </button>
              </p>`}
        </div>
        ${resources.length > 0
          ? html`
              <div class="resources-actions">
                <button
                  type="button"
                  class="add-resource-btn btn-small"
                  data-organization-id="${organizationId}"
                >
                  <i class="fas fa-plus"></i>
                  Agregar Recurso
                </button>
              </div>
            `
          : ''}
      </div>
    `;
  }

  /**
   * Render individual resource item
   */
  private renderResourceItem(resourceId: string): TemplateResult {
    // Get the actual resource data
    const gm = (window as any).GuardManagement;
    let resourceData = null;

    if (gm?.documentManager) {
      const resource = gm.documentManager.getGuardResources().find((r: any) => r.id === resourceId);
      if (resource) {
        // Use the unified conversion function
        resourceData = convertFoundryDocumentToResource(resource);
      }
    }

    return html`
      <div class="resource-item" data-resource-id="${resourceId}">
        <div class="resource-info">
          <span class="resource-name">${resourceData?.name || `Recurso ${resourceId}`}</span>
          <span class="resource-quantity">Cantidad: ${resourceData?.quantity || '--'}</span>
          ${resourceData?.description
            ? html`<span class="resource-description">${resourceData.description}</span>`
            : ''}
        </div>
        <div class="resource-actions">
          <button type="button" class="edit-resource-btn btn-icon" title="Editar recurso">
            <i class="fas fa-edit"></i>
          </button>
          <button type="button" class="remove-resource-btn btn-icon" title="Remover recurso">
            <i class="fas fa-trash"></i>
          </button>
        </div>
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

        /* Resources Section Styles */
        .resources-info-section {
          margin-top: 1rem;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid #444;
          border-radius: 4px;
        }

        .resources-info-section h4 {
          margin: 0 0 1rem 0;
          color: #f0f0e0;
          font-size: 1rem;
          font-weight: bold;
          border-bottom: 1px solid #555;
          padding-bottom: 0.5rem;
        }

        .resources-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .resource-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid #555;
          border-radius: 3px;
        }

        .resource-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .resource-name {
          font-weight: bold;
          color: #f0f0e0;
          font-size: 0.9rem;
        }

        .resource-quantity {
          font-size: 0.8rem;
          color: #bbb;
        }

        .resource-actions {
          display: flex;
          gap: 0.25rem;
        }

        .resources-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 0.5rem;
        }

        .btn-small {
          padding: 0.25rem 0.5rem;
          font-size: 0.8rem;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          transition: background-color 0.2s;
        }

        .btn-small:hover {
          background: #218838;
        }

        .link-button {
          background: none;
          border: none;
          color: #007bff;
          text-decoration: underline;
          cursor: pointer;
          font-size: 0.9rem;
          padding: 0;
          margin-left: 0.5rem;
        }

        .link-button:hover {
          color: #0056b3;
        }

        .btn-icon {
          padding: 0.25rem;
          background: transparent;
          border: 1px solid #666;
          border-radius: 3px;
          color: #bbb;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.8rem;
        }

        .btn-icon:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: #999;
          color: white;
        }

        .edit-resource-btn:hover {
          border-color: #007bff;
          color: #007bff;
        }

        .remove-resource-btn:hover {
          border-color: #dc3545;
          color: #dc3545;
        }

        .empty-state {
          text-align: center;
          color: #999;
          font-style: italic;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.2);
          border: 1px dashed #666;
          border-radius: 4px;
          margin: 0;
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
   * Setup resource event listeners with retry mechanism for DialogV2
   */
  private setupResourceEventListenersWithRetry(organizationId?: string, retries: number = 5): void {
    const attempt = () => {
      const dropZones = document.querySelectorAll('.drop-zone');
      const addResourceBtns = document.querySelectorAll('.add-resource-btn');

      if (dropZones.length > 0 || addResourceBtns.length > 0) {
        console.log(
          `Found ${dropZones.length} drop zones and ${addResourceBtns.length} add buttons, setting up listeners`
        );
        this.setupResourceEventListeners(organizationId);
      } else if (retries > 0) {
        console.log(`No drop zones found, retrying in 200ms (${retries} retries left)`);
        setTimeout(
          () => this.setupResourceEventListenersWithRetry(organizationId, retries - 1),
          200
        );
      } else {
        console.warn('Could not find drop zones after multiple retries');
      }
    };

    attempt();
  }

  /**
   * Setup event listeners for resource management buttons
   */
  private setupResourceEventListeners(organizationId?: string): void {
    try {
      console.log('Setting up resource event listeners for organization:', organizationId);

      // Find add resource button
      const addResourceBtn = document.querySelector('.add-resource-btn') as HTMLButtonElement;
      console.log('Add resource button found:', !!addResourceBtn);
      if (addResourceBtn) {
        addResourceBtn.addEventListener('click', async (event) => {
          event.preventDefault();
          await this.handleAddResource(organizationId || 'temp-org-id');
        });
      }

      // Find edit resource buttons
      const editResourceBtns = document.querySelectorAll(
        '.edit-resource-btn'
      ) as NodeListOf<HTMLButtonElement>;
      console.log('Edit resource buttons found:', editResourceBtns.length);
      editResourceBtns.forEach((btn) => {
        btn.addEventListener('click', async (event) => {
          event.preventDefault();
          const resourceItem = btn.closest('.resource-item') as HTMLElement;
          const resourceId = resourceItem?.dataset.resourceId;
          if (resourceId) {
            await this.handleEditResource(resourceId);
          }
        });
      });

      // Find remove resource buttons
      const removeResourceBtns = document.querySelectorAll(
        '.remove-resource-btn'
      ) as NodeListOf<HTMLButtonElement>;
      console.log('Remove resource buttons found:', removeResourceBtns.length);
      removeResourceBtns.forEach((btn) => {
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          const resourceItem = btn.closest('.resource-item') as HTMLElement;
          const resourceId = resourceItem?.dataset.resourceId;
          if (resourceId) {
            this.handleRemoveResource(resourceId);
          }
        });
      });

      // Setup drop zone event listeners
      const dropZones = document.querySelectorAll('.drop-zone');
      console.log('Drop zones found:', dropZones.length);
      dropZones.forEach((zone, index) => {
        console.log(`Setting up drop zone ${index}:`, zone);

        // Remove existing listeners first to avoid duplicates
        zone.removeEventListener('dragover', this.handleDragOver.bind(this));
        zone.removeEventListener('dragenter', this.handleDragEnter.bind(this));
        zone.removeEventListener('dragleave', this.handleDragLeave.bind(this));
        zone.removeEventListener('drop', this.handleDrop.bind(this));

        // Add new listeners
        zone.addEventListener('dragover', this.handleDragOver.bind(this));
        zone.addEventListener('dragenter', this.handleDragEnter.bind(this));
        zone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        zone.addEventListener('drop', this.handleDrop.bind(this));

        console.log(`Drop zone ${index} listeners set up successfully`);
      });

      console.log('Resource event listeners setup complete');
    } catch (error) {
      console.error('Error setting up resource event listeners:', error);
    }
  }

  /**
   * Handle drag over events for drop zones
   */
  private handleDragOver(event: Event): void {
    console.log('Drag over event triggered');
    const dragEvent = event as DragEvent;
    dragEvent.preventDefault();
    dragEvent.dataTransfer!.dropEffect = 'copy';
  }

  /**
   * Handle drag enter events for drop zones
   */
  private handleDragEnter(event: Event): void {
    console.log('Drag enter event triggered');
    const dragEvent = event as DragEvent;
    dragEvent.preventDefault();
    const target = dragEvent.target as HTMLElement;
    const dropZone = target.closest('.drop-zone');
    if (dropZone) {
      console.log('Adding drag-over class to drop zone');
      dropZone.classList.add('drag-over');
    }
  }

  /**
   * Handle drag leave events for drop zones
   */
  private handleDragLeave(event: Event): void {
    console.log('Drag leave event triggered');
    const dragEvent = event as DragEvent;
    const target = dragEvent.target as HTMLElement;
    const dropZone = target.closest('.drop-zone');
    const relatedTarget = dragEvent.relatedTarget as HTMLElement;

    // Only remove highlight if leaving the drop zone entirely
    if (dropZone && (!relatedTarget || !dropZone.contains(relatedTarget))) {
      console.log('Removing drag-over class from drop zone');
      dropZone.classList.remove('drag-over');
    }
  }

  /**
   * Handle drop events for drop zones
   */
  private async handleDrop(event: Event): Promise<void> {
    console.log('Drop event triggered!');
    const dragEvent = event as DragEvent;
    dragEvent.preventDefault();

    const target = dragEvent.target as HTMLElement;
    const dropZone = target.closest('.drop-zone') as HTMLElement;

    if (!dropZone) {
      console.log('No drop zone found');
      return;
    }

    console.log('Drop zone found:', dropZone);

    // Remove visual feedback
    dropZone.classList.remove('drag-over');

    try {
      const dragData = dragEvent.dataTransfer?.getData('text/plain');
      console.log('Drag data:', dragData);
      if (!dragData) {
        console.log('No drag data found');
        return;
      }

      const data = JSON.parse(dragData);
      console.log('Parsed drag data:', data);

      if (data.type !== 'guard-resource') {
        console.warn('Invalid drag data type:', data.type);
        return;
      }

      const organizationId = dropZone.dataset.organizationId;
      console.log('Organization ID from drop zone:', organizationId);
      if (!organizationId) {
        console.error('No organization ID found for drop zone');
        return;
      }

      console.log('Attempting to assign resource to organization...');
      await this.assignResourceToOrganization(organizationId, data.resourceData);
    } catch (error) {
      console.error('Error handling drop:', error);
      if (ui?.notifications) {
        ui.notifications.error('Error al asignar el recurso a la organización');
      }
    }
  }

  /**
   * Assign a resource to an organization
   */
  private async assignResourceToOrganization(
    organizationId: string,
    resourceData: any
  ): Promise<void> {
    try {
      const gm = (window as any).GuardManagement;
      if (!gm?.documentManager) {
        throw new Error('DocumentManager not available');
      }

      // Check if resource is already assigned to this organization
      const organization = gm.documentManager.getGuardOrganization(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      const existingResources = organization.system?.resources || [];
      if (existingResources.includes(resourceData.id)) {
        if (ui?.notifications) {
          ui.notifications.warn('Este recurso ya está asignado a la organización');
        }
        return;
      }

      // Add resource to organization
      await organization.system.addResource(resourceData.id);

      if (ui?.notifications) {
        ui.notifications.info(`Recurso "${resourceData.name}" asignado a la organización`);
      }

      // Emit event for UI updates
      window.dispatchEvent(
        new CustomEvent('guard-resource-assigned', {
          detail: {
            organizationId,
            resourceId: resourceData.id,
            resourceData,
          },
        })
      );

      // Refresh the resources list in the current dialog
      this.refreshResourcesList(organizationId);

      // Log success
      console.log('Resource assigned successfully:', resourceData.name);
    } catch (error) {
      console.error('Error assigning resource to organization:', error);
      throw error;
    }
  }

  /**
   * Refresh the resources list in the current dialog
   */
  private refreshResourcesList(organizationId: string): void {
    try {
      const resourcesList = document.querySelector('.resources-list');
      if (!resourcesList) return;

      const gm = (window as any).GuardManagement;
      if (!gm?.documentManager) return;

      const organization = gm.documentManager.getGuardOrganization(organizationId);
      if (!organization) return;

      const resources = organization.system?.resources || [];

      // Clear current content
      resourcesList.innerHTML = '';

      if (resources.length > 0) {
        // Add each resource
        resources.forEach((resourceId: string) => {
          const resourceElement = document.createElement('div');
          const resourceContent = this.renderResourceItem(resourceId);
          resourceElement.innerHTML = resourceContent.strings.join('');

          if (resourceElement.firstElementChild) {
            resourcesList.appendChild(resourceElement.firstElementChild);
          }
        });

        // Show add button if not present
        const resourcesActions = document.querySelector('.resources-actions');
        if (!resourcesActions) {
          const actionsElement = document.createElement('div');
          actionsElement.className = 'resources-actions';
          actionsElement.innerHTML = `
            <button type="button" class="add-resource-btn btn-small" data-organization-id="${organizationId}">
              <i class="fas fa-plus"></i>
              Agregar Recurso
            </button>
          `;
          resourcesList.parentElement?.appendChild(actionsElement);
        }
      } else {
        // Show empty state
        resourcesList.innerHTML = `
          <p class="empty-state">
            No hay recursos asignados a esta organización.
            <br>
            <small>Arrastra recursos desde el warehouse o</small>
            <button type="button" class="add-resource-btn link-button" data-organization-id="${organizationId}">
              Agregar el primer recurso
            </button>
          </p>
        `;
      }

      // Re-setup event listeners for the new content
      // this.setupResourceEventListeners(organizationId);
    } catch (error) {
      console.error('Error refreshing resources list:', error);
    }
  }

  /**
   * Handle adding a new resource to the organization
   */
  private async handleAddResource(organizationId: string): Promise<void> {
    try {
      const newResource = await AddOrEditResourceDialog.create(organizationId);

      if (newResource) {
        console.log('Nuevo recurso creado para organización:', newResource);

        if (ui?.notifications) {
          ui.notifications.info(`Recurso "${newResource.name}" agregado a la organización`);
        }

        // TODO: Update the organization's resources array and refresh UI
        // This would require managing the organization state
      }
    } catch (error) {
      console.error('Error agregando recurso:', error);
      if (ui?.notifications) {
        ui.notifications.error('Error al agregar el recurso');
      }
    }
  }

  /**
   * Handle editing an existing resource
   */
  private async handleEditResource(resourceId: string): Promise<void> {
    try {
      // TODO: Fetch the actual resource by ID
      // For now, create a mock resource
      const mockResource = {
        id: resourceId,
        name: `Recurso ${resourceId}`,
        description: 'Descripción del recurso',
        quantity: 1,
        organizationId: 'temp-org-id',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedResource = await AddOrEditResourceDialog.edit(mockResource);

      if (updatedResource) {
        console.log('Recurso actualizado:', updatedResource);

        if (ui?.notifications) {
          ui.notifications.info(`Recurso "${updatedResource.name}" actualizado`);
        }

        // TODO: Update the resource in storage and refresh UI
      }
    } catch (error) {
      console.error('Error editando recurso:', error);
      if (ui?.notifications) {
        ui.notifications.error('Error al editar el recurso');
      }
    }
  }

  /**
   * Handle removing a resource from the organization
   */
  private async handleRemoveResource(resourceId: string): Promise<void> {
    try {
      const gm = (window as any).GuardManagement;
      if (!gm?.documentManager) {
        throw new Error('DocumentManager not available');
      }

      // Get resource data for confirmation
      const resource = gm.documentManager.getGuardResources().find((r: any) => r.id === resourceId);
      const resourceName = resource?.name || `Recurso ${resourceId}`;

      // Show confirmation dialog
      const confirmed = await Dialog.confirm({
        title: 'Confirmar eliminación',
        content: `<p>¿Estás seguro de que quieres remover "${resourceName}" de esta organización?</p>
                  <p><small>El recurso seguirá disponible en el warehouse.</small></p>`,
      });

      if (!confirmed) return;

      // Find which organization this dialog belongs to
      const organizationElement = document.querySelector('[data-organization-id]') as HTMLElement;
      const organizationId = organizationElement?.dataset.organizationId;

      if (!organizationId) {
        throw new Error('No organization ID found');
      }

      // Get the organization and remove the resource
      const organization = gm.documentManager.getGuardOrganization(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      await organization.system.removeResource(resourceId);

      if (ui?.notifications) {
        ui.notifications.info(`Recurso "${resourceName}" removido de la organización`);
      }

      // Refresh the UI
      this.refreshResourcesList(organizationId);

      console.log('Resource removed from organization:', resourceName);
    } catch (error) {
      console.error('Error removiendo recurso:', error);
      if (ui?.notifications) {
        ui.notifications.error('Error al eliminar el recurso');
      }
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
