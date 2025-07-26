import { html, TemplateResult } from 'lit-html';
import { DialogFocusManager, type FocusableDialog } from '../utils/dialog-focus-manager.js';
import { safeRender } from '../utils/template-renderer.js';
import { AddOrEditResourceDialog } from './AddOrEditResourceDialog.js';

/**
 * GM Warehouse Dialog
 * A specialized custom popup for GM-only warehouse/storage management with tabs
 */

export class GMWarehouseDialog implements FocusableDialog {
  public element: HTMLElement | null = null;
  private isDragging = false;
  private isResizing = false;
  private dragOffset = { x: 0, y: 0 };
  private isFocused = false;

  // Event handlers for cleanup
  private resourceUpdateHandler?: (event: Event) => void;
  private resourceDeleteHandler?: (event: Event) => void;

  // Storage for templates (in-memory for now)
  private resourceTemplates: any[] = [];
  private reputationTemplates: any[] = [];
  private patrolEffectTemplates: any[] = [];

  constructor() {
    // Check GM permissions
    if (!(game as any)?.user?.isGM) {
      throw new Error('Only GM can access the warehouse');
    }

    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleFocus = this.handleFocus.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleGlobalClick = this.handleGlobalClick.bind(this);
  }

  /**
   * Show the GM Warehouse dialog
   */
  public show(
    options: {
      width?: number;
      height?: number;
      x?: number;
      y?: number;
    } = {}
  ): void {
    // Verify that the module is available before showing
    const gm = (window as any).GuardManagement;

    if (!gm) {
      if ((globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.error(
          'Guard Management module not found. Please reload the page.'
        );
      }
      return;
    }

    if (!gm.isInitialized) {
      if ((globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.error(
          'Guard Management module still loading. Please wait a moment and try again.'
        );
      }
      return;
    }

    if (!gm.documentManager) {
      if ((globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.error(
          'Document manager not available. Please reload the module.'
        );
      }
      return;
    }

    // Create the dialog element
    this.element = this.createElement(options);

    // Add to document
    document.body.appendChild(this.element);

    // Register with focus manager
    DialogFocusManager.getInstance().registerDialog(this);

    // Add event listeners
    this.addEventListeners();

    // Load initial content
    this.loadInitialContent();

    // Give this dialog focus immediately
    DialogFocusManager.getInstance().setFocus(this);

    // Center on screen if no position specified
    if (!options.x && !options.y) {
      this.centerOnScreen();
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
    }
  }

  /**
   * Check if dialog is open
   */
  public isOpen(): boolean {
    return (
      this.element !== null &&
      document.body &&
      document.body.contains &&
      document.body.contains(this.element)
    );
  }

  /**
   * Create the dialog HTML element
   */
  private createElement(options: {
    width?: number;
    height?: number;
    x?: number;
    y?: number;
  }): HTMLElement {
    const dialog = document.createElement('div');
    dialog.className = 'gm-warehouse-dialog custom-dialog';

    // Set initial size and position
    const width = options.width || 800;
    const height = options.height || 600;
    const x = options.x || (window.innerWidth - width) / 2;
    const y = options.y || (window.innerHeight - height) / 2;

    // Only set position and size, z-index comes from CSS
    dialog.style.left = `${x}px`;
    dialog.style.top = `${y}px`;
    dialog.style.width = `${width}px`;
    dialog.style.height = `${height}px`;
    dialog.style.position = 'fixed';

    dialog.tabIndex = -1; // Make focusable for keyboard events

    dialog.innerHTML = '';

    // Render using lit-html templates
    const dialogTemplate = this.renderDialogTemplate();
    safeRender(dialogTemplate, dialog);

    return dialog;
  }

  /**
   * Render the complete dialog template
   */
  private renderDialogTemplate(): TemplateResult {
    return html`
      <div class="custom-dialog-header">
        <h2 class="custom-dialog-title-text">GM Warehouse - Template Storage</h2>
        <button class="custom-dialog-close" type="button" aria-label="Close">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="custom-dialog-body">${this.renderWarehouseContent()}</div>
    `;
  }

  /**
   * Render warehouse content using lit-html
   */
  private renderWarehouseContent(): TemplateResult {
    return html`
      <div class="gm-warehouse-container">
        ${this.renderWarehouseTabs()} ${this.renderWarehouseMainContent()}
      </div>
    `;
  }

  /**
   * Render warehouse navigation tabs
   */
  private renderWarehouseTabs(): TemplateResult {
    return html`
      <div class="warehouse-tabs">
        <nav class="tabs" data-group="warehouse-tabs">
          <a class="item tab active" data-tab="resources">
            <i class="fas fa-boxes"></i>
            Resources
          </a>
          <a class="item tab" data-tab="reputation">
            <i class="fas fa-handshake"></i>
            Reputation
          </a>
          <a class="item tab" data-tab="patrol-effects">
            <i class="fas fa-magic"></i>
            Patrol Effects
          </a>
          <a class="item tab" data-tab="guard-modifiers">
            <i class="fas fa-shield-alt"></i>
            Guard Modifiers
          </a>
        </nav>
      </div>
    `;
  }

  /**
   * Render warehouse main content area
   */
  private renderWarehouseMainContent(): TemplateResult {
    return html`
      <div class="warehouse-content">
        ${this.renderResourcesTab()} ${this.renderReputationTab()} ${this.renderPatrolEffectsTab()}
        ${this.renderGuardModifiersTab()}
      </div>
    `;
  }

  /**
   * Render resources tab content
   */
  private renderResourcesTab(): TemplateResult {
    // Initialize with empty state, will be populated async
    return html`
      <section class="tab-content active" data-tab="resources">
        <div class="content-header">
          <h3>Resources Templates</h3>
          <button type="button" class="add-resource-btn">
            <i class="fas fa-plus"></i>
            Add Resource Template
          </button>
        </div>
        <div class="templates-list resources-list">
          <p class="loading-state">Loading resources...</p>
        </div>
      </section>
    `;
  }

  /**
   * Get resource templates from DocumentBasedManager
   */
  private async getResourceTemplates(): Promise<any[]> {
    try {
      const gm = (window as any).GuardManagement;

      if (!gm || !gm.isInitialized || !gm.documentManager) {
        this.resourceTemplates = [];
        return this.resourceTemplates;
      }

      // Get all resources from DocumentBasedManager (these serve as templates in GM Warehouse)
      this.resourceTemplates = await gm.documentManager.getGuardResources();
      return this.resourceTemplates;
    } catch (error) {
      console.error('Error loading resource templates from DocumentBasedManager:', error);
      this.resourceTemplates = [];
      return this.resourceTemplates;
    }
  }

  /**
   * Load initial content when dialog opens
   */
  private async loadInitialContent(): Promise<void> {
    // Load resources tab content
    await this.refreshResourcesTab();
  }

  /**
   * Render individual resource template
   */
  private renderResourceTemplate(resource: any): TemplateResult {
    const imageUrl = resource.system?.image || resource.image || '';

    return html`
      <div
        class="template-item resource-template"
        data-resource-id="${resource.id}"
        draggable="true"
        title="Arrastra este recurso a una organización para asignarlo"
      >
        ${imageUrl
          ? html`
              <div class="template-image">
                <img src="${imageUrl}" alt="${resource.name}" onerror="this.style.display='none'" />
              </div>
            `
          : ''}
        <div class="template-info">
          <div class="template-name">${resource.name}</div>
          <div class="template-description">
            ${(resource.system?.description || resource.description || 'Sin descripción').trim()}
          </div>
          <div class="template-quantity">Cantidad: ${resource.quantity}</div>
        </div>
        <div class="template-actions">
          <button type="button" class="edit-template-btn" title="Editar template">
            <i class="fas fa-edit"></i>
          </button>
          <button type="button" class="duplicate-template-btn" title="Duplicar template">
            <i class="fas fa-copy"></i>
          </button>
          <button type="button" class="delete-template-btn" title="Eliminar template">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render reputation tab content
   */
  private renderReputationTab(): TemplateResult {
    return html`
      <section class="tab-content" data-tab="reputation">
        <div class="content-header">
          <h3>Reputation Templates</h3>
          <button type="button" class="add-reputation-btn">
            <i class="fas fa-plus"></i>
            Add Reputation Template
          </button>
        </div>
        <div class="templates-list reputation-list">
          <p class="empty-state">No reputation templates created yet</p>
        </div>
      </section>
    `;
  }

  /**
   * Render patrol effects tab content
   */
  private renderPatrolEffectsTab(): TemplateResult {
    return html`
      <section class="tab-content" data-tab="patrol-effects">
        <div class="content-header">
          <h3>Patrol Effects Templates</h3>
          <button type="button" class="add-patrol-effect-btn">
            <i class="fas fa-plus"></i>
            Add Patrol Effect Template
          </button>
        </div>
        <div class="templates-list patrol-effects-list">
          <p class="empty-state">No patrol effect templates created yet</p>
        </div>
      </section>
    `;
  }

  /**
   * Render guard modifiers tab content
   */
  private renderGuardModifiersTab(): TemplateResult {
    return html`
      <section class="tab-content" data-tab="guard-modifiers">
        <div class="content-header">
          <h3>Guard Modifiers Templates</h3>
          <button type="button" class="add-guard-modifier-btn">
            <i class="fas fa-plus"></i>
            Add Guard Modifier Template
          </button>
        </div>
        <div class="templates-list guard-modifiers-list">
          <p class="empty-state">No guard modifier templates created yet</p>
        </div>
      </section>
    `;
  }

  /**
   * Add event listeners
   */
  private addEventListeners(): void {
    if (!this.element) return;

    // Close button
    const closeButton = this.element.querySelector('.custom-dialog-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => this.close());
    }

    // Tab switching functionality
    const tabs = this.element.querySelectorAll('.tab[data-tab]');
    tabs.forEach((tab) => {
      tab.addEventListener('click', (event) => {
        event.preventDefault();
        const target = event.currentTarget as HTMLElement;
        const tabName = target.getAttribute('data-tab');
        if (!tabName) return;

        const container = target.closest('.gm-warehouse-container');
        if (!container) return;

        // Remove active class from all tabs and contents
        container.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
        container
          .querySelectorAll('.tab-content')
          .forEach((content) => content.classList.remove('active'));

        // Add active class to clicked tab and corresponding content
        target.classList.add('active');
        const content = container.querySelector(`.tab-content[data-tab="${tabName}"]`);
        if (content) content.classList.add('active');
      });
    });

    // Handle add buttons
    const addButtons = this.element.querySelectorAll('[class*="add-"][class*="-btn"]');
    addButtons.forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        const target = event.currentTarget as HTMLElement;
        const classList = target.className;
        let templateType = '';

        if (classList.includes('add-resource-btn')) templateType = 'resource';
        else if (classList.includes('add-reputation-btn')) templateType = 'reputation';
        else if (classList.includes('add-patrol-effect-btn')) templateType = 'patrol-effect';
        else if (classList.includes('add-guard-modifier-btn')) templateType = 'guard-modifier';

        if (templateType === 'resource') {
          await this.handleAddResource();
        } else if (templateType) {
          console.log(`Adding new ${templateType} template - functionality to be implemented`);
          if ((globalThis as any).ui?.notifications) {
            (globalThis as any).ui.notifications.info(
              `Adding ${templateType} template - Coming soon!`
            );
          }
        }
      });
    });

    // Keyboard events
    this.element.addEventListener('keydown', this.handleKeyDown);

    // Mouse events for dragging (header)
    const header = this.element.querySelector('.custom-dialog-header');
    if (header) {
      header.addEventListener('mousedown', (event: Event) =>
        this.handleMouseDown(event as MouseEvent)
      );
    }

    // Global mouse events
    document.addEventListener('mousemove', (event: Event) =>
      this.handleMouseMove(event as MouseEvent)
    );
    document.addEventListener('mouseup', () => this.handleMouseUp());

    // Focus management
    this.element.addEventListener('focus', this.handleFocus);
    this.element.addEventListener('click', this.handleGlobalClick);
    document.addEventListener('click', this.handleGlobalClick);

    // Listen for resource events from other dialogs
    this.setupResourceEventListeners();
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('click', this.handleGlobalClick);

    // Remove resource event listeners
    if (this.resourceUpdateHandler) {
      document.removeEventListener('guard-resource-updated', this.resourceUpdateHandler);
    }
    if (this.resourceDeleteHandler) {
      document.removeEventListener('guard-resource-deleted', this.resourceDeleteHandler);
    }
  }

  /**
   * Setup event listeners for resource updates from other dialogs
   */
  private setupResourceEventListeners(): void {
    // Listen for resource updates from other dialogs (like CustomInfoDialog)
    this.resourceUpdateHandler = (event: Event) => {
      console.log('🔄 Warehouse received resource update event:', event);
      // Refresh the resources tab to show the updated resource
      this.refreshResourcesTab();
    };

    this.resourceDeleteHandler = (event: Event) => {
      console.log('🗑️ Warehouse received resource delete event:', event);
      // Refresh the resources tab to remove the deleted resource
      this.refreshResourcesTab();
    };

    // Add the event listeners
    document.addEventListener('guard-resource-updated', this.resourceUpdateHandler);
    document.addEventListener('guard-resource-deleted', this.resourceDeleteHandler);

    console.log('✅ Warehouse resource event listeners set up');
  }

  /**
   * Center dialog on screen
   */
  private centerOnScreen(): void {
    if (!this.element || !this.element.getBoundingClientRect) return;

    const rect = this.element.getBoundingClientRect();
    const x = (window.innerWidth - rect.width) / 2;
    const y = (window.innerHeight - rect.height) / 2;

    this.element.style.left = `${Math.max(0, x)}px`;
    this.element.style.top = `${Math.max(0, y)}px`;
  }

  /**
   * Handle mouse down events for dragging
   */
  private handleMouseDown(event: MouseEvent): void {
    if (!this.element) return;

    const target = event.target as HTMLElement;
    if (target.closest('.custom-dialog-header')) {
      this.isDragging = true;
      const rect = this.element.getBoundingClientRect();
      this.dragOffset.x = event.clientX - rect.left;
      this.dragOffset.y = event.clientY - rect.top;
      event.preventDefault();
    }
  }

  /**
   * Handle mouse move events for dragging
   */
  private handleMouseMove(event: MouseEvent): void {
    if (!this.element || !this.isDragging) return;

    const x = event.clientX - this.dragOffset.x;
    const y = event.clientY - this.dragOffset.y;

    this.element.style.left = `${Math.max(0, Math.min(x, window.innerWidth - this.element.offsetWidth))}px`;
    this.element.style.top = `${Math.max(0, Math.min(y, window.innerHeight - this.element.offsetHeight))}px`;
  }

  /**
   * Handle mouse up events for dragging
   */
  private handleMouseUp(): void {
    this.isDragging = false;
    this.isResizing = false;
  }

  /**
   * Handle keyboard events
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.close();
    }
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
   * Handle adding a new resource template
   */
  private async handleAddResource(): Promise<void> {
    try {
      // Use a generic organization ID for templates (GM warehouse)
      const templateOrganizationId = 'gm-warehouse-templates';

      const newResource = await AddOrEditResourceDialog.create(templateOrganizationId);

      if (newResource) {
        console.log('Recurso template creado:', newResource);

        // Save using DocumentBasedManager instead of localStorage
        try {
          const gm = (window as any).GuardManagement;

          if (!gm) {
            throw new Error('GuardManagement module not loaded');
          }

          if (!gm.isInitialized) {
            throw new Error('GuardManagement module not fully initialized');
          }

          if (!gm.documentManager) {
            throw new Error('DocumentBasedManager not available');
          }

          const createdResource = await gm.documentManager.createGuardResource(newResource);
          if (createdResource) {
            console.log('Resource template saved via DocumentBasedManager');

            // Refresh templates list from DocumentBasedManager
            await this.refreshResourcesTab();
          } else {
            throw new Error('Failed to create resource via DocumentBasedManager');
          }
        } catch (error) {
          console.error('Error saving resource template via DocumentBasedManager:', error);
          if ((globalThis as any).ui?.notifications) {
            (globalThis as any).ui.notifications.error('Error guardando template de recurso');
          }
          return;
        }

        // Show success message
        if ((globalThis as any).ui?.notifications) {
          (globalThis as any).ui.notifications.info(
            `Template de recurso "${newResource.name}" creado exitosamente`
          );
        }
      }
    } catch (error) {
      console.error('Error creando template de recurso:', error);
      if ((globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.error('Error al crear el template de recurso');
      }
    }
  }

  /**
   * Refresh the resources tab content
   */
  private async refreshResourcesTab(): Promise<void> {
    if (!this.element) return;

    const resourcesList = this.element.querySelector('.resources-list');
    if (resourcesList) {
      const resourceTemplates = await this.getResourceTemplates();

      // Clear current content
      resourcesList.innerHTML = '';

      if (resourceTemplates.length > 0) {
        // Add each resource template
        resourceTemplates.forEach((resource) => {
          const templateElement = document.createElement('div');
          const templateContent = this.renderResourceTemplate(resource);
          safeRender(templateContent, templateElement);

          if (templateElement.firstElementChild) {
            resourcesList.appendChild(templateElement.firstElementChild);
          }
        });
      } else {
        // Show empty state
        const emptyStateElement = document.createElement('p');
        emptyStateElement.className = 'empty-state';
        emptyStateElement.textContent = 'No resource templates created yet';
        resourcesList.appendChild(emptyStateElement);
      }

      // Re-add event listeners only for the new template items
      this.addTemplateEventListeners();
    }
  }

  /**
   * Add event listeners specifically for template items
   */
  private addTemplateEventListeners(): void {
    if (!this.element) return;

    // Handle edit template buttons
    const editButtons = this.element.querySelectorAll('.edit-template-btn');
    editButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const templateItem = button.closest('.template-item') as HTMLElement;
        const resourceId = templateItem?.dataset.resourceId;
        if (resourceId) {
          this.handleEditTemplate(resourceId);
        }
      });
    });

    // Handle duplicate template buttons
    const duplicateButtons = this.element.querySelectorAll('.duplicate-template-btn');
    duplicateButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const templateItem = button.closest('.template-item') as HTMLElement;
        const resourceId = templateItem?.dataset.resourceId;
        if (resourceId) {
          this.handleDuplicateTemplate(resourceId);
        }
      });
    });

    // Handle delete template buttons
    const deleteButtons = this.element.querySelectorAll('.delete-template-btn');
    deleteButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const templateItem = button.closest('.template-item') as HTMLElement;
        const resourceId = templateItem?.dataset.resourceId;
        if (resourceId) {
          this.handleDeleteTemplate(resourceId);
        }
      });
    });

    // Handle drag start for resource templates
    const resourceTemplates = this.element.querySelectorAll('.resource-template[draggable="true"]');
    resourceTemplates.forEach((template) => {
      template.addEventListener('dragstart', (event) => {
        this.handleResourceDragStart(event as DragEvent);
      });

      template.addEventListener('dragend', (event) => {
        this.handleResourceDragEnd(event as DragEvent);
      });
    });
  }

  /**
   * Handle drag start for resource templates
   */
  private handleResourceDragStart(event: DragEvent): void {
    const target = event.target as HTMLElement;
    const resourceTemplate = target.closest('.resource-template') as HTMLElement;

    if (!resourceTemplate || !event.dataTransfer) return;

    const resourceId = resourceTemplate.dataset.resourceId;
    if (!resourceId) return;

    // Get the resource data from the documentManager
    const gm = (window as any).GuardManagement;
    if (!gm?.documentManager) {
      console.error('DocumentManager not available for drag operation');
      return;
    }

    const resource = gm.documentManager.getGuardResources().find((r: any) => r.id === resourceId);
    if (!resource) {
      console.error('Resource not found for drag operation:', resourceId);
      return;
    }

    // Set the drag data
    const dragData = {
      type: 'guard-resource',
      resourceId: resource.id,
      resourceData: {
        id: resource.id,
        name: resource.name,
        description: resource.system?.description || resource.description,
        quantity: resource.system?.quantity || resource.quantity,
        version: resource.system?.version || resource.version || 1,
      },
    };

    event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
    event.dataTransfer.effectAllowed = 'copy';

    // Visual feedback
    resourceTemplate.style.opacity = '0.6';

    console.log('Starting drag for resource:', dragData);
  }

  /**
   * Handle drag end for resource templates
   */
  private handleResourceDragEnd(event: DragEvent): void {
    const target = event.target as HTMLElement;
    const resourceTemplate = target.closest('.resource-template') as HTMLElement;

    if (resourceTemplate) {
      // Restore visual state
      resourceTemplate.style.opacity = '1';
    }
  }

  private async handleEditTemplate(resourceId: string): Promise<void> {
    console.log('✏️ Edit resource request:', resourceId);

    const gm = (window as any).GuardManagement;
    if (!gm?.documentManager) {
      console.error('❌ DocumentBasedManager not available');
      return;
    }

    try {
      // Get the resource to edit
      const resources = gm.documentManager.getGuardResources();
      const resource = resources.find((r: any) => r.id === resourceId);

      if (!resource) {
        console.error('❌ Resource not found:', resourceId);
        if ((globalThis as any).ui?.notifications) {
          (globalThis as any).ui.notifications.error('Recurso no encontrado');
        }
        return;
      }

      // Convert Foundry document to our Resource type
      const resourceData = {
        id: resource.id,
        name: resource.name,
        description: resource.system?.description || '',
        quantity: resource.system?.quantity || 0,
        image: resource.system?.image || '',
        organizationId: resource.system?.organizationId || '',
        version: resource.system?.version || 1,
        createdAt: resource.system?.createdAt || new Date(),
        updatedAt: resource.system?.updatedAt || new Date(),
      };

      console.log('📝 Opening edit dialog for resource:', resourceData);

      // Show edit dialog
      const updatedResource = await AddOrEditResourceDialog.edit(resourceData);

      if (updatedResource) {
        console.log('✅ Resource returned from dialog:', updatedResource);

        // IMPORTANT: Save the updated resource to the database using DocumentBasedManager
        try {
          const updateSuccess = await gm.documentManager.updateGuardResource(
            updatedResource.id,
            updatedResource
          );

          if (updateSuccess) {
            console.log('💾 Resource saved to database successfully');

            // Show success notification
            if ((globalThis as any).ui?.notifications) {
              (globalThis as any).ui.notifications.info(
                `Recurso "${updatedResource.name}" actualizado correctamente`
              );
            }

            // Refresh the warehouse dialog to show the updated resource
            await this.refreshResourcesTab();

            // Emit custom event to notify other dialogs (like CustomInfoDialog)
            document.dispatchEvent(
              new CustomEvent('guard-resource-updated', {
                detail: {
                  resourceId: updatedResource.id,
                  updatedResource: updatedResource,
                  oldName: resourceData.name,
                  newName: updatedResource.name,
                },
              })
            );

            console.log('🔄 Resource update notifications sent');
          } else {
            console.error('❌ Failed to save resource to database');
            if ((globalThis as any).ui?.notifications) {
              (globalThis as any).ui.notifications.error(
                'Error al guardar el recurso en la base de datos'
              );
            }
          }
        } catch (saveError) {
          console.error('❌ Error saving resource to database:', saveError);
          if ((globalThis as any).ui?.notifications) {
            (globalThis as any).ui.notifications.error('Error al guardar el recurso');
          }
        }
      } else {
        console.log('❌ Resource edit cancelled or failed');
      }
    } catch (error) {
      console.error('❌ Error editing resource:', error);
      if ((globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.error('Error al editar el recurso');
      }
    }
  }

  /**
   * Handle duplicating a template (placeholder)
   */
  private handleDuplicateTemplate(resourceId: string): void {
    console.log('Duplicate template:', resourceId);
    // TODO: Implement duplicate functionality
  }

  /**
   * Show confirmation dialog for deleting a resource permanently
   */
  private async showDeleteResourceDialog(resourceName: string): Promise<boolean> {
    try {
      // Use foundry's built-in confirmation dialog
      const result = await Dialog.confirm({
        title: 'Confirmar Eliminación Permanente',
        content: `
          <div style="margin-bottom: 1rem;">
            <i class="fas fa-exclamation-triangle" style="color: #ff6b6b; margin-right: 0.5rem;"></i>
            <strong>¡ATENCIÓN! Eliminación Permanente</strong>
          </div>
          <p>¿Estás seguro de que deseas eliminar permanentemente el recurso "<strong>${resourceName}</strong>"?</p>
          <p><strong style="color: #ff6b6b;">Esta acción NO se puede deshacer.</strong></p>
          <p><small>El recurso será removido de todas las organizaciones y eliminado completamente del sistema.</small></p>
        `,
        yes: () => true,
        no: () => false,
        defaultYes: false,
      });

      return result;
    } catch (error) {
      console.error('Error showing delete confirmation dialog:', error);
      // Fallback to browser confirm if Dialog fails
      return confirm(
        `¿Deseas eliminar permanentemente el recurso "${resourceName}"? Esta acción NO se puede deshacer.`
      );
    }
  }

  /**
   * Handle deleting a resource permanently
   */
  private async handleDeleteTemplate(resourceId: string): Promise<void> {
    console.log('🗑️ Delete resource request:', resourceId);

    const gm = (window as any).GuardManagement;
    if (!gm?.documentManager) {
      console.error('❌ DocumentBasedManager not available');
      return;
    }

    try {
      // Get the resource first to show its name in confirmation
      const resources = gm.documentManager.getGuardResources();
      const resource = resources.find((r: any) => r.id === resourceId);

      if (!resource) {
        console.error('❌ Resource not found:', resourceId);
        if ((globalThis as any).ui?.notifications) {
          (globalThis as any).ui.notifications.error('Recurso no encontrado');
        }
        return;
      }

      const resourceName = resource.name || 'Recurso sin nombre';

      // Show confirmation dialog
      const confirmed = await this.showDeleteResourceDialog(resourceName);
      if (!confirmed) {
        console.log('❌ Resource deletion cancelled by user');
        return;
      }

      // Check if resource is assigned to any organization before deleting
      const organizations = gm.documentManager.getGuardOrganizations();
      const assignedOrganizations = organizations.filter((org: any) =>
        org.system?.resources?.includes(resourceId)
      );

      if (assignedOrganizations.length > 0) {
        console.log(`🔍 Resource is assigned to ${assignedOrganizations.length} organizations`);
      }

      // Use the DocumentBasedManager method to delete the resource and clean up references
      const deleted = await gm.documentManager.deleteGuardResource(resourceId);

      if (!deleted) {
        console.error('❌ Failed to delete resource');
        if ((globalThis as any).ui?.notifications) {
          (globalThis as any).ui.notifications.error('Error al eliminar el recurso');
        }
        return;
      }

      // Show success notification
      if ((globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.info(
          `Recurso "${resourceName}" eliminado permanentemente`
        );
      }

      // Refresh the warehouse dialog to remove the deleted resource
      this.refreshResourcesTab();

      // Emit custom event to notify other dialogs
      document.dispatchEvent(
        new CustomEvent('guard-resource-deleted', {
          detail: { resourceId, resourceName },
        })
      );
    } catch (error) {
      console.error('❌ Error deleting resource:', error);
      if ((globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.error('Error al eliminar el recurso');
      }
    }
  }

  /**
   * Static method to show the warehouse dialog
   */
  static show(options?: {
    width?: number;
    height?: number;
    x?: number;
    y?: number;
  }): GMWarehouseDialog {
    try {
      // Check if window exists
      if (typeof window === 'undefined') {
        throw new Error('Window object not available');
      }

      // Verify that GuardManagement module is available
      const gm = (window as any).GuardManagement;

      if (!gm) {
        throw new Error('GuardManagement module not loaded yet');
      }

      if (!gm.isInitialized) {
        throw new Error('GuardManagement module not fully initialized yet');
      }

      if (!gm.documentManager) {
        throw new Error('DocumentBasedManager not initialized yet');
      }

      const dialog = new GMWarehouseDialog();
      dialog.show(options);
      return dialog;
    } catch (error) {
      console.error('Error creating GM Warehouse dialog:', error);
      if (error instanceof Error && error.message.includes('Only GM can access')) {
        if ((globalThis as any).ui?.notifications) {
          (globalThis as any).ui.notifications.error(
            'Solo el GM puede acceder al almacén de plantillas'
          );
        }
      } else if (
        error instanceof Error &&
        (error.message.includes('not loaded') || error.message.includes('not initialized'))
      ) {
        if ((globalThis as any).ui?.notifications) {
          (globalThis as any).ui.notifications.warn(
            'Módulo aún no está completamente cargado. Intenta de nuevo en un momento.'
          );
        }
      }
      throw error;
    }
  }
}
