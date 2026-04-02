/**
 * POI Panel - Manages the Gente de Interés tab UI
 * Static class following the same pattern as GangsPanel / PrisonersPanel.
 */
import type { Crime } from '../../types/crimes';
import type { PersonOfInterest, PoiStatus } from '../../types/poi';
import { POI_STATUS_LABELS } from '../../types/poi';
import { GuardModal } from '../GuardModal.js';

export class PoiPanel {
  static get template() {
    return 'modules/guard-management/templates/panels/poi.hbs';
  }

  static async getData() {
    const gm = (window as any).GuardManagement;
    if (!gm?.poiManager) return { pois: [], poiCount: 0 };

    const allPois = gm.poiManager.getAllPois();

    const pois = allPois
      .sort((a: any, b: any) => b.updatedAt - a.updatedAt)
      .map((poi: PersonOfInterest) => ({
        ...poi,
        statusLabel: POI_STATUS_LABELS[poi.status as keyof typeof POI_STATUS_LABELS] || poi.status,
        crimeNames: PoiPanel.resolveCrimeNames(poi.possibleCrimes),
        gangNames: PoiPanel.resolveGangNames(poi.gangIds),
        prisonRecordCount: PoiPanel.getPrisonRecordCount(poi),
        history: [...(poi.history || [])]
          .sort((a: any, b: any) => b.timestamp - a.timestamp)
          .map((entry: any) => ({
            ...entry,
            timeAgo: PoiPanel.formatTimeAgo(entry.timestamp),
          })),
      }));

    return {
      pois,
      poiCount: allPois.length,
    };
  }

  static async render(container: HTMLElement): Promise<void> {
    try {
      const data = await PoiPanel.getData();
      const html = await foundry.applications.handlebars.renderTemplate(PoiPanel.template, data);
      $(container).html(html);
      PoiPanel.setupEventListeners(container);
      PoiPanel.setupDragAndDrop(container);
    } catch (error) {
      console.error('PoiPanel | Error rendering:', error);
    }
  }

  // --- Event listeners ---

  private static setupEventListeners(container: HTMLElement): void {
    // Search
    const searchInput = container.querySelector('.poi-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', () => PoiPanel.filterPois(container));
      searchInput.addEventListener('keydown', (e) => e.stopPropagation());
      searchInput.addEventListener('keyup', (e) => e.stopPropagation());
    }

