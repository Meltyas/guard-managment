// @ts-nocheck
/**
 * OfficerWarehouseDialog
 * Dialog for managing all created officers, split into Oficiales / Civiles tabs.
 * Both tabs show the same officer-card list, filtered by officer.isCivil.
 */

import type { Officer } from '../types/officer';
import { setupFilterToggles } from '../ui/panels/panel-helpers.js';
import { ImportExportService } from '../utils/ImportExportService.js';
import { ModalStack } from '../utils/modal-stack.js';
import { GuardModal } from '../ui/GuardModal.js';
import { AddOrEditOfficerDialog } from './AddOrEditOfficerDialog.js';

type OfficerViewMode = 'grid' | 'list' | 'gallery';
const VIEW_MODE_LS_KEY = 'guard-management.officerWarehouse.viewMode';
const VALID_VIEW_MODES: OfficerViewMode[] = ['grid', 'list', 'gallery'];

export class OfficerWarehouseDialog {
  private static instance: OfficerWarehouseDialog | null = null;
  private element: HTMLElement | null = null;
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };
  private activeTab: 'officers' | 'civiles' = 'officers';
  private viewMode: OfficerViewMode = OfficerWarehouseDialog.loadViewMode();

  /** Read the persisted view mode from localStorage (defaults to 'grid'). */
  private static loadViewMode(): OfficerViewMode {
    try {
      const stored = window.localStorage.getItem(VIEW_MODE_LS_KEY) as OfficerViewMode | null;
      if (stored && VALID_VIEW_MODES.includes(stored)) return stored;
    } catch {
      /* localStorage may be unavailable */
    }
    return 'grid';
  }

  private saveViewMode(): void {
    try {
      window.localStorage.setItem(VIEW_MODE_LS_KEY, this.viewMode);
    } catch {
      /* ignore */
    }
  }

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
      ModalStack.bringToFront(this.element);
      return;
    }

    this.element = await this.createElement();
    document.body.appendChild(this.element);

    // Register in shared modal stack (brings to front on click, manages z-index)
    ModalStack.register(this.element);

    this.addEventListeners();
    this.setupDragAndDrop();
  }

  /**
   * Close the dialog
   */
  public close(): void {
    if (this.element) {
      ModalStack.unregister(this.element);
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
   * Check if dialog is open
   */
  private bringToFront(): void {
    if (this.element) {
      // Delegate to the shared stack so we stay within the sub-90 band.
      ModalStack.bringToFront(this.element);
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
    `;

    const isGM = (game as any)?.user?.isGM || false;

    const oficialesContent = await renderTemplate(
      'modules/guard-management/templates/dialogs/officer-warehouse.hbs',
      this.buildContext(false, isGM)
    );
    const civilesContent = await renderTemplate(
      'modules/guard-management/templates/dialogs/officer-warehouse.hbs',
      this.buildContext(true, isGM)
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
   * Build the render context for one tab: enriched officers (with searchText),
   * the distinct title filter chips, the active view mode and GM flag.
   */
  private buildContext(civil: boolean, isGM: boolean) {
    const officers = this.getOfficers(civil).map((o) => {
      const skillName = o.skill?.name ?? '';
      const prosText = (o.pros ?? []).map((p) => p.title).join(' ');
      const consText = (o.cons ?? []).map((c) => c.title).join(' ');
      const searchText = `${o.actorName ?? ''} ${o.title ?? ''} ${skillName} ${prosText} ${consText}`
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
      return { ...o, searchText };
    });

    // Distinct titles → filter chips, sorted alphabetically, with counts
    const titleCounts = new Map<string, number>();
    for (const o of officers) {
      const t = (o.title || '').trim();
      if (!t) continue;
      titleCounts.set(t, (titleCounts.get(t) ?? 0) + 1);
    }
    const titles = Array.from(titleCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'es'))
      .map(([value, count]) => ({ value, label: value, count }));

    return { officers, titles, isGM, isCivilTab: civil, viewMode: this.viewMode };
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

    // Toolbar: per-panel search + title filters
    this.element.querySelectorAll('.officer-wh-panel').forEach((panel) => {
      const panelEl = panel as HTMLElement;

      const searchInput = panelEl.querySelector('.officer-search-input') as HTMLInputElement | null;
      const clearBtn = panelEl.querySelector('.officer-search-clear') as HTMLElement | null;
      if (searchInput) {
        searchInput.addEventListener('input', () => {
          if (clearBtn) clearBtn.hidden = searchInput.value.length === 0;
          this.applyFilters(panelEl);
        });
        // Prevent Foundry keyboard shortcuts from hijacking typing
        searchInput.addEventListener('keydown', (e) => e.stopPropagation());
        searchInput.addEventListener('keyup', (e) => e.stopPropagation());
      }
      clearBtn?.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
          clearBtn.hidden = true;
          searchInput.focus();
        }
        this.applyFilters(panelEl);
      });

      // Title filter chips (multi-select with "Todos" reset)
      setupFilterToggles(panelEl, {
        buttonSelector: '.officer-filter-btn',
        dataAttr: 'data-filter-title',
        onChange: () => this.applyFilters(panelEl),
      });
    });

    // View mode buttons (shared across both tabs)
    this.element.querySelectorAll('.officer-view-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = (btn as HTMLElement).dataset.viewMode as OfficerViewMode;
        if (!mode || !VALID_VIEW_MODES.includes(mode)) return;
        this.viewMode = mode;
        this.saveViewMode();
        this.applyViewMode();
      });
    });

    // Apply current view mode + filter state to freshly-rendered panels
    this.applyViewMode();
    this.element.querySelectorAll('.officer-wh-panel').forEach((panel) => {
      this.applyFilters(panel as HTMLElement);
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

    const esc = (v: unknown) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const traitList = (traits: Officer['pros'], emptyMsg: string) =>
      traits.length
        ? traits
            .map(
              (t) => `
              <div class="officer-view-trait">
                <strong>${esc(t.title)}</strong>
                ${t.description ? `<p>${esc(t.description)}</p>` : ''}
              </div>`
            )
            .join('')
        : `<p class="officer-view-empty">${emptyMsg}</p>`;

    const skillHtml = officer.skill?.name
      ? `
        <div class="officer-view-skill">
          ${officer.skill.image ? `<img src="${esc(officer.skill.image)}" alt="${esc(officer.skill.name)}" />` : '<i class="fas fa-bolt"></i>'}
          <span>${esc(officer.skill.name)}</span>
        </div>`
      : '';

    const body = `
      <div class="guard-modal-form officer-view">
        <div class="officer-view-header">
          <img src="${esc(officer.actorImg)}" alt="${esc(officer.actorName)}" class="officer-view-avatar" />
          <div class="officer-view-id">
            <h2>${esc(officer.actorName)}</h2>
            <h3>${esc(officer.title)}</h3>
            ${officer.isCivil ? '<span class="officer-view-tag"><i class="fas fa-user-friends"></i> Civil</span>' : ''}
            ${skillHtml}
          </div>
        </div>
        <div class="guard-modal-split officer-view-traits">
          <div class="officer-view-col pros">
            <div class="officer-view-col-title"><i class="fas fa-thumbs-up"></i> Pros</div>
            ${traitList(officer.pros, 'No hay pros')}
          </div>
          <div class="officer-view-col cons">
            <div class="officer-view-col-title"><i class="fas fa-thumbs-down"></i> Cons</div>
            ${traitList(officer.cons, 'No hay cons')}
          </div>
        </div>
      </div>
    `;

    GuardModal.open({
      title: `${officer.isCivil ? 'Civil' : 'Oficial'}: ${officer.actorName}`,
      icon: officer.isCivil ? 'fas fa-user-friends' : 'fas fa-user-shield',
      body,
      width: 620,
      showFooter: false,
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
   * Reflect the active view mode onto both panels: list container class and
   * the active state of the view-mode buttons.
   */
  private applyViewMode(): void {
    if (!this.element) return;
    this.element.querySelectorAll('.officers-list').forEach((list) => {
      const el = list as HTMLElement;
      el.classList.remove('view-grid', 'view-list', 'view-gallery');
      el.classList.add(`view-${this.viewMode}`);
    });
    this.element.querySelectorAll('.officer-view-btn').forEach((btn) => {
      const b = btn as HTMLElement;
      b.classList.toggle('active', b.dataset.viewMode === this.viewMode);
    });
  }

  /**
   * Filter the officer cards within a single panel by the search term and the
   * active title chips. Hides non-matching cards and shows a "no results"
   * notice when everything is filtered out.
   */
  private applyFilters(panel: HTMLElement): void {
    const searchInput = panel.querySelector('.officer-search-input') as HTMLInputElement | null;
    const term = (searchInput?.value || '').toLowerCase().trim();

    const activeTitles: string[] = [];
    panel
      .querySelectorAll('.officer-filter-btn.active:not([data-filter-title="all"])')
      .forEach((btn) => {
        const t = (btn as HTMLElement).dataset.filterTitle;
        if (t) activeTitles.push(t);
      });

    const cards = panel.querySelectorAll('.officer-card');
    let visibleCount = 0;
    cards.forEach((card) => {
      const el = card as HTMLElement;
      const haystack = el.dataset.search || '';
      const title = el.dataset.officerTitle || '';
      const matchesSearch = !term || haystack.includes(term);
      const matchesTitle = activeTitles.length === 0 || activeTitles.includes(title);
      const visible = matchesSearch && matchesTitle;
      el.style.display = visible ? '' : 'none';
      if (visible) visibleCount += 1;
    });

    // Toggle "no results" notice (only relevant when there are cards at all)
    const noResults = panel.querySelector('.officer-no-results') as HTMLElement | null;
    if (noResults) {
      noResults.hidden = !(cards.length > 0 && visibleCount === 0);
    }
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
        this.buildContext(civil, isGM)
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
