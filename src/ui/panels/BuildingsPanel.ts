/**
 * Buildings Panel - Manages the Edificios tab UI
 * Static class following the same pattern as GangsPanel / CrimesPanel.
 */
import type { BuildingGangLink, BuildingTag } from '../../types/buildings';
import { BUILDING_TAG_ICONS, BUILDING_TAG_LABELS } from '../../types/buildings';
import { GuardModal } from '../GuardModal.js';

export class BuildingsPanel {
  static get template() {
    return 'modules/guard-management/templates/panels/buildings.hbs';
  }

  static async getData() {
    const gm = (window as any).GuardManagement;
    if (!gm?.buildingManager) return { buildings: [], buildingCount: 0 };

    const allBuildings = gm.buildingManager.getAllBuildings();

    const buildings = allBuildings
      .sort((a: any, b: any) => b.updatedAt - a.updatedAt)
      .map((building: any) => ({
        ...building,
        tagLabels: (building.tags || []).map((t: BuildingTag) => ({
          key: t,
          label: BUILDING_TAG_LABELS[t] || t,
          icon: BUILDING_TAG_ICONS[t] || 'fas fa-tag',
        })),
      }));

    return {
      buildings,
      buildingCount: allBuildings.length,
    };
  }

  static async render(container: HTMLElement): Promise<void> {
    try {
      const data = await BuildingsPanel.getData();
      const html = await foundry.applications.handlebars.renderTemplate(
        BuildingsPanel.template,
        data
      );
      $(container).html(html);
      BuildingsPanel.setupEventListeners(container);
    } catch (error) {
      console.error('BuildingsPanel | Error rendering:', error);
    }
  }

  // --- Event listeners ---

  private static setupEventListeners(container: HTMLElement): void {
    // Search
    const searchInput = container.querySelector('.building-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', () => BuildingsPanel.filterBuildings(container));
      searchInput.addEventListener('keydown', (e) => e.stopPropagation());
      searchInput.addEventListener('keyup', (e) => e.stopPropagation());
    }

