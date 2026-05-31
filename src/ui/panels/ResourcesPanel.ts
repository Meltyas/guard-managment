import type { GuardOrganization, ResourceLogEntry } from '../../types/entities';
import { ConfirmService } from '../../utils/services/ConfirmService.js';
import { NotificationService } from '../../utils/services/NotificationService.js';
import { ResourceTemplate } from '../ResourceTemplate.js';

// ── Log helpers ──────────────────────────────────────────────────────────────

const LOG_ACTION_LABELS: Record<string, string> = {
  order_placed:    'Encargo registrado',
  order_arrived:   'Encargo llegado',
  quantity_added:  'Stock añadido',
  quantity_removed:'Stock retirado',
  quantity_set:    'Stock ajustado',
  resource_created:'Recurso creado',
};

function _formatTimeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'ahora mismo';
  if (diffMins < 60) return `hace ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `hace ${diffDays}d`;
}

function _enrichLogEntry(e: ResourceLogEntry) {
  return {
    ...e,
    label: LOG_ACTION_LABELS[e.action] ?? e.action,
    timeAgo: _formatTimeAgo(e.timestamp),
    dateLabel: new Date(e.timestamp).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    }),
    isPositive: e.action === 'order_arrived' || e.action === 'quantity_added' || e.action === 'resource_created',
    isNegative: e.action === 'quantity_removed',
    isPending:  e.action === 'order_placed',
  };
}

export class ResourcesPanel {
  static get template() {
    return 'modules/guard-management/templates/panels/resources.hbs';
  }

  static async getData(organization: GuardOrganization) {
    const gm = (window as any).GuardManagement;
    const resources = [];

    console.log(
      'ResourcesPanel.getData | Organization has',
      organization.resources?.length || 0,
      'resource IDs'
    );

    if (organization.resources && organization.resources.length > 0) {
      const allResources = gm.resourceManager?.getAllResources() || [];
      console.log(
        'ResourcesPanel.getData | ResourceManager has',
        allResources.length,
        'total resources'
      );

      for (const id of organization.resources) {
        const r = allResources.find((res: any) => res.id === id);
        if (r) {
          // Enrich with pending/arrived order summaries for the template
          const pendingOrders = (r.orders ?? []).filter((o: any) => o.status === 'pending');
          const arrivedOrders = (r.orders ?? []).filter((o: any) => o.status === 'arrived');
          // Log — newest first, enriched with labels and time formatting
          const logEntries = [...(r.log ?? [])]
            .sort((a: any, b: any) => b.timestamp - a.timestamp)
            .map(_enrichLogEntry);
          resources.push({ ...r, pendingOrders, arrivedOrders, logEntries });
          console.log('ResourcesPanel.getData | Found resource:', r.name);
        } else {
          console.warn('ResourcesPanel.getData | Resource ID not found:', id);
        }
      }
    }

    console.log('ResourcesPanel.getData | Returning', resources.length, 'resources');
    return {
      organizationId: organization.id,
      resources,
    };
  }

  static async render(container: HTMLElement, organization: GuardOrganization) {
    const data = await this.getData(organization);
    const htmlContent = await foundry.applications.handlebars.renderTemplate(this.template, data);

    // Use jQuery html() to forcibly replace content
    // This is more reliable than empty+append for string HTML
    console.log('ResourcesPanel | Rendering with data:', data);
    $(container).html(htmlContent);
    console.log('ResourcesPanel | DOM updated');

    // Set up expand/collapse toggles — click anywhere in summary except action buttons
    container.querySelectorAll<HTMLElement>('.entity-row__summary').forEach((summary) => {
      summary.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.entity-row__actions')) return;
        e.stopPropagation();
        const row = summary.closest('.entity-row') as HTMLElement;
        const detail = row.querySelector('.entity-row__detail') as HTMLElement;
        const toggle = row.querySelector('.entity-row__toggle') as HTMLElement;
        const isOpen = !detail.hidden;
        detail.hidden = isOpen;
        toggle?.setAttribute('aria-expanded', String(!isOpen));
        row.classList.toggle('entity-row--open', !isOpen);
      });
    });

    // Search filter
    const searchInput = container.querySelector<HTMLInputElement>('.entity-list-search__input');
    searchInput?.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      container.querySelectorAll<HTMLElement>('.entity-row').forEach((row) => {
        const name = row.querySelector('.entity-row__name')?.textContent?.toLowerCase() ?? '';
        row.classList.toggle('entity-row--hidden', !!query && !name.includes(query));
      });
    });

    // Log section toggle (collapse/expand inside each row detail)
    container.querySelectorAll<HTMLElement>('.resource-log-toggle').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const section = btn.closest('.resource-log-section') as HTMLElement;
        const list = section?.querySelector('.resource-log-list') as HTMLElement;
        const chevron = btn.querySelector('.resource-log-chevron') as HTMLElement;
        if (!list) return;
        list.hidden = !list.hidden;
        chevron?.classList.toggle('resource-log-chevron--open', !list.hidden);
      });
    });
  }

  /**
   * Handle removing a resource
   */
  public static async handleRemoveResource(
    resourceId: string,
    resourceName: string,
    organization: GuardOrganization,
    refreshCallback: () => Promise<void>
  ): Promise<void> {
    console.log('🗑️ Remove resource request:', resourceName, resourceId);

    const html = `
          <div style="margin-bottom: 1rem;">
            <i class="fas fa-exclamation-triangle" style="color: #ff6b6b; margin-right: 0.5rem;"></i>
            <strong>¿Estás seguro?</strong>
          </div>
          <p>¿Deseas remover el recurso "<strong>${resourceName}</strong>" de esta organización?</p>
          <p><small>Esta acción se puede deshacer asignando el recurso nuevamente.</small></p>
        `;

    const confirmed = await ConfirmService.confirm({ title: 'Confirmar Remoción', html });

    if (!confirmed) {
      console.log('❌ Resource removal cancelled by user');
      return;
    }

    const gm = (window as any).GuardManagement;

    if (!gm?.guardOrganizationManager) {
      console.error('❌ GuardOrganizationManager not available');
      return;
    }

    try {
      // Check if resource is assigned
      if (!organization.resources || !organization.resources.includes(resourceId)) {
        console.log('ℹ️ Resource not assigned - nothing to remove');
        NotificationService.warn(
          `El recurso "${resourceName}" no está asignado a esta organización`
        );
        return;
      }

      // Create a NEW array without the resource
      const newResources = organization.resources.filter((id: string) => id !== resourceId);

      // Create updated organization object
      const updatedOrganization = {
        ...organization,
        resources: newResources,
        updatedAt: new Date(),
        version: (organization.version || 0) + 1,
      };

      // Update organization
      await gm.guardOrganizationManager.updateOrganization(updatedOrganization);

      console.log('✅ Resource removed successfully');
      NotificationService.info(`Recurso "${resourceName}" removido de la organización`);

      // Refresh dialog
      await refreshCallback();
    } catch (error) {
      console.error('❌ Error removing resource:', error);
      NotificationService.error('Error al remover el recurso de la organización');
    }
  }

  /**
   * Handle editing a resource
   */
  public static async handleEditResource(
    resourceId: string,
    resourceName: string,
    refreshCallback: () => Promise<void>
  ): Promise<void> {
    console.log('✏️ Edit resource request:', resourceName, resourceId);

    const gm = (window as any).GuardManagement;
    if (!gm?.resourceManager) {
      console.error('❌ ResourceManager not available');
      NotificationService.error('No se pudo acceder al gestor de recursos');
      return;
    }

    try {
      // Get the resource from the resource manager
      const resources = gm.resourceManager.getAllResources() || [];
      const resource = resources.find((r: any) => r.id === resourceId);

      if (!resource) {
        console.error('❌ Resource not found:', resourceId);
        NotificationService.error('Recurso no encontrado');
        return;
      }

      const resourceData = resource; // Ya no necesita conversión

      // Import AddOrEditResourceDialog dynamically
      const { AddOrEditResourceDialog } = await import('../../dialogs/AddOrEditResourceDialog.js');

      // Show the edit dialog
      const editedResource = await AddOrEditResourceDialog.edit(resourceData);

      if (editedResource) {
        console.log('💾 Resource edited successfully, saving to database:', editedResource);

        // Save the edited resource
        const updateSuccess = await gm.resourceManager.updateResource(
          editedResource.id,
          editedResource
        );

        if (updateSuccess) {
          console.log('✅ Resource saved to database');
          NotificationService.info(`Recurso "${editedResource.name}" actualizado exitosamente`);

          // Dispatch event
          const event = new CustomEvent('guard-resource-updated', {
            detail: {
              resourceId: editedResource.id,
              updatedResource: editedResource,
              oldName: resourceData.name,
              newName: editedResource.name,
            },
          });
          window.dispatchEvent(event);

          // Refresh dialog
          await refreshCallback();
        } else {
          console.error('❌ Failed to save resource to database');
          NotificationService.error('Error al guardar el recurso en la base de datos');
        }
      }
    } catch (error) {
      console.error('❌ Error editing resource:', error);
      NotificationService.error('Error al editar el recurso');
    }
  }

  /**
   * Handle sending a resource to chat
   */
  public static async handleSendResourceToChat(resourceId: string): Promise<void> {
    console.log('💬 Send resource to chat request:', resourceId);

    try {
      await ResourceTemplate.sendResourceToChat(resourceId);
      console.log('✅ Resource sent to chat successfully');
      NotificationService.info('Recurso enviado al chat');
    } catch (error) {
      console.error('❌ Error sending resource to chat:', error);
      NotificationService.error('Error al enviar recurso al chat');
    }
  }

  /**
   * Assign a resource to the organization
   */
  public static async assignResourceToOrganization(
    resourceData: any,
    organization: GuardOrganization,
    refreshCallback: () => Promise<void>
  ): Promise<void> {
    console.log('🔧 Assigning resource:', resourceData.name);

    const gm = (window as any).GuardManagement;

    if (!gm?.guardOrganizationManager) {
      console.error('❌ GuardOrganizationManager not available');
      return;
    }

    try {
      // Initialize resources array if it doesn't exist
      const currentResources = organization.resources || [];

      // Check if resource is already assigned
      if (currentResources.includes(resourceData.id)) {
        console.log('ℹ️ Resource already assigned - skipping');
        NotificationService.warn(
          `El recurso "${resourceData.name}" ya está asignado a esta organización`
        );
        return;
      }

      // Create a NEW array with the new resource
      const newResources = [...currentResources, resourceData.id];

      // Create updated organization object
      const updatedOrganization = {
        ...organization,
        resources: newResources,
        updatedAt: new Date(),
        version: (organization.version || 0) + 1,
      };

      // Update organization
      await gm.guardOrganizationManager.updateOrganization(updatedOrganization);

      console.log('✅ Resource assigned successfully');
      NotificationService.info(`Recurso "${resourceData.name}" asignado a la organización`);

      await refreshCallback();
    } catch (error) {
      console.error('❌ Error assigning resource:', error);
      NotificationService.error('Error al asignar el recurso');
      throw error;
    }
  }

  /**
   * Handle placing an order for a resource (GM only).
   * Opens OrderResourceDialog, then calls resourceManager.createOrder().
   */
  public static async handleOrderResource(
    resourceId: string,
    refreshCallback: () => Promise<void>
  ): Promise<void> {
    console.log('📦 Order resource request:', resourceId);

    const gm = (window as any).GuardManagement;
    if (!gm?.resourceManager) {
      NotificationService.error('No se pudo acceder al gestor de recursos');
      return;
    }

    const resource = gm.resourceManager.getResource(resourceId);
    if (!resource) {
      NotificationService.error('Recurso no encontrado');
      return;
    }

    try {
      const currentTurn: number = gm.phaseManager?.getCurrentTurn?.() ?? 1;

      const { OrderResourceDialog } = await import('../../dialogs/OrderResourceDialog.js');
      const order = await OrderResourceDialog.open(resource, currentTurn);

      if (!order) {
        console.log('❌ Order cancelled by GM');
        return;
      }

      await gm.resourceManager.createOrder(resourceId, order, gm.financeManager);

      const msg =
        order.phasesUntilArrival === 0
          ? `Encargo recibido: +${order.quantity} ${resource.name}`
          : `Encargo registrado. Llegará en el turno ${order.arrivalTurn}.`;
      NotificationService.info(msg);

      await refreshCallback();
    } catch (error) {
      console.error('❌ Error ordering resource:', error);
      NotificationService.error('Error al realizar el encargo');
    }
  }

  /**
   * Delete a log entry from a resource (GM only).
   */
  public static async handleDeleteLogEntry(
    resourceId: string,
    entryId: string,
    refreshCallback: () => Promise<void>
  ): Promise<void> {
    const gm = (window as any).GuardManagement;
    if (!gm?.resourceManager) return;

    const deleted = await gm.resourceManager.deleteLogEntry(resourceId, entryId);
    if (deleted) {
      await refreshCallback();
    }
  }

  public static async handleDeleteOrder(
    resourceId: string,
    orderId: string,
    refreshCallback: () => Promise<void>
  ): Promise<void> {
    const gm = (window as any).GuardManagement;
    if (!gm?.resourceManager) return;

    const deleted = await gm.resourceManager.deleteOrder(resourceId, orderId);
    if (deleted) {
      await refreshCallback();
    }
  }
}
