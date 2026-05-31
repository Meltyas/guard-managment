/**
 * Dialog for adding or editing reputation entries — custom modal (no DialogV2).
 */

import {
  Reputation,
  REPUTATION_LABELS,
  REPUTATION_TREND_LABELS,
  REPUTATION_CATEGORY_LABELS,
  ReputationLevel,
} from '../types/entities.js';
import { ModalStack } from '../utils/modal-stack.js';
import { DialogPersistence, DIALOG_KEYS } from '../utils/DialogPersistence.js';

interface ReputationDialogData {
  name: string;
  description: string;
  level: ReputationLevel;
  image: string;
  organizationId: string;
  faction: string;
  trend: string;
  category: string;
  contact: string;
  gmNotes: string;
  factionRelationsJson: string;
  favorsJson: string;
}

export class AddOrEditReputationDialog {
  private element: HTMLElement | null = null;
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };

  private hide(): void {
    if (this.element) {
      ModalStack.unregister(this.element);
      this.element.remove();
      this.element = null;
    }
  }

  public async show(
    mode: 'create' | 'edit',
    organizationId: string,
    existingReputation?: Reputation
  ): Promise<Reputation | null> {
    const content = await this.generateContent(mode, organizationId, existingReputation);
    const title = mode === 'create' ? 'Nueva Reputación' : 'Editar Reputación';
    const saveLabel = mode === 'create' ? 'Crear' : 'Guardar';

    // Remember this editor is open so it can be restored after an F5
    DialogPersistence.markOpen(DIALOG_KEYS.reputationEditor, {
      mode,
      organizationId,
      reputationId: existingReputation?.id,
    });

    return new Promise<Reputation | null>((rawResolve) => {
      // Clear the F5-restore flag whichever way the dialog is dismissed
      const resolve = (value: Reputation | null) => {
        DialogPersistence.markClosed(DIALOG_KEYS.reputationEditor);
        rawResolve(value);
      };
      // ── Build modal shell ────────────────────────────────────────────────
      const modal = document.createElement('div');
      modal.className = 'warehouse-item-dialog custom-info-dialog reputation-custom-dialog';
      modal.style.cssText = `
        position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
        width:620px; max-height:90vh; display:flex; flex-direction:column;
        resize:both; overflow:hidden;
      `;
      modal.innerHTML = `
        <div class="custom-dialog-header" style="cursor:move;flex-shrink:0;">
          <div class="custom-dialog-title">
            <i class="fas fa-handshake"></i>
            <span>${title}</span>
          </div>
          <div class="custom-dialog-controls">
            <button class="custom-dialog-btn custom-dialog-close rep-modal-close" type="button">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
        <div class="warehouse-item-dialog-content" style="overflow-y:auto;flex:1;padding:16px;">
          ${content}
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;padding:10px 16px;flex-shrink:0;
                    border-top:1px solid rgba(243,194,103,0.3);">
          <button type="button" class="rep-modal-cancel" style="padding:6px 16px;">
            <i class="fas fa-times"></i> Cancelar
          </button>
          <button type="button" class="rep-modal-save" style="padding:6px 16px;">
            <i class="fas fa-save"></i> ${saveLabel}
          </button>
        </div>
      `;

      document.body.appendChild(modal);
      this.element = modal;
      ModalStack.register(modal);

      // ── Populate textareas (HBS escapes content so we set via JS) ────────
      const descTA = modal.querySelector('#reputation-description') as HTMLTextAreaElement;
      if (descTA && existingReputation?.description) descTA.value = existingReputation.description;
      const notesTA = modal.querySelector('#reputation-gmnotes') as HTMLTextAreaElement;
      if (notesTA && existingReputation?.gmNotes) notesTA.value = existingReputation.gmNotes;

      // ── Dynamic lists (relations + favors) ──────────────────────────────
      this.setupDynamicLists(modal, existingReputation);

      // ── File picker ─────────────────────────────────────────────────────
      const imageInput = modal.querySelector('#reputation-image') as HTMLInputElement;
      const fpBtn = modal.querySelector('.file-picker-btn[data-target="reputation-image"]') as HTMLElement;
      if (fpBtn && imageInput) {
        fpBtn.onclick = () => {
          try {
            const fp = new (window as any).FilePicker({
              type: 'image',
              current: imageInput.value || '',
              callback: (path: string) => { imageInput.value = path; },
            });
            fp.render(true);
          } catch (e) { console.warn('FilePicker unavailable', e); }
        };
      }

      // ── Dragging ─────────────────────────────────────────────────────────
      const header = modal.querySelector('.custom-dialog-header') as HTMLElement;
      header.addEventListener('mousedown', (e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        this.isDragging = true;
        const rect = modal.getBoundingClientRect();
        this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        modal.style.transform = 'none';
      });
      document.addEventListener('mousemove', (e) => {
        if (!this.isDragging) return;
        modal.style.left = `${e.clientX - this.dragOffset.x}px`;
        modal.style.top = `${e.clientY - this.dragOffset.y}px`;
      });
      document.addEventListener('mouseup', () => { this.isDragging = false; });

      // ── Close / Cancel ───────────────────────────────────────────────────
      const closeHandler = () => { this.hide(); resolve(null); };
      modal.querySelector('.rep-modal-close')!.addEventListener('click', closeHandler);
      modal.querySelector('.rep-modal-cancel')!.addEventListener('click', closeHandler);

      // ── Save ─────────────────────────────────────────────────────────────
      modal.querySelector('.rep-modal-save')!.addEventListener('click', async () => {
        const form = modal.querySelector('form.reputation-form') as HTMLFormElement | null;
        if (!form) { (ui as any)?.notifications?.error('Formulario no encontrado'); return; }

        const formData = new FormData(form);
        const data = this.extractFormData(formData);

        if (!data.name?.trim()) { (ui as any)?.notifications?.error('El nombre es obligatorio'); return; }

        const gm = (window as any).GuardManagement;
        if (!gm?.reputationManager) { (ui as any)?.notifications?.error('Sistema no disponible'); return; }

        try {
          const payload = this.buildPayload(data, existingReputation);
          let result: Reputation | null = null;

          if (mode === 'create') {
            const created = await gm.reputationManager.createReputation(payload);
            result = { ...payload, id: created.id } as Reputation;
          } else {
            await gm.reputationManager.updateReputation(existingReputation!.id, payload);
            result = { ...payload, id: existingReputation!.id } as Reputation;
          }

          this.hide();
          resolve(result);
        } catch (err) {
          console.error('Error guardando reputación:', err);
          (ui as any)?.notifications?.error('Error al guardar la reputación');
        }
      });
    });
  }

  /** Extract and parse all form fields including JSON arrays */
  private extractFormData(formData: FormData): ReputationDialogData {
    return {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      level:
        (parseInt(formData.get('level') as string) as ReputationLevel) ||
        ReputationLevel.Neutrales,
      image: formData.get('image') as string,
      organizationId: formData.get('organizationId') as string,
      faction: formData.get('faction') as string,
      trend: formData.get('trend') as string,
      category: formData.get('category') as string,
      contact: formData.get('contact') as string,
      gmNotes: formData.get('gmNotes') as string,
      factionRelationsJson: formData.get('factionRelationsJson') as string,
      favorsJson: formData.get('favorsJson') as string,
    };
  }

  /** Build a Reputation payload from parsed form data */
  private buildPayload(data: ReputationDialogData, existing?: Reputation): Partial<Reputation> {
    let factionRelations: any[] = [];
    let favors: any[] = [];

    try {
      if (data.factionRelationsJson) factionRelations = JSON.parse(data.factionRelationsJson);
    } catch (e) {}
    try {
      if (data.favorsJson) favors = JSON.parse(data.favorsJson);
    } catch (e) {}

    return {
      id: existing?.id,
      name: data.name.trim(),
      description: data.description?.trim() || '',
      level: data.level,
      image: data.image?.trim() || '',
      organizationId: data.organizationId,
      faction: data.faction?.trim() || '',
      trend: (data.trend as any) || 'stable',
      category: (data.category as any) || 'otra',
      contact: data.contact?.trim() || '',
      gmNotes: data.gmNotes?.trim() || '',
      factionRelations,
      favors,
      version: existing ? existing.version + 1 : 1,
      createdAt: existing?.createdAt,
      updatedAt: new Date(),
    };
  }

  /** Wire up the dynamic faction-relations and favors lists inside the modal */
  private setupDynamicLists(container: HTMLElement, _existing?: Reputation): void {
    const form = container.querySelector('form.reputation-form') as HTMLFormElement | null;
    if (!form) return;

    const RELATION_LABELS: Record<string, string> = {
      aliada: 'Aliada', rival: 'Rival', enemiga: 'Enemiga', neutral: 'Neutral',
    };

    // ── State ────────────────────────────────────────────────────────────────
    let factionRelations: any[] = [];
    let favors: any[] = [];

    try {
      const relJson = (form.querySelector('#rep-faction-relations-json') as HTMLInputElement)?.value;
      if (relJson && relJson !== '[]') factionRelations = JSON.parse(relJson);
    } catch (_) {}
    try {
      const favJson = (form.querySelector('#rep-favors-json') as HTMLInputElement)?.value;
      if (favJson && favJson !== '[]') favors = JSON.parse(favJson);
    } catch (_) {}

    // ── Helpers ──────────────────────────────────────────────────────────────
    const randomId = () =>
      Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);

    const syncJson = () => {
      const relInput = form.querySelector('#rep-faction-relations-json') as HTMLInputElement;
      const favInput = form.querySelector('#rep-favors-json') as HTMLInputElement;
      if (relInput) relInput.value = JSON.stringify(factionRelations);
      if (favInput) favInput.value = JSON.stringify(favors);
    };

    // ── Faction names from existing reputations ──────────────────────────────
    const getKnownFactions = (): string[] => {
      try {
        const gm = (window as any).GuardManagement;
        const all: any[] = gm?.reputationManager?.getAllReputations?.() ?? [];
        return all.map((r: any) => r.faction || r.name).filter(Boolean);
      } catch (_) { return []; }
    };

    // ── Render faction relations ─────────────────────────────────────────────
    const renderRelations = () => {
      const list = form.querySelector('#faction-relations-list') as HTMLElement;
      if (!list) return;
      list.innerHTML = '';
      if (factionRelations.length === 0) {
        list.innerHTML = '<p class="empty-dynamic">Sin relaciones registradas</p>';
        return;
      }
      const knownFactions = getKnownFactions();

      factionRelations.forEach((rel: any) => {
        const isCustom = rel.factionName && !knownFactions.includes(rel.factionName);
        const selectValue = isCustom ? '__custom__' : (rel.factionName || '');

        const factionOptions =
          `<option value="">— Seleccionar facción —</option>` +
          knownFactions.map(f =>
            `<option value="${f}"${selectValue === f ? ' selected' : ''}>${f}</option>`
          ).join('') +
          `<option value="__custom__"${isCustom ? ' selected' : ''}>✏️ Otra (personalizada)…</option>`;

        const item = document.createElement('div');
        item.className = 'dynamic-item';
        item.dataset['relId'] = rel.id;
        item.innerHTML =
          `<button type="button" class="remove-item-btn remove-relation-btn" data-id="${rel.id}" title="Eliminar"><i class="fas fa-times"></i></button>` +
          `<div class="item-row">` +
            `<div class="form-group"><label>Facción</label>` +
              `<select class="rel-faction-select" data-id="${rel.id}">${factionOptions}</select>` +
              `<input type="text" class="rel-name" data-id="${rel.id}"` +
                ` value="${rel.factionName || ''}" placeholder="Nombre personalizado"` +
                ` style="margin-top:4px;${isCustom ? '' : 'display:none;'}" />` +
            `</div>` +
            `<div class="form-group"><label>Relación</label>` +
              `<select class="rel-type" data-id="${rel.id}">` +
                Object.entries(RELATION_LABELS).map(([v, l]) =>
                  `<option value="${v}"${rel.relationType === v ? ' selected' : ''}>${l}</option>`
                ).join('') +
              `</select></div>` +
          `</div>` +
          `<div class="form-group"><label>Notas (opcional)</label>` +
            `<input type="text" class="rel-notes" data-id="${rel.id}" value="${rel.notes || ''}" placeholder="Ej: antigua alianza comercial" /></div>`;
        list.appendChild(item);
      });

      list.querySelectorAll<HTMLElement>('.remove-relation-btn').forEach((btn) => {
        btn.onclick = () => {
          factionRelations = factionRelations.filter((r: any) => r.id !== btn.dataset['id']);
          syncJson(); renderRelations();
        };
      });

      // Faction select: populate custom input visibility and factionName
      list.querySelectorAll<HTMLSelectElement>('.rel-faction-select').forEach((sel) => {
        const customInput = sel.closest('.form-group')!.querySelector<HTMLInputElement>('.rel-name')!;
        sel.onchange = () => {
          const rel = factionRelations.find((r: any) => r.id === sel.dataset['id']);
          if (!rel) return;
          if (sel.value === '__custom__') {
            customInput.style.display = '';
            customInput.focus();
            rel.factionName = customInput.value;
          } else {
            customInput.style.display = 'none';
            rel.factionName = sel.value;
          }
          syncJson();
        };
      });

      list.querySelectorAll<HTMLInputElement>('.rel-name').forEach((inp) => {
        inp.oninput = () => {
          const rel = factionRelations.find((r: any) => r.id === inp.dataset['id']);
          if (rel) { rel.factionName = inp.value; syncJson(); }
        };
      });
      list.querySelectorAll<HTMLSelectElement>('.rel-type').forEach((sel) => {
        sel.onchange = () => {
          const rel = factionRelations.find((r: any) => r.id === sel.dataset['id']);
          if (rel) { rel.relationType = sel.value; syncJson(); }
        };
      });
      list.querySelectorAll<HTMLInputElement>('.rel-notes').forEach((inp) => {
        inp.oninput = () => {
          const rel = factionRelations.find((r: any) => r.id === inp.dataset['id']);
          if (rel) { rel.notes = inp.value; syncJson(); }
        };
      });
    };

    // ── Render favors ────────────────────────────────────────────────────────
    const renderFavors = () => {
      const list = form.querySelector('#favors-list') as HTMLElement;
      if (!list) return;
      list.innerHTML = '';
      if (favors.length === 0) {
        list.innerHTML = '<p class="empty-dynamic">Sin favores registrados</p>';
        return;
      }
      favors.forEach((fav: any) => {
        const item = document.createElement('div');
        item.className = 'dynamic-item';
        item.dataset['favId'] = fav.id;
        item.innerHTML =
          `<button type="button" class="remove-item-btn remove-favor-btn" data-id="${fav.id}" title="Eliminar"><i class="fas fa-times"></i></button>` +
          `<div class="form-group"><label>Nombre del favor</label>` +
            `<input type="text" class="fav-name" data-id="${fav.id}" value="${fav.name || ''}" placeholder="Ej: Información privilegiada" /></div>` +
          `<div class="form-group"><label>Descripción</label>` +
            `<textarea class="fav-desc" data-id="${fav.id}" rows="2" placeholder="Qué ofrece este favor...">${fav.description || ''}</textarea></div>` +
          `<div class="form-group"><label>Coste (opcional)</label>` +
            `<input type="text" class="fav-cost" data-id="${fav.id}" value="${fav.cost || ''}" placeholder="Ej: 50 monedas, un favor a cambio..." /></div>`;
        list.appendChild(item);
      });

      list.querySelectorAll<HTMLElement>('.remove-favor-btn').forEach((btn) => {
        btn.onclick = () => {
          favors = favors.filter((f: any) => f.id !== btn.dataset['id']);
          syncJson(); renderFavors();
        };
      });
      list.querySelectorAll<HTMLInputElement>('.fav-name').forEach((inp) => {
        inp.oninput = () => {
          const fav = favors.find((f: any) => f.id === inp.dataset['id']);
          if (fav) { fav.name = inp.value; syncJson(); }
        };
      });
      list.querySelectorAll<HTMLTextAreaElement>('.fav-desc').forEach((ta) => {
        ta.oninput = () => {
          const fav = favors.find((f: any) => f.id === ta.dataset['id']);
          if (fav) { fav.description = ta.value; syncJson(); }
        };
      });
      list.querySelectorAll<HTMLInputElement>('.fav-cost').forEach((inp) => {
        inp.oninput = () => {
          const fav = favors.find((f: any) => f.id === inp.dataset['id']);
          if (fav) { fav.cost = inp.value; syncJson(); }
        };
      });
    };

    // ── Add buttons ──────────────────────────────────────────────────────────
    const addRelBtn = form.querySelector('#add-faction-relation-btn') as HTMLElement;
    if (addRelBtn) {
      addRelBtn.onclick = (e) => {
        e.preventDefault();
        factionRelations.push({ id: randomId(), factionName: '', relationType: 'neutral', notes: '' });
        syncJson(); renderRelations();
      };
    }

    const addFavBtn = form.querySelector('#add-favor-btn') as HTMLElement;
    if (addFavBtn) {
      addFavBtn.onclick = (e) => {
        e.preventDefault();
        favors.push({ id: randomId(), name: '', description: '', cost: '' });
        syncJson(); renderFavors();
      };
    }

    // Initial render
    renderRelations();
    renderFavors();
  }

  private async generateContent(
    _mode: 'create' | 'edit',
    organizationId: string,
    existing?: Reputation
  ): Promise<string> {
    const defaultLevel = existing?.level ?? ReputationLevel.Neutrales;
    const reputationLevels = Object.entries(REPUTATION_LABELS).map(([value, label]) => ({
      value,
      label,
      selected: parseInt(value) === defaultLevel,
    }));

    const trendOptions = Object.entries(REPUTATION_TREND_LABELS).map(([value, label]) => ({
      value,
      label,
      selected: (existing?.trend ?? 'stable') === value,
    }));

    const categoryOptions = [
      { value: '', label: '— Sin categoría —', selected: !existing?.category },
      ...Object.entries(REPUTATION_CATEGORY_LABELS).map(([value, label]) => ({
        value,
        label,
        selected: existing?.category === value,
      })),
    ];

    const data = {
      name: existing?.name || '',
      description: existing?.description || '',
      image: existing?.image || '',
      organizationId,
      faction: existing?.faction || '',
      contact: existing?.contact || '',
      gmNotes: existing?.gmNotes || '',
      reputationLevels,
      trendOptions,
      categoryOptions,
      factionRelationsJson: JSON.stringify(existing?.factionRelations ?? []),
      favorsJson: JSON.stringify(existing?.favors ?? []),
    };

    return renderTemplate(
      'modules/guard-management/templates/dialogs/add-edit-reputation.hbs',
      data
    );
  }

  // showWithStandardDialog removed — custom modal used instead

  public static async create(organizationId: string): Promise<Reputation | null> {
    const dialog = new AddOrEditReputationDialog();
    return await dialog.show('create', organizationId);
  }

  public static async edit(reputation: Reputation): Promise<Reputation | null> {
    const dialog = new AddOrEditReputationDialog();
    return await dialog.show('edit', reputation.organizationId, reputation);
  }

  public static async showCreateDialog(organizationId: string): Promise<void> {
    try {
      const result = await AddOrEditReputationDialog.create(organizationId);
      if (result) {
        window.dispatchEvent(new CustomEvent('guard-organizations-updated'));
      }
    } catch (error) {
      console.error('Error in showCreateDialog:', error);
      ui.notifications?.error('Error creating reputation');
    }
  }

  public static async showEditDialog(reputationId: string): Promise<void> {
    try {
      const gm = (window as any).GuardManagement;
      if (!gm?.reputationManager) throw new Error('ReputationManager not available');

      const reputation = gm.reputationManager.getReputation(reputationId);
      if (!reputation) throw new Error(`Reputation ${reputationId} not found`);

      const reputationData: Reputation = {
        id: reputation.id,
        name: reputation.name,
        description: reputation.description || '',
        level: reputation.level ?? ReputationLevel.Neutrales,
        image: reputation.image || '',
        organizationId: reputation.organizationId || '',
        faction: reputation.faction || '',
        trend: reputation.trend || 'stable',
        category: reputation.category || 'otra',
        contact: reputation.contact || '',
        gmNotes: reputation.gmNotes || '',
        factionRelations: reputation.factionRelations || [],
        favors: reputation.favors || [],
        version: reputation.version ?? 1,
        createdAt: reputation.createdAt ? new Date(reputation.createdAt) : new Date(),
        updatedAt: reputation.updatedAt ? new Date(reputation.updatedAt) : new Date(),
      };

      const result = await AddOrEditReputationDialog.edit(reputationData);
      if (result) {
        window.dispatchEvent(new CustomEvent('guard-organizations-updated'));
      }
    } catch (error) {
      console.error('Error in showEditDialog:', error);
      ui.notifications?.error('Error editing reputation');
    }
  }
}
