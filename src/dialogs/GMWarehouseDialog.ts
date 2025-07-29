import { html, TemplateResult } from 'lit-html';
import { REPUTATION_LABELS, ReputationLevel } from '../types/entities.js';
import { ResourceTemplate } from '../ui/ResourceTemplate.js';
import { DialogFocusManager, type FocusableDialog } from '../utils/dialog-focus-manager.js';
import { DOMEventSetup } from '../utils/DOMEventSetup.js';
import { convertFoundryDocumentToResource } from '../utils/resource-converter.js';
import { ResourceErrorHandler } from '../utils/ResourceErrorHandler.js';
import { ResourceEventHandler, type ResourceEventContext } from '../utils/ResourceEventHandler.js';
import { safeRender } from '../utils/template-renderer.js';

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
  private uiRefreshHandler?: (event: Event) => void;

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
   * Get reputation templates from DocumentBasedManager
   */
  private async getReputationTemplates(): Promise<any[]> {
    try {
      const gm = (window as any).GuardManagement;

      if (!gm || !gm.isInitialized || !gm.documentManager) {
        this.reputationTemplates = [];
        return this.reputationTemplates;
      }

      // Get all reputations from DocumentBasedManager (these serve as templates in GM Warehouse)
      this.reputationTemplates = await gm.documentManager.getGuardReputations();
      return this.reputationTemplates;
    } catch (error) {
      console.error('Error loading reputation templates from DocumentBasedManager:', error);
      this.reputationTemplates = [];
      return this.reputationTemplates;
    }
  }

  /**
   * Load initial content when dialog opens
   */
  private async loadInitialContent(): Promise<void> {
    // Load resources tab content
    await this.refreshResourcesTab();
    // Load reputation tab content
    await this.refreshReputationTab();
  }

  /**
   * Render individual resource template
   */
  private renderResourceTemplate(resource: any): TemplateResult {
    // Use the unified conversion function to ensure consistency
    const resourceData = convertFoundryDocumentToResource(resource);

    return html`
      <div
        class="template-item resource-template"
        data-resource-id="${resourceData.id}"
        draggable="true"
        title="Arrastra este recurso a una organización para asignarlo"
      >
        ${resourceData.image
          ? html`
              <div class="template-image">
                <img
                  src="${resourceData.image}"
                  alt="${resourceData.name}"
                  onerror="this.style.display='none'"
                />
              </div>
            `
          : ''}
        <div class="template-info">
          <div class="template-name">${resourceData.name}</div>
          <div class="template-description">
            ${(resourceData.description || 'Sin descripción').trim()}
          </div>
          <div class="template-quantity">Cantidad: ${resourceData.quantity}</div>
        </div>
        <div class="template-actions">
          <button
            type="button"
            class="send-to-chat-template-btn"
            title="Enviar al chat"
            data-resource-id="${resourceData.id}"
          >
            <i class="fas fa-comment"></i>
          </button>
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
   * Render individual reputation template
   */
  private renderReputationTemplate(reputation: any): TemplateResult {
    // Convert to reputation data
    const reputationData = {
      id: reputation.id,
      name: reputation.name,
      description: reputation.system?.description || '',
      level: reputation.system?.level || 4, // Default to Neutrales
      image: reputation.img || '',
      organizationId: reputation.system?.organizationId || '',
    };

    const levelLabel =
      REPUTATION_LABELS[reputationData.level as ReputationLevel] || `Level ${reputationData.level}`;

    return html`
      <div
        class="template-item reputation-template"
        data-reputation-id="${reputationData.id}"
        draggable="true"
        title="Arrastra esta reputación a una organización para asignarla"
      >
        ${reputationData.image
          ? html`
              <div class="template-image">
                <img
                  src="${reputationData.image}"
                  alt="${reputationData.name}"
                  onerror="this.style.display='none'"
                />
              </div>
            `
          : ''}
        <div class="template-info">
          <div class="template-name">${reputationData.name}</div>
          <div class="template-description">
            ${(reputationData.description || 'Sin descripción').trim()}
          </div>
          <div class="template-level">Nivel: ${levelLabel}</div>
        </div>
        <div class="template-actions">
          <button
            type="button"
            class="send-to-chat-template-btn"
            title="Enviar al chat"
            data-reputation-id="${reputationData.id}"
          >
            <i class="fas fa-comment"></i>
          </button>
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
          <p class="empty-state">Loading reputation templates...</p>
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
        } else if (templateType === 'reputation') {
          await this.handleAddReputation();
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

    // Setup resource event handlers using centralized approach
    DOMEventSetup.setupOrRetry(
      ['.add-resource-btn', '.edit-resource-btn', '.delete-resource-btn'],
      () => this.setupResourceEventListeners(),
      3
    );
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('click', this.handleGlobalClick);

    // Remove resource event listeners from window
    if (this.resourceUpdateHandler) {
      window.removeEventListener('guard-resource-updated', this.resourceUpdateHandler);
    }
    if (this.resourceDeleteHandler) {
      window.removeEventListener('guard-resource-deleted', this.resourceDeleteHandler);
    }
    if (this.uiRefreshHandler) {
      window.removeEventListener('guard-ui-refresh', this.uiRefreshHandler);
    }
  }

  /**
   * Setup event listeners using centralized resource handler
   */
  private setupResourceEventListeners(): void {
    const context: ResourceEventContext = {
      organizationId: 'gm-warehouse-templates',
      onResourceAdded: (resource) => {
        console.log('Resource template added:', resource);
        this.refreshResourcesTab();
      },
      onResourceEdited: (resource) => {
        console.log('Resource template edited:', resource);
        this.refreshResourcesTab();
      },
      onResourceRemoved: (resourceId) => {
        console.log('Resource template removed:', resourceId);
        this.refreshResourcesTab();
      },
      refreshUI: () => this.refreshResourcesTab(),
    };

    ResourceEventHandler.setup(context);

    // Also setup window event listeners for external events
    this.resourceUpdateHandler = (_event: Event) => {
      this.refreshResourcesTab();
    };

    this.resourceDeleteHandler = (_event: Event) => {
      this.refreshResourcesTab();
    };

    // Listen for general UI refresh events
    this.uiRefreshHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail;

      // Only refresh if it's related to resources
      if (detail.documentType === 'guard-management.guard-resource') {
        this.refreshResourcesTab();
      }
    };

    // Add the event listeners to window (where DocumentEventManager emits them)
    window.addEventListener('guard-resource-updated', this.resourceUpdateHandler);
    window.addEventListener('guard-resource-deleted', this.resourceDeleteHandler);
    window.addEventListener('guard-ui-refresh', this.uiRefreshHandler);
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
   * Handle adding a new resource template using centralized error handling
   */
  private async handleAddResource(): Promise<void> {
    await ResourceErrorHandler.handleResourceOperation(
      async () => {
        // Import AddOrEditResourceDialog dynamically to avoid circular dependency
        const { AddOrEditResourceDialog } = await import('./AddOrEditResourceDialog.js');

        const templateOrganizationId = 'gm-warehouse-templates';
        const newResource = await AddOrEditResourceDialog.create(templateOrganizationId);

        if (newResource) {
          const gm = (window as any).GuardManagement;
          if (!gm?.documentManager) {
            throw new Error('DocumentBasedManager not available');
          }

          const createdResource = await gm.documentManager.createGuardResource(newResource);
          if (!createdResource) {
            throw new Error('Failed to create resource via DocumentBasedManager');
          }

          await this.refreshResourcesTab();
          return createdResource;
        }

        return null;
      },
      'create',
      'template de recurso'
    );
  }

  /**
   * Handle adding a new reputation template
   */
  private async handleAddReputation(): Promise<void> {
    try {
      // Import AddOrEditReputationDialog dynamically to avoid circular dependency
      const { AddOrEditReputationDialog } = await import('./AddOrEditReputationDialog.js');

      const templateOrganizationId = 'gm-warehouse-templates';
      const newReputation = await AddOrEditReputationDialog.create(templateOrganizationId);

      if (newReputation) {
        const gm = (window as any).GuardManagement;
        if (!gm?.documentManager) {
          throw new Error('DocumentBasedManager not available');
        }

        const createdReputation = await gm.documentManager.createGuardReputation(newReputation);
        if (!createdReputation) {
          throw new Error('Failed to create reputation via DocumentBasedManager');
        }

        await this.refreshReputationTab();

        // Show success notification
        if ((globalThis as any).ui?.notifications) {
          (globalThis as any).ui.notifications.info(
            `Reputation template "${newReputation.name}" created successfully`
          );
        }
      }
    } catch (error) {
      console.error('Error adding reputation template:', error);
      if ((globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.error('Error creating reputation template');
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
   * Refresh the reputation tab content
   */
  private async refreshReputationTab(): Promise<void> {
    if (!this.element) return;

    const reputationsList = this.element.querySelector('.reputation-list');
    if (reputationsList) {
      const reputationTemplates = await this.getReputationTemplates();

      // Clear current content
      reputationsList.innerHTML = '';

      if (reputationTemplates.length > 0) {
        // Add each reputation template
        reputationTemplates.forEach((reputation) => {
          const templateElement = document.createElement('div');
          const templateContent = this.renderReputationTemplate(reputation);
          safeRender(templateContent, templateElement);

          if (templateElement.firstElementChild) {
            reputationsList.appendChild(templateElement.firstElementChild);
          }
        });
      } else {
        // Show empty state
        const emptyStateElement = document.createElement('p');
        emptyStateElement.className = 'empty-state';
        emptyStateElement.textContent = 'No reputation templates created yet';
        reputationsList.appendChild(emptyStateElement);
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

    // Handle send to chat template buttons
    const sendToChatButtons = this.element.querySelectorAll('.send-to-chat-template-btn');
    sendToChatButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const templateItem = button.closest('.template-item') as HTMLElement;
        const resourceId = templateItem?.dataset.resourceId;
        const reputationId = templateItem?.dataset.reputationId;

        if (resourceId) {
          this.handleSendTemplateToChat(resourceId);
        } else if (reputationId) {
          this.handleSendReputationTemplateToChat(reputationId);
        }
      });
    });

    // Handle edit template buttons
    const editButtons = this.element.querySelectorAll('.edit-template-btn');
    editButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const templateItem = button.closest('.template-item') as HTMLElement;
        const resourceId = templateItem?.dataset.resourceId;
        const reputationId = templateItem?.dataset.reputationId;

        if (resourceId) {
          this.handleEditTemplate(resourceId);
        } else if (reputationId) {
          this.handleEditReputationTemplate(reputationId);
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
        const reputationId = templateItem?.dataset.reputationId;

        if (resourceId) {
          this.handleDuplicateTemplate(resourceId);
        } else if (reputationId) {
          this.handleDuplicateReputationTemplate(reputationId);
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
        const reputationId = templateItem?.dataset.reputationId;

        if (resourceId) {
          this.handleDeleteTemplate(resourceId);
        } else if (reputationId) {
          this.handleDeleteReputationTemplate(reputationId);
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

    // Handle drag start for reputation templates
    const reputationTemplates = this.element.querySelectorAll(
      '.reputation-template[draggable="true"]'
    );
    console.log(`🔧 Setting up drag for ${reputationTemplates.length} reputation templates`);
    reputationTemplates.forEach((template) => {
      template.addEventListener('dragstart', (event) => {
        this.handleReputationDragStart(event as DragEvent);
      });

      template.addEventListener('dragend', (event) => {
        this.handleReputationDragEnd(event as DragEvent);
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

    // Set the drag data using unified conversion
    const resourceData = convertFoundryDocumentToResource(resource);
    const dragData = {
      type: 'guard-resource',
      resourceId: resourceData.id,
      resourceData: resourceData,
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

  /**
   * Handle drag start for reputation templates
   */
  private handleReputationDragStart(event: DragEvent): void {
    const target = event.target as HTMLElement;
    const reputationTemplate = target.closest('.reputation-template') as HTMLElement;

    if (!reputationTemplate || !event.dataTransfer) return;

    const reputationId = reputationTemplate.dataset.reputationId;
    if (!reputationId) return;

    console.log('🚀 Starting drag for reputation:', reputationId);

    // Get the reputation data from the documentManager
    const gm = (window as any).GuardManagement;
    if (!gm?.documentManager) {
      console.error('DocumentManager not available for reputation drag operation');
      return;
    }

    const reputation = gm.documentManager
      .getGuardReputations()
      .find((r: any) => r.id === reputationId);
    if (!reputation) {
      console.error('Reputation not found for drag operation:', reputationId);
      return;
    }

    // Convert to standard reputation format
    const reputationData = {
      id: reputation.id,
      name: reputation.name || 'Unnamed Reputation',
      level: reputation.system?.level || 4,
      description: reputation.system?.description || '',
      image: reputation.img || '',
      organizationId: reputation.system?.organizationId || '',
    };

    // Set the drag data
    const dragData = {
      type: 'guard-reputation',
      reputationId: reputationData.id,
      reputationData: reputationData,
    };

    event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
    event.dataTransfer.effectAllowed = 'copy';

    // Visual feedback
    reputationTemplate.style.opacity = '0.6';
    reputationTemplate.classList.add('dragging');

    console.log('✅ Drag data set for reputation:', dragData);

    // Emit custom event for cross-component communication
    document.dispatchEvent(
      new CustomEvent('guard-reputation-drag-start', {
        detail: { type: 'reputation', reputationId: reputationData.id, reputationData },
      })
    );
  }

  /**
   * Handle drag end for reputation templates
   */
  private handleReputationDragEnd(event: DragEvent): void {
    const target = event.target as HTMLElement;
    const reputationTemplate = target.closest('.reputation-template') as HTMLElement;

    if (reputationTemplate) {
      // Restore visual state
      reputationTemplate.style.opacity = '1';
      reputationTemplate.classList.remove('dragging');
    }

    console.log('🏁 Reputation drag ended');

    // Emit custom event for cross-component communication
    document.dispatchEvent(
      new CustomEvent('guard-reputation-drag-end', {
        detail: { type: 'reputation' },
      })
    );
  }

  /**
   * Handle sending template to chat
   */
  private async handleSendTemplateToChat(resourceId: string): Promise<void> {
    try {
      console.log('💬 Send template to chat request:', resourceId);

      // Send to chat using ResourceTemplate
      await ResourceTemplate.sendResourceToChat(resourceId, 'GM Warehouse');

      console.log('✅ Template sent to chat successfully');

      // Show success notification
      if ((globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.info('Recurso enviado al chat');
      }
    } catch (error) {
      console.error('❌ Error sending template to chat:', error);
      if ((globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.error('Error al enviar recurso al chat');
      }
    }
  }

  private async handleEditTemplate(resourceId: string): Promise<void> {
    await ResourceErrorHandler.handleResourceOperation(
      async () => {
        const gm = (window as any).GuardManagement;
        if (!gm?.documentManager) {
          throw new Error('DocumentBasedManager not available');
        }

        // Get the resource to edit
        const resources = gm.documentManager.getGuardResources();
        const resource = resources.find((r: any) => r.id === resourceId);

        if (!resource) {
          throw new Error('Resource not found');
        }

        // Convert Foundry document to our Resource type
        const resourceData = convertFoundryDocumentToResource(resource);

        // Import AddOrEditResourceDialog dynamically
        const { AddOrEditResourceDialog } = await import('./AddOrEditResourceDialog.js');

        // Show edit dialog
        const updatedResource = await AddOrEditResourceDialog.edit(resourceData);

        if (updatedResource) {
          // Save the updated resource to the database
          const updateSuccess = await gm.documentManager.updateGuardResource(
            updatedResource.id,
            updatedResource
          );

          if (!updateSuccess) {
            throw new Error('Failed to save resource to database');
          }

          // Refresh the warehouse dialog
          await this.refreshResourcesTab();

          // Emit custom event to notify other dialogs
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

          return updatedResource;
        }

        return null;
      },
      'update',
      `recurso`
    );
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

  // ===== REPUTATION TEMPLATE HANDLERS =====

  /**
   * Handle sending a reputation template to chat
   */
  private async handleSendReputationTemplateToChat(reputationId: string): Promise<void> {
    try {
      // TODO: Implement reputation chat functionality
      console.log('Send reputation template to chat:', reputationId);

      if ((globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.info('Sending reputation to chat - Coming soon!');
      }
    } catch (error) {
      console.error('Error sending reputation template to chat:', error);
      if ((globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.error('Error sending reputation to chat');
      }
    }
  }

  /**
   * Handle editing a reputation template
   */
  private async handleEditReputationTemplate(reputationId: string): Promise<void> {
    try {
      const gm = (window as any).GuardManagement;
      if (!gm?.documentManager) {
        throw new Error('DocumentBasedManager not available');
      }

      // Get the reputation to edit
      const reputations = gm.documentManager.getGuardReputations();
      const reputation = reputations.find((r: any) => r.id === reputationId);

      if (!reputation) {
        throw new Error('Reputation not found');
      }

      // Convert Foundry document to our Reputation type
      const reputationData = {
        id: reputation.id,
        name: reputation.name,
        description: reputation.system?.description || '',
        level: reputation.system?.level || 4,
        image: reputation.img || '',
        organizationId: reputation.system?.organizationId || '',
        version: reputation.system?.version || 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Import AddOrEditReputationDialog dynamically
      const { AddOrEditReputationDialog } = await import('./AddOrEditReputationDialog.js');

      // Show edit dialog
      const updatedReputation = await AddOrEditReputationDialog.edit(reputationData);

      if (updatedReputation) {
        // Save the updated reputation to the database
        const updateSuccess = await gm.documentManager.updateGuardReputation(
          updatedReputation.id,
          updatedReputation
        );

        if (!updateSuccess) {
          throw new Error('Failed to save reputation to database');
        }

        // Refresh the warehouse dialog
        await this.refreshReputationTab();

        // Show success notification
        if ((globalThis as any).ui?.notifications) {
          (globalThis as any).ui.notifications.info(
            `Reputation template "${updatedReputation.name}" updated successfully`
          );
        }
      }
    } catch (error) {
      console.error('Error editing reputation template:', error);
      if ((globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.error('Error editing reputation template');
      }
    }
  }

  /**
   * Handle duplicating a reputation template
   */
  private handleDuplicateReputationTemplate(reputationId: string): void {
    console.log('Duplicate reputation template:', reputationId);
    // TODO: Implement duplicate functionality for reputation
    if ((globalThis as any).ui?.notifications) {
      (globalThis as any).ui.notifications.info('Duplicate reputation template - Coming soon!');
    }
  }

  /**
   * Handle deleting a reputation template
   */
  private async handleDeleteReputationTemplate(reputationId: string): Promise<void> {
    try {
      const gm = (window as any).GuardManagement;
      if (!gm?.documentManager) {
        throw new Error('DocumentBasedManager not available');
      }

      // Get the reputation to delete for confirmation
      const reputations = gm.documentManager.getGuardReputations();
      const reputation = reputations.find((r: any) => r.id === reputationId);
      const reputationName = reputation?.name || 'Unknown Reputation';

      // Confirm deletion
      const confirmed = await Dialog.confirm({
        title: 'Delete Reputation Template',
        content: `<p>Are you sure you want to delete the reputation template "<strong>${reputationName}</strong>"?</p><p><em>This action cannot be undone.</em></p>`,
        defaultYes: false,
      });

      if (!confirmed) return;

      // Delete the reputation
      const deleteSuccess = await gm.documentManager.deleteGuardReputation(reputationId);
      if (!deleteSuccess) {
        throw new Error('Failed to delete reputation from database');
      }

      // Refresh the warehouse dialog
      await this.refreshReputationTab();

      // Show success notification
      if ((globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.info(
          `Reputation template "${reputationName}" deleted successfully`
        );
      }
    } catch (error) {
      console.error('Error deleting reputation template:', error);
      if ((globalThis as any).ui?.notifications) {
        (globalThis as any).ui.notifications.error('Error deleting reputation template');
      }
    }
  }
}
