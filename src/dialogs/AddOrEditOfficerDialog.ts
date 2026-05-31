// @ts-nocheck
/**
 * AddOrEditOfficerDialog
 * Custom GuardModal-based dialog for creating and editing patrol officers.
 * Styled to match the rest of the module's modals (resources, gangs, POIs…).
 */

import type { Officer, OfficerTrait } from '../types/officer';
import { GuardModal } from '../ui/GuardModal.js';
import { setupImagePicker } from '../ui/panels/panel-helpers.js';
import { DialogPersistence, DIALOG_KEYS } from '../utils/DialogPersistence.js';

interface OfficerState {
  actorId: string;
  actorName: string;
  actorImg: string;
  title: string;
  skillName: string;
  skillImage: string;
  pros: OfficerTrait[];
  cons: OfficerTrait[];
  organizationId?: string;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Resolve an Actor document from a drag & drop event. */
async function resolveActorFromDrop(ev: DragEvent): Promise<any | null> {
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
    actor = (game as any).actors?.get(data.id);
  }
  if (!actor && data.tokenId && data.sceneId) {
    const scene = (game as any).scenes?.get(data.sceneId);
    const token = scene?.tokens?.get(data.tokenId);
    actor = token?.actor;
  }
  return actor;
}

export class AddOrEditOfficerDialog {
  /**
   * Show the dialog in create or edit mode using the custom GuardModal.
   * Resolves with the created/updated Officer, or null if cancelled.
   */
  public async showForm(
    mode: 'create' | 'edit',
    organizationId?: string,
    existingOfficer?: Officer,
    _personnelType: 'officer' | 'civilian' = 'officer'
  ): Promise<Officer | null> {
    // Remember this editor is open so it can be restored after an F5
    DialogPersistence.markOpen(DIALOG_KEYS.officerEditor, {
      mode,
      organizationId: existingOfficer?.organizationId ?? organizationId,
      officerId: existingOfficer?.id,
      personnelType: _personnelType,
    });
    try {
      const state: OfficerState = {
        actorId: existingOfficer?.actorId || '',
        actorName: existingOfficer?.actorName || '',
        actorImg: existingOfficer?.actorImg || '',
        title: existingOfficer?.title || '',
        skillName: existingOfficer?.skill?.name || '',
        skillImage: existingOfficer?.skill?.image || '',
        pros: existingOfficer ? [...existingOfficer.pros] : [],
        cons: existingOfficer ? [...existingOfficer.cons] : [],
        organizationId: existingOfficer?.organizationId ?? organizationId,
      };

      const result = await GuardModal.openAsync<Officer>({
        title: mode === 'create' ? 'Crear Oficial' : 'Editar Oficial',
        icon: 'fas fa-user-shield',
        width: 640,
        saveLabel: mode === 'create' ? 'Crear' : 'Guardar',
        body: this.buildBody(state),
        onRender: (bodyEl) => this.wire(bodyEl, state),
        onSave: async () => this.save(mode, state, existingOfficer),
      });

      return result ?? null;
    } finally {
      DialogPersistence.markClosed(DIALOG_KEYS.officerEditor);
    }
  }

  // ── Body markup ─────────────────────────────────────────────

