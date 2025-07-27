/**
 * Custom Info Dialog - Movable and resizable HTML dialog without using Foundry's Dialog system
 */

import { html, TemplateResult } from 'lit-html';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import type { GuardOrganization } from '../types/entities';
import { DialogFocusManager, type FocusableDialog } from '../utils/dialog-focus-manager.js';
import { convertFoundryDocumentToResource } from '../utils/resource-converter.js';
import { renderTemplateToString, safeRender } from '../utils/template-renderer.js';
import { ResourceTemplate } from './ResourceTemplate.js';

export class CustomInfoDialog implements FocusableDialog {
  public element: HTMLElement | null = null;
  private isDragging = false;
  private isResizing = false;
  private dragOffset = { x: 0, y: 0 };
  private onEditCallback?: () => void;
  private onCloseCallback?: () => void;
  private isFocused = false;
  private currentOrganization: GuardOrganization | null = null;
  private resourceEventHandler: ((event: Event) => void) | null = null;
  private uiRefreshHandler?: (event: Event) => void;

  constructor() {
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleFocus = this.handleFocus.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleGlobalClick = this.handleGlobalClick.bind(this);
  }

  /**
   * Show the custom info dialog
   */
  public show(
    title: string,
    content: string,
    options: {
      onEdit?: () => void;
      onClose?: () => void;
      width?: number;
      height?: number;
      x?: number;
      y?: number;
    } = {}
  ): void {
    this.onEditCallback = options.onEdit;
    this.onCloseCallback = options.onClose;

    // Create the dialog element
    this.element = this.createElement(title, content, options);

    // Add to document
    document.body.appendChild(this.element);

    // Register with focus manager
    DialogFocusManager.getInstance().registerDialog(this);

    // Add event listeners
    this.addEventListeners();

    // Give this dialog focus immediately
    DialogFocusManager.getInstance().setFocus(this);

    // Center on screen if no position specified
    if (!options.x && !options.y) {
      this.centerOnScreen();
    }
  }

  /**
   * Show organization info dialog
   */
  public showOrganizationInfo(
    organization: GuardOrganization,
    options: {
      onEdit?: () => void;
      onClose?: () => void;
      width?: number;
      height?: number;
      x?: number;
      y?: number;
    } = {}
  ): void {
    console.log('🏛️ Setting current organization:', organization.name, organization.id);
    this.currentOrganization = organization;
    this.onEditCallback = options.onEdit;
    this.onCloseCallback = options.onClose;

    // Create the dialog element directly with organization content
    this.element = this.createOrganizationDialogElement(organization, options);

    // Add to document
    document.body.appendChild(this.element);

    // Register with focus manager
    DialogFocusManager.getInstance().registerDialog(this);

    // Add event listeners
    this.addEventListeners();

    // Give this dialog focus immediately
    DialogFocusManager.getInstance().setFocus(this);

    // Center on screen if no position specified
    if (!options.x && !options.y) {
      this.centerOnScreen();
    }
  }

  /**
   * Create the dialog HTML element specifically for organization info
   */
  private createOrganizationDialogElement(
    organization: GuardOrganization,
    options: { width?: number; height?: number; x?: number; y?: number }
  ): HTMLElement {
    const dialog = document.createElement('div');
    dialog.className = 'custom-info-dialog custom-dialog';

    // Set initial size and position
    const width = options.width || 500;
    const height = options.height || 400;
    const x = options.x || (window.innerWidth - width) / 2;
    const y = options.y || (window.innerHeight - height) / 2;

    // Only set position and size, all other styles come from CSS
    dialog.style.left = `${x}px`;
    dialog.style.top = `${y}px`;
    dialog.style.width = `${width}px`;
    dialog.style.height = `${height}px`;

    dialog.tabIndex = -1; // Make focusable for keyboard events

    dialog.innerHTML = '';

    // Render using lit-html templates directly
    const dialogTemplate = this.renderOrganizationDialogTemplate(organization);
    safeRender(dialogTemplate, dialog);

    // Load external CSS styles
    this.loadExternalStyles();

    return dialog;
  }

  /**
   * Render the complete organization dialog template
   */
  private renderOrganizationDialogTemplate(organization: GuardOrganization): TemplateResult {
    const title = `Información: ${organization.name}`;

    return html`
      ${this.renderDialogHeader(title)}
      <div class="custom-dialog-content">${this.renderOrganizationContent(organization)}</div>
      ${this.renderDialogResizeHandle()}
      <div class="drop-overlay" style="display: none;"></div>
    `;
  }

