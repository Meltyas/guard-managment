// @ts-nocheck
/**
 * OfficerWarehouseDialog
 * Dialog for managing all personnel (officers + civilians)
 */

import type { Officer } from '../types/officer';
import { AddOrEditOfficerDialog } from './AddOrEditOfficerDialog.js';
import { GuardModal } from '../ui/GuardModal.js';

export class OfficerWarehouseDialog {
  private static instance: OfficerWarehouseDialog | null = null;
  private static readonly POS_LS_KEY = 'guard-management.officerWarehouse.pos';
  private element: HTMLElement | null = null;
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };

  /**
   * Static method to show the singleton instance
   */
  public static async show(pos?: { x?: number; y?: number }): Promise<void> {
    if (!OfficerWarehouseDialog.instance) {
      OfficerWarehouseDialog.instance = new OfficerWarehouseDialog();
    }

    await OfficerWarehouseDialog.instance.show(pos);
  }

  constructor() {
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
  }

  /**
   * Show the personnel warehouse dialog
   */
  public async show(pos?: { x?: number; y?: number }): Promise<void> {
    if (this.element && this.isOpen()) {
      this.bringToFront();
      return;
    }

    // Load saved position from localStorage if no explicit position given
    let resolvedPos = pos;
    if (resolvedPos?.x == null) {
      try {
        const saved = localStorage.getItem(OfficerWarehouseDialog.POS_LS_KEY);
        if (saved) {
          const p = JSON.parse(saved);
          resolvedPos = p;
        }
      } catch {
        /* ignore */
      }
    }

    this.element = await this.createElement();
    document.body.appendChild(this.element);

    if (resolvedPos?.x !== undefined && resolvedPos?.y !== undefined) {
      this.element.style.transform = 'none';
      this.element.style.left = resolvedPos.x + 'px';
      this.element.style.top = resolvedPos.y + 'px';
    }

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

    // Get officers and civilians
    const officers = this.getOfficers().map(this.enrichOfficerStats);
    const civilians = this.getCivilians().map(this.enrichOfficerStats);
    const isGM = (game as any)?.user?.isGM || false;

    // Render using Handlebars template
    const content = await foundry.applications.handlebars.renderTemplate(
      'modules/guard-management/templates/dialogs/officer-warehouse.hbs',
      { officers, civilians, isGM }
    );

    dialog.innerHTML = `
      <header class="window-header" style="cursor: move; background: #1a1a1a; padding: 0.5rem 1rem; border-bottom: 2px solid #555; display: flex; justify-content: space-between; align-items: center;">
        <h4 class="window-title" style="margin: 0; color: #fff; font-size: 1.2rem;">Personal</h4>
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
   * Get officers from OfficerManager (filtered by visibleToPlayers for non-GM)
   */
  private getOfficers(): Officer[] {
    const gm = (window as any).GuardManagement;
    if (!gm?.officerManager) {
      return [];
    }

    const isGM = (game as any)?.user?.isGM || false;
    const all: Officer[] = gm.officerManager.list();
    return isGM ? all : all.filter((o) => o.visibleToPlayers === true);
  }

  /**
   * Get civilians from CivilianManager (filtered by visibleToPlayers for non-GM)
   */
  private getCivilians(): Officer[] {
    const gm = (window as any).GuardManagement;
    if (!gm?.civilianManager) {
      return [];
    }

    const isGM = (game as any)?.user?.isGM || false;
    const all: Officer[] = gm.civilianManager.list();
    return isGM ? all : all.filter((c) => c.visibleToPlayers === true);
  }

  /**
   * Enrich officer with computed stats display data for templates
   */
  private enrichOfficerStats(officer: Officer): any {
    const stats = officer.stats || {};
    const entries = Object.entries(stats).filter(([, v]) => (v as number) !== 0);
    return {
      ...officer,
      hasStats: entries.length > 0,
      statsDisplay: entries.map(([key, value]) => ({
        key,
        value: (value as number) > 0 ? `+${value}` : `${value}`,
        cssClass:
          (value as number) > 0 ? 'stat-positive' : (value as number) < 0 ? 'stat-negative' : '',
      })),
    };
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

    // ── Officer event listeners ──────────────────────────────────────────

    // Add officer button
    const addOfficerButton = this.element.querySelector('.add-officer-btn');
    addOfficerButton?.addEventListener('click', () => this.handleAddOfficer());

    // Edit officer buttons
    const editOfficerButtons = this.element.querySelectorAll('.edit-officer-btn');
    editOfficerButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const officerId = (button as HTMLElement).dataset.officerId;
        if (officerId) this.handleEditOfficer(officerId);
      });
    });

    // Delete officer buttons
    const deleteOfficerButtons = this.element.querySelectorAll('.delete-officer-btn');
    deleteOfficerButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const officerId = (button as HTMLElement).dataset.officerId;
        if (officerId) this.handleDeleteOfficer(officerId);
      });
    });

    // Send officer to chat buttons
    const chatOfficerButtons = this.element.querySelectorAll('.send-officer-chat-btn');
    chatOfficerButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const officerId = (button as HTMLElement).dataset.officerId;
        if (officerId) this.handleSendToChat(officerId, 'officer');
      });
    });

    // ── Civilian event listeners ─────────────────────────────────────────

    // Add civilian button
    const addCivilianButton = this.element.querySelector('.add-civilian-btn');
    addCivilianButton?.addEventListener('click', () => this.handleAddCivilian());

    // Edit civilian buttons
    const editCivilianButtons = this.element.querySelectorAll('.edit-civilian-btn');
    editCivilianButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const civilianId = (button as HTMLElement).dataset.civilianId;
        if (civilianId) this.handleEditCivilian(civilianId);
      });
    });

    // Delete civilian buttons
    const deleteCivilianButtons = this.element.querySelectorAll('.delete-civilian-btn');
    deleteCivilianButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const civilianId = (button as HTMLElement).dataset.civilianId;
        if (civilianId) this.handleDeleteCivilian(civilianId);
      });
    });

    // Send civilian to chat buttons
    const chatCivilianButtons = this.element.querySelectorAll('.send-civilian-chat-btn');
    chatCivilianButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const civilianId = (button as HTMLElement).dataset.civilianId;
        if (civilianId) this.handleSendToChat(civilianId, 'civilian');
      });
    });

    // Toggle visibility buttons (officers + civilians)
    this.element.querySelectorAll('.toggle-visibility-btn').forEach((button) => {
      button.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const el = button as HTMLElement;
        const officerId = el.dataset.officerId;
        const civilianId = el.dataset.civilianId;
        if (officerId) this.handleToggleVisibility(officerId, 'officer');
        else if (civilianId) this.handleToggleVisibility(civilianId, 'civilian');
      });
    });
  }

  /**
   * Setup drag and drop for officer and civilian cards
   */
  private setupDragAndDrop(): void {
    if (!this.element) return;

    // Officer cards
    const officerCards = this.element.querySelectorAll('.officers-list .officer-card');
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
        (card as HTMLElement).style.opacity = '0.6';
      });

      card.addEventListener('dragend', () => {
        (card as HTMLElement).style.opacity = '1';
      });
    });

    // Civilian cards
    const civilianCards = this.element.querySelectorAll('.civilians-list .civilian-card');
    civilianCards.forEach((card) => {
      card.addEventListener('dragstart', (event) => {
        const civilianId = (card as HTMLElement).dataset.civilianId;
        if (!civilianId) return;

        const gm = (window as any).GuardManagement;
        const civilian = gm?.civilianManager?.get(civilianId);
        if (!civilian) return;

        const dragData = {
          type: 'Civilian',
          civilianId: civilian.id,
          civilianData: civilian,
        };

        (event as DragEvent).dataTransfer?.setData('text/plain', JSON.stringify(dragData));
        (event as DragEvent).dataTransfer!.effectAllowed = 'copy';
        (card as HTMLElement).style.opacity = '0.6';
      });

      card.addEventListener('dragend', () => {
        (card as HTMLElement).style.opacity = '1';
      });
    });
  }

  // ── Officer CRUD handlers ──────────────────────────────────────────────

  /**
   * Handle adding a new officer
   */
  private async handleAddOfficer(): Promise<void> {
    try {
      const newOfficer = await AddOrEditOfficerDialog.create(undefined, 'officer');

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

      const updatedOfficer = await AddOrEditOfficerDialog.edit(officer, 'officer');

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

    const body = `
      <div class="guard-modal-form" style="text-align: center;">
        <p>¿Estas seguro de que quieres eliminar el actor del oficial "${officer.actorName}"?</p>
        <p style="color: #f39c12; font-size: 0.9em;"><strong>Warning:</strong> El oficial se quedara sin actor asignado y necesitaras asignar uno nuevo.</p>
      </div>
    `;

    GuardModal.open({
      title: 'Confirmar vaciar actor',
      icon: 'fas fa-trash',
      body,
      saveLabel: 'Vaciar actor',
      onSave: async () => {
        const updated = gm.officerManager.update(officerId, {
          actorId: '',
          actorName: '',
          actorImg: undefined,
        });

        if (updated) {
          await this.refresh();
          if (ui?.notifications) {
            ui.notifications.warn('Actor del oficial vacio. Debes asignar un nuevo actor a este oficial.');
          }
        }
      },
    });
  }

  // ── Civilian CRUD handlers ─────────────────────────────────────────────

  /**
   * Handle adding a new civilian
   */
  private async handleAddCivilian(): Promise<void> {
    try {
      const newCivilian = await AddOrEditOfficerDialog.create(undefined, 'civilian');

      if (newCivilian) {
        await this.refresh();

        if (ui?.notifications) {
          ui.notifications.info(`Auxiliar "${newCivilian.name}" creado exitosamente`);
        }
      }
    } catch (error) {
      console.error('Error creating civilian:', error);
      if (ui?.notifications) {
        ui.notifications.error('Error al crear el auxiliar');
      }
    }
  }

  /**
   * Handle editing a civilian
   */
  private async handleEditCivilian(civilianId: string): Promise<void> {
    try {
      const gm = (window as any).GuardManagement;
      const civilian = gm?.civilianManager?.get(civilianId);

      if (!civilian) {
        if (ui?.notifications) {
          ui.notifications.error('Auxiliar no encontrado');
        }
        return;
      }

      const updatedCivilian = await AddOrEditOfficerDialog.edit(civilian, 'civilian');

      if (updatedCivilian) {
        await this.refresh();

        if (ui?.notifications) {
          ui.notifications.info(`Auxiliar "${updatedCivilian.name}" actualizado`);
        }
      }
    } catch (error) {
      console.error('Error editing civilian:', error);
      if (ui?.notifications) {
        ui.notifications.error('Error al editar el auxiliar');
      }
    }
  }

  /**
   * Handle deleting a civilian
   */
  private async handleDeleteCivilian(civilianId: string): Promise<void> {
    const gm = (window as any).GuardManagement;
    const civilian = gm?.civilianManager?.get(civilianId);

    if (!civilian) {
      if (ui?.notifications) {
        ui.notifications.error('Auxiliar no encontrado');
      }
      return;
    }

    const body = `
      <div class="guard-modal-form" style="text-align: center;">
        <p>¿Estas seguro de que quieres eliminar el actor del auxiliar "${civilian.actorName}"?</p>
        <p style="color: #f39c12; font-size: 0.9em;"><strong>Warning:</strong> El auxiliar se quedara sin actor asignado y necesitaras asignar uno nuevo.</p>
      </div>
    `;

    GuardModal.open({
      title: 'Confirmar vaciar actor',
      icon: 'fas fa-trash',
      body,
      saveLabel: 'Vaciar actor',
      onSave: async () => {
        const updated = gm.civilianManager.update(civilianId, {
          actorId: '',
          actorName: '',
          actorImg: undefined,
        });

        if (updated) {
          await this.refresh();
          if (ui?.notifications) {
            ui.notifications.warn('Actor del auxiliar vacio. Debes asignar un nuevo actor a este auxiliar.');
          }
        }
      },
    });
  }

  // ── Shared handlers ────────────────────────────────────────────────────

  /**
   * Toggle visibleToPlayers for an officer or civilian
   */
  private async handleToggleVisibility(id: string, type: 'officer' | 'civilian'): Promise<void> {
    const gm = (window as any).GuardManagement;
    const manager = type === 'civilian' ? gm?.civilianManager : gm?.officerManager;
    if (!manager) return;
    const record = manager.get(id);
    if (!record) return;
    const newValue = !record.visibleToPlayers;
    await manager.update(id, { visibleToPlayers: newValue });
    await this.refresh();
  }

  /**
   * Send personnel info to chat
   */
  private async handleSendToChat(id: string, type: 'officer' | 'civilian'): Promise<void> {
    const gm = (window as any).GuardManagement;
    const manager = type === 'civilian' ? gm?.civilianManager : gm?.officerManager;
    const person = manager?.get(id);
    if (!person) return;

    const label = type === 'civilian' ? 'Auxiliar' : 'Oficial';

    const skillsHtml = person.skills?.length
      ? person.skills
          .map((s: any) => {
            const hearts =
              s.hopeCost > 0
                ? new Array(s.hopeCost)
                    .fill('<i class="fas fa-diamond" style="color:#e84a4a;font-size:0.75rem;"></i>')
                    .join(' ')
                : '<span style="opacity:0.5;font-size:0.8rem;">0</span>';
            const img = s.image
              ? `<img src="${s.image}" style="width:18px;height:18px;border:none;vertical-align:middle;margin-right:4px;" />`
              : '';
            return `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;">${img}<span>${s.name}</span><span style="margin-left:auto;">${hearts}</span></div>`;
          })
          .join('')
      : '';

    const prosHtml = person.pros?.length
      ? person.pros
          .map(
            (p: any) =>
              `<div style="padding:2px 0;"><strong>${p.title}</strong>${p.description ? `: ${p.description}` : ''}</div>`
          )
          .join('')
      : '<div style="opacity:0.5;">Ninguno</div>';

    const consHtml = person.cons?.length
      ? person.cons
          .map(
            (c: any) =>
              `<div style="padding:2px 0;"><strong>${c.title}</strong>${c.description ? `: ${c.description}` : ''}</div>`
          )
          .join('')
      : '<div style="opacity:0.5;">Ninguno</div>';

    const content = `
      <div class="guard-resource-chat">
        ${person.actorImg ? `<div style="text-align:center;margin-bottom:8px;"><img src="${person.actorImg}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid #555;" /></div>` : ''}
        <div class="chat-header" style="font-weight:bold;font-size:1.2em;margin-bottom:2px;text-align:center;">${person.actorName || 'Sin actor'}</div>
        <div style="text-align:center;opacity:0.8;margin-bottom:8px;">${person.title}</div>
        ${skillsHtml ? `<div style="margin-bottom:8px;padding:6px;background:rgba(0,0,0,0.1);border-radius:4px;"><div style="font-weight:bold;margin-bottom:4px;"><i class="fas fa-bolt"></i> Habilidades</div>${skillsHtml}</div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div style="padding:6px;background:rgba(0,0,0,0.1);border-radius:4px;">
            <div style="font-weight:bold;color:#4caf50;margin-bottom:4px;"><i class="fas fa-plus-circle"></i> Pros</div>
            ${prosHtml}
          </div>
          <div style="padding:6px;background:rgba(0,0,0,0.1);border-radius:4px;">
            <div style="font-weight:bold;color:#f44336;margin-bottom:4px;"><i class="fas fa-minus-circle"></i> Cons</div>
            ${consHtml}
          </div>
        </div>
      </div>
    `;

    await (ChatMessage as any).create({
      content,
      speaker: { scene: null, actor: null, token: null, alias: label },
      flags: { 'guard-management': { type: `${type}-info` } },
    });
  }

  /**
   * Refresh the dialog content
   */
  public async refresh(): Promise<void> {
    if (!this.element) return;

    const officers = this.getOfficers().map(this.enrichOfficerStats);
    const civilians = this.getCivilians().map(this.enrichOfficerStats);
    const isGM = (game as any)?.user?.isGM || false;
    const content = await foundry.applications.handlebars.renderTemplate(
      'modules/guard-management/templates/dialogs/officer-warehouse.hbs',
      { officers, civilians, isGM }
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
    if (this.isDragging && this.element) {
      const r = this.element.getBoundingClientRect();
      try {
        localStorage.setItem(
          OfficerWarehouseDialog.POS_LS_KEY,
          JSON.stringify({ x: r.left, y: r.top })
        );
      } catch {
        /* ignore */
      }
    }
    this.isDragging = false;
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
  }
}
