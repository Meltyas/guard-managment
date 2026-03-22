/**
 * Dialog for adding or editing reputation entries using GuardModal
 */

import { Reputation, REPUTATION_LABELS, ReputationLevel } from '../types/entities.js';
import { GuardModal } from '../ui/GuardModal.js';

interface ReputationDialogData {
  name: string;
  description: string;
  level: ReputationLevel;
  image: string;
  organizationId: string;
}

export class AddOrEditReputationDialog {
  /**
   * Show the dialog in create or edit mode
   */
  public async show(
    mode: 'create' | 'edit',
    organizationId: string,
    existingReputation?: Reputation
  ): Promise<Reputation | null> {
    const content = await this.generateContent(mode, organizationId, existingReputation);
    const title = mode === 'create' ? 'Nueva Reputación' : 'Editar Reputación';

    try {
      return await GuardModal.openAsync<Reputation>({
        title,
        icon: 'fas fa-star',
        body: content,
        saveLabel: mode === 'create' ? 'Crear' : 'Guardar',
        onRender: (bodyEl) => {
          const filePickerBtn = bodyEl.querySelector('.file-picker-btn[data-target="reputation-image"]');
          const imageInput = bodyEl.querySelector('#reputation-image') as HTMLInputElement;

          if (filePickerBtn && imageInput) {
            filePickerBtn.addEventListener('click', (ev: Event) => {
              ev.preventDefault();
              const fp = new FilePicker({
                type: 'image',
                current: imageInput.value || '',
                callback: (path: string) => {
                  imageInput.value = path;
                },
              });
              fp.browse();
            });
          }
        },
        onSave: async (bodyEl) => {
          const form = bodyEl.querySelector('form.guard-modal-form') as HTMLFormElement;
          if (!form) {
            ui?.notifications?.error('No se pudo encontrar el formulario');
            return false;
          }

          const formData = new FormData(form);
          const data: ReputationDialogData = {
            name: formData.get('name') as string,
            description: formData.get('description') as string,
            level:
              (parseInt(formData.get('level') as string) as ReputationLevel) ||
              ReputationLevel.Neutrales,
            image: formData.get('image') as string,
            organizationId: formData.get('organizationId') as string,
          };

          if (!data.name?.trim()) {
            ui?.notifications?.error('El nombre es obligatorio');
            return false;
          }
          if (!data.organizationId?.trim()) {
            ui?.notifications?.error('ID de organización es obligatorio');
            return false;
          }
          if (!Object.values(ReputationLevel).includes(data.level)) {
            ui?.notifications?.error('Nivel de reputación inválido');
            return false;
          }

          const gm = (window as any).GuardManagement;
          if (!gm?.reputationManager) {
            ui?.notifications?.error('Sistema no disponible para guardar reputaciones');
            return false;
          }

          const reputationData: Partial<Reputation> = {
            id: existingReputation?.id,
            name: data.name.trim(),
            description: data.description?.trim() || '',
            level: data.level,
            image: data.image?.trim() || '',
            organizationId: data.organizationId,
            version: existingReputation ? existingReputation.version + 1 : 1,
          };

          if (mode === 'create') {
            const newReputation = await gm.reputationManager.createReputation(reputationData);
            return {
              id: newReputation.id,
              name: data.name.trim(),
              description: data.description?.trim() || '',
              level: data.level,
              image: data.image?.trim() || '',
              organizationId: data.organizationId,
              version: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as Reputation;
          } else {
            const updateSuccess = await gm.reputationManager.updateReputation(
              existingReputation!.id,
              reputationData
            );
            if (!updateSuccess) {
              ui?.notifications?.error('Error al actualizar la reputación');
              return false;
            }
            return {
              id: existingReputation!.id,
              name: data.name.trim(),
              description: data.description?.trim() || '',
              level: data.level,
              image: data.image?.trim() || '',
              organizationId: data.organizationId,
              version: existingReputation!.version + 1,
              createdAt: existingReputation!.createdAt || new Date(),
              updatedAt: new Date(),
            } as Reputation;
          }
        },
      });
    } catch (error) {
      console.error('Error mostrando el diálogo de reputación:', error);
      ui?.notifications?.error('Error al mostrar el diálogo');
      return null;
    }
  }

  /**
   * Generate the HTML content for the dialog
   */
  private async generateContent(
    _mode: 'create' | 'edit',
    organizationId: string,
    existingReputation?: Reputation
  ): Promise<string> {
    const defaultLevel = existingReputation?.level ?? ReputationLevel.Neutrales;
    const reputationLevels = Object.entries(REPUTATION_LABELS).map(([value, label]) => ({
      value,
      label,
      selected: parseInt(value) === defaultLevel,
    }));

    const data = {
      name: existingReputation?.name || '',
      description: existingReputation?.description || '',
      image: existingReputation?.image || '',
      organizationId,
      reputationLevels,
    };

    return foundry.applications.handlebars.renderTemplate(
      'modules/guard-management/templates/dialogs/add-edit-reputation.hbs',
      data
    );
  }

  public static async create(organizationId: string): Promise<Reputation | null> {
    const dialog = new AddOrEditReputationDialog();
    return await dialog.show('create', organizationId);
  }

  public static async edit(reputation: Reputation): Promise<Reputation | null> {
    const dialog = new AddOrEditReputationDialog();
    return await dialog.show('edit', reputation.organizationId, reputation);
  }

  public static async showCreateDialog(organizationId: string): Promise<void> {
    try {
      const result = await AddOrEditReputationDialog.create(organizationId);
      if (result) {
        window.dispatchEvent(new CustomEvent('guard-organizations-updated'));
      }
    } catch (error) {
      console.error('Error in showCreateDialog:', error);
      ui.notifications?.error('Error creating reputation');
    }
  }

  public static async showEditDialog(reputationId: string): Promise<void> {
    try {
      const gm = (window as any).GuardManagement;
      if (!gm?.reputationManager) {
        throw new Error('ReputationManager not available');
      }

      const reputations = gm.reputationManager.getAllReputations() || [];
      const reputation = reputations.find((r: any) => r.id === reputationId);

      if (!reputation) {
        throw new Error(`Reputation with ID ${reputationId} not found`);
      }

      const reputationData: Reputation = {
        id: reputation.id,
        name: reputation.name,
        description: reputation.description || '',
        level: reputation.level ?? ReputationLevel.Neutrales,
        image: reputation.image || '',
        organizationId: reputation.organizationId || '',
        version: reputation.version ?? 1,
        createdAt: reputation.createdAt ? new Date(reputation.createdAt) : new Date(),
        updatedAt: reputation.updatedAt ? new Date(reputation.updatedAt) : new Date(),
      };

      const result = await AddOrEditReputationDialog.edit(reputationData);
      if (result) {
        window.dispatchEvent(new CustomEvent('guard-organizations-updated'));
      }
    } catch (error) {
      console.error('Error in showEditDialog:', error);
      ui.notifications?.error('Error editing reputation');
    }
  }
}