  /**
   * Update the organization and refresh the dialog content
   */
  public updateOrganization(organization: GuardOrganization): void {
    console.log('🔄 Updating dialog content...');
    this.currentOrganization = organization;

    if (!this.element) return;

    // Update title
    const titleElement = this.element.querySelector('.custom-dialog-title-text');
    if (titleElement) {
      titleElement.textContent = `Información: ${organization.name}`;
    }

    // Update content
    const contentElement = this.element.querySelector('.custom-dialog-content');
    if (contentElement) {
      // IMPORTANT: Instead of clearing innerHTML, create a new container for lit-html
      // This prevents lit-html from losing track of its DOM nodes

      // Create a new container element
      const newContainer = document.createElement('div');
      newContainer.className = 'organization-content';

      // Clear the parent and add the new container
      contentElement.innerHTML = '';
      contentElement.appendChild(newContainer);

      const organizationTemplate = this.renderOrganizationContent(organization);
      safeRender(organizationTemplate, newContainer);
      console.log('✅ Dialog updated with', organization.resources?.length || 0, 'resources');

      // Re-setup resource event listeners after content is rendered
      setTimeout(() => {
        this.setupResourceEventListeners();
      }, 50);
    }
  }

  /**
   * Render just the organization content (without dialog wrapper)
   */
  private renderOrganizationContent(organization: GuardOrganization): TemplateResult {
    console.log('🔍 Rendering organization content:', organization.name);
    console.log('🔍 Organization resources:', organization.resources);

    return html`
      <div class="organization-info">
        <div class="info-section">
          <h3><i class="fas fa-shield-alt"></i> Información General</h3>
          <div class="info-grid">
            <div class="info-item">
              <label>Nombre:</label>
              <span>${organization.name}</span>
            </div>
            <div class="info-item">
              <label>Subtítulo:</label>
              <span>${organization.subtitle || 'Sin subtítulo'}</span>
            </div>
          </div>
        </div>

        <div class="info-section">
          <h3><i class="fas fa-chart-bar"></i> Estadísticas Base</h3>
          <div class="stats-display">
            <div class="stat-box">
              <div class="stat-value">${organization.baseStats.robustismo}</div>
              <div class="stat-label">Robustismo</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${organization.baseStats.analitica}</div>
              <div class="stat-label">Analítica</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${organization.baseStats.subterfugio}</div>
              <div class="stat-label">Subterfugio</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${organization.baseStats.elocuencia}</div>
              <div class="stat-label">Elocuencia</div>
            </div>
          </div>
        </div>

        <div class="info-section">
          <h3><i class="fas fa-users"></i> Patrullas</h3>
          <div class="patrol-count">
            <span class="count">${organization.patrols?.length || 0}</span>
            <span class="label">patrullas activas</span>
          </div>
        </div>

        <div class="info-section resources-section">
          <h3><i class="fas fa-coins"></i> Recursos</h3>
          <div class="resources-list" data-organization-id="${organization.id}">
            ${organization.resources && organization.resources.length > 0
              ? html`${organization.resources
                  .map((resourceId: string) => this.renderResourceItemTemplate(resourceId))
                  .filter((template) => template !== null)}`
              : html`<p class="empty-state">
                  No hay recursos asignados a esta organización.<br /><small
                    >Arrastra recursos desde el warehouse</small
                  >
                </p>`}
          </div>
        </div>

        <div class="info-section">
          <h3><i class="fas fa-handshake"></i> Reputación</h3>
          <div class="reputation-count">
            <span class="count">${organization.reputation?.length || 0}</span>
            <span class="label">relaciones con facciones</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Update the title of the dialog
   */
  public updateTitle(title: string): void {
    if (!this.element) return;

    const titleElement = this.element.querySelector('.custom-dialog-title-text');
    if (titleElement) {
      titleElement.textContent = title;
    }
  }

  /**
   * Close the dialog
   */
  public close(): void {
    if (this.element) {
      // Unregister from focus manager
      DialogFocusManager.getInstance().unregisterDialog(this);

      this.removeEventListeners();
      this.element.remove();
      this.element = null;

      if (this.onCloseCallback) {
        this.onCloseCallback();
      }
    }
  }

  /**
   * Check if dialog is open
   */
  public isOpen(): boolean {
    return this.element !== null && document.body.contains(this.element);
  }

  /**
   * Create the dialog HTML element
   */
  private createElement(
    title: string,
    content: string,
    options: { width?: number; height?: number; x?: number; y?: number }
  ): HTMLElement {
    const dialog = document.createElement('div');
    dialog.className = 'custom-info-dialog custom-dialog';

    // Set initial size and position
    const width = options.width || 500;
    const height = options.height || 400;
    const x = options.x || (window.innerWidth - width) / 2;
    const y = options.y || (window.innerHeight - height) / 2;

    // Only set position and size, all other styles come from CSS
    dialog.style.left = `${x}px`;
    dialog.style.top = `${y}px`;
    dialog.style.width = `${width}px`;
    dialog.style.height = `${height}px`;

    dialog.tabIndex = -1; // Make focusable for keyboard events

    dialog.innerHTML = '';

    // Render using lit-html templates
    const dialogTemplate = this.renderDialogTemplate(title, content);
    safeRender(dialogTemplate, dialog);

    // Load external CSS styles
    this.loadExternalStyles();

    return dialog;
  }

  /**
   * Add event listeners
   */
  private addEventListeners(): void {
    if (!this.element) return;

    const header = this.element.querySelector('.custom-dialog-header') as HTMLElement;
    const editBtn = this.element.querySelector('.custom-dialog-edit') as HTMLElement;
    const closeBtn = this.element.querySelector('.custom-dialog-close') as HTMLElement;
    const resizeHandle = this.element.querySelector('.custom-dialog-resize-handle') as HTMLElement;

    // Dragging
    header.addEventListener('mousedown', this.handleMouseDown);

    // Resizing
    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.isResizing = true;
      document.addEventListener('mousemove', this.handleMouseMove);
      document.addEventListener('mouseup', this.handleMouseUp);
    });

    // Buttons
    editBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.onEditCallback) {
        this.onEditCallback();
      }
    });

    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    });

    // Keyboard
    this.element.addEventListener('keydown', this.handleKeyDown);

    // Global mouse events for dragging/resizing
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);

    // Drop zone functionality - entire dialog is a drop zone
    this.setupDropZoneListeners();

    // Focus management
    this.element.addEventListener('focus', this.handleFocus);
    this.element.addEventListener('click', this.handleGlobalClick);
    document.addEventListener('click', this.handleGlobalClick);

    // Add event listeners for remove resource buttons
    this.setupResourceEventListeners();

    // Listen for resource updates and deletions from warehouse
    this.setupResourceUpdateListeners();
  }

  /**
   * Setup listeners for resource updates from warehouse
   */
  private setupResourceUpdateListeners(): void {
    // Listen for resource deletions
    document.addEventListener(
      'guard-resource-deleted',
      this.handleResourceDeleted.bind(this) as EventListener
    );

    // Listen for resource updates
    document.addEventListener(
      'guard-resource-updated',
      this.handleResourceUpdated.bind(this) as EventListener
    );

    // Listen for general UI refresh events
    this.uiRefreshHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail;

      // Refresh if it's related to our current organization's resources
      if (detail.documentType === 'guard-management.guard-resource' && this.currentOrganization) {
        this.refreshContent();
      } else if (
        detail.documentType === 'guard-management.guard-organization' &&
        this.currentOrganization &&
        detail.documentId === this.currentOrganization.id
      ) {
        this.refreshContent();
      }
    };

    window.addEventListener('guard-ui-refresh', this.uiRefreshHandler);
  }

  /**
   * Handle resource deletion events
   */
  private async handleResourceDeleted(event: Event): Promise<void> {
    const customEvent = event as CustomEvent;
    const { resourceId, resourceName } = customEvent.detail;

    if (!this.currentOrganization) return;

    // Check if this organization had the deleted resource
    if (this.currentOrganization.resources?.includes(resourceId)) {
      console.log('📊 Organization had deleted resource - refreshing content');

      // Get fresh organization data
      await this.refreshContent();

      // Show notification with the proper resource name from the event
      if ((globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.info(
          `El recurso "${resourceName}" fue eliminado del sistema`
        );
      }
    }
  }

  /**
   * Handle resource update events
   */
  private async handleResourceUpdated(event: Event): Promise<void> {
    const customEvent = event as CustomEvent;
    const { resourceId, oldName, newName } = customEvent.detail;
    console.log('✏️ Resource updated event received:', oldName, '->', newName, resourceId);

    if (!this.currentOrganization) return;

    // Check if this organization has the updated resource
    if (this.currentOrganization.resources?.includes(resourceId)) {
      console.log('📊 Organization has updated resource - refreshing content');

      // Get fresh organization data
      await this.refreshContent();

      // Show notification only if name changed
      if (oldName !== newName && (globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.info(
          `Recurso actualizado: "${oldName}" → "${newName}"`
        );
      }
    }
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('click', this.handleGlobalClick);

    // Remove resource event listener
    if (this.element && this.resourceEventHandler) {
      this.element.removeEventListener('click', this.resourceEventHandler);
      this.resourceEventHandler = null;
      console.log('🧹 Cleaned up resource event handler');
    }

    // Remove resource update listeners
    document.removeEventListener(
      'guard-resource-deleted',
      this.handleResourceDeleted.bind(this) as EventListener
    );
    document.removeEventListener(
      'guard-resource-updated',
      this.handleResourceUpdated.bind(this) as EventListener
    );

    // Remove UI refresh listener from window
    if (this.uiRefreshHandler) {
      window.removeEventListener('guard-ui-refresh', this.uiRefreshHandler);
    }

    console.log('🧹 Cleaned up resource update listeners');
  }

  /**
   * Setup event listeners for resource buttons
   */
  private setupResourceEventListeners(): void {
    if (!this.element) return;

    console.log('🔧 Setting up resource event listeners...');

    // Remove existing event handler if it exists
    if (this.resourceEventHandler) {
      this.element.removeEventListener('click', this.resourceEventHandler);
      console.log('🧹 Removed existing resource event handler');
    }

    // Create new event handler and store reference
    this.resourceEventHandler = (event: Event) => {
      const target = event.target as HTMLElement;

      // Handle send to chat button
      const sendToChatBtn = target.closest('.send-to-chat-btn') as HTMLElement;
      if (sendToChatBtn) {
        event.preventDefault();
        event.stopPropagation();

        const resourceId = sendToChatBtn.getAttribute('data-resource-id');
        const organizationId = sendToChatBtn.getAttribute('data-organization-id');

        if (resourceId) {
          console.log('💬 Send to chat button clicked for:', resourceId);
          this.handleSendResourceToChat(resourceId, organizationId || undefined);
        }
        return;
      }

      // Handle remove button
      const removeBtn = target.closest('.remove-resource-btn') as HTMLElement;
      if (removeBtn) {
        event.preventDefault();
        event.stopPropagation();

        const resourceId = removeBtn.getAttribute('data-resource-id');
        const resourceName = removeBtn.getAttribute('data-resource-name');

        if (resourceId) {
          console.log('🗑️ Remove button clicked for:', resourceName, resourceId);
          this.handleRemoveResource(resourceId, resourceName || 'Recurso');
        }
        return;
      }

      // Handle edit button
      const editBtn = target.closest('.edit-resource-btn') as HTMLElement;
      if (editBtn) {
        event.preventDefault();
        event.stopPropagation();

        const resourceId = editBtn.getAttribute('data-resource-id');
        const resourceName = editBtn.getAttribute('data-resource-name');

        if (resourceId) {
          console.log('✏️ Edit button clicked for:', resourceName, resourceId);
          this.handleEditResource(resourceId, resourceName || 'Recurso');
        }
        return;
      }
    };

    // Add the new event listener
    this.element.addEventListener('click', this.resourceEventHandler);
    console.log('✅ Resource event listeners set up');
  }

  /**
   * Handle removing a resource from the organization
   */
  private async handleRemoveResource(resourceId: string, resourceName: string): Promise<void> {
    console.log('🗑️ Remove resource request:', resourceName, resourceId);

    // Show confirmation dialog
    const confirmed = await this.showRemoveResourceDialog(resourceName);
    if (!confirmed) {
      console.log('❌ Resource removal cancelled by user');
      return;
    }

    const gm = (window as any).GuardManagement;

    if (!gm?.guardOrganizationManager || !this.currentOrganization) {
      console.error('❌ GuardOrganizationManager or organization not available');
      return;
    }

    try {
      // Get current organization
      const organization = gm.guardOrganizationManager.getOrganization();
      if (!organization) {
        console.error('❌ Organization not found');
        return;
      }

      // Check if resource is assigned
      if (!organization.resources || !organization.resources.includes(resourceId)) {
        console.log('ℹ️ Resource not assigned - nothing to remove');
        if ((globalThis as any).ui?.notifications) {
          (globalThis as any).ui.notifications.warn(
            `El recurso "${resourceName}" no está asignado a esta organización`
          );
        }
        return;
      }

      // Create a NEW array without the resource to avoid mutation issues
      const newResources = organization.resources.filter((id: string) => id !== resourceId);

      // Create a completely new organization object to avoid reference issues
      const updatedOrganization = {
        ...organization,
        resources: newResources,
        updatedAt: new Date(),
        version: (organization.version || 0) + 1,
      };

      // Update organization
      await gm.guardOrganizationManager.updateOrganization(updatedOrganization);

      // Update current organization in memory with the NEW object
      this.currentOrganization = updatedOrganization;

      console.log('✅ Resource removed successfully');

      // Show success notification
      if ((globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.info(
          `Recurso "${resourceName}" removido de la organización`
        );
      }

      // Re-render the dialog to show the updated resources
      await this.refreshContent();
    } catch (error) {
      console.error('❌ Error removing resource:', error);
      if ((globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.error(
          'Error al remover el recurso de la organización'
        );
      }
    }
  }

  /**
   * Show confirmation dialog for removing a resource
   */
  private async showRemoveResourceDialog(resourceName: string): Promise<boolean> {
    try {
      // Use foundry's built-in confirmation dialog
      const result = await Dialog.confirm({
        title: 'Confirmar Remoción',
        content: `
          <div style="margin-bottom: 1rem;">
            <i class="fas fa-exclamation-triangle" style="color: #ff6b6b; margin-right: 0.5rem;"></i>
            <strong>¿Estás seguro?</strong>
          </div>
          <p>¿Deseas remover el recurso "<strong>${resourceName}</strong>" de esta organización?</p>
          <p><small>Esta acción se puede deshacer asignando el recurso nuevamente.</small></p>
        `,
        yes: () => true,
        no: () => false,
        defaultYes: false,
      });

      return result;
    } catch (error) {
      console.error('Error showing confirmation dialog:', error);
      // Fallback to browser confirm if Dialog fails
      return confirm(`¿Deseas remover el recurso "${resourceName}" de esta organización?`);
    }
  }

  /**
   * Handle editing a resource
   */
  private async handleEditResource(resourceId: string, resourceName: string): Promise<void> {
    console.log('✏️ Edit resource request:', resourceName, resourceId);

    const gm = (window as any).GuardManagement;
    if (!gm?.documentManager) {
      console.error('❌ DocumentBasedManager not available');
      if ((globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.error('No se pudo acceder al gestor de documentos');
      }
      return;
    }

    try {
      // Get the resource from the document manager
      const resources = gm.documentManager.getGuardResources();
      const resource = resources.find((r: any) => r.id === resourceId);

      if (!resource) {
        console.error('❌ Resource not found:', resourceId);
        if ((globalThis as any).ui?.notifications) {
          (globalThis as any).ui.notifications.error('Recurso no encontrado');
        }
        return;
      }

      // Convert Foundry document to our Resource type using the utility function
      const resourceData = convertFoundryDocumentToResource(resource);

      // Import AddOrEditResourceDialog dynamically to avoid circular imports
      const { AddOrEditResourceDialog } = await import('../dialogs/AddOrEditResourceDialog.js');

      // Show the edit dialog
      const editedResource = await AddOrEditResourceDialog.edit(resourceData);

      if (editedResource) {
        console.log('💾 Resource edited successfully, saving to database:', editedResource);

        // Save the edited resource using DocumentBasedManager
        const updateSuccess = await gm.documentManager.updateGuardResource(
          editedResource.id,
          editedResource
        );

        if (updateSuccess) {
          console.log('✅ Resource saved to database');

          // Notify success
          if ((globalThis as any).ui?.notifications) {
            (globalThis as any).ui.notifications.info(
              `Recurso "${editedResource.name}" actualizado exitosamente`
            );
          }

          // Dispatch event for other dialogs to update (like warehouse)
          const event = new CustomEvent('guard-resource-updated', {
            detail: {
              resourceId: editedResource.id,
              updatedResource: editedResource,
              oldName: resourceData.name,
              newName: editedResource.name,
            },
          });
          document.dispatchEvent(event);

          // Refresh this dialog's content to show the updated resource
          await this.refreshContent();
        } else {
          console.error('❌ Failed to save resource to database');
          if ((globalThis as any).ui?.notifications) {
            (globalThis as any).ui.notifications.error(
              'Error al guardar el recurso en la base de datos'
            );
          }
        }
      }
    } catch (error) {
      console.error('❌ Error editing resource:', error);
      if ((globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.error('Error al editar el recurso');
      }
    }
  }

  /**
   * Handle sending a resource to chat
   */
  private async handleSendResourceToChat(
    resourceId: string,
    _organizationId?: string
  ): Promise<void> {
    console.log('💬 Send resource to chat request:', resourceId);

    try {
      // Get organization name if available
      let organizationName = '';
      if (this.currentOrganization) {
        organizationName = this.currentOrganization.name;
      }

      // Send to chat using ResourceTemplate
      await ResourceTemplate.sendResourceToChat(resourceId, organizationName);

      console.log('✅ Resource sent to chat successfully');

      // Show success notification
      if ((globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.info('Recurso enviado al chat');
      }
    } catch (error) {
      console.error('❌ Error sending resource to chat:', error);
      if ((globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.error('Error al enviar recurso al chat');
      }
    }
  }

  /**
   * Setup drop zone listeners for the overlay
   */
  private setupDropZoneListeners(): void {
    if (!this.element) return;

    const overlay = this.element.querySelector('.drop-overlay') as HTMLElement;
    if (!overlay) return;

    // Remove existing listeners first to avoid duplicates
    overlay.removeEventListener('dragover', this.handleDragOver.bind(this));
    overlay.removeEventListener('dragenter', this.handleDragEnter.bind(this));
    overlay.removeEventListener('dragleave', this.handleDragLeave.bind(this));
    overlay.removeEventListener('drop', this.handleDrop.bind(this));

    // Add new listeners
    overlay.addEventListener('dragover', this.handleDragOver.bind(this));
    overlay.addEventListener('dragenter', this.handleDragEnter.bind(this));
    overlay.addEventListener('dragleave', this.handleDragLeave.bind(this));
    overlay.addEventListener('drop', this.handleDrop.bind(this));

    console.log('Drop zone listeners set up for overlay');

    // Listen for global drag events to show/hide overlay
    this.setupGlobalDragListeners();
  }

  /**
   * Setup global drag listeners to detect when dragging starts/ends
   */
  private setupGlobalDragListeners(): void {
    document.addEventListener('dragstart', this.handleGlobalDragStart.bind(this));
    document.addEventListener('dragend', this.handleGlobalDragEnd.bind(this));
  }

  /**
   * Handle mouse down for dragging
   */
  private handleMouseDown(e: MouseEvent): void {
    if (!this.element) return;

    // Only drag from header, not from buttons
    const target = e.target as HTMLElement;
    if (target.closest('.custom-dialog-btn')) return;

    e.preventDefault();
    this.isDragging = true;

    const rect = this.element.getBoundingClientRect();
    this.dragOffset.x = e.clientX - rect.left;
    this.dragOffset.y = e.clientY - rect.top;

    this.element.style.cursor = 'grabbing';
  }

  /**
   * Handle mouse move for dragging and resizing
   */
  private handleMouseMove(e: MouseEvent): void {
    if (!this.element) return;

    if (this.isDragging) {
      const newX = e.clientX - this.dragOffset.x;
      const newY = e.clientY - this.dragOffset.y;

      // Keep within screen bounds
      const maxX = window.innerWidth - this.element.offsetWidth;
      const maxY = window.innerHeight - this.element.offsetHeight;

      this.element.style.left = Math.max(0, Math.min(maxX, newX)) + 'px';
      this.element.style.top = Math.max(0, Math.min(maxY, newY)) + 'px';
    }

    if (this.isResizing) {
      const rect = this.element.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      const newHeight = e.clientY - rect.top;

      this.element.style.width = Math.max(300, newWidth) + 'px';
      this.element.style.height = Math.max(200, newHeight) + 'px';
    }
  }

  /**
   * Handle mouse up
   */
  private handleMouseUp(): void {
    if (this.element) {
      this.element.style.cursor = '';
    }
    this.isDragging = false;
    this.isResizing = false;
  }

  /**
   * Handle keyboard events
   */
  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.close();
    }
  }

  /**
   * Center dialog on screen
   */
  private centerOnScreen(): void {
    if (!this.element) return;

    const rect = this.element.getBoundingClientRect();
    const x = (window.innerWidth - rect.width) / 2;
    const y = (window.innerHeight - rect.height) / 2;

    this.element.style.left = Math.max(0, x) + 'px';
    this.element.style.top = Math.max(0, y) + 'px';
  }

  /**
   * Load external CSS styles for the custom dialog
   */
  private loadExternalStyles(): void {
    const styleId = 'custom-info-dialog-styles';

    // Check if styles already exist
    if (document.getElementById(styleId)) {
      console.log('🎨 CSS styles already loaded');
      return;
    }

    // Create link element for external CSS
    const link = document.createElement('link');
    link.id = styleId;
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = 'modules/guard-management/styles/custom-info-dialog.css';

    link.onload = () => {
      console.log('🎨 CSS styles loaded successfully');
    };

    link.onerror = () => {
      console.error('❌ Error loading CSS styles');
    };

    document.head.appendChild(link);
    console.log('🎨 CSS link added to document head');
  }

  /**
   * Generate organization info content
   */
  public generateOrganizationInfoContent(organization: GuardOrganization): string {
    const template = html`
      <div class="organization-info">
        <div class="info-section">
          <h3><i class="fas fa-shield-alt"></i> Información General</h3>
          <div class="info-grid">
            <div class="info-item">
              <label>Nombre:</label>
              <span>${organization.name}</span>
            </div>
            <div class="info-item">
              <label>Subtítulo:</label>
              <span>${organization.subtitle || 'Sin subtítulo'}</span>
            </div>
          </div>
        </div>

        <div class="info-section">
          <h3><i class="fas fa-chart-bar"></i> Estadísticas Base</h3>
          <div class="stats-display">
            <div class="stat-box">
              <div class="stat-value">${organization.baseStats.robustismo}</div>
              <div class="stat-label">Robustismo</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${organization.baseStats.analitica}</div>
              <div class="stat-label">Analítica</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${organization.baseStats.subterfugio}</div>
              <div class="stat-label">Subterfugio</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${organization.baseStats.elocuencia}</div>
              <div class="stat-label">Elocuencia</div>
            </div>
          </div>
        </div>

        <div class="info-section">
          <h3><i class="fas fa-users"></i> Patrullas</h3>
          <div class="patrol-count">
            <span class="count">${organization.patrols?.length || 0}</span>
            <span class="label">patrullas activas</span>
          </div>
        </div>

        <div class="info-section resources-section">
          <h3><i class="fas fa-coins"></i> Recursos</h3>
          <div class="resources-list" data-organization-id="${organization.id}">
            ${organization.resources && organization.resources.length > 0
              ? html`${organization.resources
                  .map((resourceId: string) => this.renderResourceItemTemplate(resourceId))
                  .filter((template) => template !== null)}`
              : html`<p class="empty-state">
                  No hay recursos asignados a esta organización.<br /><small
                    >Arrastra recursos desde el warehouse</small
                  >
                </p>`}
          </div>
        </div>

        <div class="info-section">
          <h3><i class="fas fa-handshake"></i> Reputación</h3>
          <div class="reputation-count">
            <span class="count">${organization.reputation?.length || 0}</span>
            <span class="label">relaciones con facciones</span>
          </div>
        </div>
      </div>
    `;

    // Convert template to string for dialog usage
    return renderTemplateToString(template);
  }

  /**
   * Static version for backward compatibility
   */
  public static generateOrganizationInfoContent(organization: GuardOrganization): string {
    const instance = new CustomInfoDialog();
    return instance.generateOrganizationInfoContent(organization);
  }

  /**
   * Render dialog template
   */
  private renderDialogTemplate(title: string, content: string): TemplateResult {
    return html`
      ${this.renderDialogHeader(title)} ${this.renderDialogContent(content)}
      ${this.renderDialogResizeHandle()}
      <div class="drop-overlay" style="display: none;"></div>
    `;
  }

  /**
   * Render dialog header
   */
  private renderDialogHeader(title: string): TemplateResult {
    return html`
      <div class="custom-dialog-header">
        <div class="custom-dialog-title">
          <i class="fas fa-info-circle"></i>
          <span class="custom-dialog-title-text">${title}</span>
        </div>
        <div class="custom-dialog-controls">
          <button class="custom-dialog-btn custom-dialog-edit" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="custom-dialog-btn custom-dialog-close" title="Cerrar">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render dialog content
   */
  private renderDialogContent(content: string): TemplateResult {
    return html` <div class="custom-dialog-content">${unsafeHTML(content)}</div> `;
  }

  /**
   * Render dialog resize handle
   */
  private renderDialogResizeHandle(): TemplateResult {
    return html` <div class="custom-dialog-resize-handle"></div> `;
  }

  /**
   * Handle focus events - called when dialog gains focus
   */
  public onFocus(): void {
    if (this.element) {
      this.element.classList.add('focused');
      this.isFocused = true;
    }
  }

  /**
   * Handle blur events - called when dialog loses focus
   */
  public onBlur(): void {
    if (this.element) {
      this.element.classList.remove('focused');
      this.isFocused = false;
    }
  }

  /**
   * Handle global click events to manage focus
   */
  private handleGlobalClick(event: MouseEvent): void {
    if (!this.element) return;

    const target = event.target as HTMLElement;
    const isClickOnDialog = this.element.contains(target);

    if (isClickOnDialog && !this.isFocused) {
      // Clicked on this dialog, give it focus
      DialogFocusManager.getInstance().setFocus(this);
    }
  }

  /**
   * Handle focus events - focus gained
   */
  private handleFocus(): void {
    if (!this.isFocused) {
      DialogFocusManager.getInstance().setFocus(this);
    }
  }

  /**
   * Handle blur events - focus lost (not used in this implementation)
   */
  private handleBlur(): void {
    // Note: We don't clear focus here because focus is managed globally
    // Focus is only lost when another dialog gains focus or when dialog is closed
  }

  /**
   * Render individual resource item as TemplateResult
   */
  private renderResourceItemTemplate(resourceId: string): TemplateResult | null {
    return ResourceTemplate.renderResourceItem(resourceId, {
      showActions: true,
      showSendToChat: true,
      organizationId: this.currentOrganization?.id || '',
    });
  }

  /**
   * Handle global drag start - show overlay
   */
  private handleGlobalDragStart(event: DragEvent): void {
    // Only show overlay if this is a guard resource being dragged
    const dragData = event.dataTransfer?.getData('text/plain');
    if (dragData) {
      try {
        const data = JSON.parse(dragData);
        if (data.type === 'guard-resource') {
          this.showDropOverlay();
        }
      } catch (error) {
        // Not valid JSON, could be from other source
      }
    }
  }

  /**
   * Handle global drag end - hide overlay
   */
  private handleGlobalDragEnd(_event: DragEvent): void {
    this.hideDropOverlay();
  }

  /**
   * Show the drop overlay
   */
  private showDropOverlay(): void {
    if (!this.element) return;

    const overlay = this.element.querySelector('.drop-overlay') as HTMLElement;
    if (overlay) {
      overlay.style.display = 'block';
      overlay.style.pointerEvents = 'auto';
    }
  }

  /**
   * Hide the drop overlay
   */
  private hideDropOverlay(): void {
    if (!this.element) return;

    const overlay = this.element.querySelector('.drop-overlay') as HTMLElement;
    if (overlay) {
      overlay.style.display = 'none';
      overlay.style.pointerEvents = 'none';
      overlay.classList.remove('drag-over');
    }
  }

  /**
   * Handle drag over events
   */
  private handleDragOver(event: Event): void {
    event.preventDefault();
    console.log('Drag over overlay');
  }

  /**
   * Handle drag enter events
   */
  private handleDragEnter(event: Event): void {
    event.preventDefault();
    if (this.element) {
      const overlay = this.element.querySelector('.drop-overlay') as HTMLElement;
      if (overlay) {
        overlay.classList.add('drag-over');
        console.log('Drag entered overlay');
      }
    }
  }

  /**
   * Handle drag leave events
   */
  private handleDragLeave(_event: Event): void {
    if (this.element) {
      const overlay = this.element.querySelector('.drop-overlay') as HTMLElement;
      if (overlay) {
        overlay.classList.remove('drag-over');
        console.log('Drag left overlay');
      }
    }
  }

  /**
   * Handle drop events
   */
  private async handleDrop(event: Event): Promise<void> {
    event.preventDefault();

    if (this.element) {
      const overlay = this.element.querySelector('.drop-overlay') as HTMLElement;
      if (overlay) {
        overlay.classList.remove('drag-over');
      }
    }

    this.hideDropOverlay();

    const dragEvent = event as DragEvent;
    if (!dragEvent.dataTransfer) return;

    try {
      const data = JSON.parse(dragEvent.dataTransfer.getData('text/plain'));
      console.log('🎯 Resource drop attempt:', data.resourceData.name);

      if (data.type === 'guard-resource') {
        // Implement actual resource assignment
        await this.assignResourceToOrganization(data.resourceData);

        // Show success notification
        if ((globalThis as any).ui?.notifications) {
          (globalThis as any).ui.notifications.info(
            `Recurso "${data.resourceData.name}" asignado a la organización`
          );
        }

        // Re-render the dialog to show the new resource
        await this.refreshContent();
      }
    } catch (error) {
      console.error('❌ Error parsing drop data:', error);
      if ((globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.error('Error al asignar el recurso a la organización');
      }
    }
  }

  /**
   * Assign a resource to the current organization
   */
  private async assignResourceToOrganization(resourceData: any): Promise<void> {
    console.log('🔧 Assigning resource:', resourceData.name);

    const gm = (window as any).GuardManagement;

    if (!gm?.guardOrganizationManager || !this.currentOrganization) {
      console.error('❌ GuardOrganizationManager or organization not available');
      return;
    }

    try {
      // Get current organization (GuardOrganizationManager manages only one organization)
      const organization = gm.guardOrganizationManager.getOrganization();
      if (!organization) {
        console.error('❌ Organization not found');
        return;
      }

      // Initialize resources array if it doesn't exist
      if (!organization.resources) {
        organization.resources = [];
      }

      // Check if resource is already assigned
      if (organization.resources.includes(resourceData.id)) {
        console.log('ℹ️ Resource already assigned - skipping');
        if ((globalThis as any).ui?.notifications) {
          (globalThis as any).ui.notifications.warn(
            `El recurso "${resourceData.name}" ya está asignado a esta organización`
          );
        }
        return;
      }

      // Create a NEW array with the new resource to avoid mutation issues
      const newResources = [...organization.resources, resourceData.id];

      // Create a completely new organization object to avoid reference issues
      const updatedOrganization = {
        ...organization,
        resources: newResources,
        updatedAt: new Date(),
        version: (organization.version || 0) + 1,
      };

      // Update organization (GuardOrganizationManager has different update method)
      await gm.guardOrganizationManager.updateOrganization(updatedOrganization);

      // Update current organization in memory with the NEW object
      this.currentOrganization = updatedOrganization;

      console.log('✅ Resource assigned successfully');
    } catch (error) {
      console.error('❌ Error assigning resource:', error);
      throw error;
    }
  }

  /**
   * Refresh dialog content with updated data
   */
  private async refreshContent(): Promise<void> {
    console.log('🔄 RefreshContent called...');

    if (!this.currentOrganization) {
      console.log('❌ No current organization for refresh');
      return;
    }

    const gm = (window as any).GuardManagement;
    if (!gm?.guardOrganizationManager) {
      console.log('❌ No guardOrganizationManager for refresh');
      return;
    }

    try {
      // Get the FRESH organization data from the manager IMMEDIATELY
      const freshOrganization = gm.guardOrganizationManager.getOrganization();
      if (!freshOrganization) {
        console.log('❌ No organization found in manager');
        return;
      }

      console.log(
        '📊 Refreshing - Current resources count:',
        this.currentOrganization.resources?.length || 0
      );
      console.log(
        '📊 Refreshing - Fresh resources count:',
        freshOrganization.resources?.length || 0
      );

      // IMPORTANT: Update our current organization reference to the fresh one
      this.currentOrganization = freshOrganization;

      // Force immediate update of the dialog content
      this.updateOrganization(freshOrganization);

      console.log('✅ Refresh completed immediately');
    } catch (error) {
      console.error('❌ Error refreshing dialog content:', error);
    }
  }
}
