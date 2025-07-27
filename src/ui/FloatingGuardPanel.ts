/**
 * Floating Guard Management Panel - Canvas overlay component
 */

import { html, TemplateResult } from 'lit-html';
import { GMWarehouseDialog } from '../dialogs/GMWarehouseDialog';
import { GuardDialogManager } from '../managers/GuardDialogManager';
import { safeRender } from '../utils/template-renderer.js';

export interface FloatingPanelPosition {
  x: number;
  y: number;
}

export class FloatingGuardPanel {
  private panel: HTMLElement | null = null;
  private isDragging: boolean = false;
  private dragOffset: { x: number; y: number } = { x: 0, y: 0 };
  private dialogManager: GuardDialogManager;
  private uiRefreshHandler?: (event: Event) => void;

  private readonly STORAGE_KEY = 'guard-management-panel-position';
  private readonly DEFAULT_POSITION: FloatingPanelPosition = { x: 50, y: 50 };

  constructor(dialogManager: GuardDialogManager) {
    this.dialogManager = dialogManager;
  }

  /**
   * Initialize the floating panel
   */
  public initialize(): void {
    this.createPanel();
    this.attachEventListeners();
    this.restorePosition();
  }

  /**
   * Show the floating panel
   */
  public show(): void {
    if (this.panel) {
      this.panel.style.display = 'block';
      this.saveVisibility(true);
    }
  }

  /**
   * Hide the floating panel
   */
  public hide(): void {
    if (this.panel) {
      this.panel.style.display = 'none';
      this.saveVisibility(false);
    }
  }

  /**
   * Toggle panel visibility
   */
  public toggle(): void {
    if (this.panel) {
      const isVisible = this.panel.style.display !== 'none';
      if (isVisible) {
        this.hide();
      } else {
        this.show();
      }
    }
  }

  /**
   * Cleanup and remove the panel
   */
  public cleanup(): void {
    // Remove UI refresh listener
    if (this.uiRefreshHandler) {
      document.removeEventListener('guard-ui-refresh', this.uiRefreshHandler);
      this.uiRefreshHandler = undefined;
    }

    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
  }

  /**
   * Force reconfigure GM elements (for debugging)
   */
  public forceConfigureGM(): void {
    // Simplified - no longer needed
  }

  /**
   * Refresh the panel content after game is ready
   */
  public refreshPanel(): void {
    if (!this.panel) return;

    // Remove existing panel
    this.panel.remove();

    // Recreate with current game state
    this.createPanel();
    this.attachEventListeners();
    this.restorePosition();
  }

  /**
   * Create the panel HTML element
   */
  private createPanel(): void {
    this.panel = document.createElement('div');
    this.panel.id = 'guard-management-floating-panel';
    this.panel.className = 'guard-floating-panel';

    // Check GM status
    const isGM = (game?.user as any)?.isGM;

    // Render using lit-html templates
    const panelTemplate = this.renderPanelTemplate(isGM);
    safeRender(panelTemplate, this.panel);

    // Add CSS styles
    this.addStyles();

    // Append to body (will be positioned over canvas)
    document.body.appendChild(this.panel);
  }

  /**
   * Main panel template
   */
  private renderPanelTemplate(isGM: boolean): TemplateResult {
    return html` ${this.renderPanelHeader()} ${this.renderPanelContent(isGM)} `;
  }

