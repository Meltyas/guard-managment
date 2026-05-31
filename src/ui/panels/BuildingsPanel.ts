/**
 * Buildings Panel - Manages the Edificios tab UI
 * Static class following the same pattern as GangsPanel / CrimesPanel.
 */
import type { BuildingChangelogEntry, BuildingGangLink, BuildingTag, BuildingZone } from '../../types/buildings';
import {
  BUILDING_TAG_ICONS,
  BUILDING_TAG_LABELS,
  BUILDING_ZONE_ICONS,
  BUILDING_ZONE_LABELS,
  BUILDING_ZONE_ORDER,
} from '../../types/buildings';
import { GuardModal } from '../GuardModal.js';
import { BuildingActivatorModal } from '../modals/BuildingActivatorModal.js';
import { setupFilterToggles, setupImagePicker, renderPanel } from './panel-helpers.js';

export class BuildingsPanel {
  static get template() {
    return 'modules/guard-management/templates/panels/buildings.hbs';
  }

  private static getZoneOrder(): BuildingZone[] {
    const stored = (game as any)?.settings?.get('guard-management', 'buildingZoneOrder') as BuildingZone[] | undefined;
    if (Array.isArray(stored) && stored.length > 0) return stored;
    return [...BUILDING_ZONE_ORDER];
  }

  private static async saveZoneOrder(order: BuildingZone[]): Promise<void> {
    await (game as any)?.settings?.set('guard-management', 'buildingZoneOrder', order);
  }

  static async getData() {
    const gm = (window as any).GuardManagement;
    if (!gm?.buildingManager) return { zones: [], buildingCount: 0, isGM: false };

    const isGM = !!(game as any)?.user?.isGM;
    const allBuildings = gm.buildingManager.getAllBuildings();

    // Solo mostrar edificios activos en el panel (el activador es la vía para activarlos)
    const visibleBuildings = allBuildings.filter((b: any) => b.active);

    const mapped = visibleBuildings
      .sort((a: any, b: any) => b.updatedAt - a.updatedAt)
      .map((building: any) => ({
        ...building,
        tagLabels: (building.tags || []).map((t: BuildingTag) => ({
          key: t,
          label: BUILDING_TAG_LABELS[t] || t,
          icon: BUILDING_TAG_ICONS[t] || 'fas fa-tag',
        })),
        zoneLabel: BUILDING_ZONE_LABELS[building.zone as BuildingZone] || building.zone,
      }));

    // Agrupar por zona en orden almacenado (o por defecto)
    const order = BuildingsPanel.getZoneOrder();
    const zonesWithBuildings = mapped.map((b: any) => b.zone as BuildingZone);
    const uniqueZones = Array.from(new Set(zonesWithBuildings)) as BuildingZone[];
    // Include zones that have buildings, preserving order; append unknown zones at end
    const allZoneKeys: BuildingZone[] = [
      ...order,
      ...uniqueZones.filter((z) => !order.includes(z)),
    ];
    const zones = allZoneKeys
      .map((zoneKey, idx, arr) => {
        const buildings = mapped.filter((b: any) => b.zone === zoneKey);
        if (buildings.length === 0) return null;
        return {
          key: zoneKey,
          label: BUILDING_ZONE_LABELS[zoneKey] ?? zoneKey,
          icon: BUILDING_ZONE_ICONS[zoneKey] ?? 'fas fa-map-marker',
          buildings,
          isFirst: idx === 0,
          isLast: idx === arr.length - 1,
        };
      })
      .filter(Boolean);

    return {
      zones,
      buildingCount: visibleBuildings.length,
      isGM,
    };
  }

  static async render(container: HTMLElement): Promise<void> {
    await renderPanel(container, {
      template: BuildingsPanel.template,
      getData: () => BuildingsPanel.getData(),
      onMounted: (c) => BuildingsPanel.setupEventListeners(c),
      panelName: 'BuildingsPanel',
    });
  }

  // --- Event listeners ---

