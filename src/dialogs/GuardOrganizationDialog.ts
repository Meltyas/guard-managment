/**
 * Guard Organization Dialog - Create/Edit Guard Organizations using DialogV2
 */

import { html, TemplateResult } from 'lit-html';
import type { GuardOrganization, GuardStats } from '../types/entities';
import { DEFAULT_GUARD_STATS } from '../types/entities';
import { DOMEventSetup } from '../utils/DOMEventSetup.js';
import {
  ReputationEventHandler,
  type ReputationEventContext,
} from '../utils/ReputationEventHandler.js';
import { convertFoundryDocumentToResource } from '../utils/resource-converter.js';
import { ResourceEventHandler, type ResourceEventContext } from '../utils/ResourceEventHandler.js';
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

      // Setup resource event listeners using the centralized handler
      DOMEventSetup.setupOrRetry(
        ['.add-resource-btn', '.edit-resource-btn', '.remove-resource-btn', '.drop-zone'],
        () => this.setupResourceEventListeners(existingOrganization?.id),
        3
      );

      // Setup reputation event listeners using the centralized handler
      DOMEventSetup.setupOrRetry(
        [
          '.add-reputation-btn',
          '.edit-reputation-btn',
          '.remove-reputation-btn',
          '.delete-reputation-btn',
          '.send-to-chat-btn',
          '.drop-zone',
        ],
        () => this.setupReputationEventListeners(existingOrganization?.id),
        3
      );

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
        ${this.renderResourcesSection(data)} ${this.renderReputationsSection(data)}
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
   * Render reputations management section
   */
  private renderReputationsSection(data: any): TemplateResult {
    const organizationId = data.id || 'temp-org-id';
    const reputations = data.reputation || [];

    return html`
      <div class="reputations-info-section" data-organization-id="${organizationId}">
        <h4>Reputaciones de la Organización</h4>
        <div class="reputations-list" data-organization-id="${organizationId}">
          ${reputations.length > 0
            ? reputations.map((reputationId: string) => this.renderReputationItem(reputationId))
            : html`<p class="empty-state">
                No hay reputaciones asignadas a esta organización.
                <br />
                <small>Asigna reputaciones desde el diálogo de información o</small>
                <button
                  type="button"
                  class="add-reputation-btn link-button"
                  data-organization-id="${organizationId}"
                >
                  Agregar la primera reputación
                </button>
              </p>`}
        </div>
        ${reputations.length > 0
          ? html`
              <div class="reputations-actions">
                <button
                  type="button"
                  class="add-reputation-btn btn-small"
                  data-organization-id="${organizationId}"
                >
                  <i class="fas fa-plus"></i>
                  Agregar Reputación
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
   * Render a reputation item
   */
  private renderReputationItem(reputationId: string): TemplateResult {
    // Get the actual reputation data
    const gm = (window as any).GuardManagement;
    let reputationData = null;

    if (gm?.documentManager) {
      const reputation = gm.documentManager
        .getGuardReputations()
        ?.find((r: any) => r.id === reputationId);
      if (reputation) {
        reputationData = reputation;
      }
    }

    if (!reputationData) {
      return html`
        <div class="reputation-item error" data-reputation-id="${reputationId}">
          <div class="reputation-info">
            <span class="reputation-name">Reputación no encontrada</span>
            <span class="reputation-level">ID: ${reputationId}</span>
          </div>
          <div class="reputation-actions">
            <button type="button" class="remove-reputation-btn btn-icon" title="Remover reputación">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }

    // Render reputation item directly with basic template
    const { REPUTATION_LABELS } = require('../types/entities.js');
    const levelLabel = REPUTATION_LABELS[reputationData.level] || `Level ${reputationData.level}`;

    return html`
      <div class="reputation-item" data-reputation-id="${reputationId}" draggable="true">
        ${reputationData.image
          ? html`
              <div class="reputation-image">
                <img
                  src="${reputationData.image}"
                  alt="${reputationData.name}"
                  onerror="this.style.display='none'"
                />
              </div>
            `
          : ''}
        <div class="reputation-info">
          <span class="reputation-name">${reputationData.name}</span>
          <span class="reputation-level">Nivel: ${levelLabel}</span>
          ${reputationData.description
            ? html`<span class="reputation-description">${reputationData.description.trim()}</span>`
            : ''}
        </div>
        <div class="reputation-actions">
          <button
            type="button"
            class="send-to-chat-btn btn-icon"
            title="Enviar al chat"
            data-reputation-id="${reputationId}"
          >
            <i class="fas fa-comment"></i>
          </button>
          <button
            type="button"
            class="edit-reputation-btn btn-icon"
            title="Editar reputación"
            data-reputation-id="${reputationId}"
          >
            <i class="fas fa-edit"></i>
          </button>
          <button
            type="button"
            class="remove-reputation-btn btn-icon"
            title="Remover reputación"
            data-reputation-id="${reputationId}"
          >
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

        /* Reputations Section Styles */
        .reputations-info-section {
          margin-top: 1rem;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid #444;
          border-radius: 4px;
        }

        .reputations-info-section h4 {
          margin: 0 0 1rem 0;
          color: #f0f0e0;
          font-size: 1rem;
          font-weight: bold;
          border-bottom: 1px solid #555;
          padding-bottom: 0.5rem;
        }

        .reputations-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .reputation-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid #555;
          border-radius: 3px;
          cursor: grab;
        }

        .reputation-item:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: #777;
        }

        .reputation-item.dragging {
          opacity: 0.5;
          cursor: grabbing;
        }

        .reputation-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .reputation-name {
          font-weight: bold;
          color: #f0f0e0;
          font-size: 0.9rem;
        }

        .reputation-level {
          font-size: 0.8rem;
          color: #bbb;
        }

        .reputation-description {
          font-size: 0.75rem;
          color: #999;
          font-style: italic;
        }

        .reputation-actions {
          display: flex;
          gap: 0.25rem;
        }

        .reputations-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 0.5rem;
        }

        .edit-reputation-btn:hover {
          border-color: #007bff;
          color: #007bff;
        }

        .remove-reputation-btn:hover,
        .delete-reputation-btn:hover {
          border-color: #dc3545;
          color: #dc3545;
        }

        .send-to-chat-btn:hover {
          border-color: #28a745;
          color: #28a745;
        }

        /* Drop zone styles */
        .drop-zone {
          border: 2px dashed #666;
          border-radius: 4px;
          padding: 1rem;
          margin: 0.5rem 0;
          text-align: center;
          color: #999;
          transition: all 0.3s ease;
        }

        .drop-zone.drag-over {
          border-color: #007bff;
          background: rgba(0, 123, 255, 0.1);
          color: #007bff;
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
   * Setup event listeners for resource management using centralized handler
   */
  private setupResourceEventListeners(organizationId?: string): void {
    // Clean up any existing handlers first
    ResourceEventHandler.cleanup();

    const context: ResourceEventContext = {
      organizationId: organizationId || 'temp-org-id',
      onResourceAdded: (resource) => {
        console.log('Resource added to organization:', resource);
        this.refreshResourcesList(organizationId || 'temp-org-id');
      },
      onResourceEdited: (resource) => {
        console.log('Resource edited:', resource);
        this.refreshResourcesList(organizationId || 'temp-org-id');
      },
      onResourceRemoved: (resourceId) => {
        console.log('Resource removed:', resourceId);
        this.refreshResourcesList(organizationId || 'temp-org-id');
      },
      refreshUI: () => {
        this.refreshResourcesList(organizationId || 'temp-org-id');
      },
    };

    ResourceEventHandler.setup(context);
  }

  /**
   * Setup event listeners for reputation management using centralized handler
   */
  private setupReputationEventListeners(organizationId?: string): void {
    console.log('🔧 Setting up reputation event listeners for organization:', organizationId);

    // Clean up any existing handlers first
    ReputationEventHandler.cleanup();

    const context: ReputationEventContext = {
      organizationId: organizationId || 'temp-org-id',
      onReputationAdded: (reputation) => {
        console.log('Reputation added to organization:', reputation);
        this.refreshReputationsList(organizationId || 'temp-org-id');
      },
      onReputationEdited: (reputation) => {
        console.log('Reputation edited:', reputation);
        this.refreshReputationsList(organizationId || 'temp-org-id');
      },
      onReputationRemoved: (reputationId) => {
        console.log('Reputation removed:', reputationId);
        this.refreshReputationsList(organizationId || 'temp-org-id');
      },
      refreshUI: () => {
        this.refreshReputationsList(organizationId || 'temp-org-id');
      },
    };

    ReputationEventHandler.setup(context);
    console.log('✅ Reputation event listeners setup completed');
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

      // Setup event listeners for the new content using centralized handler
      // Clean up any existing handlers first
      ResourceEventHandler.cleanup();

      const context: ResourceEventContext = {
        organizationId,
        refreshUI: () => this.refreshResourcesList(organizationId),
      };
      ResourceEventHandler.setup(context);
    } catch (error) {
      console.error('Error refreshing resources list:', error);
    }
  }

  /**
   * Refresh the reputations list in the current dialog
   */
  private refreshReputationsList(organizationId: string): void {
    try {
      const reputationsList = document.querySelector('.reputations-list');
      if (!reputationsList) return;

      const gm = (window as any).GuardManagement;
      if (!gm?.documentManager) return;

      const organization = gm.documentManager.getGuardOrganization(organizationId);
      if (!organization) return;

      const reputations = organization.system?.reputation || [];

      // Clear current content
      reputationsList.innerHTML = '';

      if (reputations.length > 0) {
        // Add each reputation
        reputations.forEach((reputationId: string) => {
          const reputationElement = document.createElement('div');
          const reputationContent = this.renderReputationItem(reputationId);
          reputationElement.innerHTML = reputationContent.strings.join('');

          if (reputationElement.firstElementChild) {
            reputationsList.appendChild(reputationElement.firstElementChild);
          }
        });

        // Show add button if not present
        const reputationsActions = document.querySelector('.reputations-actions');
        if (!reputationsActions) {
          const actionsElement = document.createElement('div');
          actionsElement.className = 'reputations-actions';
          actionsElement.innerHTML = `
            <button type="button" class="add-reputation-btn btn-small" data-organization-id="${organizationId}">
              <i class="fas fa-plus"></i>
              Agregar Reputación
            </button>
          `;
          reputationsList.parentElement?.appendChild(actionsElement);
        }
      } else {
        // Show empty state
        reputationsList.innerHTML = `
          <p class="empty-state">
            No hay reputaciones asignadas a esta organización.
            <br>
            <small>Arrastra reputaciones desde el warehouse o</small>
            <button type="button" class="add-reputation-btn link-button" data-organization-id="${organizationId}">
              Agregar la primera reputación
            </button>
          </p>
        `;
      }

      // Setup event listeners for the new content using centralized handler
      // Clean up any existing handlers first
      ReputationEventHandler.cleanup();

      const context: ReputationEventContext = {
        organizationId,
        refreshUI: () => this.refreshReputationsList(organizationId),
      };
      ReputationEventHandler.setup(context);
    } catch (error) {
      console.error('Error refreshing reputations list:', error);
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
