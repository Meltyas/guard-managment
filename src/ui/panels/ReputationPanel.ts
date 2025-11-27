import type { GuardOrganization } from '../../types/entities';
import { ReputationTemplate } from '../ReputationTemplate.js';
import { NotificationService } from '../../utils/services/NotificationService.js';
import { ConfirmService } from '../../utils/services/ConfirmService.js';
import { AddOrEditReputationDialog } from '../../dialogs/AddOrEditReputationDialog.js';
import { REPUTATION_LABELS, ReputationLevel } from '../../types/entities.js';

export class ReputationPanel {
  static get template() {
    return 'modules/guard-management/templates/panels/reputation.hbs';
  }

  static async getData(organization: GuardOrganization) {
      const gm = (window as any).GuardManagement;
      const reputation = [];
      if (organization.reputation && organization.reputation.length > 0) {
          const allReputation = gm.documentManager.getGuardReputations();
          for (const id of organization.reputation) {
              const r = allReputation.find((res: any) => res.id === id);
              if (r) {
                  const system = r.system || {};
                  const level = system.level || ReputationLevel.Neutrales;
                  
                  let statusClass = 'neutral';
                  if (level <= 2) statusClass = 'negative';
                  else if (level >= 5) statusClass = 'positive';

                  const rep = { 
                      id: r.id, 
                      name: r.name,
                      description: system.description || '',
                      value: REPUTATION_LABELS[level as ReputationLevel] || 'Desconocido',
                      statusClass: statusClass,
                      level: level
                  };
                  reputation.push(rep);
              }
          }
      }
      
      // Sort by level descending
      reputation.sort((a, b) => b.level - a.level);

      return {
          organizationId: organization.id,
          reputation
      };
  }

  static async render(container: HTMLElement, organization: GuardOrganization) {
      const data = await this.getData(organization);
      const htmlContent = await renderTemplate(this.template, data);
      container.innerHTML = htmlContent;
  }

  /**
   * Handle adding a new reputation entry
   */
  public static async handleAddReputation(
    organizationId: string,
    refreshCallback: () => Promise<void>
  ): Promise<void> {
    console.log('➕ Add reputation request for organization:', organizationId);

    try {
      await AddOrEditReputationDialog.showCreateDialog(organizationId);

      console.log('✅ Add reputation dialog closed, waiting for automatic assignment...');

      // Wait a short time for the automatic reputation assignment to complete
      setTimeout(async () => {
        console.log('🔄 Refreshing content after reputation creation...');
        await refreshCallback();
      }, 200);
    } catch (error) {
      console.error('❌ Error showing add reputation dialog:', error);
      NotificationService.error('Error al abrir el diálogo de reputación');
    }
  }

  /**
   * Handle editing a reputation entry
   */
  public static async handleEditReputation(
    reputationId: string,
    refreshCallback: () => Promise<void>
  ): Promise<void> {
    console.log('✏️ Edit reputation request:', reputationId);

    try {
      // Get the reputation data first to have the old name for notifications
      const gm = (window as any).GuardManagement;
      if (!gm?.documentManager) {
        console.error('DocumentManager not available');
        return;
      }

      const reputations = gm.documentManager.getGuardReputations();
      const oldReputation = reputations.find((r: any) => r.id === reputationId);
      const oldName = oldReputation?.name || 'Reputación Desconocida';

      await AddOrEditReputationDialog.showEditDialog(reputationId);

      console.log('✅ Edit reputation dialog closed, refreshing content');
      await refreshCallback();

      // Get updated reputation data for notification and event
      const updatedReputations = gm.documentManager.getGuardReputations();
      const updatedReputation = updatedReputations.find((r: any) => r.id === reputationId);
      const newName = updatedReputation?.name || oldName;

      if (oldName !== newName) {
        NotificationService.info(`Reputación actualizada: "${oldName}" → "${newName}"`);
      }

      // Dispatch event for other dialogs to update
      const event = new CustomEvent('guard-reputation-updated', {
        detail: {
          reputationId: reputationId,
          oldName: oldName,
          newName: newName,
        },
      });
      document.dispatchEvent(event);
    } catch (error) {
      console.error('❌ Error showing edit reputation dialog:', error);
      NotificationService.error('Error al editar la reputación');
    }
  }

