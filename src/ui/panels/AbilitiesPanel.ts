/**
 * AbilitiesPanel — renders the guard abilities / favors tab.
 */

import { ConfirmService } from '../../utils/services/ConfirmService.js';
import { GuardModal } from '../GuardModal.js';
import { renderPanel } from './panel-helpers.js';

export class AbilitiesPanel {
  static get template() {
    return 'modules/guard-management/templates/panels/abilities.hbs';
  }

  static async getData() {
    const gm = (window as any).GuardManagement;
    const isGM = (game as any)?.user?.isGM ?? false;
    const manager = gm?.abilityManager;
    if (!manager) return { abilities: [], isGM };
    const abilities = manager.getAllAbilities();
    return { abilities, isGM };
  }

  static async render(container: HTMLElement) {
    await renderPanel(container, {
      template: AbilitiesPanel.template,
      getData: () => AbilitiesPanel.getData(),
      onMounted: (c) => AbilitiesPanel.setupEventListeners(c),
      panelName: 'AbilitiesPanel',
    });
  }

  private static setupEventListeners(container: HTMLElement) {
    const $html = $(container);

    $html.off('click', '.abilities-add-btn').on('click', '.abilities-add-btn', () => {
      AbilitiesPanel.openEditDialog(container, null);
    });

    $html
      .off('click', '.ability-edit-btn')
      .on('click', '.ability-edit-btn', function (ev) {
        ev.stopPropagation();
        const id = (ev.currentTarget as HTMLElement).dataset.abilityId ?? '';
        AbilitiesPanel.openEditDialog(container, id);
      });

    $html
      .off('click', '.ability-delete-btn')
      .on('click', '.ability-delete-btn', async function (ev) {
        ev.stopPropagation();
        const id = (ev.currentTarget as HTMLElement).dataset.abilityId ?? '';
        const confirmed = await ConfirmService.confirm({
          title: '¿Eliminar habilidad?',
          html: '<p>Esta acción no se puede deshacer.</p>',
        });
        if (!confirmed) return;
        const manager = (window as any).GuardManagement?.abilityManager;
        await manager?.deleteAbility(id);
        await AbilitiesPanel.render(container);
      });
  }

  private static openEditDialog(container: HTMLElement, id: string | null) {
    const manager = (window as any).GuardManagement?.abilityManager;
    const existing = id ? manager?.getAbility(id) : null;

    const title = existing ? `Editar: ${existing.name}` : 'Nueva Habilidad';
    const imgValue = existing?.img ?? 'icons/svg/book.svg';
    const nameValue = existing?.name ?? '';
    const costValue = existing?.cost ?? '';
    const categoryValue = existing?.category ?? '';
    const descValue = existing?.description ?? '';

    const body = `
      <div class="gm-modal-form">
        <div class="form-group">
          <label>Imagen</label>
          <div class="image-picker-row">
            <img class="ability-img-preview" src="${imgValue}" alt="preview"
              style="width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid rgba(243,194,103,.4);cursor:pointer;"
              title="Click para cambiar imagen" />
            <input type="text" class="ability-img-input" value="${imgValue}"
              placeholder="Ruta de imagen..." />
          </div>
        </div>
        <div class="form-group">
          <label>Nombre</label>
          <input type="text" class="ability-name-input" value="${nameValue}"
            placeholder="Nombre de la habilidad..." />
        </div>
        <div class="form-group">
          <label>Categoría / Etiqueta</label>
          <input type="text" class="ability-category-input" value="${categoryValue}"
            placeholder="Ej: Táctica, Social, Combate..." />
        </div>
        <div class="form-group">
          <label>Coste (texto libre)</label>
          <input type="text" class="ability-cost-input" value="${costValue}"
            placeholder="Ej: 2 Esperanza, 1 turno, Sin coste..." />
        </div>
        <div class="form-group">
          <label>Descripción (HTML)</label>
          <textarea class="ability-desc-input" rows="8"
            style="width:100%;resize:vertical;font-family:monospace;font-size:0.85rem;"
            placeholder="Descripción en HTML...">${descValue}</textarea>
        </div>
      </div>
    `;

    GuardModal.open({
      title,
      icon: 'fas fa-star',
      body,
      saveLabel: 'Guardar',
      width: 520,
      onRender: (bodyEl) => {
        const imgEl = bodyEl.querySelector('.ability-img-preview') as HTMLImageElement | null;
        const inputEl = bodyEl.querySelector('.ability-img-input') as HTMLInputElement | null;

        imgEl?.addEventListener('click', () => {
          new (globalThis as any).FilePicker({
            type: 'image',
            current: imgEl.src,
            callback: (path: string) => {
              imgEl.src = path;
              if (inputEl) inputEl.value = path;
            },
          }).render(true);
        });

        inputEl?.addEventListener('input', () => {
          if (imgEl) imgEl.src = inputEl.value;
        });
      },
      onSave: async (bodyEl) => {
        const name =
          (bodyEl.querySelector('.ability-name-input') as HTMLInputElement)?.value?.trim() ||
          'Habilidad';
        const img =
          (bodyEl.querySelector('.ability-img-input') as HTMLInputElement)?.value?.trim() ||
          'icons/svg/book.svg';
        const cost =
          (bodyEl.querySelector('.ability-cost-input') as HTMLInputElement)?.value?.trim() || '';
        const category =
          (bodyEl.querySelector('.ability-category-input') as HTMLInputElement)?.value?.trim() || '';
        const description =
          (bodyEl.querySelector('.ability-desc-input') as HTMLTextAreaElement)?.value ?? '';

        if (existing) {
          await manager.updateAbility(id!, { name, img, cost, category, description });
        } else {
          await manager.createAbility({ name, img, cost, category, description });
        }
        await AbilitiesPanel.render(container);
      },
    });
  }
}
