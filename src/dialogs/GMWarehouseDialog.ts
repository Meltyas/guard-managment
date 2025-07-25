import { html, TemplateResult } from 'lit-html';
import { renderTemplateToString } from '../utils/template-renderer.js';

/**
 * GM Warehouse Dialog
 * A specialized dialog for GM-only warehouse/storage management with tabs
 */

export class GMWarehouseDialog {
  constructor() {
    // Check GM permissions
    if (!game?.user?.isGM) {
      throw new Error('Only GM can access the warehouse');
    }
  }

  /**
   * Show the GM Warehouse dialog
   */
  public async show(): Promise<boolean> {
    const content = this.generateContent();
    const title = 'GM Warehouse - Template Storage';

    try {
      const DialogV2Class = (foundry as any)?.applications?.api?.DialogV2;

      if (!DialogV2Class) {
        console.warn('DialogV2 no está disponible, usando Dialog estándar como fallback');
        return this.showWithStandardDialog();
      }

      const result = await DialogV2Class.wait({
        window: {
          title,
          resizable: true,
          classes: ['guard-management', 'gm-warehouse-dialog'],
        },
        position: {
          width: 800,
          height: 600,
        },
        content,
        buttons: [
          {
            action: 'close',
            icon: 'fas fa-times',
            label: 'Cerrar',
            default: true,
            callback: () => true,
          },
        ],
      });

      return result === 'close';
    } catch (error) {
      console.error('Error showing GM Warehouse dialog:', error);
      return false;
    }
  }

  /**
   * Generate the dialog content
   */
  private generateContent(): string {
    const template = this.renderWarehouseContent();
    // Convert TemplateResult to string for DialogV2 using safe renderer
    return renderTemplateToString(template);
  }

  /**
   * Render warehouse content using lit-html
   */
  private renderWarehouseContent(): TemplateResult {
    return html`
      <div class="gm-warehouse-container">
        ${this.renderWarehouseTabs()} ${this.renderWarehouseMainContent()} ${this.renderTabScript()}
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
          <p class="empty-state">No resource templates created yet</p>
        </div>
      </section>
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
   * Render tab switching script
   */
  private renderTabScript(): TemplateResult {
    return html`
      <script>
        // Tab switching functionality
        document.addEventListener('click', function (event) {
          const target = event.target.closest('.tab');
          if (target && target.hasAttribute('data-tab')) {
            const tabName = target.getAttribute('data-tab');
            const container = target.closest('.gm-warehouse-container');

            // Remove active class from all tabs and contents
            container.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
            container
              .querySelectorAll('.tab-content')
              .forEach((content) => content.classList.remove('active'));

            // Add active class to clicked tab and corresponding content
            target.classList.add('active');
            const content = container.querySelector('.tab-content[data-tab="' + tabName + '"]');
            if (content) content.classList.add('active');
          }

          // Handle add buttons
          const addButton = event.target.closest('[class*="add-"][class*="-btn"]');
          if (addButton) {
            const classList = addButton.className;
            let templateType = '';

            if (classList.includes('add-resource-btn')) templateType = 'resource';
            else if (classList.includes('add-reputation-btn')) templateType = 'reputation';
            else if (classList.includes('add-patrol-effect-btn')) templateType = 'patrol-effect';
            else if (classList.includes('add-guard-modifier-btn')) templateType = 'guard-modifier';

            if (templateType) {
              console.log(
                'Adding new ' + templateType + ' template - functionality to be implemented'
              );
              if (ui.notifications) {
                ui.notifications.info('Adding ' + templateType + ' template - Coming soon!');
              }
            }
          }
        });
      </script>
    `;
  }

  /**
   * Fallback to standard Dialog if DialogV2 is not available
   */
  private async showWithStandardDialog(): Promise<boolean> {
    return new Promise((resolve) => {
      new Dialog(
        {
          title: 'GM Warehouse - Template Storage',
          content: this.generateContent(),
          buttons: {
            close: {
              icon: '<i class="fas fa-times"></i>',
              label: 'Cerrar',
              callback: () => resolve(true),
            },
          },
          default: 'close',
          render: () => {
            // Tab functionality is handled by inline script
          },
        },
        {
          classes: ['guard-management', 'gm-warehouse-dialog'],
          width: 800,
          height: 600,
          resizable: true,
        }
      ).render(true);
    });
  }

  /**
   * Static method to show the warehouse dialog
   */
  static async show(): Promise<boolean> {
    try {
      const dialog = new GMWarehouseDialog();
      return await dialog.show();
    } catch (error) {
      console.error('Error creating GM Warehouse dialog:', error);
      if (error instanceof Error && error.message.includes('Only GM can access')) {
        ui.notifications?.error('Solo el GM puede acceder al almacén de plantillas');
      }
      return false;
    }
  }
}