  /**
   * Panel header with controls
   */
  private renderPanelHeader(): TemplateResult {
    return html`
      <div class="panel-header">
        <div class="panel-title">
          <i class="fas fa-shield-alt"></i>
          <span>Gestión de Guardias</span>
        </div>
        <div class="panel-controls">
          <button class="panel-minimize" title="Minimizar">
            <i class="fas fa-minus"></i>
          </button>
          <button class="panel-close" title="Cerrar">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Panel content section
   */
  private renderPanelContent(isGM: boolean): TemplateResult {
    return html`
      <div class="panel-content">
        ${this.renderQuickActions(isGM)} ${this.renderOrganizationSummary()}
      </div>
    `;
  }

  /**
   * Quick action buttons
   */
  private renderQuickActions(isGM: boolean): TemplateResult {
    return html`
      <div class="quick-actions">
        <button class="action-btn primary" data-action="manage-organizations">
          <i class="fas fa-info-circle"></i>
          <span>Ver Organización</span>
        </button>
        ${isGM ? this.renderGMWarehouseButton() : html`<!-- No GM button - user is not GM -->`}
        <button class="action-btn secondary" data-action="debug-info">
          <i class="fas fa-bug"></i>
          <span>Debug Info</span>
        </button>
      </div>
    `;
  }

  /**
   * GM Warehouse button (only for GMs)
   */
  private renderGMWarehouseButton(): TemplateResult {
    return html`
      <button class="action-btn secondary" data-action="open-warehouse">
        <i class="fas fa-warehouse"></i>
        <span>GM Warehouse</span>
      </button>
    `;
  }

  /**
   * Organization summary section
   */
  private renderOrganizationSummary(): TemplateResult {
    return html`
      <div class="organization-summary">
        <div class="summary-header">Organización de Guardias</div>
        <div class="organization-list" id="organization-quick-list">
          <!-- Dynamic content will be populated here -->
        </div>
      </div>
    `;
  }

  /**
   * Add CSS styles for the floating panel
   */
  private addStyles(): void {
    const existingStyle = document.getElementById('guard-floating-panel-styles');
    if (existingStyle) return;

    const style = document.createElement('style');
    style.id = 'guard-floating-panel-styles';
    style.textContent = `
      .guard-floating-panel {
        position: fixed;
        width: 280px;
        min-height: 200px;
        background: linear-gradient(135deg, rgba(0, 0, 0, 0.95), rgba(20, 20, 20, 0.95));
        border: 2px solid #5e5e5e;
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
        z-index: 40;
        font-family: 'Signika', sans-serif;
        backdrop-filter: blur(10px);
        user-select: none;
      }

      .guard-floating-panel .panel-header {
        background: linear-gradient(90deg, #4a4a4a, #2a2a2a);
        color: white;
        padding: 8px 12px;
        border-radius: 6px 6px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
        border-bottom: 1px solid #666;
      }

      .guard-floating-panel .panel-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: bold;
        font-size: 0.9rem;
      }

      .guard-floating-panel .panel-controls {
        display: flex;
        gap: 4px;
      }

      .guard-floating-panel .panel-controls button {
        background: none;
        border: none;
        color: #ccc;
        cursor: pointer;
        padding: 4px 6px;
        border-radius: 3px;
        font-size: 0.8rem;
        transition: all 0.2s;
      }

      .guard-floating-panel .panel-controls button:hover {
        background: rgba(255, 255, 255, 0.1);
        color: white;
      }

      .guard-floating-panel .panel-content {
        padding: 12px;
      }

      .guard-floating-panel .quick-actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 12px;
      }

