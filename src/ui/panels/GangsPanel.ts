/**
 * Gangs Panel - Manages the Bandas tab UI
 * Static class following the same pattern as PrisonersPanel / CrimesPanel.
 */
import type { Gang, GangMember } from '../../types/gangs';
import { GANG_STATUS_LABELS } from '../../types/gangs';

export class GangsPanel {
  static get template() {
    return 'modules/guard-management/templates/panels/gangs.hbs';
  }

  static async getData() {
    const gm = (window as any).GuardManagement;
    if (!gm?.gangManager) return { gangs: [], gangCount: 0 };

    const allGangs = gm.gangManager.getAllGangs();

    const enrichMember = (m: any) => ({
      ...m,
      count: m.count || 1,
      showCount: (m.count || 1) > 1,
    });

    const gangs = allGangs
      .sort((a: any, b: any) => b.updatedAt - a.updatedAt)
      .map((gang: any) => ({
        ...gang,
        subleaders: (gang.subleaders || []).map(enrichMember),
        members: (gang.members || []).map(enrichMember),
        statusLabel:
          GANG_STATUS_LABELS[gang.status as keyof typeof GANG_STATUS_LABELS] || gang.status,
        history: [...(gang.history || [])]
          .sort((a: any, b: any) => b.timestamp - a.timestamp)
          .map((entry: any) => ({
            ...entry,
            timeAgo: GangsPanel.formatTimeAgo(entry.timestamp),
          })),
      }));

    return {
      gangs,
      gangCount: allGangs.length,
    };
  }

  static async render(container: HTMLElement): Promise<void> {
    try {
      const data = await GangsPanel.getData();
      const html = await foundry.applications.handlebars.renderTemplate(GangsPanel.template, data);
      $(container).html(html);
      GangsPanel.setupEventListeners(container);
      GangsPanel.setupDragAndDrop(container);
    } catch (error) {
      console.error('GangsPanel | Error rendering:', error);
    }
  }

  // --- Event listeners ---

  private static setupEventListeners(container: HTMLElement): void {
    // Search
    const searchInput = container.querySelector('.gang-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', () => GangsPanel.filterGangs(container));
      searchInput.addEventListener('keydown', (e) => e.stopPropagation());
      searchInput.addEventListener('keyup', (e) => e.stopPropagation());
    }