  private static setupEventListeners(container: HTMLElement): void {
    // Zone reorder buttons
    container.querySelectorAll<HTMLElement>('.zone-order-up-btn, .zone-order-down-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const zoneKey = btn.dataset.zoneKey as BuildingZone;
        if (!zoneKey) return;
        const dir = btn.classList.contains('zone-order-up-btn') ? -1 : 1;
        const order = BuildingsPanel.getZoneOrder();
        const idx = order.indexOf(zoneKey);
        if (idx < 0) return;
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= order.length) return;
        [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
        await BuildingsPanel.saveZoneOrder(order);
        await BuildingsPanel.render(container);
      });
    });

    // Search
    const searchInput = container.querySelector('.building-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', () => BuildingsPanel.filterBuildings(container));
      searchInput.addEventListener('keydown', (e) => e.stopPropagation());
      searchInput.addEventListener('keyup', (e) => e.stopPropagation());
    }

    // Filter toggles
    setupFilterToggles(container, {
      buttonSelector: '.building-filter-btn',
      dataAttr: 'data-filter-tag',
      onChange: () => BuildingsPanel.filterBuildings(container),
    });

    // Add building button
    container.querySelector('.building-add-btn')?.addEventListener('click', () => {
      BuildingsPanel.showAddBuildingDialog(container);
    });

    // Activator button (accessible to all users)
    container.querySelector('.building-activator-btn')?.addEventListener('click', () => {
      BuildingActivatorModal.open(async () => {
        await BuildingsPanel.render(container);
      });
    });

    // Deactivate buttons (GM only)
    container.querySelectorAll('.building-deactivate-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const buildingId = (btn as HTMLElement).dataset.buildingId;
        if (buildingId) BuildingsPanel.handleDeactivateBuilding(buildingId, container);
      });
    });

    // Chat buttons
    container.querySelectorAll('.building-chat-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const buildingId = (btn as HTMLElement).dataset.buildingId;
        if (buildingId) BuildingsPanel.sendBuildingToChat(buildingId);
      });
    });

    // Edit buttons
    container.querySelectorAll('.building-edit-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const buildingId = (btn as HTMLElement).dataset.buildingId;
        if (buildingId) BuildingsPanel.showEditBuildingDialog(buildingId, () => BuildingsPanel.render(container));
      });
    });

    // Delete buttons
    container.querySelectorAll('.building-delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const buildingId = (btn as HTMLElement).dataset.buildingId;
        if (buildingId) BuildingsPanel.handleDeleteBuilding(buildingId, container);
      });
    });
    // Zone toggle
    container.querySelectorAll('.building-zone-header').forEach((header) => {
      header.addEventListener('click', () => {
        const section = header.closest('.building-zone-section') as HTMLElement;
        if (!section) return;
        section.classList.toggle('collapsed');
      });
    });
  }

  // --- Filter ---

  private static filterBuildings(container: HTMLElement): void {
    const searchInput = container.querySelector('.building-search-input') as HTMLInputElement;
    const searchTerm = (searchInput?.value || '').toLowerCase().trim();

    const activeFilters: string[] = [];
    container
      .querySelectorAll('.building-filter-btn.active:not([data-filter-tag="all"])')
      .forEach((btn) => {
        const tag = (btn as HTMLElement).dataset.filterTag;
        if (tag) activeFilters.push(tag);
      });

    container.querySelectorAll('.building-card').forEach((card) => {
      const el = card as HTMLElement;
      const name = card.querySelector('.building-name')?.textContent?.toLowerCase() || '';
      const desc = card.querySelector('.building-description')?.textContent?.toLowerCase() || '';
      const tags = el.dataset.buildingTags || '';
      const matchesSearch = !searchTerm || name.includes(searchTerm) || desc.includes(searchTerm);
      const matchesFilter =
        activeFilters.length === 0 || activeFilters.some((f) => tags.includes(f));
      el.style.display = matchesSearch && matchesFilter ? '' : 'none';
    });

    // Ocultar secciones de zona si no tienen ninguna tarjeta visible
    container.querySelectorAll('.building-zone-section').forEach((section) => {
      const el = section as HTMLElement;
      const visibleCards = el.querySelectorAll('.building-card:not([style*="display: none"])');
      el.style.display = visibleCards.length > 0 ? '' : 'none';
    });
  }

  // --- Dialog helpers ---

  private static getGangOptions(): { id: string; name: string }[] {
    const gm = (window as any).GuardManagement;
    if (!gm?.gangManager) return [];
    return gm.gangManager.getAllGangs().map((g: any) => ({ id: g.id, name: g.name }));
  }

  private static buildZoneSelect(selectedZone: BuildingZone = 'fuera-arboria'): string {
    return BUILDING_ZONE_ORDER.map((zoneKey) => {
      const sel = zoneKey === selectedZone ? 'selected' : '';
      return `<option value="${zoneKey}" ${sel}>${BUILDING_ZONE_LABELS[zoneKey]}</option>`;
    }).join('');
  }

  private static buildTagCheckboxes(selectedTags: BuildingTag[] = []): string {
    const allTags: BuildingTag[] = ['civil', 'auxiliar', 'guardia', 'publico', 'oficial'];
    return allTags
      .map((tag) => {
        const checked = selectedTags.includes(tag) ? 'checked' : '';
        return `<label style="display: inline-flex; align-items: center; gap: 4px; margin-right: 10px; cursor: pointer;">
          <input type="checkbox" name="building-tag" value="${tag}" ${checked} />
          <i class="${BUILDING_TAG_ICONS[tag]}" style="font-size: 0.85em;"></i>
          ${BUILDING_TAG_LABELS[tag]}
        </label>`;
      })
      .join('');
  }

  private static buildGangSelect(selectedGangId?: string): string {
    const gangs = BuildingsPanel.getGangOptions();
    let options = '<option value="">— Sin banda —</option>';
    for (const g of gangs) {
      const sel = g.id === selectedGangId ? 'selected' : '';
      options += `<option value="${g.id}" ${sel}>${g.name}</option>`;
    }
    return options;
  }

  // --- Dialogs ---

  private static async showAddBuildingDialog(container: HTMLElement): Promise<void> {
    let selectedImage = '';

    const body = `
      <div class="guard-modal-form">
        <div class="guard-modal-row">
          <label for="building-name"><i class="fas fa-building"></i> Nombre del edificio</label>
          <input type="text" id="building-name" placeholder="Ej: Taberna del Gallo, Cuartel de la Guardia..." />
        </div>
        <div class="guard-modal-row">
          <label for="building-desc"><i class="fas fa-align-left"></i> Descripción</label>
          <textarea id="building-desc" rows="3" placeholder="Descripción del edificio..."></textarea>
        </div>
        <div class="guard-modal-row">
          <label><i class="fas fa-image"></i> Imagen</label>
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="text" id="building-img" placeholder="Ruta de imagen..." style="flex: 1;" />
            <button type="button" id="building-img-picker" class="buildings-btn" style="white-space: nowrap;">
              <i class="fas fa-file-image"></i> Buscar
            </button>
          </div>
          <div id="building-img-preview" style="margin-top: 6px; text-align: center;"></div>
        </div>
        <div class="guard-modal-row">
          <label><i class="fas fa-tags"></i> Etiquetas</label>
          <div id="building-tags" style="display: flex; flex-wrap: wrap; gap: 4px;">
            ${BuildingsPanel.buildTagCheckboxes()}
          </div>
        </div>
        <div class="guard-modal-row">
          <label for="building-zone"><i class="fas fa-map-marker-alt"></i> Zona</label>
          <select id="building-zone">
            ${BuildingsPanel.buildZoneSelect()}
          </select>
        </div>
        <div class="guard-modal-row">
          <label for="building-gang"><i class="fas fa-users"></i> Banda asociada</label>
          <select id="building-gang">
            ${BuildingsPanel.buildGangSelect()}
          </select>
        </div>
        <div class="guard-modal-row" id="building-gang-notes-group" style="display: none;">
          <label for="building-gang-notes"><i class="fas fa-sticky-note"></i> Nota sobre la banda</label>
          <textarea id="building-gang-notes" rows="2" placeholder="Influencia, actividad, etc."></textarea>
        </div>
      </div>
    `;

    GuardModal.open({
      title: 'Registrar Nuevo Edificio',
      icon: 'fas fa-building',
      body,
      saveLabel: 'Registrar',
      onRender: (bodyEl) => {
        const imgInput = bodyEl.querySelector('#building-img') as HTMLInputElement;
        const imgPreview = bodyEl.querySelector('#building-img-preview') as HTMLElement;
        const imgPicker = bodyEl.querySelector('#building-img-picker');
        const gangSelect = bodyEl.querySelector('#building-gang') as HTMLSelectElement;
        const gangNotesGroup = bodyEl.querySelector('#building-gang-notes-group') as HTMLElement;

        setupImagePicker({
          pickerEl: imgPicker,
          inputEl: imgInput,
          previewEl: imgPreview,
          onSelect: (path) => {
            selectedImage = path;
          },
          previewOnInput: true,
        });

        gangSelect?.addEventListener('change', () => {
          gangNotesGroup.style.display = gangSelect.value ? '' : 'none';
        });

        (bodyEl.querySelector('#building-name') as HTMLInputElement)?.focus();
      },
      onSave: async (bodyEl) => {
        const name = (bodyEl.querySelector('#building-name') as HTMLInputElement)?.value?.trim();
        if (!name) {
          (globalThis as any).ui?.notifications?.warn('El nombre del edificio es obligatorio.');
          return false;
        }

        const description =
          (bodyEl.querySelector('#building-desc') as HTMLTextAreaElement)?.value?.trim() || '';

        const tags: BuildingTag[] = [];
        bodyEl.querySelectorAll('input[name="building-tag"]:checked').forEach((cb: any) => {
          tags.push(cb.value as BuildingTag);
        });

        const zone = ((bodyEl.querySelector('#building-zone') as HTMLSelectElement)?.value ||
          'fuera-arboria') as BuildingZone;

        const gangId = (bodyEl.querySelector('#building-gang') as HTMLSelectElement)?.value;
        let gangLink: BuildingGangLink | undefined;
        if (gangId) {
          const gangs = BuildingsPanel.getGangOptions();
          const gang = gangs.find((g) => g.id === gangId);
          const gangNotes =
            (bodyEl.querySelector('#building-gang-notes') as HTMLTextAreaElement)?.value?.trim() ||
            '';
          gangLink = { gangId, gangName: gang?.name || '', notes: gangNotes };
        }

        const gm = (window as any).GuardManagement;
        if (!gm?.buildingManager) return false;

        await gm.buildingManager.addBuilding({
          name,
          description,
          img: selectedImage || undefined,
          tags,
          zone,
          gangLink,
        });

        window.dispatchEvent(new CustomEvent('guard-buildings-updated'));
        await BuildingsPanel.render(container);
      },
    });
  }

  static async showEditBuildingDialog(
    buildingId: string,
    onSaved: () => void
  ): Promise<void> {
    const gm = (window as any).GuardManagement;
    if (!gm?.buildingManager) return;
    const building = gm.buildingManager.getBuilding(buildingId);
    if (!building) return;

    const isGM = !!(game as any)?.user?.isGM;
    let selectedImage = building.img || '';

    // ── Changelog HTML ──────────────────────────────────────────────────────
    const changelog: BuildingChangelogEntry[] = building.changelog || [];
    const changelogHtml = changelog.length === 0
      ? `<p style="color:#666;font-size:0.82em;margin:0;">Sin cambios registrados todavía.</p>`
      : [...changelog]
          .reverse()
          .map((entry) => {
            const date = new Date(entry.timestamp);
            const dateStr = date.toLocaleDateString('es-ES', {
              day: '2-digit', month: '2-digit', year: '2-digit',
              hour: '2-digit', minute: '2-digit',
            });
            const changesHtml = entry.changes
              .map(
                (c) =>
                  `<div class="building-changelog-change">
                    <span class="building-changelog-field">${c.field}</span>
                    <span class="building-changelog-from">${c.from || '—'}</span>
                    <i class="fas fa-arrow-right" style="font-size:0.7em;color:#666;"></i>
                    <span class="building-changelog-to">${c.to || '—'}</span>
                  </div>`
              )
              .join('');
            return `
              <div class="building-changelog-entry">
                <div class="building-changelog-meta">
                  <span class="building-changelog-user"><i class="fas fa-user"></i> ${entry.userName}</span>
                  <span class="building-changelog-date">${dateStr}</span>
                </div>
                ${changesHtml}
              </div>`;
          })
          .join('');

    const body = `
      <div class="guard-modal-form">
        <div class="guard-modal-row">
          <label for="building-name"><i class="fas fa-building"></i> Nombre del edificio</label>
          <input type="text" id="building-name" value="${building.name.replace(/"/g, '&quot;')}" />
        </div>
        <div class="guard-modal-row">
          <label for="building-desc"><i class="fas fa-align-left"></i> Descripción</label>
          <textarea id="building-desc" rows="3">${building.description || ''}</textarea>
        </div>
        <div class="guard-modal-row">
          <label><i class="fas fa-image"></i> Imagen</label>
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="text" id="building-img" value="${building.img || ''}" style="flex: 1;" />
            <button type="button" id="building-img-picker" class="buildings-btn" style="white-space: nowrap;">
              <i class="fas fa-file-image"></i> Buscar
            </button>
          </div>
          <div id="building-img-preview" style="margin-top: 6px; text-align: center;">
            ${building.img ? `<img src="${building.img}" style="max-width: 80px; max-height: 80px; border-radius: 6px; border: 1px solid #555;" />` : ''}
          </div>
        </div>
        <div class="guard-modal-row">
          <label><i class="fas fa-tags"></i> Etiquetas</label>
          <div id="building-tags" style="display: flex; flex-wrap: wrap; gap: 4px;">
            ${BuildingsPanel.buildTagCheckboxes(building.tags)}
          </div>
        </div>
        <div class="guard-modal-row">
          <label for="building-zone"><i class="fas fa-map-marker-alt"></i> Zona</label>
          <select id="building-zone">
            ${BuildingsPanel.buildZoneSelect(building.zone)}
          </select>
        </div>
        <div class="guard-modal-row">
          <label for="building-gang"><i class="fas fa-users"></i> Banda asociada</label>
          <select id="building-gang">
            ${BuildingsPanel.buildGangSelect(building.gangLink?.gangId)}
          </select>
        </div>
        <div class="guard-modal-row" id="building-gang-notes-group" style="${building.gangLink?.gangId ? '' : 'display: none;'}">
          <label for="building-gang-notes"><i class="fas fa-sticky-note"></i> Nota sobre la banda</label>
          <textarea id="building-gang-notes" rows="2">${building.gangLink?.notes || ''}</textarea>
        </div>
        ${isGM ? `
        <div class="guard-modal-row building-visibility-row">
          <label style="font-weight: 600; color: #c89a52;"><i class="fas fa-eye-slash"></i> Visibilidad (solo GM)</label>
          <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-weight: normal;">
            <input type="checkbox" id="building-hidden" ${building.hidden ? 'checked' : ''} />
            Ocultar del activador de edificios (los jugadores no podrán activarlo)
          </label>
        </div>` : ''}
        <div class="guard-modal-row building-changelog-row">
          <label><i class="fas fa-history"></i> Historial de cambios</label>
          <div class="building-changelog-list">
            ${changelogHtml}
          </div>
        </div>
      </div>
    `;

    GuardModal.open({
      title: `Editar Edificio: ${building.name}`,
      icon: 'fas fa-edit',
      body,
      onRender: (bodyEl) => {
        const imgInput = bodyEl.querySelector('#building-img') as HTMLInputElement;
        const imgPreview = bodyEl.querySelector('#building-img-preview') as HTMLElement;
        const imgPicker = bodyEl.querySelector('#building-img-picker');
        const gangSelect = bodyEl.querySelector('#building-gang') as HTMLSelectElement;
        const gangNotesGroup = bodyEl.querySelector('#building-gang-notes-group') as HTMLElement;

        setupImagePicker({
          pickerEl: imgPicker,
          inputEl: imgInput,
          previewEl: imgPreview,
          onSelect: (path) => {
            selectedImage = path;
          },
        });

        gangSelect?.addEventListener('change', () => {
          gangNotesGroup.style.display = gangSelect.value ? '' : 'none';
        });
      },
      onSave: async (bodyEl) => {
        const name = (bodyEl.querySelector('#building-name') as HTMLInputElement)?.value?.trim();
        if (!name) {
          (globalThis as any).ui?.notifications?.warn('El nombre del edificio es obligatorio.');
          return false;
        }

        const description =
          (bodyEl.querySelector('#building-desc') as HTMLTextAreaElement)?.value?.trim() || '';

        const tags: BuildingTag[] = [];
        bodyEl.querySelectorAll('input[name="building-tag"]:checked').forEach((cb: any) => {
          tags.push(cb.value as BuildingTag);
        });

        const zone = ((bodyEl.querySelector('#building-zone') as HTMLSelectElement)?.value ||
          'fuera-arboria') as BuildingZone;

        const gangId = (bodyEl.querySelector('#building-gang') as HTMLSelectElement)?.value;
        let gangLink: BuildingGangLink | undefined;
        if (gangId) {
          const gangs = BuildingsPanel.getGangOptions();
          const gang = gangs.find((g) => g.id === gangId);
          const gangNotes =
            (bodyEl.querySelector('#building-gang-notes') as HTMLTextAreaElement)?.value?.trim() ||
            '';
          gangLink = { gangId, gangName: gang?.name || '', notes: gangNotes };
        }

        const updates: any = { name, description, tags, zone, gangLink };
        if (selectedImage !== (building.img || '')) {
          updates.img = selectedImage || undefined;
        }
        if (isGM) {
          updates.hidden = !!(bodyEl.querySelector('#building-hidden') as HTMLInputElement)?.checked;
        }

        // ── Calcular diff para el changelog ───────────────────────────────
        const diffChanges: BuildingChangelogEntry['changes'] = [];

        const label = (k: string) =>
          ({
            name: 'Nombre', description: 'Descripción', zone: 'Zona',
            tags: 'Etiquetas', img: 'Imagen', gangLink: 'Banda', hidden: 'Oculto',
          } as Record<string, string>)[k] ?? k;

        const zoneLabel = (z: string) => BUILDING_ZONE_LABELS[z as BuildingZone] || z;
        const tagsLabel = (t: BuildingTag[]) =>
          t.length ? t.map((x) => BUILDING_TAG_LABELS[x] || x).join(', ') : '—';

        if (name !== building.name)
          diffChanges.push({ field: label('name'), from: building.name, to: name });
        if (description !== (building.description || ''))
          diffChanges.push({ field: label('description'), from: building.description || '', to: description });
        if (zone !== building.zone)
          diffChanges.push({ field: label('zone'), from: zoneLabel(building.zone), to: zoneLabel(zone) });
        const oldTagsStr = tagsLabel(building.tags || []);
        const newTagsStr = tagsLabel(tags);
        if (oldTagsStr !== newTagsStr)
          diffChanges.push({ field: label('tags'), from: oldTagsStr, to: newTagsStr });
        if ((updates.img ?? '') !== (building.img ?? ''))
          diffChanges.push({ field: label('img'), from: building.img || '—', to: updates.img || '—' });
        const oldGang = building.gangLink?.gangName || '';
        const newGang = gangLink?.gangName || '';
        if (oldGang !== newGang)
          diffChanges.push({ field: label('gangLink'), from: oldGang || '—', to: newGang || '—' });
        if (isGM && updates.hidden !== building.hidden)
          diffChanges.push({ field: label('hidden'), from: String(building.hidden), to: String(updates.hidden) });

        if (diffChanges.length > 0) {
          const user = (game as any)?.user;
          const entry: BuildingChangelogEntry = {
            userId: user?.id || '',
            userName: user?.name || 'Desconocido',
            timestamp: Date.now(),
            changes: diffChanges,
          };
          updates.changelog = [...(building.changelog || []), entry];
        }

        await gm.buildingManager.updateBuilding(buildingId, updates);
        window.dispatchEvent(new CustomEvent('guard-buildings-updated'));
        onSaved();
      },
    });
  }

  private static async handleDeleteBuilding(
    buildingId: string,
    container: HTMLElement
  ): Promise<void> {
    const gm = (window as any).GuardManagement;
    if (!gm?.buildingManager) return;
    const building = gm.buildingManager.getBuilding(buildingId);
    if (!building) return;

    const body = `
      <div class="guard-modal-form" style="text-align: center;">
        <p><i class="fas fa-exclamation-triangle" style="color: #e84a4a; font-size: 1.5em;"></i></p>
        <p>¿Eliminar el edificio <strong>"${building.name}"</strong>?</p>
        <p style="font-size: 0.85em; color: #ccc;">Esta acción no se puede deshacer.</p>
      </div>
    `;

    GuardModal.open({
      title: 'Eliminar Edificio',
      icon: 'fas fa-trash',
      body,
      saveLabel: 'Eliminar',
      onSave: async () => {
        await gm.buildingManager.deleteBuilding(buildingId);
        window.dispatchEvent(new CustomEvent('guard-buildings-updated'));
        await BuildingsPanel.render(container);
      },
    });
  }

  // --- Deactivate ---

  private static async handleDeactivateBuilding(
    buildingId: string,
    container: HTMLElement
  ): Promise<void> {
    const gm = (window as any).GuardManagement;
    if (!gm?.buildingManager) return;
    const building = gm.buildingManager.getBuilding(buildingId);
    if (!building) return;

    GuardModal.open({
      title: 'Desactivar Edificio',
      icon: 'fas fa-eye-slash',
      body: `
        <div class="guard-modal-form" style="text-align: center;">
          <p><i class="fas fa-eye-slash" style="color: #e8a84a; font-size: 1.5em;"></i></p>
          <p>¿Desactivar <strong>"${building.name}"</strong>?</p>
          <p style="font-size: 0.85em; color: #ccc;">El edificio dejará de mostrarse en las zonas hasta que se vuelva a activar.</p>
        </div>
      `,
      saveLabel: 'Desactivar',
      onSave: async () => {
        await gm.buildingManager.deactivateBuilding(buildingId);
        window.dispatchEvent(new CustomEvent('guard-buildings-updated'));
        await BuildingsPanel.render(container);
      },
    });
  }

  // --- Send to Chat ---

  private static async sendBuildingToChat(buildingId: string): Promise<void> {
    const gm = (window as any).GuardManagement;
    const building = gm?.buildingManager?.getBuilding(buildingId);
    if (!building) return;

    const imgHtml = building.img
      ? `<div style="margin:-8px -8px 0 -8px;border-radius:6px 6px 0 0;overflow:hidden;max-height:200px;">
           <img src="${building.img}" style="width:100%;height:200px;object-fit:cover;display:block;" />
         </div>`
      : '';

    const tagsHtml =
      (building.tags || []).length > 0
        ? `<p style="margin:4px 0;"><strong>Etiquetas:</strong> ${building.tags.map((t: BuildingTag) => BUILDING_TAG_LABELS[t] || t).join(', ')}</p>`
        : '';

    const zoneHtml = building.zone
      ? `<p style="margin:4px 0;"><strong>Zona:</strong> ${BUILDING_ZONE_LABELS[building.zone as BuildingZone] || building.zone}</p>`
      : '';

    const descHtml = building.description ? `<p style="margin:6px 0 0 0;">${building.description}</p>` : '';

    let gangHtml = '';
    if (building.gangLink) {
      gangHtml = `<p style="margin:4px 0;"><strong>Banda:</strong> ${building.gangLink.gangName}</p>`;
      if (building.gangLink.notes) {
        gangHtml += `<p style="font-size:0.9em;font-style:italic;opacity:0.8;margin:2px 0;">${building.gangLink.notes}</p>`;
      }
    }

    const content = `
      <div style="border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:8px;background:rgba(0,0,0,0.1);overflow:hidden;">
        ${imgHtml}
        <h3 style="margin:${building.img ? '8px' : '0'} 0 4px 0;font-size:1.2em;">${building.name}</h3>
        ${zoneHtml}
        ${tagsHtml}
        ${descHtml}
        ${gangHtml ? `<hr style="border-color:rgba(255,255,255,0.1);margin:6px 0;">${gangHtml}` : ''}
      </div>
    `;

    await (ChatMessage as any).create({ content, speaker: { alias: 'Registro de Edificios' } });
    (globalThis as any).ui?.notifications?.info(`Ficha de "${building.name}" enviada al chat`);
  }
}