  /**
   * Handle removing a reputation from the organization
   */
  public static async handleRemoveReputation(
    reputationId: string,
    reputationName: string,
    organization: GuardOrganization,
    refreshCallback: () => Promise<void>
  ): Promise<void> {
    console.log('🗑️ Remove reputation request:', reputationName, reputationId);
    
    const html = `
          <div style="margin-bottom: 1rem;">
            <i class="fas fa-exclamation-triangle" style="color: #ff6b6b; margin-right: 0.5rem;"></i>
            <strong>¿Estás seguro?</strong>
          </div>
          <p>¿Deseas remover la reputación "<strong>${reputationName}</strong>" de esta organización?</p>
          <p><small>Esta acción se puede deshacer asignando la reputación nuevamente.</small></p>
        `;
    
    const confirmed = await ConfirmService.confirm({ title: 'Confirmar Remoción', html });
    
    if (!confirmed) {
      console.log('❌ Reputation removal cancelled by user');
      return;
    }

    const gm = (window as any).GuardManagement;

    if (!gm?.guardOrganizationManager) {
      console.error('❌ GuardOrganizationManager not available');
      return;
    }

    try {
      // Check if reputation is assigned
      if (!organization.reputation || !organization.reputation.includes(reputationId)) {
        console.log('ℹ️ Reputation not assigned - nothing to remove');
        NotificationService.warn(
          `La reputación "${reputationName}" no está asignada a esta organización`
        );
        return;
      }

      // Create a NEW array without the reputation
      const newReputation = organization.reputation.filter((id: string) => id !== reputationId);

      // Create updated organization object
      const updatedOrganization = {
        ...organization,
        reputation: newReputation,
        updatedAt: new Date(),
        version: (organization.version || 0) + 1,
      };

      // Update organization
      await gm.guardOrganizationManager.updateOrganization(updatedOrganization);

      console.log('✅ Reputation removed successfully');
      NotificationService.info(`Reputación "${reputationName}" removida de la organización`);

      await refreshCallback();
    } catch (error) {
      console.error('❌ Error removing reputation:', error);
      NotificationService.error('Error al remover la reputación de la organización');
    }
  }

  /**
   * Handle sending a reputation to chat
   */
  public static async handleSendReputationToChat(reputationId: string): Promise<void> {
    console.log('💬 Send reputation to chat request:', reputationId);

    try {
      await ReputationTemplate.sendReputationToChat(reputationId);
      console.log('✅ Reputation sent to chat successfully');
      NotificationService.info('Reputación enviada al chat');
    } catch (error) {
      console.error('❌ Error sending reputation to chat:', error);
      NotificationService.error('Error al enviar reputación al chat');
    }
  }

  /**
   * Assign a reputation to the organization
   */
  public static async assignReputationToOrganization(
    reputationData: any,
    organization: GuardOrganization,
    refreshCallback: () => Promise<void>
  ): Promise<void> {
    console.log('🤝 Assigning reputation:', reputationData.name);

    const gm = (window as any).GuardManagement;

    if (!gm?.guardOrganizationManager) {
      console.error('❌ GuardOrganizationManager not available');
      return;
    }

    try {
      // Initialize reputation array if it doesn't exist
      const currentReputation = organization.reputation || [];

      // Check if reputation is already assigned
      if (currentReputation.includes(reputationData.id)) {
        console.log('ℹ️ Reputation already assigned - skipping');
        NotificationService.warn(
          `La reputación "${reputationData.name}" ya está asignada a esta organización`
        );
        return;
      }

      // Create a NEW array with the new reputation
      const newReputation = [...currentReputation, reputationData.id];

      // Create updated organization object
      const updatedOrganization = {
        ...organization,
        reputation: newReputation,
        updatedAt: new Date(),
        version: (organization.version || 0) + 1,
      };

      // Update organization
      await gm.guardOrganizationManager.updateOrganization(updatedOrganization);

      console.log('✅ Reputation assigned successfully');
      NotificationService.info(`Reputación "${reputationData.name}" asignada a la organización`);

      await refreshCallback();
    } catch (error) {
      console.error('❌ Error assigning reputation:', error);
      NotificationService.error('Error al asignar la reputación');
      throw error;
    }
  }
}
