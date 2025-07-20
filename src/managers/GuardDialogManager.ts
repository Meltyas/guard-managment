/**
 * Guard Dialog Manager - Coordinates all guard-related dialogs
 */

import type { GuardOrganization } from '../types/entities';
import { CustomInfoDialog } from '../ui/CustomInfoDialog';
import { GuardOrganizationManager } from './GuardOrganizationManager';

export class GuardDialogManager {
  public guardOrganizationManager: GuardOrganizationManager;
  private customInfoDialog: CustomInfoDialog | null = null;

  constructor(guardOrganizationManager: GuardOrganizationManager) {
    this.guardOrganizationManager = guardOrganizationManager;
  }

  /**
   * Initialize the dialog manager
   */
  public async initialize(): Promise<void> {
    console.log('GuardDialogManager | Initialized');
  }

  /**
   * Show dialog to edit the organization (no create, solo edit)
   */
  public async showEditOrganizationDialog(): Promise<GuardOrganization | null> {
    try {
      const result = await this.guardOrganizationManager.showEditDialog();
      if (result) {
        ui?.notifications?.info(`Organización "${result.name}" actualizada exitosamente`);

        // Trigger update event for floating panel
        this.triggerOrganizationUpdate();
      }
      return result;
    } catch (error) {
      console.error('GuardDialogManager | Error editing organization:', error);
      ui?.notifications?.error('Error al editar la organización');
      return null;
    }
  }

  /**
   * Show the organization management dialog (mostrar información de la organización)
   */
  public async showManageOrganizationsDialog(): Promise<void> {
    const organization = this.guardOrganizationManager.getOrganization();

    if (!organization) {
      ui?.notifications?.warn('No hay organización para gestionar');
      return;
    }

    // Mostrar diálogo de información con botón para editar
    await this.showOrganizationInfoDialog(organization);
  }

  /**
   * Mostrar diálogo de información de la organización (Custom HTML Dialog)
   */
  private async showOrganizationInfoDialog(organization: GuardOrganization): Promise<void> {
    try {
      // Cerrar diálogo anterior si existe
      if (this.customInfoDialog && this.customInfoDialog.isOpen()) {
        this.customInfoDialog.close();
      }

      // Crear nuevo diálogo personalizado
      this.customInfoDialog = new CustomInfoDialog();

      const title = `Información: ${organization.name}`;
      const content = CustomInfoDialog.generateOrganizationInfoContent(organization);

      // Mostrar el diálogo con callbacks
      this.customInfoDialog.show(title, content, {
        width: 600,
        height: 500,
        onEdit: async () => {
          // Abrir diálogo de edición
          const updatedOrg = await this.showEditOrganizationDialog();
          if (updatedOrg && this.customInfoDialog) {
            // Actualizar el contenido del diálogo personalizado
            const newTitle = `Información: ${updatedOrg.name}`;
            const newContent = CustomInfoDialog.generateOrganizationInfoContent(updatedOrg);
            this.customInfoDialog.updateTitle(newTitle);
            this.customInfoDialog.updateContent(newContent);
            ui?.notifications?.info('Información actualizada');
          }
        },
        onClose: () => {
          this.customInfoDialog = null;
        },
      });
    } catch (error) {
      console.error('GuardDialogManager | Error showing organization info:', error);
      ui?.notifications?.error('Error al mostrar la información de la organización');
    }
  }

  /**
   * Trigger update event for floating panel
   */
  private triggerOrganizationUpdate(): void {
    // Dispatch custom event for floating panel to update
    window.dispatchEvent(new CustomEvent('guard-organizations-updated'));
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    // Cerrar diálogo personalizado si está abierto
    if (this.customInfoDialog && this.customInfoDialog.isOpen()) {
      this.customInfoDialog.close();
    }
    console.log('GuardDialogManager | Cleaned up');
  }
}
