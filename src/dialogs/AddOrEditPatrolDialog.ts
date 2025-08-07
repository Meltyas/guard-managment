import { html } from 'lit-html';
import { GuardStats, Patrol } from '../types/entities';
import { classifyLastOrderAge } from '../utils/patrol-helpers';
import { renderTemplateToString } from '../utils/template-renderer.js';

interface PatrolDialogData {
  name: string;
  subtitle: string;
  baseStats: GuardStats;
  lastOrderText: string;
  organizationId: string;
}

export class AddOrEditPatrolDialog {
  async show(
    mode: 'create' | 'edit',
    organizationId: string,
    existing?: Patrol
  ): Promise<Patrol | null> {
    const content = this.generateContent(mode, organizationId, existing);
    const title = mode === 'create' ? 'Nueva Patrulla' : 'Editar Patrulla';
    try {
      const DialogV2Class = (foundry as any).applications.api.DialogV2;
      if (!DialogV2Class) {
        console.warn('DialogV2 no disponible');
        return null;
      }

      let resultPatrol: Patrol | null = null;

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
                button?.form || dialog?.window?.content?.querySelector('form.patrol-form');
              if (!form) return 'cancel';
              const fd = new FormData(form);
              const data: PatrolDialogData = {
                name: (fd.get('name') as string) || '',
                subtitle: (fd.get('subtitle') as string) || '',
                organizationId: fd.get('organizationId') as string,
                lastOrderText: (fd.get('lastOrderText') as string) || '',
                baseStats: {
                  robustismo: parseInt(fd.get('stat_robustismo') as string) || 0,
                  analitica: parseInt(fd.get('stat_analitica') as string) || 0,
                  subterfugio: parseInt(fd.get('stat_subterfugio') as string) || 0,
                  elocuencia: parseInt(fd.get('stat_elocuencia') as string) || 0,
                },
              };

              if (!data.name.trim()) {
                ui?.notifications?.error('El nombre es obligatorio');
                return 'cancel';
              }

              const gm = (window as any).GuardManagement;
              const orgMgr = gm?.guardOrganizationManager;
              if (!orgMgr) return 'cancel';
              const patrolMgr = orgMgr.getPatrolManager();

              if (mode === 'create') {
                const created = patrolMgr.createPatrol({
                  name: data.name.trim(),
                  subtitle: data.subtitle.trim(),
                  organizationId: data.organizationId,
                  baseStats: data.baseStats,
                } as any);
                if (data.lastOrderText.trim()) {
                  patrolMgr.updateLastOrder(created.id, data.lastOrderText.trim());
                }
                // persist via manager helper
                orgMgr.upsertPatrolSnapshot(patrolMgr.getPatrol(created.id)!);
                resultPatrol = created;
              } else if (existing) {
                patrolMgr.updatePatrol(existing.id, {
                  name: data.name.trim(),
                  subtitle: data.subtitle.trim(),
                  baseStats: data.baseStats,
                });
                if (data.lastOrderText.trim()) {
                  patrolMgr.updateLastOrder(existing.id, data.lastOrderText.trim());
                }
                const updated = patrolMgr.getPatrol(existing.id) || null;
                if (updated) {
                  orgMgr.upsertPatrolSnapshot(updated);
                }
                resultPatrol = updated;
              }

              return 'save';
            },
          },
          { action: 'cancel', icon: 'fas fa-times', label: 'Cancelar', callback: () => 'cancel' },
        ],
      });

      if (result === 'save') return resultPatrol;
      return null;
    } catch (e) {
      console.error('Error mostrando diálogo de patrulla', e);
      ui?.notifications?.error('Error al mostrar diálogo de patrulla');
      return null;
    }
  }

  private generateContent(
    mode: 'create' | 'edit',
    organizationId: string,
    existing?: Patrol
  ): string {
    const data: PatrolDialogData = {
      name: existing?.name || '',
      subtitle: existing?.subtitle || '',
      organizationId,
      baseStats: existing?.baseStats || {
        robustismo: 0,
        analitica: 0,
        subterfugio: 0,
        elocuencia: 0,
      },
      lastOrderText: existing?.lastOrder?.text || '',
    };

    const orderAgeClass = existing?.lastOrder
      ? classifyLastOrderAge({ issuedAt: existing.lastOrder.issuedAt })
      : 'normal';

    const template = html`<form class="patrol-form guard-dialog">
      <div class="section identity">
        <label>Nombre</label>
        <input type="text" name="name" value="${data.name}" required maxlength="50" />
        <label>Subtítulo</label>
        <input type="text" name="subtitle" value="${data.subtitle}" maxlength="80" />
      </div>

      <div class="section stats">
        <h4>Estadísticas Base</h4>
        ${this.renderStatInput('Robustismo', 'robustismo', data.baseStats.robustismo)}
        ${this.renderStatInput('Analítica', 'analitica', data.baseStats.analitica)}
        ${this.renderStatInput('Subterfugio', 'subterfugio', data.baseStats.subterfugio)}
        ${this.renderStatInput('Elocuencia', 'elocuencia', data.baseStats.elocuencia)}
      </div>

      <div class="section last-order">
        <h4>Última Orden</h4>
        <textarea name="lastOrderText" rows="2" placeholder="Orden reciente...">
${data.lastOrderText}</textarea
        >
        ${existing?.lastOrder
          ? html`<div class="last-order-meta ${orderAgeClass}">
              Emitida: ${new Date(existing.lastOrder.issuedAt).toLocaleString()}
            </div>`
          : ''}
      </div>

      <input type="hidden" name="organizationId" value="${organizationId}" />
      <p class="hint">
        ${mode === 'create' ? 'Crear nueva patrulla para organización.' : 'Actualizar patrulla.'}
      </p>
    </form>`;

    return renderTemplateToString(template);
  }

  private renderStatInput(label: string, key: string, value: number) {
    return html`<div class="stat-input">
      <label>${label}</label
      ><input type="number" name="stat_${key}" value="${value}" min="0" max="50" />
    </div>`;
  }

  static async create(organizationId: string) {
    return new AddOrEditPatrolDialog().show('create', organizationId);
  }
  static async edit(organizationId: string, patrol: Patrol) {
    return new AddOrEditPatrolDialog().show('edit', organizationId, patrol);
  }
}
