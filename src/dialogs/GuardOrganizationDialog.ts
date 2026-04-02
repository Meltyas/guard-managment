/**
 * Guard Organization Dialog - Create/Edit Guard Organizations using GuardModal
 */

import type { GuardOrganization, GuardStats } from '../types/entities';
import { DEFAULT_GUARD_STATS, GUARD_STAT_MAX, GUARD_STAT_MIN } from '../types/entities';
import { GuardModal } from '../ui/GuardModal.js';

export interface GuardOrganizationDialogData {
  name: string;
  subtitle: string;
  agility: number;
  strength: number;
  finesse: number;
  instinct: number;
  presence: number;
  knowledge: number;
}

// New internal type for rendering instead of using any
interface GuardOrganizationFormRenderData {
  name: string;
  subtitle: string;
  baseStats: GuardStats;
  minStat: number;
  maxStat: number;
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
    const content = await this.generateContent(mode, existingOrganization);
    const title =
      mode === 'create' ? 'Nueva Organización de Guardias' : 'Editar Organización de Guardias';

    try {
      const data = await GuardModal.openAsync<GuardOrganizationDialogData>({
        title,
        icon: 'fas fa-shield-alt',
        body: content,
        saveLabel: mode === 'create' ? 'Crear' : 'Guardar',
        onSave: async (bodyEl) => {
          const form = bodyEl.querySelector('form.guard-modal-form') as HTMLFormElement;
          if (!form) {
            ui?.notifications?.error('No se pudo encontrar el formulario');
            return false;
          }

          const formData = new FormData(form);
          const data = this.extractFormData(formData);

          const validationResult = this.validateDataWithDetails(data);
          if (!validationResult.isValid) {
            this.highlightErrorFields(form, validationResult.errorFields);
            ui?.notifications?.error(validationResult.errorMessage);
            return false;
          }

          return data;
        },
      });

      if (!data) return null;
      return this.createOrganizationFromData(data, mode, existingOrganization);
    } catch (error) {
      console.error('GuardOrganizationDialog | Error showing dialog:', error);
      ui?.notifications?.error('Error al mostrar el diálogo de organización');
      return null;
    }
  }

  /**
   * Generate the HTML content for the dialog
   */
  public async generateContent(
    _mode: 'create' | 'edit',
    organization?: GuardOrganization
  ): Promise<string> {
    const data: GuardOrganizationFormRenderData = organization
      ? {
          name: organization.name ?? '',
          subtitle: organization.subtitle ?? '',
          baseStats: { ...organization.baseStats },
          minStat: GUARD_STAT_MIN,
          maxStat: GUARD_STAT_MAX,
        }
      : {
          name: '',
          subtitle: '',
          baseStats: { ...DEFAULT_GUARD_STATS },
          minStat: GUARD_STAT_MIN,
          maxStat: GUARD_STAT_MAX,
        };

    return foundry.applications.handlebars.renderTemplate(
      'modules/guard-management/templates/dialogs/guard-organization.hbs',
      data
    );
  }

  /**
   * Extract form data and convert to typed object
   */
  private extractFormData(formData: FormData): GuardOrganizationDialogData {
    const agilityValue = formData.get('agility') as string;
    const strengthValue = formData.get('strength') as string;
    const finesseValue = formData.get('finesse') as string;
    const instinctValue = formData.get('instinct') as string;
    const presenceValue = formData.get('presence') as string;
    const knowledgeValue = formData.get('knowledge') as string;

    return {
      name: (formData.get('name') as string) || '',
      subtitle: (formData.get('subtitle') as string) || '',
      agility:
        agilityValue !== null && agilityValue !== ''
          ? parseInt(agilityValue)
          : DEFAULT_GUARD_STATS.agility,
      strength:
        strengthValue !== null && strengthValue !== ''
          ? parseInt(strengthValue)
          : DEFAULT_GUARD_STATS.strength,
      finesse:
        finesseValue !== null && finesseValue !== ''
          ? parseInt(finesseValue)
          : DEFAULT_GUARD_STATS.finesse,
      instinct:
        instinctValue !== null && instinctValue !== ''
          ? parseInt(instinctValue)
          : DEFAULT_GUARD_STATS.instinct,
      presence:
        presenceValue !== null && presenceValue !== ''
          ? parseInt(presenceValue)
          : DEFAULT_GUARD_STATS.presence,
      knowledge:
        knowledgeValue !== null && knowledgeValue !== ''
          ? parseInt(knowledgeValue)
          : DEFAULT_GUARD_STATS.knowledge,
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

    if (!data.name || data.name.trim().length === 0) {
      errorFields.push('name');
      errors.push('El nombre es requerido');
    }

    const statChecks = [
      { value: data.agility, name: 'agility', label: 'Agilidad' },
      { value: data.strength, name: 'strength', label: 'Fuerza' },
      { value: data.finesse, name: 'finesse', label: 'Destreza' },
      { value: data.instinct, name: 'instinct', label: 'Instinto' },
      { value: data.presence, name: 'presence', label: 'Presencia' },
      { value: data.knowledge, name: 'knowledge', label: 'Conocimiento' },
    ];

    for (const stat of statChecks) {
      if (stat.value < GUARD_STAT_MIN || stat.value > GUARD_STAT_MAX || isNaN(stat.value)) {
        errorFields.push(stat.name);
        errors.push(`${stat.label} debe estar entre ${GUARD_STAT_MIN} y ${GUARD_STAT_MAX}`);
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
    const allInputs = form.querySelectorAll('input');
    allInputs.forEach((input) => {
      input.classList.remove('error');
      input.style.borderColor = '';
    });

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
      agility: data.agility,
      strength: data.strength,
      finesse: data.finesse,
      instinct: data.instinct,
      presence: data.presence,
      knowledge: data.knowledge,
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
}