    // Filter toggles
    container.querySelectorAll('.building-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tag = (btn as HTMLElement).dataset.filterTag;
        if (tag === 'all') {
          container
            .querySelectorAll('.building-filter-btn')
            .forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
        } else {
          container
            .querySelector('.building-filter-btn[data-filter-tag="all"]')
            ?.classList.remove('active');
          btn.classList.toggle('active');
          const anyActive =
            container.querySelectorAll('.building-filter-btn.active:not([data-filter-tag="all"])')
              .length > 0;
          if (!anyActive) {
            container
              .querySelector('.building-filter-btn[data-filter-tag="all"]')
              ?.classList.add('active');
          }
        }
        BuildingsPanel.filterBuildings(container);
      });
    });

    // Add building button
    container.querySelector('.building-add-btn')?.addEventListener('click', () => {
      BuildingsPanel.showAddBuildingDialog(container);
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
        if (buildingId) BuildingsPanel.showEditBuildingDialog(buildingId, container);
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
  }

  // --- Dialog helpers ---

  private static getGangOptions(): { id: string; name: string }[] {
    const gm = (window as any).GuardManagement;
    if (!gm?.gangManager) return [];
    return gm.gangManager.getAllGangs().map((g: any) => ({ id: g.id, name: g.name }));
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

        imgPicker?.addEventListener('click', () => {
          new (globalThis as any).FilePicker({
            type: 'image',
            current: imgInput?.value || '',
            callback: (path: string) => {
              if (imgInput) imgInput.value = path;
              selectedImage = path;
              if (imgPreview) {
                imgPreview.innerHTML = `<img src="${path}" style="max-width: 80px; max-height: 80px; border-radius: 6px; border: 1px solid #555;" />`;
              }
            },
          }).browse();
        });

        imgInput?.addEventListener('change', () => {
          selectedImage = imgInput.value;
          if (imgPreview && imgInput.value) {
            imgPreview.innerHTML = `<img src="${imgInput.value}" style="max-width: 80px; max-height: 80px; border-radius: 6px; border: 1px solid #555;" />`;
          }
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

        const description = (bodyEl.querySelector('#building-desc') as HTMLTextAreaElement)?.value?.trim() || '';

        const tags: BuildingTag[] = [];
        bodyEl.querySelectorAll('input[name="building-tag"]:checked').forEach((cb: any) => {
          tags.push(cb.value as BuildingTag);
        });

        const gangId = (bodyEl.querySelector('#building-gang') as HTMLSelectElement)?.value;
        let gangLink: BuildingGangLink | undefined;
        if (gangId) {
          const gangs = BuildingsPanel.getGangOptions();
          const gang = gangs.find((g) => g.id === gangId);
          const gangNotes = (bodyEl.querySelector('#building-gang-notes') as HTMLTextAreaElement)?.value?.trim() || '';
          gangLink = { gangId, gangName: gang?.name || '', notes: gangNotes };
        }

        const gm = (window as any).GuardManagement;
        if (!gm?.buildingManager) return false;

        await gm.buildingManager.addBuilding({
          name,
          description,
          img: selectedImage || undefined,
          tags,
          gangLink,
        });

        window.dispatchEvent(new CustomEvent('guard-buildings-updated'));
        await BuildingsPanel.render(container);
      },
    });
  }

  private static async showEditBuildingDialog(
    buildingId: string,
    container: HTMLElement
  ): Promise<void> {
    const gm = (window as any).GuardManagement;
    if (!gm?.buildingManager) return;
    const building = gm.buildingManager.getBuilding(buildingId);
    if (!building) return;

    let selectedImage = building.img || '';

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
          <label for="building-gang"><i class="fas fa-users"></i> Banda asociada</label>
          <select id="building-gang">
            ${BuildingsPanel.buildGangSelect(building.gangLink?.gangId)}
          </select>
        </div>
        <div class="guard-modal-row" id="building-gang-notes-group" style="${building.gangLink?.gangId ? '' : 'display: none;'}">
          <label for="building-gang-notes"><i class="fas fa-sticky-note"></i> Nota sobre la banda</label>
          <textarea id="building-gang-notes" rows="2">${building.gangLink?.notes || ''}</textarea>
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

        imgPicker?.addEventListener('click', () => {
          new (globalThis as any).FilePicker({
            type: 'image',
            current: imgInput?.value || '',
            callback: (path: string) => {
              if (imgInput) imgInput.value = path;
              selectedImage = path;
              if (imgPreview) {
                imgPreview.innerHTML = `<img src="${path}" style="max-width: 80px; max-height: 80px; border-radius: 6px; border: 1px solid #555;" />`;
              }
            },
          }).browse();
        });

        imgInput?.addEventListener('change', () => {
          selectedImage = imgInput.value;
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

        const description = (bodyEl.querySelector('#building-desc') as HTMLTextAreaElement)?.value?.trim() || '';

        const tags: BuildingTag[] = [];
        bodyEl.querySelectorAll('input[name="building-tag"]:checked').forEach((cb: any) => {
          tags.push(cb.value as BuildingTag);
        });

        const gangId = (bodyEl.querySelector('#building-gang') as HTMLSelectElement)?.value;
        let gangLink: BuildingGangLink | undefined;
        if (gangId) {
          const gangs = BuildingsPanel.getGangOptions();
          const gang = gangs.find((g) => g.id === gangId);
          const gangNotes = (bodyEl.querySelector('#building-gang-notes') as HTMLTextAreaElement)?.value?.trim() || '';
          gangLink = { gangId, gangName: gang?.name || '', notes: gangNotes };
        }

        const updates: any = { name, description, tags, gangLink };
        if (selectedImage !== (building.img || '')) {
          updates.img = selectedImage || undefined;
        }

        await gm.buildingManager.updateBuilding(buildingId, updates);
        window.dispatchEvent(new CustomEvent('guard-buildings-updated'));
        await BuildingsPanel.render(container);
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

  // --- Send to Chat ---

  private static async sendBuildingToChat(buildingId: string): Promise<void> {
    const gm = (window as any).GuardManagement;
    const building = gm?.buildingManager?.getBuilding(buildingId);
    if (!building) return;

    const imgHtml = building.img
      ? `<img src="${building.img}" width="50" height="50" style="float:left;margin-right:8px;border-radius:4px;" />`
      : '';

    const tagsHtml =
      (building.tags || []).length > 0
        ? `<p><strong>Etiquetas:</strong> ${building.tags.map((t: BuildingTag) => BUILDING_TAG_LABELS[t] || t).join(', ')}</p>`
        : '';

    const descHtml = building.description ? `<p>${building.description}</p>` : '';

    let gangHtml = '';
    if (building.gangLink) {
      gangHtml = `<p><strong>Banda:</strong> ${building.gangLink.gangName}</p>`;
      if (building.gangLink.notes) {
        gangHtml += `<p style="font-size:0.9em;font-style:italic;opacity:0.8;">${building.gangLink.notes}</p>`;
      }
    }

    const content = `
      <div style="border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:8px;background:rgba(0,0,0,0.1);">
        ${imgHtml}
        <h3 style="margin:0 0 4px 0;">${building.name}</h3>
        ${tagsHtml}
        ${descHtml}
        ${gangHtml ? `<hr style="border-color:rgba(255,255,255,0.1);margin:6px 0;">${gangHtml}` : ''}
      </div>
    `;

    await (ChatMessage as any).create({ content, speaker: { alias: 'Registro de Edificios' } });
    (globalThis as any).ui?.notifications?.info(`Ficha de "${building.name}" enviada al chat`);
  }
}
