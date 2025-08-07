/**
 * Custom Info Dialog - Movable and resizable HTML dialog without using Foundry's Dialog system
 */

import { html, TemplateResult } from 'lit-html';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import { AddOrEditReputationDialog } from '../dialogs/AddOrEditReputationDialog.js';
import type { GuardOrganization } from '../types/entities';
import { DialogFocusManager, type FocusableDialog } from '../utils/dialog-focus-manager.js';
import { convertFoundryDocumentToResource } from '../utils/resource-converter.js';
// Import CSS for drag & drop styling
import '../styles/custom-info-dialog.css';
import { classifyLastOrderAge } from '../utils/patrol-helpers.js';
import { ConfirmService } from '../utils/services/ConfirmService.js';
import { NotificationService } from '../utils/services/NotificationService.js';
import { renderTemplateToString, safeRender } from '../utils/template-renderer.js';
import { ReputationTemplate } from './ReputationTemplate.js';
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
  // Tab state keys
  private static readonly TAB_LS_KEY = 'guard-management.infoDialog.selectedTab';
  private tabsInitialized = false;
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
    this.initTabs(dialog);

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
      const newContainer = document.createElement('div');
      newContainer.className = 'organization-content';
      contentElement.innerHTML = '';
      contentElement.appendChild(newContainer);
      const organizationTemplate = this.renderOrganizationContent(organization);
      safeRender(organizationTemplate, newContainer);
      // allow tabs to re-bind after each refresh
      this.tabsInitialized = false;
      this.initTabs(this.element!);
      console.log('✅ Dialog updated with', organization.resources?.length || 0, 'resources');
      setTimeout(() => {
        this.setupEventListeners();
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
      <div class="org-tabs-layout" data-current-tab="general">
        <nav
          class="org-tabs"
          role="tablist"
          aria-orientation="vertical"
          data-initial-tab="${localStorage.getItem(CustomInfoDialog.TAB_LS_KEY) || 'general'}"
        >
          <button type="button" class="org-tab-btn" role="tab" data-tab="general">
            <i class="fas fa-info-circle"></i><span>General</span>
          </button>
          <button type="button" class="org-tab-btn" role="tab" data-tab="patrols">
            <i class="fas fa-users"></i><span>Patrullas</span>
          </button>
          <button type="button" class="org-tab-btn" role="tab" data-tab="resources">
            <i class="fas fa-coins"></i><span>Recursos</span>
          </button>
          <button type="button" class="org-tab-btn" role="tab" data-tab="reputation">
            <i class="fas fa-handshake"></i><span>Reputación</span>
          </button>
          <div class="active-bar" aria-hidden="true"></div>
        </nav>
        <div class="org-tab-panels">
          <section class="org-tab-panel" role="tabpanel" data-tab-panel="general">
            ${this.renderOrganizationGeneralPanel(organization)}
          </section>
          <section class="org-tab-panel" role="tabpanel" data-tab-panel="patrols">
            ${this.renderOrganizationPatrolsPlaceholder()}
          </section>
          <section class="org-tab-panel" role="tabpanel" data-tab-panel="resources">
            ${this.renderOrganizationResourcesPanel(organization)}
          </section>
          <section class="org-tab-panel" role="tabpanel" data-tab-panel="reputation">
            ${this.renderOrganizationReputationPanel(organization)}
          </section>
        </div>
      </div>
    `;
  }

  /** Render previous general info (extracted) */
  private renderOrganizationGeneralPanel(organization: GuardOrganization): TemplateResult {
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
      </div>
    `;
  }

  /** Patrols placeholder panel */
  private renderOrganizationPatrolsPlaceholder(): TemplateResult {
    const gm = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    const patrols = orgMgr ? orgMgr.listOrganizationPatrols() : [];
    // Shell never replaced after first render; dynamic section updated separately to prevent duplication
    return html`<div class="patrols-panel" data-patrols-panel>
      <div class="panel-header">
        <h3><i class="fas fa-users"></i> Patrullas</h3>
        <button type="button" class="btn create-patrol" data-action="create-patrol">
          <i class="fas fa-plus"></i> Nueva Patrulla
        </button>
      </div>
      <div class="patrols-dynamic" data-patrols-container>
        ${patrols.length === 0
          ? html`<p class="empty-state">No hay patrullas. Crea la primera.</p>`
          : this.renderPatrolCards(patrols)}
      </div>
    </div>`;
  }

  private renderOrganizationResourcesPanel(organization: GuardOrganization): TemplateResult {
    return html`
      <div class="organization-info">
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
      </div>
    `;
  }

  private renderOrganizationReputationPanel(organization: GuardOrganization): TemplateResult {
    return html`
      <div class="organization-info">
        <div class="info-section resources-section">
          <h3><i class="fas fa-handshake"></i> Reputación</h3>
          <div class="resources-list reputation-list" data-organization-id="${organization.id}">
            ${organization.reputation && organization.reputation.length > 0
              ? html`${organization.reputation
                  .map((reputationId: string) => this.renderReputationItemTemplate(reputationId))
                  .filter((template: any) => template !== null)}`
              : html`<p class="empty-state">
                  No hay entradas de reputación para esta organización.<br /><small
                    >Arrastra reputaciones desde el warehouse</small
                  >
                </p>`}
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
    this.setupEventListeners();

    // Listen for resource updates and deletions from warehouse
    this.setupResourceUpdateListeners();
  }

  /**
   * Setup listeners for resource and reputation updates from warehouse
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

    // Listen for reputation updates
    document.addEventListener(
      'guard-reputation-updated',
      this.handleReputationUpdated.bind(this) as EventListener
    );

    // NOTE: Temporarily disabled to prevent duplicate reputation entries
    // Listen for reputation creation
    // document.addEventListener(
    //   'guard-reputation-created',
    //   this.handleReputationCreated.bind(this) as EventListener
    // );

    // Listen for general UI refresh events
    this.uiRefreshHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail;

      // Refresh if it's related to our current organization's resources or reputation
      if (detail.documentType === 'guard-management.guard-resource' && this.currentOrganization) {
        this.refreshContent();
      } else if (
        detail.documentType === 'guard-management.guard-reputation' &&
        this.currentOrganization
      ) {
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
      NotificationService.info(`El recurso "${resourceName}" fue eliminado del sistema`);
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
      if (oldName !== newName) {
        NotificationService.info(`Recurso actualizado: "${oldName}" → "${newName}"`);
      }
    }
  }

  /**
   * Handle reputation update events
   */
  private async handleReputationUpdated(event: Event): Promise<void> {
    const customEvent = event as CustomEvent;
    const { reputationId, oldName, newName } = customEvent.detail;
    console.log('✏️ Reputation updated event received:', oldName, '->', newName, reputationId);

    if (!this.currentOrganization) return;

    // Check if this organization has the updated reputation
    if (this.currentOrganization.reputation?.includes(reputationId)) {
      console.log('📊 Organization has updated reputation - refreshing content');

      // Get fresh organization data
      await this.refreshContent();

      // Show notification only if name changed
      if (oldName !== newName) {
        NotificationService.info(`Reputación actualizada: "${oldName}" → "${newName}"`);
      }
    }
  }

  /**
   * Handle reputation creation events
   * NOTE: Temporarily disabled to prevent duplicate reputation entries
   */
  // private async handleReputationCreated(event: Event): Promise<void> {
  //   const customEvent = event as CustomEvent;
  //   const { organizationId } = customEvent.detail;
  //   console.log('➕ Reputation created event received for organization:', organizationId);

  //   // If this is for our current organization, refresh
  //   if (this.currentOrganization && this.currentOrganization.id === organizationId) {
  //     console.log('📊 Reputation created for current organization - refreshing content');
  //     await this.refreshContent();
  //   }
  // }

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

    // Remove reputation update listeners
    document.removeEventListener(
      'guard-reputation-updated',
      this.handleReputationUpdated.bind(this) as EventListener
    );
    // NOTE: Temporarily disabled to prevent duplicate reputation entries
    // document.removeEventListener(
    //   'guard-reputation-created',
    //   this.handleReputationCreated.bind(this) as EventListener
    // );

    // Remove UI refresh listener from window
    if (this.uiRefreshHandler) {
      window.removeEventListener('guard-ui-refresh', this.uiRefreshHandler);
    }

    // Remove custom drag event listeners
    document.removeEventListener(
      'guard-reputation-drag-start',
      this.handleCustomDragStart.bind(this) as EventListener
    );
    document.removeEventListener(
      'guard-reputation-drag-end',
      this.handleCustomDragEnd.bind(this) as EventListener
    );
    document.removeEventListener('dragstart', this.handleGlobalDragStart.bind(this));
    document.removeEventListener('dragend', this.handleGlobalDragEnd.bind(this));

    console.log('🧹 Cleaned up resource update listeners');
  }

  /**
   * Setup event listeners for resource buttons
   */
  private setupEventListeners(): void {
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
        const reputationId = sendToChatBtn.getAttribute('data-reputation-id');
        const organizationId = sendToChatBtn.getAttribute('data-organization-id');

        if (resourceId) {
          console.log('💬 Send resource to chat button clicked for:', resourceId);
          this.handleSendResourceToChat(resourceId, organizationId || undefined);
        } else if (reputationId) {
          console.log('💬 Send reputation to chat button clicked for:', reputationId);
          this.handleSendReputationToChat(reputationId, organizationId || undefined);
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

      // Handle reputation buttons
      // Add Reputation button
      const addReputationBtn = target.closest('.add-reputation-btn') as HTMLElement;
      if (addReputationBtn) {
        event.preventDefault();
        event.stopPropagation();

        const organizationId = addReputationBtn.getAttribute('data-organization-id');
        if (organizationId) {
          console.log('➕ Add reputation button clicked');
          this.handleAddReputation(organizationId);
        }
        return;
      }

      // Edit Reputation button
      const editReputationBtn = target.closest('.edit-reputation-btn') as HTMLElement;
      if (editReputationBtn) {
        event.preventDefault();
        event.stopPropagation();

        const reputationId = editReputationBtn.getAttribute('data-reputation-id');
        if (reputationId) {
          console.log('✏️ Edit reputation button clicked for:', reputationId);
          this.handleEditReputation(reputationId);
        }
        return;
      }

      // Remove Reputation button (changed from delete to remove to match template)
      const removeReputationBtn = target.closest('.remove-reputation-btn') as HTMLElement;
      if (removeReputationBtn) {
        event.preventDefault();
        event.stopPropagation();

        const reputationId = removeReputationBtn.getAttribute('data-reputation-id');
        const reputationName = removeReputationBtn.getAttribute('data-reputation-name');
        if (reputationId) {
          console.log('🗑️ Remove reputation button clicked for:', reputationName, reputationId);
          this.handleRemoveReputation(reputationId, reputationName || 'Reputación');
        }
        return;
      }
    };

    // Add the new event listener
    this.element.addEventListener('click', this.resourceEventHandler);
    console.log('✅ Resource event listeners set up');

    const root = this.element;
    if (!root) return;
    root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const actionBtn = target.closest('button[data-action]') as HTMLButtonElement | null;
      if (actionBtn) {
        const action = actionBtn.dataset.action;
        if (action === 'create-patrol') {
          e.preventDefault();
          this.handleCreatePatrol();
          return;
        }
        if (action === 'edit') {
          this.handleEditPatrol(actionBtn.dataset.patrolId!);
          return;
        }
        if (action === 'delete') {
          this.handleDeletePatrol(actionBtn.dataset.patrolId!);
          return;
        }
      }
      const lastOrderEl = target.closest('[data-action="edit-last-order"]') as HTMLElement | null;
      if (lastOrderEl) {
        const pid = lastOrderEl.dataset.patrolId!;
        this.handleEditLastOrder(pid);
      }
    });
  }

  private async handleCreatePatrol() {
    const gm = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    if (!orgMgr) return;
    const org = orgMgr.getOrganization();
    if (!org) return;
    const created = await orgMgr.openCreatePatrolDialog();
    if (created) {
      ui?.notifications?.info('Patrulla creada');
      this.refreshPatrolsPanel();
    }
  }
  private async handleEditPatrol(patrolId: string) {
    const gm = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    if (!orgMgr) return;
    const updated = await orgMgr.openEditPatrolDialog(patrolId);
    if (updated) {
      ui?.notifications?.info('Patrulla actualizada');
      this.refreshPatrolsPanel();
    }
  }
  private async handleDeletePatrol(patrolId: string) {
    const confirm = await Dialog.confirm({
      title: 'Eliminar Patrulla',
      content: `<p>¿Seguro que deseas eliminar esta patrulla?</p>`,
    });
    if (!confirm) return;
    const gm = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    if (!orgMgr) return;
    const org = orgMgr.getOrganization();
    if (!org) return;
    orgMgr.removePatrol(patrolId);
    const pMgr = orgMgr.getPatrolManager();
    pMgr.deletePatrol(patrolId);
    ui?.notifications?.warn('Patrulla eliminada');
    this.refreshPatrolsPanel();
  }

  private refreshPatrolsPanel() {
    const gm = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    if (!orgMgr) return;
    const org = orgMgr.getOrganization();
    if (!org) return;
    // Simple debounce: if a refresh was scheduled in the same tick, skip
    if ((this as any)._patrolsRefreshScheduled) {
      (this as any)._patrolsRefreshPending = true;
      return;
    }
    (this as any)._patrolsRefreshScheduled = true;
    queueMicrotask(() => {
      (this as any)._patrolsRefreshScheduled = false;
      if ((this as any)._patrolsRefreshPending) {
        (this as any)._patrolsRefreshPending = false;
        this.refreshPatrolsPanel();
        return;
      }
    });
    const tabPanel = this.element?.querySelector(
      '[data-tab-panel="patrols"]'
    ) as HTMLElement | null;
    if (!tabPanel) return;
    // Remove duplicate patrols-panel wrappers if any (keep first)
    const wrappers = Array.from(tabPanel.querySelectorAll('[data-patrols-panel]')) as HTMLElement[];
    if (wrappers.length > 1) {
      wrappers.slice(1).forEach((w) => w.remove());
    }
    let wrapper: HTMLElement | null = wrappers[0] || null;
    if (!wrapper) {
      // First time: create wrapper fresh
      safeRender(this.renderOrganizationPatrolsPlaceholder(), tabPanel);
      wrapper = tabPanel.querySelector('[data-patrols-panel]') as HTMLElement | null;
    }
    if (!wrapper) return; // still missing
    const container = wrapper.querySelector('[data-patrols-container]') as HTMLElement | null;
    if (!container) {
      // Rebuild wrapper completely if container missing / corrupted
      safeRender(this.renderOrganizationPatrolsPlaceholder(), tabPanel);
      return;
    }
    let patrols = orgMgr.listOrganizationPatrols();
    // Diagnostic + de-dup safeguard (root cause may be data layer emitting duplicates)
    const seen = new Set<string>();
    const dups: string[] = [];
    patrols = patrols.filter((p: any) => {
      if (!p?.id) return false;
      if (seen.has(p.id)) {
        dups.push(p.id);
        return false; // drop duplicate
      }
      seen.add(p.id);
      return true;
    });
    if (dups.length) {
      console.warn('[PatrolsPanel] Duplicados filtrados en render:', dups);
    }
    console.debug('[PatrolsPanel] Render patrol IDs:', Array.from(seen));
    const dynamicTpl =
      patrols.length === 0
        ? html`<p class="empty-state">No hay patrullas. Crea la primera.</p>`
        : this.renderPatrolCards(patrols);
    try {
      // Render version guard to prevent interleaving older renders
      const versionKey = 'data-render-version';
      const currentVersion = ((this as any)._patrolsRenderVersion =
        ((this as any)._patrolsRenderVersion || 0) + 1);
      // Hard clear to avoid any lingering duplicated nodes before lit-html patching
      while (container.firstChild) container.removeChild(container.firstChild);
      safeRender(dynamicTpl, container);
      container.setAttribute(versionKey, String(currentVersion));
      // Final safety: ensure only one header exists
      const headers = wrapper.querySelectorAll('.panel-header');
      if (headers.length > 1) {
        headers.forEach((h, i) => {
          if (i > 0) h.remove();
        });
      }
    } catch (err) {
      console.warn('Patrols dynamic render fallback:', err);
      try {
        container.innerHTML = '';
        // naive conversion fallback
        const temp = document.createElement('div');
        temp.innerHTML = (dynamicTpl as any).getHTML?.() || '';
        while (temp.firstChild) container.appendChild(temp.firstChild);
      } catch {
        container.textContent = 'Error actualizando patrullas';
      }
    }
  }

  /**
   * Handle removing a resource from the organization
   */
  private async handleRemoveResource(resourceId: string, resourceName: string): Promise<void> {
    console.log('🗑️ Remove resource request:', resourceName, resourceId);
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
        NotificationService.warn(
          `El recurso "${resourceName}" no está asignado a esta organización`
        );
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
      NotificationService.info(`Recurso "${resourceName}" removido de la organización`);

      // Re-render the dialog to show the updated resources
      await this.refreshContent();
    } catch (error) {
      console.error('❌ Error removing resource:', error);
      NotificationService.error('Error al remover el recurso de la organización');
    }
  }

  /**
   * Show confirmation dialog for removing a resource
   */
  private async showRemoveResourceDialog(resourceName: string): Promise<boolean> {
    const html = `
          <div style="margin-bottom: 1rem;">
            <i class="fas fa-exclamation-triangle" style="color: #ff6b6b; margin-right: 0.5rem;"></i>
            <strong>¿Estás seguro?</strong>
          </div>
          <p>¿Deseas remover el recurso "<strong>${resourceName}</strong>" de esta organización?</p>
          <p><small>Esta acción se puede deshacer asignando el recurso nuevamente.</small></p>
        `;
    return await ConfirmService.confirm({ title: 'Confirmar Remoción', html });
  }

  /**
   * Handle editing a resource
   */
  private async handleEditResource(resourceId: string, resourceName: string): Promise<void> {
    console.log('✏️ Edit resource request:', resourceName, resourceId);

    const gm = (window as any).GuardManagement;
    if (!gm?.documentManager) {
      console.error('❌ DocumentBasedManager not available');
      NotificationService.error('No se pudo acceder al gestor de documentos');
      return;
    }

    try {
      // Get the resource from the document manager
      const resources = gm.documentManager.getGuardResources();
      const resource = resources.find((r: any) => r.id === resourceId);

      if (!resource) {
        console.error('❌ Resource not found:', resourceId);
        NotificationService.error('Recurso no encontrado');
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
          NotificationService.info(`Recurso "${editedResource.name}" actualizado exitosamente`);

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
  private async handleSendResourceToChat(
    resourceId: string,
    _organizationId?: string
  ): Promise<void> {
    console.log('💬 Send resource to chat request:', resourceId);

    try {
      // Send to chat using ResourceTemplate
      await ResourceTemplate.sendResourceToChat(resourceId);

      console.log('✅ Resource sent to chat successfully');

      // Show success notification
      NotificationService.info('Recurso enviado al chat');
    } catch (error) {
      console.error('❌ Error sending resource to chat:', error);
      NotificationService.error('Error al enviar recurso al chat');
    }
  }

  /**
   * Handle sending a reputation to chat
   */
  private async handleSendReputationToChat(
    reputationId: string,
    _organizationId?: string
  ): Promise<void> {
    console.log('💬 Send reputation to chat request:', reputationId);

    try {
      // Send to chat using ReputationTemplate
      await ReputationTemplate.sendReputationToChat(reputationId);

      console.log('✅ Reputation sent to chat successfully');

      // Show success notification
      NotificationService.info('Reputación enviada al chat');
    } catch (error) {
      console.error('❌ Error sending reputation to chat:', error);
      NotificationService.error('Error al enviar reputación al chat');
    }
  }

  /**
   * Handle adding a new reputation entry
   */
  private async handleAddReputation(organizationId: string): Promise<void> {
    console.log('➕ Add reputation request for organization:', organizationId);
    console.log(
      '📊 Current reputation count BEFORE create:',
      this.currentOrganization?.reputation?.length || 0
    );

    try {
      await AddOrEditReputationDialog.showCreateDialog(organizationId);

      // The showCreateDialog already sends 'guard-organizations-updated' event
      // but we need to wait a bit for the automatic assignment to complete
      console.log('✅ Add reputation dialog closed, waiting for automatic assignment...');

      // Wait a short time for the automatic reputation assignment to complete
      setTimeout(async () => {
        console.log('🔄 Refreshing content after reputation creation...');
        console.log(
          '📊 Current reputation count BEFORE refresh:',
          this.currentOrganization?.reputation?.length || 0
        );
        await this.refreshContent();
        console.log(
          '📊 Current reputation count AFTER refresh:',
          this.currentOrganization?.reputation?.length || 0
        );
      }, 200); // Increased delay from 100ms to 200ms
    } catch (error) {
      console.error('❌ Error showing add reputation dialog:', error);
      NotificationService.error('Error al abrir el diálogo de reputación');
    }
  }

  /**
   * Handle editing a reputation entry
   */
  private async handleEditReputation(reputationId: string): Promise<void> {
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

      // Always refresh content after edit dialog closes
      console.log('✅ Edit reputation dialog closed, refreshing content');
      await this.refreshContent();

      // Get updated reputation data for notification and event
      const updatedReputations = gm.documentManager.getGuardReputations();
      const updatedReputation = updatedReputations.find((r: any) => r.id === reputationId);
      const newName = updatedReputation?.name || oldName;

      // Show notification only if we can determine the name changed
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
   * Handle removing a reputation from the organization (not deleting from system)
   */
  private async handleRemoveReputation(
    reputationId: string,
    reputationName: string
  ): Promise<void> {
    console.log('🗑️ Remove reputation request:', reputationName, reputationId);
    const confirmed = await this.showRemoveReputationDialog(reputationName);
    if (!confirmed) {
      console.log('❌ Reputation removal cancelled by user');
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

      // Check if reputation is assigned
      if (!organization.reputation || !organization.reputation.includes(reputationId)) {
        console.log('ℹ️ Reputation not assigned - nothing to remove');
        NotificationService.warn(
          `La reputación "${reputationName}" no está asignada a esta organización`
        );
        return;
      }

      // Create a NEW array without the reputation to avoid mutation issues
      const newReputation = organization.reputation.filter((id: string) => id !== reputationId);

      // Create a completely new organization object to avoid reference issues
      const updatedOrganization = {
        ...organization,
        reputation: newReputation,
        updatedAt: new Date(),
        version: (organization.version || 0) + 1,
      };

      // Update organization
      await gm.guardOrganizationManager.updateOrganization(updatedOrganization);

      // Update current organization in memory with the NEW object
      this.currentOrganization = updatedOrganization;

      console.log('✅ Reputation removed successfully');

      // Show success notification
      NotificationService.info(`Reputación "${reputationName}" removida de la organización`);

      // Re-render the dialog to show the updated reputation list
      await this.refreshContent();
    } catch (error) {
      console.error('❌ Error removing reputation:', error);
      NotificationService.error('Error al remover la reputación de la organización');
    }
  }

  /**
   * Show confirmation dialog for removing a reputation
   */
  private async showRemoveReputationDialog(reputationName: string): Promise<boolean> {
    const html = `
          <div style="margin-bottom: 1rem;">
            <i class="fas fa-exclamation-triangle" style="color: #ff6b6b; margin-right: 0.5rem;"></i>
            <strong>¿Estás seguro?</strong>
          </div>
          <p>¿Deseas remover la reputación "<strong>${reputationName}</strong>" de esta organización?</p>
          <p><small>Esta acción se puede deshacer asignando la reputación nuevamente.</small></p>
        `;
    return await ConfirmService.confirm({ title: 'Confirmar Remoción', html });
  }

  /**
   * Handle deleting a reputation entry
   */
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
    // Listen for custom drag events from ReputationEventHandler
    document.addEventListener(
      'guard-reputation-drag-start',
      this.handleCustomDragStart.bind(this) as EventListener
    );
    document.addEventListener(
      'guard-reputation-drag-end',
      this.handleCustomDragEnd.bind(this) as EventListener
    );

    // Keep existing listeners for resources
    document.addEventListener('dragstart', this.handleGlobalDragStart.bind(this));
    document.addEventListener('dragend', this.handleGlobalDragEnd.bind(this));
  }

  /**
   * Handle custom drag start events from reputation system
   */
  private handleCustomDragStart(event: Event): void {
    const customEvent = event as CustomEvent;
    console.log('🎯 Custom drag start detected:', customEvent.detail);
    this.showDropOverlay();
  }

  /**
   * Handle custom drag end events from reputation system
   */
  private handleCustomDragEnd(event: Event): void {
    const customEvent = event as CustomEvent;
    console.log('🏁 Custom drag end detected:', customEvent.detail);
    this.hideDropOverlay();
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
    // Dynamic loading removed; styles are imported statically via ES modules.
    return;
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

        <div class="info-section resources-section">
          <h3><i class="fas fa-handshake"></i> Reputación</h3>
          <div class="resources-list reputation-list" data-organization-id="${organization.id}">
            ${organization.reputation && organization.reputation.length > 0
              ? html`${organization.reputation
                  .map((reputationId: string) => this.renderReputationItemTemplate(reputationId))
                  .filter((template: any) => template !== null)}`
              : html`<p class="empty-state">
                  No hay entradas de reputación para esta organización.<br /><small
                    >Arrastra reputaciones desde el warehouse</small
                  >
                </p>`}
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
   * Render a reputation item template
   */
  private renderReputationItemTemplate(reputationId: string): TemplateResult | null {
    try {
      const gm = (window as any).GuardManagement;
      if (!gm?.documentManager) {
        console.error('DocumentManager not available');
        return null;
      }

      const reputations = gm.documentManager.getGuardReputations();
      const reputation = reputations.find((r: any) => r.id === reputationId);

      if (!reputation) {
        console.warn(`Reputation with ID ${reputationId} not found`);
        return null;
      }

      // Use ReputationTemplate.renderReputationItem with same options as resources
      return ReputationTemplate.renderReputationItem(reputationId, {
        showActions: true,
        showSendToChat: true,
        organizationId: this.currentOrganization?.id || '',
      });
    } catch (error) {
      console.error('Error rendering reputation item template:', error);
      return null;
    }
  }

  /**
   * Handle global drag start - show overlay
   */
  private handleGlobalDragStart(event: DragEvent): void {
    // Show overlay if this is a guard resource or reputation being dragged
    const dragData = event.dataTransfer?.getData('text/plain');
    if (dragData) {
      try {
        const data = JSON.parse(dragData);
        if (data.type === 'guard-resource' || data.type === 'reputation') {
          console.log('🎯 Detected drag start for:', data.type);
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
      console.log('🎯 Drop attempt:', data);

      if (data.type === 'guard-resource') {
        console.log('📦 Resource drop:', data.resourceData.name);
        // Implement actual resource assignment
        await this.assignResourceToOrganization(data.resourceData);

        // Show success notification
        NotificationService.info(`Recurso "${data.resourceData.name}" asignado a la organización`);

        // Re-render the dialog to show the new resource
        await this.refreshContent();
      } else if (data.type === 'reputation' || data.type === 'guard-reputation') {
        console.log('🤝 Reputation drop:', data.reputation?.name || data.reputationData?.name);
        // Handle both formats - from warehouse (reputationData) or from local (reputation)
        const reputationData = data.reputationData || data.reputation;
        await this.assignReputationToOrganization(reputationData);

        // Show success notification
        NotificationService.info(`Reputación "${reputationData.name}" asignada a la organización`);

        // Re-render the dialog to show the new reputation
        await this.refreshContent();
      } else {
        console.warn('⚠️ Unknown drop type:', data.type);
      }
    } catch (error) {
      console.error('❌ Error parsing drop data:', error);
      NotificationService.error('Error al asignar el elemento a la organización');
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
        NotificationService.warn(
          `El recurso "${resourceData.name}" ya está asignado a esta organización`
        );
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
      NotificationService.error('Error al asignar el recurso');
      throw error;
    }
  }

  /**
   * Assign a reputation to the current organization
   */
  private async assignReputationToOrganization(reputationData: any): Promise<void> {
    console.log('🤝 Assigning reputation:', reputationData.name);

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

      // Initialize reputation array if it doesn't exist
      if (!organization.reputation) {
        organization.reputation = [];
      }

      // Check if reputation is already assigned
      if (organization.reputation.includes(reputationData.id)) {
        console.log('ℹ️ Reputation already assigned - skipping');
        NotificationService.warn(
          `La reputación "${reputationData.name}" ya está asignada a esta organización`
        );
        return;
      }

      // Create a NEW array with the new reputation to avoid mutation issues
      const newReputation = [...organization.reputation, reputationData.id];

      // Create a completely new organization object to avoid reference issues
      const updatedOrganization = {
        ...organization,
        reputation: newReputation,
        updatedAt: new Date(),
        version: (organization.version || 0) + 1,
      };

      // Update organization (GuardOrganizationManager has different update method)
      // Update organization (GuardOrganizationManager has different update method)
      await gm.guardOrganizationManager.updateOrganization(updatedOrganization);

      // Update current organization in memory with the NEW object
      this.currentOrganization = updatedOrganization;

      console.log('✅ Reputation assigned successfully');
    } catch (error) {
      console.error('❌ Error assigning reputation:', error);
      NotificationService.error('Error al asignar la reputación');
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
    if (!gm?.guardOrganizationManager || !gm?.documentManager) {
      console.log('❌ No guardOrganizationManager or documentManager for refresh');
      return;
    }

    try {
      // First try to get from DocumentBasedManager which should be more up-to-date
      let freshOrganization = null;

      try {
        const guardOrgs = gm.documentManager.getGuardOrganizations();
        freshOrganization = guardOrgs.find((org: any) => org.id === this.currentOrganization!.id);

        if (freshOrganization) {
          // Convert Foundry document to our organization type
          freshOrganization = {
            id: freshOrganization.id,
            name: freshOrganization.name || 'Organización Sin Nombre',
            subtitle: freshOrganization.system?.subtitle || '',
            baseStats: {
              robustismo: freshOrganization.system?.baseStats?.robustismo || 0,
              analitica: freshOrganization.system?.baseStats?.analitica || 0,
              subterfugio: freshOrganization.system?.baseStats?.subterfugio || 0,
              elocuencia: freshOrganization.system?.baseStats?.elocuencia || 0,
            },
            resources: freshOrganization.system?.resources || [],
            reputation: freshOrganization.system?.reputation || [],
            patrols: freshOrganization.system?.patrols || [],
            version: freshOrganization.system?.version || 1,
            createdAt: freshOrganization.system?.createdAt
              ? new Date(freshOrganization.system.createdAt)
              : new Date(),
            updatedAt: new Date(),
          };
          console.log('📊 Using data from DocumentBasedManager');
        }
      } catch (error) {
        console.log(
          '⚠️ Could not get data from DocumentBasedManager, falling back to GuardOrganizationManager'
        );
      }

      // Fallback to GuardOrganizationManager if DocumentBasedManager fails
      if (!freshOrganization) {
        freshOrganization = gm.guardOrganizationManager.getOrganization();
        if (!freshOrganization) {
          console.log('❌ No organization found in either manager');
          return;
        }
        console.log('📊 Using data from GuardOrganizationManager (fallback)');
      }

      console.log(
        '📊 Refreshing - Current reputation count:',
        this.currentOrganization.reputation?.length || 0
      );
      console.log(
        '📊 Refreshing - Fresh reputation count:',
        freshOrganization.reputation?.length || 0
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

  private async handleEditLastOrder(patrolId: string) {
    const gm = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    if (!orgMgr) return;
    const pMgr = orgMgr.getPatrolManager();
    const patrol = pMgr.getPatrol(patrolId);
    if (!patrol) return;
    const current = patrol.lastOrder?.text || '';
    const result = await (foundry as any).applications.api.DialogV2.wait({
      window: { title: 'Editar Última Orden', resizable: true },
      content: `<form class='last-order-edit'><textarea name='order' rows='4' style='width:100%;'>${current}</textarea><p class='hint'>Actualiza la última orden de la patrulla.</p></form>`,
      buttons: [
        {
          action: 'save',
          label: 'Guardar',
          icon: 'fas fa-save',
          default: true,
          callback: (_ev: any, btn: any, dlg: any) => {
            const form = btn?.form || dlg?.window?.content?.querySelector('form.last-order-edit');
            if (!form) return 'cancel';
            const fd = new FormData(form);
            const text = (fd.get('order') as string) || '';
            if (!text.trim()) {
              ui?.notifications?.warn('Orden vacía');
              return 'cancel';
            }
            pMgr.updateLastOrder(patrolId, text.trim());
            const updated = pMgr.getPatrol(patrolId);
            if (updated) {
              orgMgr.upsertPatrolSnapshot(updated);
            }
            return 'save';
          },
        },
        { action: 'cancel', label: 'Cancelar', icon: 'fas fa-times', callback: () => 'cancel' },
      ],
    });
    if (result === 'save') {
      ui?.notifications?.info('Orden actualizada');
      this.refreshPatrolsPanel();
    }
  }

  private initTabs(root: HTMLElement): void {
    if (this.tabsInitialized) return; // prevent duplicate listeners
    const layout = root.querySelector('.org-tabs-layout') as HTMLElement;
    if (!layout) return;
    const tabsContainer = layout.querySelector('.org-tabs') as HTMLElement;
    const buttons = Array.from(layout.querySelectorAll('.org-tab-btn')) as HTMLButtonElement[];
    const panels = Array.from(layout.querySelectorAll('.org-tab-panel')) as HTMLElement[];
    const activeBar = tabsContainer?.querySelector('.active-bar') as HTMLElement | null;

    const stored = localStorage.getItem(CustomInfoDialog.TAB_LS_KEY) || 'general';

    const positionBar = (btn: HTMLButtonElement | undefined) => {
      if (!btn || !activeBar) return;
      activeBar.style.top = btn.offsetTop + 'px';
      activeBar.style.height = btn.offsetHeight + 'px';
    };

    const activate = (tab: string) => {
      buttons.forEach((b) => {
        const on = b.dataset.tab === tab;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      panels.forEach((p) => p.classList.toggle('active', p.dataset.tabPanel === tab));
      layout.setAttribute('data-current-tab', tab);
      try {
        localStorage.setItem(CustomInfoDialog.TAB_LS_KEY, tab);
      } catch {}
      positionBar(buttons.find((b) => b.dataset.tab === tab));
    };

    buttons.forEach((b) => b.addEventListener('click', () => activate(b.dataset.tab!)));

    // Keyboard navigation
    const keyNavHandler = (ev: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown', 'w', 's', 'W', 'S'].includes(ev.key)) return;
      const idx = buttons.findIndex((b) => b.classList.contains('active'));
      if (idx === -1) return;
      let next = idx + (ev.key === 'ArrowUp' || ev.key.toLowerCase() === 'w' ? -1 : 1);
      if (next < 0) next = buttons.length - 1;
      if (next >= buttons.length) next = 0;
      activate(buttons[next].dataset.tab!);
      buttons[next].focus();
      ev.preventDefault();
    };
    layout.addEventListener('keydown', keyNavHandler);

    // Initial activation
    activate(stored);
    requestAnimationFrame(() => positionBar(buttons.find((b) => b.classList.contains('active'))));

    this.tabsInitialized = true;
  }

  private computePatrolStatBreakdown(patrol: any) {
    try {
      const derived = patrol.derivedStats || patrol.baseStats || {};
      const effectTotals: Record<string, number> = {};
      for (const eff of patrol.patrolEffects || []) {
        for (const [k, v] of Object.entries(eff.modifiers || {})) {
          effectTotals[k] = (effectTotals[k] || 0) + ((v as number) || 0);
        }
      }
      const breakdown: Record<
        string,
        { base: number; effects: number; org: number; total: number }
      > = {};
      for (const key of Object.keys(derived)) {
        const base = patrol.baseStats?.[key] ?? 0;
        const effects = effectTotals[key] || 0;
        const total = derived[key] || 0;
        const org = total - base - effects; // whatever isn't base or effects we attribute to organization modifiers
        breakdown[key] = { base, effects, org, total };
      }
      return breakdown;
    } catch {
      return {};
    }
  }

  private renderPatrolCards(patrols: any[]): TemplateResult {
    return html`<div class="patrol-cards-grid">
      ${patrols.map((p) => {
        const lastOrder = p.lastOrder;
        const ageClass = lastOrder
          ? classifyLastOrderAge({ issuedAt: lastOrder.issuedAt })
          : 'normal';
        const bd = this.computePatrolStatBreakdown(p);
        return html`<div class="patrol-card" data-patrol-id="${p.id}">
          <div class="header">
            <span class="name">${p.name}</span>${p.subtitle
              ? html`<span class="subtitle">${p.subtitle}</span>`
              : ''}
          </div>
          <div class="stats-mini">
            ${Object.entries(p.derivedStats || p.baseStats || {}).map(([k, v]) => {
              const b = (bd as any)[k] || { base: 0, effects: 0, org: 0, total: v };
              const tip = `Base: ${b.base}\nEfectos: ${b.effects}\nOrganización: ${b.org >= 0 ? '+' : ''}${b.org}\nTotal: ${b.total}`;
              return html`<span class="stat" data-stat="${k}" title="${tip}"
                >${k.slice(0, 3)}: ${v}</span
              >`;
            })}
          </div>
          <div class="officer-slot">
            ${p.officer
              ? html`<img src="${p.officer.img || ''}" alt="oficial" />`
              : html`<span class="empty">Sin Oficial</span>`}
          </div>
          <div class="soldiers-count">Soldados: ${p.soldiers?.length || 0}</div>
          <div
            class="last-order-line ${ageClass}"
            data-action="edit-last-order"
            data-patrol-id="${p.id}"
            title="Click para editar la última orden"
          >
            <i class="fas fa-scroll"></i>
            <span class="last-order-label">Orden:</span>
            <span class="last-order-text">${lastOrder ? lastOrder.text : '— (sin orden)'}</span>
            ${lastOrder ? html`<span class="age-indicator ${ageClass}"></span>` : ''}
          </div>
          <div class="actions">
            <button type="button" class="edit-patrol" data-action="edit" data-patrol-id="${p.id}">
              <i class="fas fa-edit"></i></button
            ><button
              type="button"
              class="delete-patrol"
              data-action="delete"
              data-patrol-id="${p.id}"
            >
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>`;
      })}
    </div>`;
  }
}
