/**
 * Custom Info Dialog - Movable and resizable HTML dialog without using Foundry's Dialog system
 */

import type { GuardOrganization } from '../types/entities';
import { DialogFocusManager, type FocusableDialog } from '../utils/dialog-focus-manager.js';
// Import CSS for drag & drop styling
import '../styles/custom-info-dialog.css';
import { NotificationService } from '../utils/services/NotificationService.js';
import { CrimesPanel } from './panels/CrimesPanel.js';
import { GangsPanel } from './panels/GangsPanel.js';
import { BuildingsPanel } from './panels/BuildingsPanel.js';
import { PoiPanel } from './panels/PoiPanel.js';
import { GeneralPanel } from './panels/GeneralPanel.js';
import { PatrolsPanel } from './panels/PatrolsPanel.js';
import { PrisonersPanel } from './panels/PrisonersPanel.js';
import { ReputationPanel } from './panels/ReputationPanel.js';
import { ResourcesPanel } from './panels/ResourcesPanel.js';
import { FinancesPanel } from './panels/FinancesPanel.js';
import { PresenceIndicator } from './PresenceIndicator.js';

export class CustomInfoDialog implements FocusableDialog {
  public element: HTMLElement | null = null;
  private isDragging = false;
  private isResizing = false;
  private isMinimized = false;
  private preMinimizeSize = { width: 0, height: 0 };
  private dragOffset = { x: 0, y: 0 };
  private onEditCallback?: () => void;
  private onCloseCallback?: () => void;
  private isFocused = false;
  private currentOrganization: GuardOrganization | null = null;
  // Tab state keys
  private static readonly TAB_LS_KEY = 'guard-management.infoDialog.selectedTab';
  private static readonly POS_LS_KEY = 'guard-management.orgDialog.pos';
  private tabsInitialized = false;
  private resourceEventHandler: ((event: Event) => void) | null = null;
  private uiRefreshHandler?: (event: Event) => void;
  private presenceIndicator: PresenceIndicator | null = null;
  private lastInteractionTime = 0;

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
    // Auto-refresh prisoners when data layer updates
    window.addEventListener('guard-prisoners-updated', () => {
      try {
        if (!this.element || !this.currentOrganization) return;
        const activeTab = this.element.querySelector('[data-tab-panel="prisoners"]');
        if (activeTab) this.refreshPrisonersPanel();
      } catch (e) {
        console.warn('CustomInfoDialog | prisoners auto-refresh failed', e);
      }
    });
    // Auto-refresh prisoners when phase advances (remaining phases change)
    window.addEventListener('guard-phase-advanced', () => {
      try {
        if (!this.element || !this.currentOrganization) return;
        const activeTab = this.element.querySelector('[data-tab-panel="prisoners"]');
        if (activeTab) this.refreshPrisonersPanel();
      } catch (e) {
        console.warn('CustomInfoDialog | prisoners phase-refresh failed', e);
      }
    });
    // Auto-refresh auxiliaries when data layer updates
    window.addEventListener('guard-auxiliaries-updated', () => {
      try {
        if (!this.element || !this.currentOrganization) return;
        const activeTab = this.element.querySelector('[data-tab-panel="auxiliaries"]');
        if (activeTab) this.refreshAuxiliariesPanel();
      } catch (e) {
        console.warn('CustomInfoDialog | auxiliaries auto-refresh failed', e);
      }
    });
    // Auto-refresh crimes when data layer updates
    window.addEventListener('guard-crimes-updated', () => {
      try {
        if (!this.element || !this.currentOrganization) return;
        const activeTab = this.element.querySelector('[data-tab-panel="crimes"]');
        if (activeTab) this.refreshCrimesPanel();
      } catch (e) {
        console.warn('CustomInfoDialog | crimes auto-refresh failed', e);
      }
    });
    // Auto-refresh gangs when data layer updates
    window.addEventListener('guard-gangs-updated', () => {
      try {
        if (!this.element || !this.currentOrganization) return;
        const activeTab = this.element.querySelector('[data-tab-panel="gangs"]');
        if (activeTab) this.refreshGangsPanel();
      } catch (e) {
        console.warn('CustomInfoDialog | gangs auto-refresh failed', e);
      }
    });
    // Auto-refresh buildings when data layer updates
    window.addEventListener('guard-buildings-updated', () => {
      try {
        if (!this.element || !this.currentOrganization) return;
        const activeTab = this.element.querySelector('[data-tab-panel="buildings"]');
        if (activeTab) this.refreshBuildingsPanel();
      } catch (e) {
        console.warn('CustomInfoDialog | buildings auto-refresh failed', e);
      }
    });
    // Auto-refresh POI when data layer updates
    window.addEventListener('guard-poi-updated', () => {
      try {
        if (!this.element || !this.currentOrganization) return;
        const activeTab = this.element.querySelector('[data-tab-panel="poi"]');
        if (activeTab) this.refreshPoiPanel();
      } catch (e) {
        console.warn('CustomInfoDialog | poi auto-refresh failed', e);
      }
    });
    // Auto-refresh finances when data layer updates
    window.addEventListener('guard-finances-updated', () => {
      try {
        if (!this.element || !this.currentOrganization) return;
        const activeTab = this.element.querySelector('[data-tab-panel="finances"]');
        if (activeTab) this.refreshFinancesPanel();
      } catch (e) {
        console.warn('CustomInfoDialog | finances auto-refresh failed', e);
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

    // Load saved position from localStorage if no explicit position given
    if (options.x == null && options.y == null) {
      try {
        const saved = localStorage.getItem(CustomInfoDialog.POS_LS_KEY);
        if (saved) {
          const pos = JSON.parse(saved);
          options = {
            ...options,
            x: pos.x,
            y: pos.y,
            width: pos.width ?? options.width,
            height: pos.height ?? options.height,
          };
        }
      } catch {
        /* ignore */
      }
    }

    // Create the dialog element directly with organization content
    this.element = await this.createOrganizationDialogElement(organization, options);

    // Add to document
    document.body.appendChild(this.element);

    // Register with focus manager
    DialogFocusManager.getInstance().registerDialog(this);

    // Add event listeners
    this.addEventListeners();

    // Attach presence indicator (shows other players' active tabs)
    this.presenceIndicator = new PresenceIndicator(this.element);
    this.presenceIndicator.attach();

    // Give this dialog focus immediately
    DialogFocusManager.getInstance().setFocus(this);

    // Center on screen if no position specified
    if (options.x == null && options.y == null) {
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
    const x = options.x ?? (window.innerWidth - width) / 2;
    const y = options.y ?? (window.innerHeight - height) / 2;

    // Only set position and size, all other styles come from CSS
    dialog.style.left = `${x}px`;
    dialog.style.top = `${y}px`;
    dialog.style.width = `${width}px`;
    dialog.style.height = `${height}px`;

    dialog.tabIndex = -1; // Make focusable for keyboard events

    const templatePath = 'modules/guard-management/templates/dialogs/info-dialog.hbs';
    const content = await foundry.applications.handlebars.renderTemplate(templatePath, {
      title: `Información: ${organization.name}`,
      initialTab: localStorage.getItem(CustomInfoDialog.TAB_LS_KEY) || 'general',
      isGM: !!(game as any)?.user?.isGM,
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
  public async refreshContent(): Promise<void> {
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
      // ALWAYS use GuardOrganizationManager as source of truth
      // It's updated via settings onChange and has the freshest data
      const freshOrganization = gm.guardOrganizationManager.getOrganization();

      if (!freshOrganization) {
        console.log('❌ No organization found in GuardOrganizationManager');
        return;
      }

      console.log('📊 Using fresh data from GuardOrganizationManager', {
        resources: freshOrganization.resources?.length || 0,
        reputation: freshOrganization.reputation?.length || 0,
      });

      // IMPORTANT: Update our current organization reference to the fresh one
      this.currentOrganization = freshOrganization;

      // Render panels with fresh data
      if (this.element) {
        const generalContainer = this.element.querySelector(
          '[data-tab-panel="general"]'
        ) as HTMLElement;
        if (generalContainer) {
          console.log('🔄 Rendering GeneralPanel...');
          await GeneralPanel.render(generalContainer, freshOrganization, () =>
            this.refreshContent()
          );
        }

        const patrolsContainer = this.element.querySelector(
          '[data-tab-panel="patrols"]'
        ) as HTMLElement;
        if (patrolsContainer) {
          console.log('🔄 Rendering PatrolsPanel...');
          await PatrolsPanel.render(patrolsContainer);
        }

        const auxiliariesContainer = this.element.querySelector(
          '[data-tab-panel="auxiliaries"]'
        ) as HTMLElement;
        if (auxiliariesContainer) {
          console.log('🔄 Rendering AuxiliariesPanel...');
          await PatrolsPanel.render(auxiliariesContainer, 'auxiliary');
        }

        const resourcesContainer = this.element.querySelector(
          '[data-tab-panel="resources"]'
        ) as HTMLElement;
        if (resourcesContainer) {
          console.log(
            '🔄 Rendering ResourcesPanel with',
            freshOrganization.resources?.length || 0,
            'resource IDs...'
          );
          await ResourcesPanel.render(resourcesContainer, freshOrganization);
        }

        const reputationContainer = this.element.querySelector(
          '[data-tab-panel="reputation"]'
        ) as HTMLElement;
        if (reputationContainer) {
          console.log(
            '🔄 Rendering ReputationPanel with',
            freshOrganization.reputation?.length || 0,
            'reputation IDs...'
          );
          await ReputationPanel.render(reputationContainer, freshOrganization);
        }

        const crimesContainer = this.element.querySelector(
          '[data-tab-panel="crimes"]'
        ) as HTMLElement;
        if (crimesContainer) {
          console.log('🔄 Rendering CrimesPanel...');
          await CrimesPanel.render(crimesContainer);
        }

        const prisonersContainer = this.element.querySelector(
          '[data-tab-panel="prisoners"]'
        ) as HTMLElement;
        if (prisonersContainer) {
          console.log('🔄 Rendering PrisonersPanel...');
          await PrisonersPanel.render(prisonersContainer);
        }

        const gangsContainer = this.element.querySelector(
          '[data-tab-panel="gangs"]'
        ) as HTMLElement;
        if (gangsContainer) {
          console.log('🔄 Rendering GangsPanel...');
          await GangsPanel.render(gangsContainer);
        }

        const buildingsContainer = this.element.querySelector(
          '[data-tab-panel="buildings"]'
        ) as HTMLElement;
        if (buildingsContainer) {
          console.log('🔄 Rendering BuildingsPanel...');
          await BuildingsPanel.render(buildingsContainer);
        }

        const poiContainer = this.element.querySelector(
          '[data-tab-panel="poi"]'
        ) as HTMLElement;
        if (poiContainer) {
          console.log('🔄 Rendering PoiPanel...');
          await PoiPanel.render(poiContainer);
        }

        const financesContainer = this.element.querySelector(
          '[data-tab-panel="finances"]'
        ) as HTMLElement;
        if (financesContainer) {
          console.log('🔄 Rendering FinancesPanel...');
          await FinancesPanel.render(financesContainer);
        }
      }

      console.log('✅ Refresh completed successfully');
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
      // Clean up presence indicator
      this.presenceIndicator?.detach();
      this.presenceIndicator = null;

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
   * Toggle minimized state — collapses to header pill, semi-transparent, draggable
   */
  private toggleMinimize(): void {
    if (!this.element) return;
    this.isMinimized = !this.isMinimized;

    const icon = this.element.querySelector('.custom-dialog-minimize i') as HTMLElement | null;

    if (this.isMinimized) {
      this.preMinimizeSize = { width: this.element.offsetWidth, height: this.element.offsetHeight };
      this.element.classList.add('minimized');
      // Measure natural header width before locking it
      this.element.style.width = 'max-content';
      const naturalWidth = this.element.offsetWidth;
      this.element.style.width = `${naturalWidth}px`;
      this.element.style.height = '';
      if (icon) icon.className = 'fas fa-window-restore';
    } else {
      this.element.classList.remove('minimized');
      this.element.style.width = `${this.preMinimizeSize.width}px`;
      this.element.style.height = `${this.preMinimizeSize.height}px`;
      if (icon) icon.className = 'fas fa-window-minimize';
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
    const minimizeBtn = this.element.querySelector('.custom-dialog-minimize') as HTMLElement;
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

    // Share button (GM only — visibility already set by template via isGM)
    const shareBtn = this.element.querySelector('.custom-dialog-share-players') as HTMLElement | null;
    if (shareBtn) {
      shareBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.shareWithPlayers();
      });
    }

    minimizeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleMinimize();
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

  public refreshAuxiliariesPanel() {
    const tabPanel = this.element?.querySelector(
      '[data-tab-panel="auxiliaries"]'
    ) as HTMLElement | null;
    if (!tabPanel) return;

    PatrolsPanel.render(tabPanel, 'auxiliary');
  }

  public refreshPrisonersPanel() {
    const tabPanel = this.element?.querySelector(
      '[data-tab-panel="prisoners"]'
    ) as HTMLElement | null;
    if (!tabPanel) return;

    PrisonersPanel.render(tabPanel);
  }

  public refreshCrimesPanel() {
    const tabPanel = this.element?.querySelector('[data-tab-panel="crimes"]') as HTMLElement | null;
    if (!tabPanel) return;

    CrimesPanel.render(tabPanel);
  }

  public refreshGangsPanel() {
    const tabPanel = this.element?.querySelector('[data-tab-panel="gangs"]') as HTMLElement | null;
    if (!tabPanel) return;

    GangsPanel.render(tabPanel);
  }

  public refreshBuildingsPanel() {
    const tabPanel = this.element?.querySelector(
      '[data-tab-panel="buildings"]'
    ) as HTMLElement | null;
    if (!tabPanel) return;

    BuildingsPanel.render(tabPanel);
  }

  public refreshPoiPanel() {
    const tabPanel = this.element?.querySelector(
      '[data-tab-panel="poi"]'
    ) as HTMLElement | null;
    if (!tabPanel) return;

    PoiPanel.render(tabPanel);
  }

  public refreshFinancesPanel() {
    const tabPanel = this.element?.querySelector(
      '[data-tab-panel="finances"]'
    ) as HTMLElement | null;
    if (!tabPanel) return;

    FinancesPanel.render(tabPanel);
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

    // Track user interaction
    this.lastInteractionTime = Date.now();

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
      this.presenceIndicator?.reposition();
    }

    if (this.isResizing && !this.isMinimized) {
      const rect = this.element.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      const newHeight = e.clientY - rect.top;

      this.element.style.width = Math.max(300, newWidth) + 'px';
      this.element.style.height = Math.max(200, newHeight) + 'px';
      this.presenceIndicator?.reposition();
    }
  }

  /**
   * Handle mouse up
   */
  private handleMouseUp(): void {
    if (this.element) {
      this.element.style.cursor = '';
      if ((this.isDragging || this.isResizing) && this.element) {
        const r = this.element.getBoundingClientRect();
        try {
          localStorage.setItem(
            CustomInfoDialog.POS_LS_KEY,
            JSON.stringify({ x: r.left, y: r.top, width: r.width, height: r.height })
          );
        } catch {
          /* ignore */
        }
      }
    }
    this.isDragging = false;
    this.isResizing = false;
  }

  /**
   * Handle keyboard events
   */
  private handleKeyDown(e: KeyboardEvent): void {
    // Track user interaction (any key = active)
    this.lastInteractionTime = Date.now();

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

    if (isClickOnDialog) {
      this.lastInteractionTime = Date.now();
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
        if (
          data.type === 'guard-resource' ||
          data.type === 'reputation' ||
          data.type === 'guard-modifier'
        ) {
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
      } else if (data.type === 'guard-modifier') {
        console.log('🛡️ Guard Modifier drop:', data.modifierData.name);
        await this.assignGuardModifierToOrganization(data.modifierData);

        NotificationService.info(
          `Modificador "${data.modifierData.name}" asignado a la organización`
        );

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

  /**
   * Assign a guard modifier to the current organization
   */
  private async assignGuardModifierToOrganization(modifierData: any): Promise<void> {
    if (!this.currentOrganization) return;

    const gm = (window as any).GuardManagement;
    if (!gm?.guardOrganizationManager) return;

    // Check if modifier is already assigned
    if (this.currentOrganization.activeModifiers?.includes(modifierData.id)) {
      NotificationService.warn('Este modificador ya está activo en la organización');
      return;
    }

    const updatedModifiers = [...(this.currentOrganization.activeModifiers || []), modifierData.id];

    await gm.guardOrganizationManager.updateOrganization({
      activeModifiers: updatedModifiers,
    });
  }

  /**
   * Get the timestamp of the last user interaction
   */
  public getLastInteractionTime(): number {
    return this.lastInteractionTime;
  }

  /**
   * Activate a specific tab programmatically
   */
  public activateTab(tab: string): void {
    if (!this.element) return;
    const btn = this.element.querySelector(`.org-tab-btn[data-tab="${tab}"]`) as HTMLButtonElement | null;
    if (btn) btn.click();
  }

  /**
   * Show a dismissable banner asking the player to go to a specific tab
   */
  public showGmBanner(tab: string): void {
    if (!this.element) return;

    // Remove any existing banner first
    this.element.querySelector('.guard-gm-banner')?.remove();

    const tabLabels: Record<string, string> = {
      general: 'General',
      patrols: 'Patrullas',
      auxiliaries: 'Auxiliares',
      resources: 'Recursos',
      reputation: 'Reputación',
      crimes: 'Crímenes',
      prisoners: 'Prisioneros',
      gangs: 'Bandas',
      buildings: 'Edificios',
      poi: 'Gente de Interés',
      finances: 'Finanzas',
    };
    const label = tabLabels[tab] ?? tab;

    const banner = document.createElement('div');
    banner.className = 'guard-gm-banner';
    banner.innerHTML = `
      <span class="guard-gm-banner-text">
        <i class="fas fa-share-alt"></i>
        El GM quiere que veas <strong>${label}</strong>
      </span>
      <div class="guard-gm-banner-actions">
        <button class="guard-gm-banner-go"><i class="fas fa-arrow-right"></i> Ir</button>
        <button class="guard-gm-banner-dismiss" title="Cerrar"><i class="fas fa-times"></i></button>
      </div>`;

    const dismiss = () => banner.remove();

    banner.querySelector('.guard-gm-banner-go')?.addEventListener('click', () => {
      banner.remove();
      this.activateTab(tab);
    });
    banner.querySelector('.guard-gm-banner-dismiss')?.addEventListener('click', dismiss);

    // Auto-dismiss when the player clicks any tab
    this.element.querySelectorAll('.org-tab-btn').forEach((btn) => {
      btn.addEventListener('click', dismiss, { once: true });
    });

    const content = this.element.querySelector('.custom-dialog-content') as HTMLElement | null;
    if (content) this.element.insertBefore(banner, content);
  }

  /**
   * Flash the dialog to draw attention (player was recently active)
   */
  public flashAttention(): void {
    if (!this.element) return;
    this.element.classList.remove('guard-dialog-attention');
    // Force reflow so re-adding the class triggers the animation again
    void this.element.offsetWidth;
    this.element.classList.add('guard-dialog-attention');
    setTimeout(() => this.element?.classList.remove('guard-dialog-attention'), 1600);
  }

  /**
   * Write to game.settings to trigger the onChange on all player clients
   */
  private shareWithPlayers(): void {
    const layout = this.element?.querySelector('.org-tabs-layout') as HTMLElement | null;
    const currentTab = layout?.getAttribute('data-current-tab') || 'general';

    game?.settings?.set('guard-management', 'orgDialogRequest' as any, {
      tab: currentTab,
      timestamp: Date.now(),
    });

    ui?.notifications?.info('Mostrando interfaz a los jugadores...');
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

      // Notify presence indicator of tab change
      this.presenceIndicator?.notifyInteraction(tab);

      // Refresh panel when user clicks a tab (skip during initial setup to avoid race with refreshContent)
      if (this.tabsInitialized) {
        if (tab === 'patrols') {
          this.refreshPatrolsPanel();
        }
        if (tab === 'auxiliaries') {
          this.refreshAuxiliariesPanel();
        }
        if (tab === 'prisoners') {
          this.refreshPrisonersPanel();
        }
        if (tab === 'crimes') {
          this.refreshCrimesPanel();
        }
        if (tab === 'gangs') {
          this.refreshGangsPanel();
        }
        if (tab === 'buildings') {
          this.refreshBuildingsPanel();
        }
        if (tab === 'poi') {
          this.refreshPoiPanel();
        }
        if (tab === 'finances') {
          this.refreshFinancesPanel();
        }
      }
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