    // Filter toggles
    container.querySelectorAll('.gang-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const status = (btn as HTMLElement).dataset.filterStatus;
        if (status === 'all') {
          container
            .querySelectorAll('.gang-filter-btn')
            .forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
        } else {
          container
            .querySelector('.gang-filter-btn[data-filter-status="all"]')
            ?.classList.remove('active');
          btn.classList.toggle('active');
          const anyActive =
            container.querySelectorAll('.gang-filter-btn.active:not([data-filter-status="all"])')
              .length > 0;
          if (!anyActive) {
            container
              .querySelector('.gang-filter-btn[data-filter-status="all"]')
              ?.classList.add('active');
          }
        }
        GangsPanel.filterGangs(container);
      });
    });

    // Add gang button
    container.querySelector('.gang-add-btn')?.addEventListener('click', () => {
      GangsPanel.showAddGangDialog(container);
    });

    // Edit buttons
    container.querySelectorAll('.gang-edit-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const gangId = (btn as HTMLElement).dataset.gangId;
        if (gangId) GangsPanel.showEditGangDialog(gangId, container);
      });
    });

    // Status buttons
    container.querySelectorAll('.gang-status-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const gangId = (btn as HTMLElement).dataset.gangId;
        if (gangId) GangsPanel.showStatusDialog(gangId, container);
      });
    });

    // Delete buttons
    container.querySelectorAll('.gang-delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const gangId = (btn as HTMLElement).dataset.gangId;
        if (gangId) GangsPanel.handleDeleteGang(gangId, container);
      });
    });

    // Chat buttons
    container.querySelectorAll('.gang-chat-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const gangId = (btn as HTMLElement).dataset.gangId;
        if (gangId) GangsPanel.sendGangToChat(gangId);
      });
    });

    // Ctrl+click on subleader/member avatars to increment count
    // Ctrl+right-click to decrement count
    container.querySelectorAll('.gang-member-avatar[data-role="subleader"], .gang-member-avatar[data-role="member"]').forEach((avatar) => {
      avatar.addEventListener('click', async (e) => {
        const me = e as MouseEvent;
        if (me.ctrlKey) {
          e.stopPropagation();
          const el = avatar as HTMLElement;
          const gangId = el.dataset.gangId;
          const actorId = el.dataset.actorId;
          const role = el.dataset.role as 'subleader' | 'member';
          if (!gangId || !actorId || !role) return;

          const gm = (window as any).GuardManagement;
          if (!gm?.gangManager) return;

          await gm.gangManager.incrementMemberCount(gangId, actorId, role);
          await GangsPanel.render(container);
        }
      });

      avatar.addEventListener('contextmenu', async (e) => {
        if (!(e as MouseEvent).ctrlKey) return;
        e.preventDefault();
        e.stopPropagation();
        const el = avatar as HTMLElement;
        const gangId = el.dataset.gangId;
        const actorId = el.dataset.actorId;
        const role = el.dataset.role as 'subleader' | 'member';
        if (!gangId || !actorId || !role) return;

        const gm = (window as any).GuardManagement;
        if (!gm?.gangManager) return;

        await gm.gangManager.decrementMemberCount(gangId, actorId, role);
        await GangsPanel.render(container);
      });
    });

    // Shift+click to delete history entries and member avatars
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

    // Shift+click on member avatars to remove them
    container.querySelectorAll('.gang-member-avatar').forEach((avatar) => {
      avatar.addEventListener('click', async (e) => {
        if (!shiftHeld) return;
        e.stopPropagation();
        const el = avatar as HTMLElement;
        const gangId = el.dataset.gangId;
        const actorId = el.dataset.actorId;
        const role = el.dataset.role;
        if (!gangId || !actorId || !role) return;

        const gm = (window as any).GuardManagement;
        if (!gm?.gangManager) return;

        if (role === 'leader') await gm.gangManager.removeLeader(gangId, actorId);
        else if (role === 'subleader') await gm.gangManager.removeSubleader(gangId, actorId);
        else if (role === 'member') await gm.gangManager.removeMember(gangId, actorId);

        window.dispatchEvent(new CustomEvent('guard-gangs-updated'));
        await GangsPanel.render(container);
      });
    });

    container.querySelectorAll('.gang-history-entry').forEach((entry) => {
      entry.addEventListener('click', async () => {
        if (!shiftHeld) return;
        const el = entry as HTMLElement;
        const gangId = el.dataset.gangId;
        const timestamp = parseInt(el.dataset.entryTimestamp || '0');
        if (!gangId || !timestamp) return;

        const gm = (window as any).GuardManagement;
        if (!gm?.gangManager) return;

        const removed = await gm.gangManager.removeHistoryEntry(gangId, timestamp);
        if (removed) {
          await GangsPanel.render(container);
        }
      });
    });
  }

  // --- Drag and drop ---

  private static setupDragAndDrop(container: HTMLElement): void {
    const dropZones = container.querySelectorAll('[data-drop]');

    dropZones.forEach((zone) => {
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

        const raw = (ev as DragEvent).dataTransfer?.getData('text/plain') || '';
        let data: any;
        try {
          data = JSON.parse(raw);
        } catch {
          return;
        }

        // Resolve actor
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
        if (!actor) {
          (globalThis as any).ui?.notifications?.warn('No se pudo resolver el actor arrastrado.');
          return;
        }

        const zoneEl = zone as HTMLElement;
        const role = zoneEl.dataset.drop; // 'leader', 'subleader', 'member'
        const gangId = zoneEl.dataset.gangId;
        if (!role || !gangId) return;

        const gm = (window as any).GuardManagement;
        if (!gm?.gangManager) return;

        const member: GangMember = {
          actorId: actor.id,
          name: actor.name,
          img: actor.img || actor.prototypeToken?.texture?.src,
        };

        if (role === 'leader') await gm.gangManager.addLeader(gangId, member);
        else if (role === 'subleader') await gm.gangManager.addSubleader(gangId, member);
        else if (role === 'member') await gm.gangManager.addMember(gangId, member);

        window.dispatchEvent(new CustomEvent('guard-gangs-updated'));
        await GangsPanel.render(container);
      });
    });
  }

  // --- Filter ---

  private static filterGangs(container: HTMLElement): void {
    const searchInput = container.querySelector('.gang-search-input') as HTMLInputElement;
    const searchTerm = (searchInput?.value || '').toLowerCase().trim();

    const activeFilters: string[] = [];
    container
      .querySelectorAll('.gang-filter-btn.active:not([data-filter-status="all"])')
      .forEach((btn) => {
        const status = (btn as HTMLElement).dataset.filterStatus;
        if (status) activeFilters.push(status);
      });

    container.querySelectorAll('.gang-card').forEach((card) => {
      const el = card as HTMLElement;
      const name = card.querySelector('.gang-name')?.textContent?.toLowerCase() || '';
      const status = el.dataset.gangStatus || '';
      const matchesSearch = !searchTerm || name.includes(searchTerm);
      const matchesFilter = activeFilters.length === 0 || activeFilters.includes(status);
      el.style.display = matchesSearch && matchesFilter ? '' : 'none';
    });
  }

  // --- Dialogs ---

  private static async showAddGangDialog(container: HTMLElement): Promise<void> {
    const DialogV2 = (foundry as any).applications?.api?.DialogV2;
    if (!DialogV2) return;

    let selectedImage = '';

    await DialogV2.wait({
      window: { title: 'Registrar Nueva Banda' },
      content: `
        <div class="gang-dialog" style="padding: 10px;">
          <div class="form-group">
            <label for="gang-name">Nombre de la banda</label>
            <input type="text" id="gang-name" name="name" placeholder="Ej: Los Cuervos, Hermandad de la Sombra..." required />
          </div>
          <div class="form-group">
            <label>Imagen</label>
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="text" id="gang-img" name="img" placeholder="Ruta de imagen..." style="flex: 1;" />
              <button type="button" id="gang-img-picker" class="gangs-btn" style="white-space: nowrap;">
                <i class="fas fa-file-image"></i> Buscar
              </button>
            </div>
            <div id="gang-img-preview" style="margin-top: 6px; text-align: center;"></div>
          </div>
          <div class="form-group stacked">
            <label for="gang-notes">Notas</label>
            <prose-mirror name="gang-notes" value="">
            </prose-mirror>
          </div>
        </div>
      `,
      render: (_event: any, html: any) => {
        const el = html instanceof HTMLElement ? html : html?.element;
        if (!el) return;
        const imgInput = el.querySelector('#gang-img') as HTMLInputElement;
        const imgPreview = el.querySelector('#gang-img-preview') as HTMLElement;
        const imgPicker = el.querySelector('#gang-img-picker');

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
      },
      buttons: [
        { action: 'cancel', label: 'Cancelar', icon: 'fas fa-times' },
        {
          action: 'save',
          label: 'Registrar',
          icon: 'fas fa-check',
          default: true,
          callback: async (_event: any, _button: any, dialog: any) => {
            const dialogEl = dialog?.element || dialog;
            if (!dialogEl) return;

            const name = (dialogEl.querySelector('#gang-name') as HTMLInputElement)?.value?.trim();
            if (!name) {
              (globalThis as any).ui?.notifications?.warn('El nombre de la banda es obligatorio.');
              return;
            }

            // Read ProseMirror content
            let notes = '';
            const proseMirror = dialogEl.querySelector('.editor-content.ProseMirror') as HTMLElement;
            if (proseMirror) {
              notes = proseMirror.innerHTML || '';
            } else {
              const pmEl = dialogEl.querySelector('prose-mirror') as any;
              if (pmEl?.value) notes = pmEl.value;
            }

            const gm = (window as any).GuardManagement;
            if (!gm?.gangManager) return;

            await gm.gangManager.addGang({
              name,
              img: selectedImage || undefined,
              notes,
            });

            window.dispatchEvent(new CustomEvent('guard-gangs-updated'));
            await GangsPanel.render(container);
          },
        },
      ],
      modal: false,
    });
  }

  private static async showEditGangDialog(gangId: string, container: HTMLElement): Promise<void> {
    const gm = (window as any).GuardManagement;
    if (!gm?.gangManager) return;
    const gang = gm.gangManager.getGang(gangId);
    if (!gang) return;

    const DialogV2 = (foundry as any).applications?.api?.DialogV2;
    if (!DialogV2) return;

    let selectedImage = gang.img || '';

    await DialogV2.wait({
      window: { title: `Editar Banda: ${gang.name}` },
      content: `
        <div class="gang-dialog" style="padding: 10px;">
          <div class="form-group">
            <label for="gang-name">Nombre de la banda</label>
            <input type="text" id="gang-name" name="name" value="${gang.name.replace(/"/g, '&quot;')}" required />
          </div>
          <div class="form-group">
            <label>Imagen</label>
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="text" id="gang-img" name="img" value="${gang.img || ''}" style="flex: 1;" />
              <button type="button" id="gang-img-picker" class="gangs-btn" style="white-space: nowrap;">
                <i class="fas fa-file-image"></i> Buscar
              </button>
            </div>
            <div id="gang-img-preview" style="margin-top: 6px; text-align: center;">
              ${gang.img ? `<img src="${gang.img}" style="max-width: 80px; max-height: 80px; border-radius: 6px; border: 1px solid #555;" />` : ''}
            </div>
          </div>
          <div class="form-group stacked">
            <label for="gang-notes">Notas</label>
            <prose-mirror name="gang-notes" value="${(gang.notes || '').replace(/"/g, '&quot;')}">
              ${gang.notes || ''}
            </prose-mirror>
          </div>
        </div>
      `,
      render: (_event: any, html: any) => {
        const el = html instanceof HTMLElement ? html : html?.element;
        if (!el) return;
        const imgInput = el.querySelector('#gang-img') as HTMLInputElement;
        const imgPreview = el.querySelector('#gang-img-preview') as HTMLElement;
        const imgPicker = el.querySelector('#gang-img-picker');

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
      },
      buttons: [
        { action: 'cancel', label: 'Cancelar', icon: 'fas fa-times' },
        {
          action: 'save',
          label: 'Guardar',
          icon: 'fas fa-check',
          default: true,
          callback: async (_event: any, _button: any, dialog: any) => {
            const dialogEl = dialog?.element || dialog;
            if (!dialogEl) return;

            const name = (dialogEl.querySelector('#gang-name') as HTMLInputElement)?.value?.trim();
            if (!name) {
              (globalThis as any).ui?.notifications?.warn('El nombre de la banda es obligatorio.');
              return;
            }

            // Read ProseMirror
            let notes = '';
            const proseMirror = dialogEl.querySelector('.editor-content.ProseMirror') as HTMLElement;
            if (proseMirror) {
              notes = proseMirror.innerHTML || '';
            } else {
              const pmEl = dialogEl.querySelector('prose-mirror') as any;
              if (pmEl?.value) notes = pmEl.value;
            }

            const updates: any = { notes };
            if (name !== gang.name) {
              updates.name = name;
            }
            if (selectedImage !== (gang.img || '')) {
              updates.img = selectedImage || undefined;
            }

            await gm.gangManager.updateGang(gangId, updates);
            window.dispatchEvent(new CustomEvent('guard-gangs-updated'));
            await GangsPanel.render(container);
          },
        },
      ],
      modal: false,
    });
  }

  private static async showStatusDialog(gangId: string, container: HTMLElement): Promise<void> {
    const gm = (window as any).GuardManagement;
    if (!gm?.gangManager) return;
    const gang = gm.gangManager.getGang(gangId);
    if (!gang) return;

    const DialogV2 = (foundry as any).applications?.api?.DialogV2;
    if (!DialogV2) return;

    const statuses = ['active', 'disbanded', 'arrested', 'unknown'] as const;
    const buttons = statuses
      .filter((s) => s !== gang.status)
      .map((s) => ({
        action: s,
        label: GANG_STATUS_LABELS[s],
        icon:
          s === 'active'
            ? 'fas fa-check-circle'
            : s === 'disbanded'
              ? 'fas fa-ban'
              : s === 'arrested'
                ? 'fas fa-handcuffs'
                : 'fas fa-question-circle',
      }));

    const result = await DialogV2.wait({
      window: { title: `Cambiar Estado: ${gang.name}` },
      content: `
        <div style="padding: 10px; text-align: center;">
          <p>Estado actual: <strong>${GANG_STATUS_LABELS[gang.status as keyof typeof GANG_STATUS_LABELS]}</strong></p>
          <p style="font-size: 0.85em; color: #ccc;">Selecciona el nuevo estado:</p>
        </div>
      `,
      buttons: [{ action: 'cancel', label: 'Cancelar', icon: 'fas fa-times' }, ...buttons],
      modal: false,
    });

    if (result === 'cancel' || !result) return;

    await gm.gangManager.changeStatus(gangId, result);
    window.dispatchEvent(new CustomEvent('guard-gangs-updated'));
    await GangsPanel.render(container);
  }

  private static async handleDeleteGang(gangId: string, container: HTMLElement): Promise<void> {
    const gm = (window as any).GuardManagement;
    if (!gm?.gangManager) return;
    const gang = gm.gangManager.getGang(gangId);
    if (!gang) return;

    const DialogV2 = (foundry as any).applications?.api?.DialogV2;
    if (!DialogV2) return;

    const result = await DialogV2.wait({
      window: { title: 'Eliminar Banda' },
      content: `
        <div style="padding: 10px; text-align: center;">
          <p><i class="fas fa-exclamation-triangle" style="color: #e84a4a; font-size: 1.5em;"></i></p>
          <p>¿Eliminar la banda <strong>"${gang.name}"</strong>?</p>
          <p style="font-size: 0.85em; color: #ccc;">Esta acción no se puede deshacer.</p>
        </div>
      `,
      buttons: [
        { action: 'cancel', label: 'Cancelar', icon: 'fas fa-times' },
        { action: 'delete', label: 'Eliminar', icon: 'fas fa-trash' },
      ],
      modal: false,
    });

    if (result !== 'delete') return;

    await gm.gangManager.deleteGang(gangId);
    window.dispatchEvent(new CustomEvent('guard-gangs-updated'));
    await GangsPanel.render(container);
  }

  // --- Send to Chat ---

  private static async sendGangToChat(gangId: string): Promise<void> {
    const gm = (window as any).GuardManagement;
    const gang: Gang | undefined = gm?.gangManager?.getGang(gangId);
    if (!gang) return;

    const imgHtml = gang.img
      ? `<img src="${gang.img}" width="50" height="50" style="float:left;margin-right:8px;border-radius:4px;" />`
      : '';

    const statusLabel = GANG_STATUS_LABELS[gang.status] || gang.status;

    const membersList = (arr: GangMember[], role: string) => {
      if (!arr || arr.length === 0) return '';
      const names = arr.map((m) => m.name).join(', ');
      return `<p><strong>${role}:</strong> ${names}</p>`;
    };

    const membersHtml =
      membersList(gang.leaders, 'Líder(es)') +
      membersList(gang.subleaders, 'Sublíderes') +
      membersList(gang.members, 'Miembros');

    const content = `
      <div style="border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:8px;background:rgba(0,0,0,0.1);">
        ${imgHtml}
        <h3 style="margin:0 0 4px 0;">${gang.name}</h3>
        <p><strong>Estado:</strong> ${statusLabel}</p>
        ${membersHtml}
      </div>
    `;

    await (ChatMessage as any).create({ content, speaker: { alias: 'Registro de Bandas' } });
    (globalThis as any).ui?.notifications?.info(`Ficha de "${gang.name}" enviada al chat`);
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