  private buildBody(state: OfficerState): string {
    return `
      <div class="guard-modal-form officer-modal">
        <div class="officer-modal-actor" id="officer-actor-zone">
          ${this.actorZoneHtml(state)}
        </div>

        <div class="guard-modal-row">
          <label for="officer-title"><i class="fas fa-id-badge"></i> Título del Oficial</label>
          <input type="text" id="officer-title" value="${escapeHtml(state.title)}"
            placeholder="Ej: Capitán, Sargento, Comandante..." />
        </div>

        <div class="officer-modal-section">
          <div class="officer-modal-section-title">
            <i class="fas fa-bolt"></i> Habilidad de Patrulla
            <span class="officer-modal-optional">(Opcional)</span>
          </div>
          <div class="guard-modal-row">
            <label for="officer-skill-name"><i class="fas fa-tag"></i> Nombre</label>
            <input type="text" id="officer-skill-name" value="${escapeHtml(state.skillName)}"
              placeholder="Ej: Tácticas Avanzadas, Don de Mando..." />
          </div>
          <div class="guard-modal-row">
            <label><i class="fas fa-image"></i> Imagen</label>
            <div class="officer-img-field">
              <div id="officer-skill-preview" class="officer-skill-thumb">
                ${state.skillImage ? `<img src="${escapeHtml(state.skillImage)}" />` : '<i class="fas fa-image"></i>'}
              </div>
              <input type="text" id="officer-skill-image" value="${escapeHtml(state.skillImage)}"
                placeholder="icons/..." />
              <button type="button" id="officer-skill-picker" class="officer-icon-btn" title="Seleccionar imagen">
                <i class="fas fa-folder-open"></i>
              </button>
            </div>
          </div>
        </div>

        <div class="guard-modal-split officer-modal-traits">
          <div class="officer-modal-section officer-traits-col pros">
            <div class="officer-modal-section-title">
              <i class="fas fa-thumbs-up"></i> Pros
            </div>
            <div id="officer-pros-list" class="officer-traits-list">
              ${this.traitsHtml(state.pros, 'pro')}
            </div>
            <button type="button" class="officer-add-trait" data-type="pro">
              <i class="fas fa-plus"></i> Agregar Pro
            </button>
          </div>

          <div class="officer-modal-section officer-traits-col cons">
            <div class="officer-modal-section-title">
              <i class="fas fa-thumbs-down"></i> Cons
            </div>
            <div id="officer-cons-list" class="officer-traits-list">
              ${this.traitsHtml(state.cons, 'con')}
            </div>
            <button type="button" class="officer-add-trait" data-type="con">
              <i class="fas fa-plus"></i> Agregar Con
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private actorZoneHtml(state: OfficerState): string {
    if (state.actorId && state.actorName) {
      return `
        <div class="officer-actor-preview" data-drop="actor">
          <img src="${escapeHtml(state.actorImg)}" alt="${escapeHtml(state.actorName)}" />
          <div class="officer-actor-info">
            <span class="officer-actor-name">${escapeHtml(state.actorName)}</span>
            <span class="officer-actor-hint"><i class="fas fa-sync-alt"></i> Arrastra otro actor para cambiarlo</span>
          </div>
          <button type="button" class="officer-actor-clear" title="Quitar actor">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
    }
    return `
      <div class="officer-actor-dropzone" data-drop="actor">
        <i class="fas fa-user-plus"></i>
        <span>Arrastra un Actor aquí para asignarlo como Oficial</span>
      </div>
    `;
  }

  private traitsHtml(traits: OfficerTrait[], type: 'pro' | 'con'): string {
    if (!traits.length) {
      return `<p class="officer-traits-empty">No hay ${type === 'pro' ? 'pros' : 'cons'} agregados</p>`;
    }
    return traits
      .map(
        (t) => `
        <div class="officer-trait-item" data-trait-id="${t.id}">
          <div class="officer-trait-head">
            <strong>${escapeHtml(t.title)}</strong>
            <button type="button" class="officer-trait-remove" data-trait-id="${t.id}" data-type="${type}" title="Eliminar">
              <i class="fas fa-times"></i>
            </button>
          </div>
          ${t.description ? `<div class="officer-trait-desc">${escapeHtml(t.description)}</div>` : ''}
        </div>`
      )
      .join('');
  }

  // ── Wiring ──────────────────────────────────────────────────

  private wire(bodyEl: HTMLElement, state: OfficerState): void {
    const titleInput = bodyEl.querySelector('#officer-title') as HTMLInputElement;
    const actorZone = bodyEl.querySelector('#officer-actor-zone') as HTMLElement;
    const prosList = bodyEl.querySelector('#officer-pros-list') as HTMLElement;
    const consList = bodyEl.querySelector('#officer-cons-list') as HTMLElement;

    // Keep title synced (it survives partial re-renders via state).
    titleInput?.addEventListener('input', () => {
      state.title = titleInput.value;
    });

    // ── Actor drop zone ──
    const wireActorZone = () => {
      const zone = actorZone.querySelector('[data-drop="actor"]') as HTMLElement;
      if (!zone) return;

      zone.addEventListener('dragenter', (ev) => {
        ev.preventDefault();
        zone.classList.add('dnd-hover');
      });
      zone.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        zone.classList.add('dnd-hover');
      });
      zone.addEventListener('dragleave', () => zone.classList.remove('dnd-hover'));
      zone.addEventListener('drop', async (ev) => {
        ev.preventDefault();
        zone.classList.remove('dnd-hover');
        const actor = await resolveActorFromDrop(ev as DragEvent);
        if (!actor) {
          (globalThis as any).ui?.notifications?.warn('No se pudo resolver el actor arrastrado.');
          return;
        }
        state.actorId = actor.id;
        state.actorName = actor.name || '';
        state.actorImg = actor.img || actor.prototypeToken?.texture?.src || '';
        actorZone.innerHTML = this.actorZoneHtml(state);
        wireActorZone();
      });

      const clearBtn = actorZone.querySelector('.officer-actor-clear');
      clearBtn?.addEventListener('click', () => {
        state.actorId = '';
        state.actorName = '';
        state.actorImg = '';
        actorZone.innerHTML = this.actorZoneHtml(state);
        wireActorZone();
      });
    };
    wireActorZone();

    // ── Skill image picker ──
    const skillInput = bodyEl.querySelector('#officer-skill-image') as HTMLInputElement;
    const skillPreview = bodyEl.querySelector('#officer-skill-preview') as HTMLElement;
    const skillPicker = bodyEl.querySelector('#officer-skill-picker');
    const skillNameInput = bodyEl.querySelector('#officer-skill-name') as HTMLInputElement;

    skillNameInput?.addEventListener('input', () => {
      state.skillName = skillNameInput.value;
    });

    setupImagePicker({
      pickerEl: skillPicker,
      inputEl: skillInput,
      previewEl: skillPreview,
      onSelect: (path) => {
        state.skillImage = path;
        if (skillPreview) {
          skillPreview.innerHTML = path
            ? `<img src="${escapeHtml(path)}" />`
            : '<i class="fas fa-image"></i>';
        }
      },
      previewOnInput: true,
    });

    // ── Pros / Cons ──
    const renderTraits = (type: 'pro' | 'con') => {
      const list = type === 'pro' ? prosList : consList;
      list.innerHTML = this.traitsHtml(type === 'pro' ? state.pros : state.cons, type);
      wireRemove(type);
    };

    const wireRemove = (type: 'pro' | 'con') => {
      const list = type === 'pro' ? prosList : consList;
      list.querySelectorAll('.officer-trait-remove').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = (btn as HTMLElement).dataset.traitId;
          if (type === 'pro') state.pros = state.pros.filter((p) => p.id !== id);
          else state.cons = state.cons.filter((c) => c.id !== id);
          renderTraits(type);
        });
      });
    };

    wireRemove('pro');
    wireRemove('con');

    bodyEl.querySelectorAll('.officer-add-trait').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const type = (btn as HTMLElement).dataset.type as 'pro' | 'con';
        const trait = await this.promptTrait(type);
        if (!trait) return;
        const newTrait: OfficerTrait = {
          id: foundry.utils.randomID(),
          title: trait.title,
          description: trait.description,
          createdAt: new Date(),
        };
        if (type === 'pro') state.pros = [...state.pros, newTrait];
        else state.cons = [...state.cons, newTrait];
        renderTraits(type);
      });
    });
  }

  /** Nested GuardModal to add a pro/con trait. */
  private async promptTrait(
    type: 'pro' | 'con'
  ): Promise<{ title: string; description: string } | null> {
    const body = `
      <div class="guard-modal-form">
        <div class="guard-modal-row">
          <label for="trait-title"><i class="fas fa-heading"></i> Título</label>
          <input type="text" id="trait-title" placeholder="Ej: Veterano, Temerario..." />
        </div>
        <div class="guard-modal-row">
          <label for="trait-desc"><i class="fas fa-align-left"></i> Descripción</label>
          <textarea id="trait-desc" rows="4" placeholder="Describe la característica..."></textarea>
        </div>
      </div>
    `;

    return GuardModal.openAsync<{ title: string; description: string }>({
      title: type === 'pro' ? 'Agregar Pro' : 'Agregar Con',
      icon: type === 'pro' ? 'fas fa-thumbs-up' : 'fas fa-thumbs-down',
      width: 460,
      saveLabel: 'Agregar',
      body,
      onRender: (bodyEl) => {
        (bodyEl.querySelector('#trait-title') as HTMLInputElement)?.focus();
      },
      onSave: async (bodyEl) => {
        const title = (bodyEl.querySelector('#trait-title') as HTMLInputElement)?.value?.trim();
        const description =
          (bodyEl.querySelector('#trait-desc') as HTMLTextAreaElement)?.value?.trim() || '';
        if (!title) {
          (globalThis as any).ui?.notifications?.error('El título es obligatorio');
          return false;
        }
        return { title, description };
      },
    });
  }

  // ── Persistence ─────────────────────────────────────────────

  private async save(
    mode: 'create' | 'edit',
    state: OfficerState,
    existingOfficer?: Officer
  ): Promise<Officer | false> {
    if (!state.actorId?.trim()) {
      (globalThis as any).ui?.notifications?.error('Debes asignar un Actor al oficial');
      return false;
    }
    if (!state.title?.trim()) {
      (globalThis as any).ui?.notifications?.error('El título es obligatorio');
      return false;
    }

    const gm = (window as any).GuardManagement;
    if (!gm?.officerManager) {
      (globalThis as any).ui?.notifications?.error('Sistema de oficiales no disponible');
      return false;
    }

    const skillName = state.skillName?.trim();
    const skillImage = state.skillImage?.trim();
    const skill = skillName ? { name: skillName, image: skillImage || undefined } : undefined;

    try {
      let officer: Officer | undefined;

      if (mode === 'create') {
        officer = await gm.officerManager.create({
          actorId: state.actorId,
          actorName: state.actorName,
          actorImg: state.actorImg,
          title: state.title.trim(),
          skill,
          pros: state.pros.map((p) => ({ title: p.title, description: p.description })),
          cons: state.cons.map((c) => ({ title: c.title, description: c.description })),
          organizationId: state.organizationId,
        });
        (globalThis as any).ui?.notifications?.info(`Oficial "${state.actorName}" creado`);
      } else {
        officer = gm.officerManager.update(existingOfficer!.id, {
          title: state.title.trim(),
          skill,
          pros: state.pros,
          cons: state.cons,
          organizationId: state.organizationId,
        });
        if (!officer) {
          (globalThis as any).ui?.notifications?.error('No se pudo actualizar el oficial');
          return false;
        }
        (globalThis as any).ui?.notifications?.info(`Oficial "${state.actorName}" actualizado`);
      }

      return officer!;
    } catch (error) {
      console.error('Error al guardar oficial:', error);
      (globalThis as any).ui?.notifications?.error('Error al guardar el oficial');
      return false;
    }
  }

  // ── Static API ──────────────────────────────────────────────

  public static async show(
    mode: 'create' | 'edit',
    organizationId?: string,
    existingOfficer?: Officer,
    personnelType: 'officer' | 'civilian' = 'officer'
  ): Promise<Officer | null> {
    const dialog = new AddOrEditOfficerDialog();
    return dialog.showForm(mode, organizationId, existingOfficer, personnelType);
  }

  public static async create(
    organizationId?: string,
    personnelType: 'officer' | 'civilian' = 'officer'
  ): Promise<Officer | null> {
    return this.show('create', organizationId, undefined, personnelType);
  }

  public static async edit(
    officer: Officer,
    personnelType: 'officer' | 'civilian' = 'officer'
  ): Promise<Officer | null> {
    return this.show('edit', officer.organizationId, officer, personnelType);
  }
}
