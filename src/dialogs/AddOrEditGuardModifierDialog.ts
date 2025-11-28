import { DEFAULT_GUARD_STATS, GuardModifier, GuardStats } from '../types/entities.js';

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
      const DialogV2Class = (foundry as any).applications.api.DialogV2;
      if (!DialogV2Class) {
        console.warn('DialogV2 no disponible');
        return null;
      }

      let resultModifier: GuardModifier | null = null;

      const result = await DialogV2Class.wait({
        window: { title, resizable: true },
        content,
        buttons: [
          {
            action: 'save',
            icon: 'fas fa-save',
            label: mode === 'create' ? 'Crear' : 'Guardar',
            default: true,
            callback: async (_ev: Event, button: any, dialog: any) => {
              const form =
                button?.form || dialog?.window?.content?.querySelector('form.guard-modifier-form');
              if (!form) return 'cancel';
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
                return 'cancel';
              }

              resultModifier = {
                id: existing?.id || '',
                ...data,
                version: (existing?.version || 0) + 1,
                createdAt: existing?.createdAt || new Date(),
                updatedAt: new Date(),
              } as GuardModifier;

              return 'save';
            },
          },
          { action: 'cancel', icon: 'fas fa-times', label: 'Cancelar', callback: () => 'cancel' },
        ],
        render: (event: any) => {
          const element = event instanceof HTMLElement ? event : event.target.element;
          if (!element) return;

          // Add row button handler
          element.querySelector('.add-stat-mod')?.addEventListener('click', (e: Event) => {
            e.preventDefault();
            this.addStatRow(element.querySelector('.stat-mods-container') as HTMLElement);
          });

          // Remove row button handler (delegated)
          element.querySelector('.stat-mods-container')?.addEventListener('click', (e: Event) => {
            const target = e.target as HTMLElement;
            if (target.closest('.remove-stat-mod')) {
              e.preventDefault();
              target.closest('.stat-mod-row')?.remove();
            }
          });

          // File picker
          const filePickerBtn = element.querySelector('.file-picker-btn');
          if (filePickerBtn) {
            filePickerBtn.addEventListener('click', (ev: Event) => {
              ev.preventDefault();
              const fp = new FilePicker({
                type: 'image',
                callback: (path: string) => {
                  const input = element.querySelector('input[name="image"]') as HTMLInputElement;
                  const img = element.querySelector('.image-preview img') as HTMLImageElement;
                  if (input) input.value = path;
                  if (img) img.src = path;
                },
              });
              fp.browse();
            });
          }
        },
      });

      if (result === 'save') return resultModifier;
      return null;
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
    return await renderTemplate(templatePath, {
      ...data,
      statOptions,
      isCreate: mode === 'create',
    });
  }

  private addStatRow(container: HTMLElement) {
    const row = document.createElement('div');
    row.className = 'stat-mod-row form-group';
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