    // Filter toggles
    container.querySelectorAll('.poi-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const status = (btn as HTMLElement).dataset.filterStatus;
        if (status === 'all') {
          container
            .querySelectorAll('.poi-filter-btn')
            .forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
        } else {
          container
            .querySelector('.poi-filter-btn[data-filter-status="all"]')
            ?.classList.remove('active');
          btn.classList.toggle('active');
          const anyActive =
            container.querySelectorAll('.poi-filter-btn.active:not([data-filter-status="all"])')
              .length > 0;
          if (!anyActive) {
            container
              .querySelector('.poi-filter-btn[data-filter-status="all"]')
              ?.classList.add('active');
          }
        }
        PoiPanel.filterPois(container);
      });
    });

    // Add POI button
    container.querySelector('.poi-add-btn')?.addEventListener('click', () => {
      PoiPanel.showAddPoiDialog(container);
    });

    // Edit buttons
    container.querySelectorAll('.poi-edit-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const poiId = (btn as HTMLElement).dataset.poiId;
        if (poiId) PoiPanel.showEditPoiDialog(poiId, container);
      });
    });

    // Status buttons
    container.querySelectorAll('.poi-status-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const poiId = (btn as HTMLElement).dataset.poiId;
        if (poiId) PoiPanel.showStatusDialog(poiId, container);
      });
    });

    // Delete buttons
    container.querySelectorAll('.poi-delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const poiId = (btn as HTMLElement).dataset.poiId;
        if (poiId) PoiPanel.handleDeletePoi(poiId, container);
      });
    });

    // Chat buttons
    container.querySelectorAll('.poi-chat-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const poiId = (btn as HTMLElement).dataset.poiId;
        if (poiId) PoiPanel.sendPoiToChat(poiId);
      });
    });

    // Crimes buttons
    container.querySelectorAll('.poi-crimes-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const poiId = (btn as HTMLElement).dataset.poiId;
        if (poiId) PoiPanel.showAssignCrimesDialog(poiId, container);
      });
    });

    // Gangs buttons
    container.querySelectorAll('.poi-gangs-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const poiId = (btn as HTMLElement).dataset.poiId;
        if (poiId) PoiPanel.showAssignGangsDialog(poiId, container);
      });
    });

    // View prison record buttons
    container.querySelectorAll('.poi-view-record-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const poiId = (btn as HTMLElement).dataset.poiId;
        if (poiId) PoiPanel.handleViewPrisonRecord(poiId);
      });
    });

    // Shift+click to delete history entries
    let shiftHeld = false;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        shiftHeld = true;
        container.classList.add('shift-held');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        shiftHeld = false;
        container.classList.remove('shift-held');
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    container.querySelectorAll('.poi-history-entry').forEach((entry) => {
      entry.addEventListener('click', async () => {
        if (!shiftHeld) return;
        const el = entry as HTMLElement;
        const poiId = el.dataset.poiId;
        const timestamp = parseInt(el.dataset.entryTimestamp || '0');
        if (!poiId || !timestamp) return;

        const gm = (window as any).GuardManagement;
        if (!gm?.poiManager) return;

        const removed = await gm.poiManager.removeHistoryEntry(poiId, timestamp);
        if (removed) {
          await PoiPanel.render(container);
        }
      });
    });
  }

  // --- Drag and drop ---

  private static async resolveActorFromDrop(ev: DragEvent): Promise<any | null> {
    const raw = ev.dataTransfer?.getData('text/plain') || '';
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }

    let actor: any = null;
    if (data.type === 'Actor' && data.uuid) {
      actor = await (globalThis as any).fromUuid(data.uuid);
    } else if (data.type === 'Actor' && data.id) {
      actor = (game as any).actors.get(data.id);
    }
    if (!actor && data.tokenId && data.sceneId) {
      const scene = (game as any).scenes.get(data.sceneId);
      const token = scene?.tokens?.get(data.tokenId);
      actor = token?.actor;
    }
    return actor;
  }

  private static setupDragAndDrop(container: HTMLElement): void {
    // Drop on existing POI image -> link actor
    const imageDropZones = container.querySelectorAll('[data-drop="actor"]');
    imageDropZones.forEach((zone) => {
      zone.addEventListener('dragenter', (ev) => {
        ev.preventDefault();
        (zone as HTMLElement).classList.add('dnd-hover');
      });
      zone.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        (zone as HTMLElement).classList.add('dnd-hover');
      });
      zone.addEventListener('dragleave', () => {
        (zone as HTMLElement).classList.remove('dnd-hover');
      });
      zone.addEventListener('drop', async (ev) => {
        ev.preventDefault();
        (zone as HTMLElement).classList.remove('dnd-hover');

        const actor = await PoiPanel.resolveActorFromDrop(ev as DragEvent);
        if (!actor) {
          (globalThis as any).ui?.notifications?.warn('No se pudo resolver el actor arrastrado.');
          return;
        }

        const poiId = (zone as HTMLElement).dataset.poiId;
        if (!poiId) return;

        const gm = (window as any).GuardManagement;
        if (!gm?.poiManager) return;

        await gm.poiManager.linkActor(
          poiId,
          actor.id,
          actor.img || actor.prototypeToken?.texture?.src
        );
        window.dispatchEvent(new CustomEvent('guard-poi-updated'));
        await PoiPanel.render(container);
      });
    });

    // Drop on "new-poi" zones -> create new POI from actor
    const newPoiDropZones = container.querySelectorAll('[data-drop="new-poi"]');
    newPoiDropZones.forEach((zone) => {
      zone.addEventListener('dragenter', (ev) => {
        ev.preventDefault();
        (zone as HTMLElement).classList.add('dnd-hover');
      });
      zone.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        (zone as HTMLElement).classList.add('dnd-hover');
      });
      zone.addEventListener('dragleave', () => {
        (zone as HTMLElement).classList.remove('dnd-hover');
      });
      zone.addEventListener('drop', async (ev) => {
        ev.preventDefault();
        (zone as HTMLElement).classList.remove('dnd-hover');

        const actor = await PoiPanel.resolveActorFromDrop(ev as DragEvent);
        if (!actor) {
          (globalThis as any).ui?.notifications?.warn('No se pudo resolver el actor arrastrado.');
          return;
        }

        const gm = (window as any).GuardManagement;
        if (!gm?.poiManager) return;

        await gm.poiManager.addPoi({
          name: actor.name,
          img: actor.img || actor.prototypeToken?.texture?.src,
          actorId: actor.id,
        });

        window.dispatchEvent(new CustomEvent('guard-poi-updated'));
        await PoiPanel.render(container);
        (globalThis as any).ui?.notifications?.info(
          `"${actor.name}" registrado como persona de interés.`
        );
      });
    });
  }

  // --- Filter ---

  private static filterPois(container: HTMLElement): void {
    const searchInput = container.querySelector('.poi-search-input') as HTMLInputElement;
    const searchTerm = (searchInput?.value || '').toLowerCase().trim();

    const activeFilters: string[] = [];
    container
      .querySelectorAll('.poi-filter-btn.active:not([data-filter-status="all"])')
      .forEach((btn) => {
        const status = (btn as HTMLElement).dataset.filterStatus;
        if (status) activeFilters.push(status);
      });

    container.querySelectorAll('.poi-card').forEach((card) => {
      const el = card as HTMLElement;
      const name = card.querySelector('.poi-name')?.textContent?.toLowerCase() || '';
      const status = el.dataset.poiStatus || '';
      const matchesSearch = !searchTerm || name.includes(searchTerm);
      const matchesFilter = activeFilters.length === 0 || activeFilters.includes(status);
      el.style.display = matchesSearch && matchesFilter ? '' : 'none';
    });
  }

  // --- Dialogs ---

  private static async showAddPoiDialog(container: HTMLElement): Promise<void> {
    let selectedImage = '';
    let linkedActorId = '';

    const body = `
      <div class="guard-modal-form">
        <div class="poi-dialog-dropzone" id="poi-actor-drop">
          <i class="fas fa-user-plus"></i>
          <span>Arrastra un actor aquí para rellenar los datos</span>
        </div>
        <div class="guard-modal-row">
          <label for="poi-name"><i class="fas fa-user"></i> Nombre</label>
          <input type="text" id="poi-name" placeholder="Nombre de la persona..." />
        </div>
        <div class="guard-modal-row">
          <label><i class="fas fa-image"></i> Imagen</label>
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="text" id="poi-img" placeholder="Ruta de imagen..." style="flex: 1;" />
            <button type="button" id="poi-img-picker" class="poi-btn" style="white-space: nowrap;">
              <i class="fas fa-file-image"></i> Buscar
            </button>
          </div>
          <div id="poi-img-preview" style="margin-top: 6px; text-align: center;"></div>
        </div>
        <div class="guard-modal-row">
          <label for="poi-notes"><i class="fas fa-sticky-note"></i> Notas</label>
          <textarea id="poi-notes" rows="3" placeholder="Notas opcionales..."></textarea>
        </div>
      </div>
    `;

    GuardModal.open({
      title: 'Registrar Persona de Interés',
      icon: 'fas fa-user-secret',
      body,
      saveLabel: 'Registrar',
      onRender: (bodyEl) => {
        const imgInput = bodyEl.querySelector('#poi-img') as HTMLInputElement;
        const imgPreview = bodyEl.querySelector('#poi-img-preview') as HTMLElement;
        const imgPicker = bodyEl.querySelector('#poi-img-picker');
        const nameInput = bodyEl.querySelector('#poi-name') as HTMLInputElement;

        // Actor drop zone
        const dropZone = bodyEl.querySelector('#poi-actor-drop') as HTMLElement;
        if (dropZone) {
          dropZone.addEventListener('dragenter', (ev) => {
            ev.preventDefault();
            dropZone.classList.add('dnd-hover');
          });
          dropZone.addEventListener('dragover', (ev) => {
            ev.preventDefault();
            dropZone.classList.add('dnd-hover');
          });
          dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dnd-hover');
          });
          dropZone.addEventListener('drop', async (ev) => {
            ev.preventDefault();
            dropZone.classList.remove('dnd-hover');

            const actor = await PoiPanel.resolveActorFromDrop(ev as DragEvent);
            if (!actor) {
              (globalThis as any).ui?.notifications?.warn(
                'No se pudo resolver el actor arrastrado.'
              );
              return;
            }

            if (nameInput) nameInput.value = actor.name;
            const actorImg = actor.img || actor.prototypeToken?.texture?.src || '';
            if (imgInput) imgInput.value = actorImg;
            selectedImage = actorImg;
            linkedActorId = actor.id;
            if (imgPreview && actorImg) {
              imgPreview.innerHTML = `<img src="${actorImg}" style="max-width: 80px; max-height: 80px; border-radius: 6px; border: 1px solid #555;" />`;
            }
            dropZone.innerHTML = `<i class="fas fa-check-circle" style="color: #4ae89a;"></i><span>Actor vinculado: ${actor.name}</span>`;
          });
        }

        // File picker
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
          }).render(true);
        });

        imgInput?.addEventListener('change', () => {
          selectedImage = imgInput.value;
          if (imgPreview && imgInput.value) {
            imgPreview.innerHTML = `<img src="${imgInput.value}" style="max-width: 80px; max-height: 80px; border-radius: 6px; border: 1px solid #555;" />`;
          }
        });

        nameInput?.focus();
      },
      onSave: async (bodyEl) => {
        const name = (bodyEl.querySelector('#poi-name') as HTMLInputElement)?.value?.trim();
        if (!name) {
          (globalThis as any).ui?.notifications?.warn('El nombre es obligatorio.');
          return false;
        }

        const notes =
          (bodyEl.querySelector('#poi-notes') as HTMLTextAreaElement)?.value?.trim() || '';

        const gm = (window as any).GuardManagement;
        if (!gm?.poiManager) return false;

        await gm.poiManager.addPoi({
          name,
          img: selectedImage || undefined,
          actorId: linkedActorId || undefined,
          notes,
        });

        window.dispatchEvent(new CustomEvent('guard-poi-updated'));
        await PoiPanel.render(container);
      },
    });
  }

  private static async showEditPoiDialog(poiId: string, container: HTMLElement): Promise<void> {
    const gm = (window as any).GuardManagement;
    if (!gm?.poiManager) return;
    const poi = gm.poiManager.getPoi(poiId);
    if (!poi) return;

    let selectedImage = poi.img || '';

    const body = `
      <div class="guard-modal-form">
        <div class="guard-modal-row">
          <label for="poi-name"><i class="fas fa-user"></i> Nombre</label>
          <input type="text" id="poi-name" value="${poi.name.replace(/"/g, '&quot;')}" />
        </div>
        <div class="guard-modal-row">
          <label><i class="fas fa-image"></i> Imagen</label>
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="text" id="poi-img" value="${poi.img || ''}" style="flex: 1;" />
            <button type="button" id="poi-img-picker" class="poi-btn" style="white-space: nowrap;">
              <i class="fas fa-file-image"></i> Buscar
            </button>
          </div>
          <div id="poi-img-preview" style="margin-top: 6px; text-align: center;">
            ${poi.img ? `<img src="${poi.img}" style="max-width: 80px; max-height: 80px; border-radius: 6px; border: 1px solid #555;" />` : ''}
          </div>
        </div>
        <div class="guard-modal-row">
          <label for="poi-notes"><i class="fas fa-sticky-note"></i> Notas</label>
          <textarea id="poi-notes" rows="3">${poi.notes || ''}</textarea>
        </div>
      </div>
    `;

    GuardModal.open({
      title: `Editar: ${poi.name}`,
      icon: 'fas fa-edit',
      body,
      onRender: (bodyEl) => {
        const imgInput = bodyEl.querySelector('#poi-img') as HTMLInputElement;
        const imgPreview = bodyEl.querySelector('#poi-img-preview') as HTMLElement;
        const imgPicker = bodyEl.querySelector('#poi-img-picker');

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
          }).render(true);
        });

        imgInput?.addEventListener('change', () => {
          selectedImage = imgInput.value;
        });
      },
      onSave: async (bodyEl) => {
        const name = (bodyEl.querySelector('#poi-name') as HTMLInputElement)?.value?.trim();
        if (!name) {
          (globalThis as any).ui?.notifications?.warn('El nombre es obligatorio.');
          return false;
        }

        const notes =
          (bodyEl.querySelector('#poi-notes') as HTMLTextAreaElement)?.value?.trim() || '';

        const updates: any = { notes };
        if (name !== poi.name) {
          updates.name = name;
        }
        if (selectedImage !== (poi.img || '')) {
          updates.img = selectedImage || undefined;
        }

        await gm.poiManager.updatePoi(poiId, updates);
        window.dispatchEvent(new CustomEvent('guard-poi-updated'));
        await PoiPanel.render(container);
      },
    });
  }

  private static async showStatusDialog(poiId: string, container: HTMLElement): Promise<void> {
    const gm = (window as any).GuardManagement;
    if (!gm?.poiManager) return;
    const poi = gm.poiManager.getPoi(poiId);
    if (!poi) return;

    const statuses: PoiStatus[] = ['active', 'released', 'imprisoned', 'deceased', 'unknown'];
    const statusIcons: Record<PoiStatus, string> = {
      active: 'fas fa-eye',
      released: 'fas fa-door-open',
      imprisoned: 'fas fa-dungeon',
      deceased: 'fas fa-skull',
      unknown: 'fas fa-question-circle',
    };

    const statusButtons = statuses
      .filter((s) => s !== poi.status)
      .map(
        (s) => `
        <button type="button" class="guard-modal-btn save status-btn" data-status="${s}" style="flex: 1;">
          <i class="${statusIcons[s]}"></i> ${POI_STATUS_LABELS[s]}
        </button>`
      )
      .join('');

    const body = `
      <div class="guard-modal-form" style="text-align: center;">
        <div class="guard-modal-row" style="align-items: center;">
          <label>Estado actual</label>
          <strong>${POI_STATUS_LABELS[poi.status as keyof typeof POI_STATUS_LABELS]}</strong>
        </div>
        <div class="guard-modal-row" style="align-items: center;">
          <label>Selecciona el nuevo estado:</label>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">${statusButtons}</div>
        </div>
      </div>
    `;

    GuardModal.open({
      title: `Cambiar Estado: ${poi.name}`,
      icon: 'fas fa-exchange-alt',
      body,
      showFooter: false,
      onSave: async () => {},
      onRender: (bodyEl) => {
        bodyEl.querySelectorAll('.status-btn').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const newStatus = (btn as HTMLElement).dataset.status as PoiStatus;
            if (!newStatus) return;
            await gm.poiManager.changeStatus(poiId, newStatus);
            window.dispatchEvent(new CustomEvent('guard-poi-updated'));
            await PoiPanel.render(container);
            const modal = btn.closest('.guard-modal');
            if (modal) modal.remove();
          });
        });
      },
    });
  }

  private static async handleDeletePoi(poiId: string, container: HTMLElement): Promise<void> {
    const gm = (window as any).GuardManagement;
    if (!gm?.poiManager) return;
    const poi = gm.poiManager.getPoi(poiId);
    if (!poi) return;

    const body = `
      <div class="guard-modal-form" style="text-align: center;">
        <p><i class="fas fa-exclamation-triangle" style="color: #e84a4a; font-size: 1.5em;"></i></p>
        <p>¿Eliminar a <strong>"${poi.name}"</strong> del registro?</p>
        <p style="font-size: 0.85em; color: #ccc;">Esta acción no se puede deshacer.</p>
      </div>
    `;

    GuardModal.open({
      title: 'Eliminar Persona de Interés',
      icon: 'fas fa-trash',
      body,
      saveLabel: 'Eliminar',
      onSave: async () => {
        await gm.poiManager.deletePoi(poiId);
        window.dispatchEvent(new CustomEvent('guard-poi-updated'));
        await PoiPanel.render(container);
      },
    });
  }

  // --- Assign crimes dialog ---

  private static async showAssignCrimesDialog(
    poiId: string,
    container: HTMLElement
  ): Promise<void> {
    const gm = (window as any).GuardManagement;
    if (!gm?.poiManager || !gm?.crimeManager) return;
    const poi = gm.poiManager.getPoi(poiId);
    if (!poi) return;

    const allCrimes = gm.crimeManager.getAllCrimes();
    const currentCrimeIds = new Set(poi.possibleCrimes || []);

    const crimeRows = allCrimes
      .map(
        (c: Crime) => `
        <tr>
          <td><input type="checkbox" class="poi-crime-checkbox" data-crime-id="${c.id}" ${currentCrimeIds.has(c.id) ? 'checked' : ''} /></td>
          <td>${c.name}</td>
          <td><span class="offense-badge offense-${c.offenseType}">${c.offenseType}</span></td>
        </tr>`
      )
      .join('');

    const body = `
      <div class="guard-modal-form">
        <p style="font-size: 0.85em; color: #ccc; margin-bottom: 8px;">Selecciona los posibles crímenes asociados a esta persona:</p>
        <table class="poi-crimes-table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="width: 30px;"></th>
              <th style="text-align: left;">Crimen</th>
              <th style="text-align: left; width: 80px;">Tipo</th>
            </tr>
          </thead>
          <tbody>
            ${crimeRows || '<tr><td colspan="3" style="text-align:center; color:#888; padding:12px;">No hay crímenes registrados en el catálogo.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;

    GuardModal.open({
      title: `Posibles Crímenes: ${poi.name}`,
      icon: 'fas fa-gavel',
      body,
      saveLabel: 'Aplicar',
      onSave: async (bodyEl) => {
        const selectedIds = new Set<string>();
        bodyEl.querySelectorAll('.poi-crime-checkbox:checked').forEach((cb: any) => {
          const crimeId = cb.dataset.crimeId;
          if (crimeId) selectedIds.add(crimeId);
        });

        for (const crimeId of selectedIds) {
          if (!currentCrimeIds.has(crimeId)) {
            await gm.poiManager.addCrime(poiId, crimeId);
          }
        }
        for (const crimeId of currentCrimeIds) {
          if (!selectedIds.has(crimeId)) {
            await gm.poiManager.removeCrime(poiId, crimeId);
          }
        }

        window.dispatchEvent(new CustomEvent('guard-poi-updated'));
        await PoiPanel.render(container);
      },
    });
  }

  // --- Assign gangs dialog ---

  private static async showAssignGangsDialog(poiId: string, container: HTMLElement): Promise<void> {
    const gm = (window as any).GuardManagement;
    if (!gm?.poiManager || !gm?.gangManager) return;
    const poi = gm.poiManager.getPoi(poiId);
    if (!poi) return;

    const allGangs = gm.gangManager.getAllGangs();
    const currentGangIds = new Set(poi.gangIds || []);

    const gangRows = allGangs
      .map(
        (g: any) => `
        <tr>
          <td><input type="checkbox" class="poi-gang-checkbox" data-gang-id="${g.id}" ${currentGangIds.has(g.id) ? 'checked' : ''} /></td>
          <td>${g.name}</td>
          <td><span class="gang-status-badge gang-status-${g.status}">${g.status}</span></td>
        </tr>`
      )
      .join('');

    const body = `
      <div class="guard-modal-form">
        <p style="font-size: 0.85em; color: #ccc; margin-bottom: 8px;">Selecciona las bandas a las que pertenece esta persona:</p>
        <table class="poi-gangs-table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="width: 30px;"></th>
              <th style="text-align: left;">Banda</th>
              <th style="text-align: left; width: 80px;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${gangRows || '<tr><td colspan="3" style="text-align:center; color:#888; padding:12px;">No hay bandas registradas.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;

    GuardModal.open({
      title: `Bandas: ${poi.name}`,
      icon: 'fas fa-users',
      body,
      saveLabel: 'Aplicar',
      onSave: async (bodyEl) => {
        const selectedIds = new Set<string>();
        bodyEl.querySelectorAll('.poi-gang-checkbox:checked').forEach((cb: any) => {
          const gangId = cb.dataset.gangId;
          if (gangId) selectedIds.add(gangId);
        });

        for (const gangId of selectedIds) {
          if (!currentGangIds.has(gangId)) {
            await gm.poiManager.addGang(poiId, gangId);
          }
        }
        for (const gangId of currentGangIds) {
          if (!selectedIds.has(gangId)) {
            await gm.poiManager.removeGang(poiId, gangId);
          }
        }

        window.dispatchEvent(new CustomEvent('guard-poi-updated'));
        await PoiPanel.render(container);
      },
    });
  }

  // --- Send to Chat ---

  private static async sendPoiToChat(poiId: string): Promise<void> {
    const gm = (window as any).GuardManagement;
    const poi: PersonOfInterest | undefined = gm?.poiManager?.getPoi(poiId);
    if (!poi) return;

    const imgHtml = poi.img
      ? `<img src="${poi.img}" width="50" height="50" style="float:left;margin-right:8px;border-radius:4px;" />`
      : '';

    const statusLabel = POI_STATUS_LABELS[poi.status] || poi.status;

    const crimeNames = PoiPanel.resolveCrimeNames(poi.possibleCrimes);
    const crimesHtml =
      crimeNames.length > 0
        ? `<p><strong>Posibles Crímenes:</strong> ${crimeNames.map((c) => c.name).join(', ')}</p>`
        : '';

    const gangNames = PoiPanel.resolveGangNames(poi.gangIds);
    const gangsHtml =
      gangNames.length > 0
        ? `<p><strong>Bandas:</strong> ${gangNames.map((g) => g.name).join(', ')}</p>`
        : '';

    const prisonCount = PoiPanel.getPrisonRecordCount(poi);
    const prisonHtml =
      prisonCount > 0 ? `<p><strong>Registros de prisión:</strong> ${prisonCount}</p>` : '';

    const content = `
      <div style="border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:8px;background:rgba(0,0,0,0.1);">
        ${imgHtml}
        <h3 style="margin:0 0 4px 0;">${poi.name}</h3>
        <p><strong>Estado:</strong> ${statusLabel}</p>
        ${crimesHtml}
        ${gangsHtml}
        ${prisonHtml}
      </div>
    `;

    await (ChatMessage as any).create({ content, speaker: { alias: 'Gente de Interés' } });
    (globalThis as any).ui?.notifications?.info(`Ficha de "${poi.name}" enviada al chat`);
  }

  // --- Cross-reference helpers ---

  private static resolveCrimeNames(crimeIds: string[]): { name: string; offenseType: string }[] {
    if (!Array.isArray(crimeIds) || crimeIds.length === 0) return [];
    const gm = (window as any).GuardManagement;
    const crimeManager = gm?.crimeManager;
    if (!crimeManager) return [];

    return crimeIds
      .map((id) => {
        const crime: Crime | null = crimeManager.getCrime(id);
        if (!crime) return null;
        return { name: crime.name, offenseType: crime.offenseType };
      })
      .filter(Boolean) as { name: string; offenseType: string }[];
  }

  private static resolveGangNames(
    gangIds: string[]
  ): { id: string; name: string; status: string }[] {
    if (!Array.isArray(gangIds) || gangIds.length === 0) return [];
    const gm = (window as any).GuardManagement;
    const gangManager = gm?.gangManager;
    if (!gangManager) return [];

    return gangIds
      .map((id) => {
        const gang = gangManager.getGang(id);
        if (!gang) return null;
        return { id: gang.id, name: gang.name, status: gang.status };
      })
      .filter(Boolean) as { id: string; name: string; status: string }[];
  }

  private static getPrisonRecordCount(poi: PersonOfInterest): number {
    const gm = (window as any).GuardManagement;
    const prisonerManager = gm?.prisonerManager;
    if (!prisonerManager) return 0;
    const allPrisoners = prisonerManager.getAllPrisoners();
    return allPrisoners.filter((p: any) => {
      if (poi.actorId && p.actorId === poi.actorId) return true;
      return p.name.toLowerCase() === poi.name.toLowerCase();
    }).length;
  }

  private static handleViewPrisonRecord(poiId: string): void {
    const gm = (window as any).GuardManagement;
    const poi = gm?.poiManager?.getPoi(poiId);
    if (!poi) return;

    // Switch to prisoners tab
    const dialog = gm?.guardDialogManager?.customInfoDialog;
    if (dialog?.element) {
      const prisonersTab = dialog.element.querySelector('[data-tab="prisoners"]') as HTMLElement;
      if (prisonersTab) prisonersTab.click();

      // After render, set the search to the POI name
      setTimeout(() => {
        const searchInput = dialog.element?.querySelector(
          '.prisoner-search-input'
        ) as HTMLInputElement;
        if (searchInput) {
          searchInput.value = poi.name;
          searchInput.dispatchEvent(new Event('input'));
        }
      }, 200);
    }
  }

  // --- Helpers ---

  private static formatTimeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'ahora';
    if (minutes < 60) return `hace ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `hace ${days}d`;
  }
}
