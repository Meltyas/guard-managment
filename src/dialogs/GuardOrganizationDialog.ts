/**
 * Guard Organization Dialog - Create/Edit Guard Organizations using DialogV2
 */

import type { GuardOrganization, GuardStats } from '../types/entities';
import { DEFAULT_GUARD_STATS } from '../types/entities';

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
            callback: (_event: Event, _button: any, dialog: any) => {
              const formData = new FormData(dialog.form);
              const data = this.extractFormData(formData);

              // Validar datos
              if (!this.validateData(data)) {
                ui?.notifications?.error(
                  'Por favor, completa todos los campos requeridos correctamente'
                );
                return false;
              }

              return data;
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

    return `
      <form class="guard-organization-form">
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

        <div class="stats-section">
          <h3>Estadísticas Base</h3>
          <div class="stats-grid">
            <div class="stat-input">
              <label for="robustismo">Robustismo</label>
              <input
                type="number"
                name="robustismo"
                id="robustismo"
                value="${data.baseStats?.robustismo || DEFAULT_GUARD_STATS.robustismo}"
                min="1"
                max="20"
                required
              />
            </div>

            <div class="stat-input">
              <label for="analitica">Analítica</label>
              <input
                type="number"
                name="analitica"
                id="analitica"
                value="${data.baseStats?.analitica || DEFAULT_GUARD_STATS.analitica}"
                min="1"
                max="20"
                required
              />
            </div>

            <div class="stat-input">
              <label for="subterfugio">Subterfugio</label>
              <input
                type="number"
                name="subterfugio"
                id="subterfugio"
                value="${data.baseStats?.subterfugio || DEFAULT_GUARD_STATS.subterfugio}"
                min="1"
                max="20"
                required
              />
            </div>

            <div class="stat-input">
              <label for="elocuencia">Elocuencia</label>
              <input
                type="number"
                name="elocuencia"
                id="elocuencia"
                value="${data.baseStats?.elocuencia || DEFAULT_GUARD_STATS.elocuencia}"
                min="1"
                max="20"
                required
              />
            </div>
          </div>
        </div>

        <div class="dialog-info">
          <p><small>* Campos requeridos</small></p>
          <p><small>Las estadísticas pueden ser modificadas más tarde mediante modificadores de organización.</small></p>
        </div>
      </form>

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
          transition: border-color 0.3s ease, background-color 0.3s ease;
        }

        .stat-input input.error,
        .form-group input.error {
          border-color: #ff4444 !important;
          background-color: rgba(255, 68, 68, 0.1) !important;
          animation: shake 0.5s ease-in-out;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
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
    return {
      name: (formData.get('name') as string) || '',
      subtitle: (formData.get('subtitle') as string) || '',
      robustismo: parseInt(formData.get('robustismo') as string) || DEFAULT_GUARD_STATS.robustismo,
      analitica: parseInt(formData.get('analitica') as string) || DEFAULT_GUARD_STATS.analitica,
      subterfugio:
        parseInt(formData.get('subterfugio') as string) || DEFAULT_GUARD_STATS.subterfugio,
      elocuencia: parseInt(formData.get('elocuencia') as string) || DEFAULT_GUARD_STATS.elocuencia,
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
      if (stat.value < 1 || stat.value > 20 || isNaN(stat.value)) {
        errorFields.push(stat.name);
        errors.push(`${stat.label} debe estar entre 1 y 20`);
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
        updatedAt: new Date(),
        version: existingOrganization.version + 1,
      };
    } else {
      return {
        id: foundry.utils.randomID(),
        name: data.name.trim(),
        subtitle: data.subtitle.trim(),
        createdAt: new Date(),
        updatedAt: new Date(),
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