      .guard-floating-panel .action-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.85rem;
        transition: all 0.2s;
        font-family: inherit;
      }

      .guard-floating-panel .action-btn.primary {
        background: linear-gradient(135deg, #4a7c59, #2d5a37);
        color: white;
      }

      .guard-floating-panel .action-btn.primary:hover {
        background: linear-gradient(135deg, #5a8c69, #3d6a47);
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      }

      .guard-floating-panel .action-btn.secondary {
        background: linear-gradient(135deg, #666, #444);
        color: white;
      }

      .guard-floating-panel .action-btn.secondary:hover {
        background: linear-gradient(135deg, #777, #555);
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      }

      .guard-floating-panel .action-btn.gm-only {
        display: flex;
      }

      .guard-floating-panel .organization-summary {
        border-top: 1px solid #444;
        padding-top: 12px;
      }

      .guard-floating-panel .summary-header {
        color: #ddd;
        font-size: 0.8rem;
        font-weight: bold;
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .guard-floating-panel .organization-list {
        max-height: 120px;
        overflow-y: auto;
      }

      .guard-floating-panel .organization-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 8px;
        margin: 2px 0;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
        font-size: 0.8rem;
        color: #ccc;
        cursor: pointer;
        transition: all 0.2s;
      }

      .guard-floating-panel .organization-item:hover {
        background: rgba(255, 255, 255, 0.1);
        color: white;
      }

      .guard-floating-panel .organization-name {
        font-weight: bold;
      }

      .guard-floating-panel .organization-subtitle {
        color: #999;
        font-size: 0.7rem;
      }

      .guard-floating-panel.minimized .panel-content {
        display: none;
      }

      .guard-floating-panel.dragging {
        opacity: 0.8;
        cursor: grabbing;
      }

      /* Scrollbar styling */
      .guard-floating-panel .organization-list::-webkit-scrollbar {
        width: 4px;
      }

      .guard-floating-panel .organization-list::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
      }

      .guard-floating-panel .organization-list::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 2px;
      }

      .guard-floating-panel .organization-list::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.5);
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Attach event listeners for interactions
   */
  private attachEventListeners(): void {
    if (!this.panel) return;

    // Drag functionality
    const header = this.panel.querySelector('.panel-header') as HTMLElement;
    if (header) {
      header.addEventListener('mousedown', this.handleDragStart.bind(this));
    }

    // Panel controls
    const minimizeBtn = this.panel.querySelector('.panel-minimize') as HTMLElement;
    const closeBtn = this.panel.querySelector('.panel-close') as HTMLElement;

    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', this.handleMinimize.bind(this));
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', this.hide.bind(this));
    }

    // Action buttons
    const actionBtns = this.panel.querySelectorAll('.action-btn');
    actionBtns.forEach((btn) => {
      btn.addEventListener('click', this.handleActionClick.bind(this));
    });

    // Global drag handlers
    document.addEventListener('mousemove', this.handleDragMove.bind(this));
    document.addEventListener('mouseup', this.handleDragEnd.bind(this));

    // Setup UI refresh listener
    this.setupUIRefreshListener();
  }

  /**
   * Setup listener for UI refresh events
   */
  private setupUIRefreshListener(): void {
    this.uiRefreshHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      console.log('🔄 FloatingGuardPanel received UI refresh event:', detail);
      
      // Refresh panel content for any guard-management document changes
      if (detail.documentType?.startsWith('guard-management.')) {
        console.log('♻️ Refreshing floating panel due to document change');
        this.refreshPanel();
      }
    };

    document.addEventListener('guard-ui-refresh', this.uiRefreshHandler);
    console.log('✅ FloatingGuardPanel UI refresh listener set up');
  }

  /**
   * Handle drag start
   */
  private handleDragStart(event: MouseEvent): void {
    if (!this.panel) return;

    this.isDragging = true;
    this.panel.classList.add('dragging');

    const rect = this.panel.getBoundingClientRect();
    this.dragOffset = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    event.preventDefault();
  }

  /**
   * Handle drag move
   */
  private handleDragMove(event: MouseEvent): void {
    if (!this.isDragging || !this.panel) return;

    const x = event.clientX - this.dragOffset.x;
    const y = event.clientY - this.dragOffset.y;

    // Keep panel within viewport bounds
    const maxX = window.innerWidth - this.panel.offsetWidth;
    const maxY = window.innerHeight - this.panel.offsetHeight;

    const clampedX = Math.max(0, Math.min(maxX, x));
    const clampedY = Math.max(0, Math.min(maxY, y));

    this.panel.style.left = `${clampedX}px`;
    this.panel.style.top = `${clampedY}px`;
  }

  /**
   * Handle drag end
   */
  private handleDragEnd(): void {
    if (!this.isDragging || !this.panel) return;

    this.isDragging = false;
    this.panel.classList.remove('dragging');

    // Save position
    this.savePosition();
  }

  /**
   * Handle minimize toggle
   */
  private handleMinimize(): void {
    if (!this.panel) return;

    this.panel.classList.toggle('minimized');

    const icon = this.panel.querySelector('.panel-minimize i') as HTMLElement;
    if (icon) {
      const isMinimized = this.panel.classList.contains('minimized');
      icon.className = isMinimized ? 'fas fa-plus' : 'fas fa-minus';
    }
  }

  /**
   * Handle action button clicks
   */
  private handleActionClick(event: Event): void {
    const target = event.currentTarget as HTMLElement;
    const action = target.getAttribute('data-action');

    switch (action) {
      case 'manage-organizations':
        this.dialogManager.showManageOrganizationsDialog();
        break;
      case 'open-warehouse':
        this.openGMWarehouse();
        break;
      case 'debug-info':
        this.showDebugInfo();
        break;
    }
  }

  /**
   * Open the GM Warehouse dialog
   */
  private openGMWarehouse(): void {
    try {
      // IMMEDIATE RECOVERY ATTEMPT - check and restore if needed
      this.ensureModuleAvailable();

      // Verify that GuardManagement module is available
      const gm = (window as any).GuardManagement;

      if (!gm) {
        if (ui?.notifications) {
          ui.notifications.error(
            'Error crítico: El módulo Guard Management ha sido eliminado. Recarga la página.'
          );
        }
        return;
      }

      if (!gm.isInitialized) {
        if (ui?.notifications) {
          ui.notifications.warn(
            'Módulo aún no está completamente inicializado. Intenta de nuevo en un momento.'
          );
        }
        return;
      }

      if (!gm.documentManager) {
        if (ui?.notifications) {
          ui.notifications.warn(
            'Sistema de datos aún no está listo. Intenta de nuevo en un momento.'
          );
        }
        return;
      }

      GMWarehouseDialog.show();
    } catch (error) {
      console.error('FloatingGuardPanel.openGMWarehouse() | Error:', error);
      if (ui?.notifications) {
        ui.notifications.error(
          `Error al abrir el almacén: ${error instanceof Error ? error.message : 'Error desconocido'}`
        );
      }
    }
  }

  /**
   * Ensure the GuardManagement module is available, restore if needed
   */
  private ensureModuleAvailable(): void {
    const currentModule = (window as any).GuardManagement;

    if (!currentModule) {
      // Try to find a backup reference in the system
      try {
        // Look for the module in Foundry's module registry
        const foundryModule = (game as any)?.modules?.get('guard-management');
        if (foundryModule && foundryModule.active) {
          // Display recovery notification
          if (ui?.notifications) {
            ui.notifications.warn(
              'El módulo Guard Management fue eliminado inesperadamente. Por favor, recarga la página.'
            );
          }
        }
      } catch (error) {
        console.error('FloatingGuardPanel | Error during module recovery attempt:', error);
      }
    }
  }

  /**
   * Show debug info in console
   */
  private showDebugInfo(): void {
    console.log('=== 🔍 GUARD MANAGEMENT DEBUG INFO ===');

    // 1. Game and User Status
    console.log('📊 Game Status:', {
      gameExists: !!game,
      gameReady: game?.ready,
      userExists: !!game?.user,
      isGM: (game?.user as any)?.isGM,
      userId: game?.user?.id,
      userName: game?.user?.name,
    });

    // 2. Module Status
    const gm = (window as any).GuardManagement;
    console.log('🏛️ Module Status:', {
      moduleExists: !!gm,
      guardManager: !!gm?.guardManager,
      dialogManager: !!gm?.dialogManager,
      documentManager: !!gm?.documentManager,
      floatingPanel: !!gm?.floatingPanel,
    });

    // 3. Organization Data
    const organizations = this.dialogManager.guardOrganizationManager.getAllOrganizations();
    console.log('🏰 Organizations:', {
      count: organizations.length,
      organizations: organizations,
    });

    // 4. GM Warehouse Templates Data
    console.log('🏪 GM Warehouse Templates:');

    // Resource Templates
    const resourceTemplatesKey = 'guard-management-resource-templates';
    const resourceTemplates = JSON.parse(localStorage.getItem(resourceTemplatesKey) || '[]');
    console.log('📦 Resource Templates:', {
      storageKey: resourceTemplatesKey,
      count: resourceTemplates.length,
      templates: resourceTemplates,
    });

    // Reputation Templates
    const reputationTemplatesKey = 'guard-management-reputation-templates';
    const reputationTemplates = JSON.parse(localStorage.getItem(reputationTemplatesKey) || '[]');
    console.log('⭐ Reputation Templates:', {
      storageKey: reputationTemplatesKey,
      count: reputationTemplates.length,
      templates: reputationTemplates,
    });

    // Patrol Effect Templates
    const patrolEffectTemplatesKey = 'guard-management-patrol-effect-templates';
    const patrolEffectTemplates = JSON.parse(
      localStorage.getItem(patrolEffectTemplatesKey) || '[]'
    );
    console.log('⚡ Patrol Effect Templates:', {
      storageKey: patrolEffectTemplatesKey,
      count: patrolEffectTemplates.length,
      templates: patrolEffectTemplates,
    });

    // 5. Local Storage Debug
    console.log('💾 Local Storage Keys:');
    const guardKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('guard-management')) {
        guardKeys.push({
          key: key,
          valueLength: localStorage.getItem(key)?.length || 0,
          preview: localStorage.getItem(key)?.substring(0, 100) + '...',
        });
      }
    }
    console.log('🔑 Guard Management Storage:', guardKeys);

    // 6. Document Storage Debug
    if (gm?.documentManager) {
      console.log('📄 Document Manager:', {
        allDocuments: gm.documentManager.getGuardOrganizations(),
        documentCount: gm.documentManager.getGuardOrganizations()?.length || 0,
      });
    }

    // 7. Dialog System Check
    console.log('🪟 Dialog System:', {
      DialogV2Available: !!foundry?.applications?.api?.DialogV2,
      standardDialogAvailable: !!Dialog,
    });

    // 8. Canvas and UI Status
    console.log('🎮 Canvas & UI:', {
      canvasExists: !!canvas,
      canvasReady: canvas?.ready,
      uiExists: !!ui,
      notificationsExists: !!ui?.notifications,
    });

    console.log('=== END DEBUG INFO ===');
  }

  /**
   * Update the organization list in the panel
   */
  public updateOrganizationList(): void {
    const listContainer = this.panel?.querySelector('#organization-quick-list');
    if (!listContainer) return;

    const organizations = this.dialogManager.guardOrganizationManager.getAllOrganizations();
    const organizationTemplate = this.renderOrganizationList(organizations);

    safeRender(organizationTemplate, listContainer as HTMLElement);
  }

  /**
   * Render organization list
   */
  private renderOrganizationList(organizations: any[]): TemplateResult {
    if (organizations.length === 0) {
      return html`
        <div style="color: #999; font-size: 0.75rem; text-align: center; padding: 8px;">
          No hay organizaciones
        </div>
      `;
    }

    return html` ${organizations.map((org) => this.renderOrganizationItem(org))} `;
  }

  /**
   * Render individual organization item
   */
  private renderOrganizationItem(org: any): TemplateResult {
    return html`
      <div
        class="organization-item"
        data-org-id="${org.id}"
        @click=${() => this.handleOrganizationClick()}
      >
        <div>
          <div class="organization-name">${org.name}</div>
          <div class="organization-subtitle">${org.subtitle}</div>
        </div>
        <div style="color: #888; font-size: 0.7rem;">${org.patrols.length} patrullas</div>
      </div>
    `;
  }

  /**
   * Handle organization item click
   */
  private handleOrganizationClick(): void {
    this.dialogManager.showEditOrganizationDialog();
  }

  /**
   * Save panel position to localStorage
   */
  private savePosition(): void {
    if (!this.panel) return;

    const position: FloatingPanelPosition = {
      x: parseInt(this.panel.style.left) || this.DEFAULT_POSITION.x,
      y: parseInt(this.panel.style.top) || this.DEFAULT_POSITION.y,
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(position));
  }

  /**
   * Restore panel position from localStorage
   */
  private restorePosition(): void {
    if (!this.panel) return;

    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      const position: FloatingPanelPosition = saved ? JSON.parse(saved) : this.DEFAULT_POSITION;

      // Ensure position is within viewport
      const maxX = window.innerWidth - this.panel.offsetWidth;
      const maxY = window.innerHeight - this.panel.offsetHeight;

      const clampedX = Math.max(0, Math.min(maxX, position.x));
      const clampedY = Math.max(0, Math.min(maxY, position.y));

      this.panel.style.left = `${clampedX}px`;
      this.panel.style.top = `${clampedY}px`;
    } catch (error) {
      this.panel.style.left = `${this.DEFAULT_POSITION.x}px`;
      this.panel.style.top = `${this.DEFAULT_POSITION.y}px`;
    }
  }

  /**
   * Save panel visibility state
   */
  private saveVisibility(visible: boolean): void {
    localStorage.setItem('guard-management-panel-visible', visible.toString());
  }

  /**
   * Restore panel visibility state
   */
  public restoreVisibility(): void {
    const saved = localStorage.getItem('guard-management-panel-visible');
    const shouldShow = saved !== null ? saved === 'true' : true; // Default to visible

    if (shouldShow) {
      this.show();
    } else {
      this.hide();
    }
  }
}
