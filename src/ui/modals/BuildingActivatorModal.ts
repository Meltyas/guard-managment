/**
 * BuildingActivatorModal
 *
 * Modal de activación de edificios, accesible para cualquier jugador.
 * Muestra los edificios inactivos (y no ocultos por el GM) con buscador y filtro por zona.
 *
 * El GM además puede ver y activar edificios ocultos desde el panel de edificios.
 */

import { GuardModal } from '../GuardModal.js';
import { DialogPersistence, DIALOG_KEYS } from '../../utils/DialogPersistence.js';
import {
  BUILDING_ZONE_LABELS,
  BUILDING_ZONE_ICONS,
  BUILDING_ZONE_ORDER,
} from '../../types/buildings.js';
import type { Building, BuildingZone } from '../../types/buildings.js';
import { BuildingsPanel } from '../panels/BuildingsPanel.js';

export class BuildingActivatorModal {
  /** Abre el modal de activación. Accesible por cualquier jugador. */
  static open(onActivated?: () => void): void {
    new BuildingActivatorModal()._open(onActivated);
  }

  private _open(onActivated?: () => void): void {
    const gm = (window as any).GuardManagement;
    if (!gm?.buildingManager) return;

    const isGM = !!(game as any)?.user?.isGM;

    // Construir opciones de zona a partir de las que tienen edificios disponibles
    const allInactive: Building[] = isGM
      ? gm.buildingManager.getAllBuildings().filter((b: Building) => !b.active)
      : gm.buildingManager.getActivatableBuildings();

    const zonesWithBuildings = BUILDING_ZONE_ORDER.filter((z) =>
      allInactive.some((b) => b.zone === z)
    );

    const zoneFilterHtml = zonesWithBuildings.length > 1
      ? `<div class="building-activator-zone-filters">
          <button class="building-activator-zone-btn active" data-zone="all">Todas</button>
          ${zonesWithBuildings
            .map(
              (z) =>
                `<button class="building-activator-zone-btn" data-zone="${z}">
                  <i class="${BUILDING_ZONE_ICONS[z]}"></i> ${BUILDING_ZONE_LABELS[z]}
                </button>`
            )
            .join('')}
        </div>`
      : '';

    const body = `
      <div class="building-activator-modal">
        <p class="building-activator-hint">
          <i class="fas fa-info-circle"></i>
          Selecciona un edificio para hacerlo visible en su zona.
        </p>
        <div class="building-activator-search-wrapper">
          <i class="fas fa-search"></i>
          <input
            type="text"
            class="building-activator-search"
            placeholder="Buscar edificio por nombre..."
            autocomplete="off"
          />
        </div>
        ${zoneFilterHtml}
        <div class="building-activator-list">
          <!-- populated by JS -->
        </div>
        <div class="building-activator-empty" style="display:none;">
          <i class="fas fa-check-circle" style="color:#4caf50;font-size:1.4em;"></i>
          <p>No hay edificios disponibles para activar.</p>
        </div>
      </div>
    `;

    GuardModal.open({
      title: 'Activar Edificio',
      icon: 'fas fa-map-marker-alt',
      body,
      width: 540,
      showFooter: false,
      onSave: async () => {},
      onClose: () => {
        // Clear open-state so it is not restored after F5
        DialogPersistence.markClosed(DIALOG_KEYS.buildingActivator);
      },
      onRender: (bodyEl) => {
        // Persist that this modal is open so it can be restored after F5
        DialogPersistence.markOpen(DIALOG_KEYS.buildingActivator);

        this._renderList(bodyEl, isGM, onActivated);

        const searchInput = bodyEl.querySelector('.building-activator-search') as HTMLInputElement;
        searchInput?.addEventListener('input', () => this._applyFilters(bodyEl));
        searchInput?.addEventListener('keydown', (e) => e.stopPropagation());
        searchInput?.addEventListener('keyup', (e) => e.stopPropagation());

        bodyEl.querySelectorAll('.building-activator-zone-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            bodyEl
              .querySelectorAll('.building-activator-zone-btn')
              .forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            this._applyFilters(bodyEl);
          });
        });

        searchInput?.focus();
      },
    });
  }

  private _renderList(bodyEl: HTMLElement, isGM: boolean, onActivated?: () => void): void {
    const gm = (window as any).GuardManagement;
    const listEl = bodyEl.querySelector('.building-activator-list') as HTMLElement;
    const emptyEl = bodyEl.querySelector('.building-activator-empty') as HTMLElement;
    if (!listEl) return;

    const buildings: Building[] = isGM
      ? gm.buildingManager.getAllBuildings().filter((b: Building) => !b.active)
      : gm.buildingManager.getActivatableBuildings();

    buildings.sort((a: Building, b: Building) => a.name.localeCompare(b.name));

    if (buildings.length === 0) {
      listEl.style.display = 'none';
      emptyEl.style.display = '';
      return;
    }

    listEl.style.display = '';
    emptyEl.style.display = 'none';

    listEl.innerHTML = buildings
      .map((b: Building) => {
        const zoneLabel = BUILDING_ZONE_LABELS[b.zone as BuildingZone] || b.zone;
        const zoneIcon = BUILDING_ZONE_ICONS[b.zone as BuildingZone] || 'fas fa-map-marker-alt';
        const imgHtml = b.img
          ? `<img src="${b.img}" alt="" class="building-activator-img" />`
          : `<div class="building-activator-img-placeholder"><i class="fas fa-building"></i></div>`;
        const hiddenBadge =
          b.hidden && isGM
            ? `<span class="building-activator-hidden-badge" title="Oculto para jugadores"><i class="fas fa-eye-slash"></i></span>`
            : '';
        const editBtn = isGM
          ? `<button class="building-activator-edit-btn" data-building-id="${b.id}" title="Editar edificio">
               <i class="fas fa-edit"></i>
             </button>`
          : '';
        return `
          <div class="building-activator-item"
               data-building-id="${b.id}"
               data-building-name="${b.name.toLowerCase()}"
               data-building-zone="${b.zone}">
            ${imgHtml}
            <div class="building-activator-info">
              <span class="building-activator-name">${b.name}${hiddenBadge}</span>
              <span class="building-activator-zone">
                <i class="${zoneIcon}"></i> ${zoneLabel}
              </span>
            </div>
            ${editBtn}
            <button class="building-activator-btn" data-building-id="${b.id}" title="Activar edificio">
              <i class="fas fa-plus-circle"></i> Activar
            </button>
          </div>
        `;
      })
      .join('');

    listEl.querySelectorAll('.building-activator-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const buildingId = (btn as HTMLElement).dataset.buildingId;
        if (!buildingId) return;

        await gm.buildingManager.activateBuilding(buildingId);
        window.dispatchEvent(new CustomEvent('guard-buildings-updated'));
        onActivated?.();

        this._renderList(bodyEl, isGM, onActivated);
        this._applyFilters(bodyEl);
        (globalThis as any).ui?.notifications?.info('Edificio activado correctamente.');
      });
    });

    listEl.querySelectorAll('.building-activator-edit-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const buildingId = (btn as HTMLElement).dataset.buildingId;
        if (!buildingId) return;
        BuildingsPanel.showEditBuildingDialog(buildingId, () => {
          this._renderList(bodyEl, isGM, onActivated);
          this._applyFilters(bodyEl);
          onActivated?.();
        });
      });
    });
  }

  private _applyFilters(bodyEl: HTMLElement): void {
    const searchInput = bodyEl.querySelector('.building-activator-search') as HTMLInputElement;
    const q = (searchInput?.value || '').toLowerCase().trim();

    const activeZoneBtn = bodyEl.querySelector(
      '.building-activator-zone-btn.active'
    ) as HTMLElement | null;
    const selectedZone = activeZoneBtn?.dataset.zone || 'all';

    let visibleCount = 0;
    bodyEl.querySelectorAll('.building-activator-item').forEach((item) => {
      const el = item as HTMLElement;
      const name = el.dataset.buildingName || '';
      const zone = el.dataset.buildingZone || '';
      const matchesSearch = !q || name.includes(q);
      const matchesZone = selectedZone === 'all' || zone === selectedZone;
      const visible = matchesSearch && matchesZone;
      el.style.display = visible ? '' : 'none';
      if (visible) visibleCount++;
    });

    const emptyEl = bodyEl.querySelector('.building-activator-empty') as HTMLElement;
    const listEl = bodyEl.querySelector('.building-activator-list') as HTMLElement;
    if (emptyEl && listEl) {
      const hasItems = listEl.querySelectorAll('.building-activator-item').length > 0;
      emptyEl.style.display = !hasItems || visibleCount === 0 ? '' : 'none';
    }
  }
}
