import { DEFAULT_GUARD_STATS, GuardModifier, GuardStats } from '../types/entities.js';
import { GuardModal } from '../ui/GuardModal.js';

interface GuardModifierDialogData {
  name: string;
  description: string;
  type: 'positive' | 'negative' | 'neutral';
  image: string;
  statModifications: { statName: keyof GuardStats; value: number }[];
}

export class AddOrEditGuardModifierDialog {
  async show(mode: 'create' | 'edit', existing?: GuardModifier): Promise<GuardModifier | null> {
    const content = await this.generateContent(mode, existing);
    const title =
      mode === 'create' ? 'Nuevo Modificador de Guardia' : 'Editar Modificador de Guardia';

    try {
      return await GuardModal.openAsync<GuardModifier>({
        title,
        icon: 'fas fa-sliders-h',
        body: content,
        saveLabel: mode === 'create' ? 'Crear' : 'Guardar',
        onRender: (bodyEl) => {
          // Add row button handler
          bodyEl.querySelector('.add-stat-mod')?.addEventListener('click', (e: Event) => {
            e.preventDefault();
            this.addStatRow(bodyEl.querySelector('.stat-mods-container') as HTMLElement);
          });

          // Remove row button handler (delegated)
          bodyEl.querySelector('.stat-mods-container')?.addEventListener('click', (e: Event) => {
            const target = e.target as HTMLElement;
            if (target.closest('.remove-stat-mod')) {
              e.preventDefault();
              target.closest('.stat-mod-row')?.remove();
            }
          });

          // File picker
          const filePickerBtn = bodyEl.querySelector('.file-picker-btn');
          if (filePickerBtn) {
            filePickerBtn.addEventListener('click', (ev: Event) => {
              ev.preventDefault();
              const input = bodyEl.querySelector('input[name="image"]') as HTMLInputElement;
              const fp = new FilePicker({
                type: 'image',
                current: input?.value || '',
                callback: (path: string) => {
                  const img = bodyEl.querySelector('.image-preview img') as HTMLImageElement;
                  if (input) input.value = path;
                  if (img) img.src = path;
                },
              });
              fp.render(true);
            });
          }
        },
        onSave: async (bodyEl) => {
          const form = bodyEl.querySelector('form.guard-modal-form') as HTMLFormElement;
          if (!form) return false;
          const fd = new FormData(form);

          // Parse stat modifications
          const statModifications: { statName: keyof GuardStats; value: number }[] = [];
          const statNames = fd.getAll('statName') as (keyof GuardStats)[];
          const statValues = fd.getAll('statValue') as string[];

          for (let i = 0; i < statNames.length; i++) {
            const val = parseInt(statValues[i]);
            if (!Number.isNaN(val) && val !== 0) {
              statModifications.push({ statName: statNames[i], value: val });
            }
          }

          const data: GuardModifierDialogData = {
            name: (fd.get('name') as string) || '',
            description: (fd.get('description') as string) || '',
            type: (fd.get('type') as any) || 'neutral',
            image: (fd.get('image') as string) || '',
            statModifications,
          };

          if (!data.name.trim()) {
            ui?.notifications?.error('El nombre es obligatorio');
            return false;
          }

          return {
            id: existing?.id || '',
            ...data,
            version: (existing?.version || 0) + 1,
            createdAt: existing?.createdAt || new Date(),
            updatedAt: new Date(),
          } as GuardModifier;
        },
      });
    } catch (e) {
      console.error('Error mostrando diálogo de modificador de guardia', e);
      ui?.notifications?.error('Error al mostrar diálogo');
      return null;
    }
  }

  private async generateContent(
    mode: 'create' | 'edit',
    existing?: GuardModifier
  ): Promise<string> {
    const data: GuardModifierDialogData = {
      name: existing?.name || '',
      description: existing?.description || '',
      type: existing?.type || 'neutral',
      image: existing?.image || 'icons/svg/item-bag.svg',
      statModifications: existing?.statModifications || [],
    };

    const statOptions = Object.keys(DEFAULT_GUARD_STATS).map((k) => ({
      value: k,
      label: k.charAt(0).toUpperCase() + k.slice(1),
    }));

    const templatePath = 'modules/guard-management/templates/dialogs/add-edit-guard-modifier.hbs';
    return await foundry.applications.handlebars.renderTemplate(templatePath, {
      ...data,
      statOptions,
      isCreate: mode === 'create',
    });
  }

  private addStatRow(container: HTMLElement) {
    const row = document.createElement('div');
    row.className = 'stat-mod-row';
    row.style.display = 'flex';
    row.style.gap = '5px';
    row.style.alignItems = 'center';

    const statOptions = Object.keys(DEFAULT_GUARD_STATS)
      .map((k) => `<option value="${k}">${k.charAt(0).toUpperCase() + k.slice(1)}</option>`)
      .join('');

    row.innerHTML = `
      <select name="statName" style="flex: 1;">${statOptions}</select>
      <input type="number" name="statValue" value="0" style="width: 60px;" />
      <button type="button" class="remove-stat-mod" style="width: 30px;"><i class="fas fa-trash"></i></button>
    `;
    container.appendChild(row);
  }

  static async create() {
    return new AddOrEditGuardModifierDialog().show('create');
  }

  static async edit(modifier: GuardModifier) {
    return new AddOrEditGuardModifierDialog().show('edit', modifier);
  }
}
