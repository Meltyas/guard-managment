/**
 * OfficerWarehouseDialog
 * Dialog for managing all created officers
 */

import type { Officer } from '../types/officer';
import { AddOrEditOfficerDialog } from './AddOrEditOfficerDialog.js';

export class OfficerWarehouseDialog {
  private static instance: OfficerWarehouseDialog | null = null;
  private element: HTMLElement | null = null;
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };

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
    dialog.className = 'dialog window-app officer-warehouse-window';
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 800px;
      max-height: 80vh;
      z-index: 100;
      background: #2b2b2b;
      border: 2px solid #555;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
      display: flex;
      flex-direction: column;
    `;

    // Get officers from OfficerManager
    const officers = this.getOfficers();
    const isGM = (game as any)?.user?.isGM || false;

    // Render using Handlebars template
    const content = await renderTemplate(
      'modules/guard-management/templates/dialogs/officer-warehouse.hbs',
      { officers, isGM }
    );

    dialog.innerHTML = `
      <header class="window-header" style="cursor: move; background: #1a1a1a; padding: 0.5rem 1rem; border-bottom: 2px solid #555; display: flex; justify-content: space-between; align-items: center;">
        <h4 class="window-title" style="margin: 0; color: #fff; font-size: 1.2rem;">Almacén de Oficiales</h4>
        <a class="header-button close" title="Close" style="cursor: pointer; color: #fff; font-size: 1.2rem;">
          <i class="fas fa-times"></i>
        </a>
      </header>
      <div class="window-content" style="overflow-y: auto; padding: 1rem; background: #2b2b2b;">
        ${content}
      </div>
    `;

    return dialog;
  }

  /**
   * Get officers from OfficerManager
   */
  private getOfficers(): Officer[] {
    const gm = (window as any).GuardManagement;
    if (!gm?.officerManager) {
      return [];
    }

    return gm.officerManager.list();
  }

  /**
   * Add event listeners
   */
  private addEventListeners(): void {
    if (!this.element) return;

    // Close button
    const closeButton = this.element.querySelector('.header-button.close');
    closeButton?.addEventListener('click', () => this.close());

    // Drag functionality
    const header = this.element.querySelector('.window-header');
    if (header) {
      header.addEventListener('mousedown', this.handleMouseDown);
    }

    // Add officer button
    const addButton = this.element.querySelector('.add-officer-btn');
    addButton?.addEventListener('click', () => this.handleAddOfficer());

    // View officer buttons
    const viewButtons = this.element.querySelectorAll('.view-officer-btn');
    viewButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        const officerId = (button as HTMLElement).dataset.officerId;
        if (officerId) {
          this.handleViewOfficer(officerId);
        }
      });
    });

    // Edit officer buttons
    const editButtons = this.element.querySelectorAll('.edit-officer-btn');
    editButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        const officerId = (button as HTMLElement).dataset.officerId;
        if (officerId) {
          this.handleEditOfficer(officerId);
        }
      });
    });

    // Delete officer buttons
    const deleteButtons = this.element.querySelectorAll('.delete-officer-btn');
    deleteButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        const officerId = (button as HTMLElement).dataset.officerId;
        if (officerId) {
          this.handleDeleteOfficer(officerId);
        }
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
  private async handleAddOfficer(): Promise<void> {
    try {
      const newOfficer = await AddOrEditOfficerDialog.create();

      if (newOfficer) {
        await this.refresh();

        if (ui?.notifications) {
          ui.notifications.info(`Oficial "${newOfficer.name}" creado exitosamente`);
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

    // Show officer details in a dialog
    const DialogV2Class = foundry.applications.api.DialogV2;
    if (!DialogV2Class) return;

    const content = `
      <div class="officer-details">
        <div class="officer-header">
          <img src="${officer.actorImg}" alt="${officer.actorName}" class="officer-avatar-large" />
          <div>
            <h2>${officer.actorName}</h2>
            <h3>${officer.title}</h3>
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

    await DialogV2Class.wait({
      window: {
        title: `Oficial: ${officer.actorName}`,
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

    // Confirmation dialog
    const DialogV2Class = foundry.applications.api.DialogV2;
    if (!DialogV2Class) return;

    const result = await DialogV2Class.wait({
      window: {
        title: 'Confirmar eliminación',
      },
      content: `<p>¿Estás seguro de que quieres eliminar al oficial "${officer.actorName}"?</p>`,
      buttons: [
        {
          action: 'delete',
          icon: 'fas fa-trash',
          label: 'Eliminar',
        },
        {
          action: 'cancel',
          icon: 'fas fa-times',
          label: 'Cancelar',
        },
      ],
      rejectClose: false,
      modal: true,
    });

    if (result === 'delete') {
      const deleted = gm.officerManager.delete(officerId);

      if (deleted) {
        await this.refresh();

        if (ui?.notifications) {
          ui.notifications.info(`Oficial "${officer.actorName}" eliminado`);
        }
      }
    }
  }

  /**
   * Refresh the dialog content
   */
  private async refresh(): Promise<void> {
    if (!this.element) return;

    const officers = this.getOfficers();
    const content = await renderTemplate(
      'modules/guard-management/templates/dialogs/officer-warehouse.hbs',
      { officers }
    );

    const contentArea = this.element.querySelector('.window-content');
    if (contentArea) {
      contentArea.innerHTML = content;
      this.addEventListeners();
      this.setupDragAndDrop();
    }
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
