/**
 * Custom Info Dialog - Movable and resizable HTML dialog without using Foundry's Dialog system
 */

import type { GuardOrganization } from '../types/entities';
import { DialogFocusManager, type FocusableDialog } from '../utils/dialog-focus-manager.js';
// Import CSS for drag & drop styling
import '../styles/custom-info-dialog.css';
import { NotificationService } from '../utils/services/NotificationService.js';
import { GeneralPanel } from './panels/GeneralPanel.js';
import { PatrolsPanel } from './panels/PatrolsPanel.js';
import { ReputationPanel } from './panels/ReputationPanel.js';
import { ResourcesPanel } from './panels/ResourcesPanel.js';

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
    // Auto-refresh patrols when data layer updates (hydrate / persist)
    window.addEventListener('guard-patrols-updated', () => {
      try {
        if (!this.element || !this.currentOrganization) return;
        // Solo refrescar si la pestaña de patrullas está montada
        const activeTab = this.element.querySelector('[data-tab-panel="patrols"]');
        if (activeTab) this.refreshPatrolsPanel();
      } catch (e) {
        console.warn('CustomInfoDialog | patrols auto-refresh failed', e);
      }
    });
  }

  /**
   * Show organization info dialog
   */
  public async showOrganizationInfo(
    organization: GuardOrganization,
    options: {
      onEdit?: () => void;
      onClose?: () => void;
      width?: number;
      height?: number;
      x?: number;
      y?: number;
    } = {}
  ): Promise<void> {
    console.log('🏛️ Setting current organization:', organization.name, organization.id);
    this.currentOrganization = organization;
    this.onEditCallback = options.onEdit;
    this.onCloseCallback = options.onClose;

    // Create the dialog element directly with organization content
    this.element = await this.createOrganizationDialogElement(organization, options);

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

    // Initial content render
    await this.refreshContent();
  }

  /**
   * Create the dialog HTML element specifically for organization info
   */
  private async createOrganizationDialogElement(
    organization: GuardOrganization,
    options: { width?: number; height?: number; x?: number; y?: number }
  ): Promise<HTMLElement> {
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

    const templatePath = 'modules/guard-management/templates/dialogs/info-dialog.hbs';
    const content = await renderTemplate(templatePath, {
      title: `Información: ${organization.name}`,
      initialTab: localStorage.getItem(CustomInfoDialog.TAB_LS_KEY) || 'general',
    });

    dialog.innerHTML = content;

    this.initTabs(dialog);

    return dialog;
  }

  /**
   * Update the organization and refresh the dialog content
   */
  public async updateOrganization(organization: GuardOrganization): Promise<void> {
    console.log('🔄 Updating dialog content...');
    this.currentOrganization = organization;

    if (!this.element) return;

    // Update title
    const titleElement = this.element.querySelector('.custom-dialog-title-text');
    if (titleElement) {
      titleElement.textContent = `Información: ${organization.name}`;
    }

    await this.refreshContent();
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
              robustismo: freshOrganization.system?.baseStats?.robustismo ?? 0,
              analitica: freshOrganization.system?.baseStats?.analitica ?? 0,
              subterfugio: freshOrganization.system?.baseStats?.subterfugio ?? 0,
              elocuencia: freshOrganization.system?.baseStats?.elocuencia ?? 0,
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

      // IMPORTANT: Update our current organization reference to the fresh one
      this.currentOrganization = freshOrganization;

      // Render panels
      if (this.element) {
        const generalContainer = this.element.querySelector(
          '[data-tab-panel="general"]'
        ) as HTMLElement;
        if (generalContainer) await GeneralPanel.render(generalContainer, freshOrganization);

        const patrolsContainer = this.element.querySelector(
          '[data-tab-panel="patrols"]'
        ) as HTMLElement;
        if (patrolsContainer) await PatrolsPanel.render(patrolsContainer);

        const resourcesContainer = this.element.querySelector(
          '[data-tab-panel="resources"]'
        ) as HTMLElement;
        if (resourcesContainer) await ResourcesPanel.render(resourcesContainer, freshOrganization);

        const reputationContainer = this.element.querySelector(
          '[data-tab-panel="reputation"]'
        ) as HTMLElement;
        if (reputationContainer)
          await ReputationPanel.render(reputationContainer, freshOrganization);
      }

      console.log('✅ Refresh completed immediately');
    } catch (error) {
      console.error('❌ Error refreshing dialog content:', error);
    }
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
  }

  private refreshPatrolsPanel() {
    const tabPanel = this.element?.querySelector(
      '[data-tab-panel="patrols"]'
    ) as HTMLElement | null;
    if (!tabPanel) return;

    PatrolsPanel.render(tabPanel);
  }

  /**
   * Handle removing a resource from the organization
   */
  private async handleRemoveResource(resourceId: string, resourceName: string): Promise<void> {
    if (!this.currentOrganization) return;
    await ResourcesPanel.handleRemoveResource(
      resourceId,
      resourceName,
      this.currentOrganization,
      () => this.refreshContent()
    );
  }

  /**
   * Handle editing a resource
   */
  private async handleEditResource(resourceId: string, resourceName: string): Promise<void> {
    await ResourcesPanel.handleEditResource(resourceId, resourceName, () => this.refreshContent());
  }

  /**
   * Handle sending a resource to chat
   */
  private async handleSendResourceToChat(
    resourceId: string,
    _organizationId?: string
  ): Promise<void> {
    await ResourcesPanel.handleSendResourceToChat(resourceId);
  }

  /**
   * Handle sending a reputation to chat
   */
  private async handleSendReputationToChat(
    reputationId: string,
    _organizationId?: string
  ): Promise<void> {
    await ReputationPanel.handleSendReputationToChat(reputationId);
  }

  /**
   * Handle adding a new reputation entry
   */
  private async handleAddReputation(organizationId: string): Promise<void> {
    await ReputationPanel.handleAddReputation(organizationId, () => this.refreshContent());
  }

  /**
   * Handle editing a reputation entry
   */
  private async handleEditReputation(reputationId: string): Promise<void> {
    await ReputationPanel.handleEditReputation(reputationId, () => this.refreshContent());
  }

  /**
   * Handle removing a reputation from the organization (not deleting from system)
   */
  private async handleRemoveReputation(
    reputationId: string,
    reputationName: string
  ): Promise<void> {
    if (!this.currentOrganization) return;
    await ReputationPanel.handleRemoveReputation(
      reputationId,
      reputationName,
      this.currentOrganization,
      () => this.refreshContent()
    );
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
    if (!this.currentOrganization) return;
    await ResourcesPanel.assignResourceToOrganization(resourceData, this.currentOrganization, () =>
      this.refreshContent()
    );
  }

  /**
   * Assign a reputation to the current organization
   */
  private async assignReputationToOrganization(reputationData: any): Promise<void> {
    if (!this.currentOrganization) return;
    await ReputationPanel.assignReputationToOrganization(
      reputationData,
      this.currentOrganization,
      () => this.refreshContent()
    );
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
}
