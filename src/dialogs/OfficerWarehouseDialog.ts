// @ts-nocheck
/**
 * OfficerWarehouseDialog
 * Dialog for managing all created officers, split into Oficiales / Civiles tabs.
 * Both tabs show the same officer-card list, filtered by officer.isCivil.
 */

import type { Officer } from '../types/officer';
import { ImportExportService } from '../utils/ImportExportService.js';
import { AddOrEditOfficerDialog } from './AddOrEditOfficerDialog.js';

export class OfficerWarehouseDialog {
  private static instance: OfficerWarehouseDialog | null = null;
  private element: HTMLElement | null = null;
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };
  private activeTab: 'officers' | 'civiles' = 'officers';

  /**
   * Static method to show the singleton instance
   */
  public static async show(): Promise<void> {
    if (!OfficerWarehouseDialog.instance) {
      OfficerWarehouseDialog.instance = new OfficerWarehouseDialog();
    }

    await OfficerWarehouseDialog.instance.show();
  }

  constructor() {
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
  }

  /**
   * Show the officer warehouse dialog
   */
  public async show(): Promise<void> {
    if (this.element && this.isOpen()) {
      this.bringToFront();
      return;
    }

    this.element = await this.createElement();
    document.body.appendChild(this.element);

    this.addEventListeners();
    this.setupDragAndDrop();
  }

  /**
   * Close the dialog
   */
  public close(): void {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }

  /**
   * Check if dialog is open
   */
  public isOpen(): boolean {
    return this.element !== null && document.body.contains(this.element);
  }

  /**
   * Bring dialog to front
   */
  private bringToFront(): void {
    if (this.element) {
      this.element.style.zIndex = '100';
    }
  }

  /**
   * Create the dialog HTML element
   */
  private async createElement(): Promise<HTMLElement> {
    const dialog = document.createElement('div');
    dialog.className = 'officer-warehouse-window custom-info-dialog';
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 800px;
      max-height: 80vh;
      z-index: 100;
    `;

    const isGM = (game as any)?.user?.isGM || false;

    const oficialesContent = await renderTemplate(
      'modules/guard-management/templates/dialogs/officer-warehouse.hbs',
      { officers: this.getOfficers(false), isGM, isCivilTab: false }
    );
    const civilesContent = await renderTemplate(
      'modules/guard-management/templates/dialogs/officer-warehouse.hbs',
      { officers: this.getOfficers(true), isGM, isCivilTab: true }
    );

    dialog.innerHTML = `
      <header class="custom-dialog-header">
        <div class="custom-dialog-title">
          <i class="fas fa-users"></i>
          <span>Personal</span>
        </div>
        <div class="custom-dialog-controls">
          <button type="button" class="custom-dialog-btn custom-dialog-close header-button close" title="Cerrar" aria-label="Cerrar">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </header>
      <nav class="officer-wh-tabs">
        <button class="officer-wh-tab-btn active" data-tab="officers">
          <i class="fas fa-user-shield"></i> Oficiales
        </button>
        <button class="officer-wh-tab-btn" data-tab="civiles">
          <i class="fas fa-user-friends"></i> Civiles
        </button>
      </nav>
      <div class="window-content officer-warehouse-body">
        <div class="officer-wh-panel active" data-tab-panel="officers">
          ${oficialesContent}
        </div>
        <div class="officer-wh-panel" data-tab-panel="civiles">
          ${civilesContent}
        </div>
      </div>
    `;

    return dialog;
  }

  /**
   * Get officers filtered by isCivil flag
   */
  private getOfficers(civil: boolean): Officer[] {
    const gm = (window as any).GuardManagement;
    if (!gm?.officerManager) return [];
    return gm.officerManager.list().filter((o: Officer) => !!o.isCivil === civil);
  }

  /**
   * Add event listeners
   */
  private addEventListeners(): void {
    if (!this.element) return;

    // Close button
    const closeButton = this.element.querySelector('.header-button.close');
    closeButton?.addEventListener('click', () => this.close());

    // Drag functionality — attach to the header
    const header = this.element.querySelector('.custom-dialog-header');
    if (header) {
      header.addEventListener('mousedown', this.handleMouseDown);
    }

    // Tab switching
    this.element.querySelectorAll('.officer-wh-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = (btn as HTMLElement).dataset.tab as 'officers' | 'civiles';
        if (!tab || tab === this.activeTab) return;
        this.activeTab = tab;
        this.element!.querySelectorAll('.officer-wh-tab-btn').forEach((b) =>
          b.classList.toggle('active', b === btn)
        );
        this.element!.querySelectorAll('.officer-wh-panel').forEach((p) =>
          p.classList.toggle('active', (p as HTMLElement).dataset.tabPanel === tab)
        );
      });
    });

    // Add officer buttons (data-civil distinguishes which tab)
    this.element.querySelectorAll('.add-officer-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const isCivil = (btn as HTMLElement).dataset.civil === 'true';
        this.handleAddOfficer(isCivil);
      });
    });

    // View officer buttons
    this.element.querySelectorAll('.view-officer-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const officerId = (button as HTMLElement).dataset.officerId;
        if (officerId) this.handleViewOfficer(officerId);
      });
    });

    // Edit officer buttons
    this.element.querySelectorAll('.edit-officer-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const officerId = (button as HTMLElement).dataset.officerId;
        if (officerId) this.handleEditOfficer(officerId);
      });
    });

    // Delete officer buttons
    this.element.querySelectorAll('.delete-officer-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const officerId = (button as HTMLElement).dataset.officerId;
        if (officerId) this.handleDeleteOfficer(officerId);
      });
    });

    // Toggle civil button
    this.element.querySelectorAll('.toggle-civil-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const officerId = (button as HTMLElement).dataset.officerId;
        if (officerId) this.handleToggleCivil(officerId);
      });
    });

    // Export / Import buttons
    this.element.querySelectorAll('.warehouse-export-btn').forEach((btn) => {
      (btn as HTMLElement).addEventListener('click', async (e) => {
        e.preventDefault();
        const section = (btn as HTMLElement).dataset.section;
        const label = (btn as HTMLElement).dataset.sectionLabel || section;
        if (section) await ImportExportService.exportSection(label, section);
      });
    });

    this.element.querySelectorAll('.warehouse-import-btn').forEach((btn) => {
      (btn as HTMLElement).addEventListener('click', async (e) => {
        e.preventDefault();
        const section = (btn as HTMLElement).dataset.section;
        const label = (btn as HTMLElement).dataset.sectionLabel || section;
        if (!section) return;
        await ImportExportService.importSection(label, section, async () => {
          await this.refresh();
        });
      });
    });
  }

  /**
   * Setup drag and drop for officer cards
   */
  private setupDragAndDrop(): void {
    if (!this.element) return;

    const officerCards = this.element.querySelectorAll('.officer-card');
    officerCards.forEach((card) => {
      card.addEventListener('dragstart', (event) => {
        const officerId = (card as HTMLElement).dataset.officerId;
        if (!officerId) return;

        const gm = (window as any).GuardManagement;
        const officer = gm?.officerManager?.get(officerId);
        if (!officer) return;

        const dragData = {
          type: 'Officer',
          officerId: officer.id,
          officerData: officer,
        };

        (event as DragEvent).dataTransfer?.setData('text/plain', JSON.stringify(dragData));
        // Custom type allows drop-zones to detect officer kind during dragenter/dragover
        const officerTypeKey = officer.isCivil
          ? 'application/x-guard-civil-officer'
          : 'application/x-guard-officer';
        (event as DragEvent).dataTransfer?.setData(officerTypeKey, '1');
        (event as DragEvent).dataTransfer!.effectAllowed = 'copy';

        // Visual feedback
        (card as HTMLElement).style.opacity = '0.6';
      });

      card.addEventListener('dragend', (event) => {
        (card as HTMLElement).style.opacity = '1';
      });
    });
  }

  /**
   * Handle adding a new officer
   */
  private async handleAddOfficer(isCivil = false): Promise<void> {
    try {
      const newOfficer = await AddOrEditOfficerDialog.create();

      if (newOfficer) {
        // Mark as civil if created from the Civiles tab
        if (isCivil) {
          const gm = (window as any).GuardManagement;
          gm?.officerManager?.update(newOfficer.id, { isCivil: true });
        }

        await this.refresh();

        if (ui?.notifications) {
          ui.notifications.info(`"${newOfficer.name}" creado exitosamente`);
        }
      }
    } catch (error) {
      console.error('Error creating officer:', error);
      if (ui?.notifications) {
        ui.notifications.error('Error al crear el oficial');
      }
    }
  }

  /**
   * Handle viewing an officer
   */
  private async handleViewOfficer(officerId: string): Promise<void> {
    const gm = (window as any).GuardManagement;
    const officer = gm?.officerManager?.get(officerId);

    if (!officer) {
      if (ui?.notifications) {
        ui.notifications.error('Oficial no encontrado');
      }
      return;
    }

    const content = `
      <div class="officer-details">
        <div class="officer-header">
          <img src="${officer.actorImg}" alt="${officer.actorName}" class="officer-avatar-large" />
          <div>
            <h2>${officer.actorName}</h2>
            <h3>${officer.title}</h3>
            ${officer.isCivil ? '<span style="font-size:0.8em;opacity:0.7"><i class="fas fa-user-friends"></i> Civil</span>' : ''}
          </div>
        </div>
        <div class="officer-traits">
          <div class="pros-section">
            <h4><i class="fas fa-thumbs-up"></i> Pros</h4>
            ${
              officer.pros.length > 0
                ? officer.pros
                    .map(
                      (p) => `
              <div class="trait-detail">
                <strong>${p.title}</strong>
                <p>${p.description}</p>
              </div>
            `
                    )
                    .join('')
                : '<p>No hay pros</p>'
            }
          </div>
          <div class="cons-section">
            <h4><i class="fas fa-thumbs-down"></i> Cons</h4>
            ${
              officer.cons.length > 0
                ? officer.cons
                    .map(
                      (c) => `
              <div class="trait-detail">
                <strong>${c.title}</strong>
                <p>${c.description}</p>
              </div>
            `
                    )
                    .join('')
                : '<p>No hay cons</p>'
            }
          </div>
        </div>
      </div>
    `;

    await foundry.applications.api.DialogV2.wait({
      window: {
        title: `${officer.isCivil ? 'Civil' : 'Oficial'}: ${officer.actorName}`,
        resizable: true,
      },
      content,
      buttons: [
        {
          action: 'close',
          icon: 'fas fa-times',
          label: 'Cerrar',
        },
      ],
      rejectClose: false,
      modal: true,
    });
  }

  /**
   * Handle editing an officer
   */
  private async handleEditOfficer(officerId: string): Promise<void> {
    try {
      const gm = (window as any).GuardManagement;
      const officer = gm?.officerManager?.get(officerId);

      if (!officer) {
        if (ui?.notifications) {
          ui.notifications.error('Oficial no encontrado');
        }
        return;
      }

      const updatedOfficer = await AddOrEditOfficerDialog.edit(officer);

      if (updatedOfficer) {
        await this.refresh();

        if (ui?.notifications) {
          ui.notifications.info(`Oficial "${updatedOfficer.name}" actualizado`);
        }
      }
    } catch (error) {
      console.error('Error editing officer:', error);
      if (ui?.notifications) {
        ui.notifications.error('Error al editar el oficial');
      }
    }
  }

  /**
   * Handle deleting an officer
   */
  private async handleDeleteOfficer(officerId: string): Promise<void> {
    const gm = (window as any).GuardManagement;
    const officer = gm?.officerManager?.get(officerId);

    if (!officer) {
      if (ui?.notifications) {
        ui.notifications.error('Oficial no encontrado');
      }
      return;
    }

    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: 'Confirmar eliminación' },
      content: `<p>¿Estás seguro de que quieres eliminar a "${officer.actorName}"?</p>`,
      buttons: [
        { action: 'delete', icon: 'fas fa-trash', label: 'Eliminar' },
        { action: 'cancel', icon: 'fas fa-times', label: 'Cancelar' },
      ],
      rejectClose: false,
      modal: true,
    });

    if (result === 'delete') {
      gm.officerManager.delete(officerId);
      await this.refresh();
      ui?.notifications?.info(`"${officer.actorName}" eliminado`);
    }
  }

  /** Move officer between Oficiales ↔ Civiles tabs */
  private async handleToggleCivil(officerId: string): Promise<void> {
    const gm = (window as any).GuardManagement;
    const officer = gm?.officerManager?.get(officerId);
    if (!officer) return;
    gm.officerManager.update(officerId, { isCivil: !officer.isCivil });
    await this.refresh();
    const label = !officer.isCivil ? 'Civiles' : 'Oficiales';
    ui?.notifications?.info(`"${officer.actorName}" movido a ${label}`);
  }

  /**
   * Refresh the dialog content
   */
  private async refresh(): Promise<void> {
    if (!this.element) return;
    const isGM = (game as any)?.user?.isGM || false;

    for (const civil of [false, true] as const) {
      const panelKey = civil ? 'civiles' : 'officers';
      const panel = this.element.querySelector(`[data-tab-panel="${panelKey}"]`);
      if (!panel) continue;
      panel.innerHTML = await renderTemplate(
        'modules/guard-management/templates/dialogs/officer-warehouse.hbs',
        { officers: this.getOfficers(civil), isGM, isCivilTab: civil }
      );
    }
    this.addEventListeners();
    this.setupDragAndDrop();
  }

  /**
   * Handle mouse down on header (start drag)
   */
  private handleMouseDown(event: MouseEvent): void {
    // Only drag if clicking on header, not on buttons
    const target = event.target as HTMLElement;
    if (target.closest('.header-button')) return;

    this.isDragging = true;
    const rect = this.element!.getBoundingClientRect();
    this.dragOffset = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
    event.preventDefault();
  }

  /**
   * Handle mouse move (drag)
   */
  private handleMouseMove(event: MouseEvent): void {
    if (!this.isDragging || !this.element) return;

    const x = event.clientX - this.dragOffset.x;
    const y = event.clientY - this.dragOffset.y;

    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
    this.element.style.transform = 'none';
  }

  /**
   * Handle mouse up (end drag)
   */
  private handleMouseUp(): void {
    this.isDragging = false;
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
  }
}
