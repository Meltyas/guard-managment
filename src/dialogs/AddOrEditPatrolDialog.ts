import { html } from 'lit-html';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import { GUARD_STAT_MAX, GUARD_STAT_MIN, GuardStats, Patrol } from '../types/entities';
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
                  robustismo: (() => {
                    const v = parseInt(fd.get('stat_robustismo') as string);
                    return Number.isNaN(v) ? 0 : v;
                  })(),
                  analitica: (() => {
                    const v = parseInt(fd.get('stat_analitica') as string);
                    return Number.isNaN(v) ? 0 : v;
                  })(),
                  subterfugio: (() => {
                    const v = parseInt(fd.get('stat_subterfugio') as string);
                    return Number.isNaN(v) ? 0 : v;
                  })(),
                  elocuencia: (() => {
                    const v = parseInt(fd.get('stat_elocuencia') as string);
                    return Number.isNaN(v) ? 0 : v;
                  })(),
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

    // Remove lit-html artifact comments that can appear encoded inside textareas when serialised
    const cleanArtifacts = (s: string) =>
      (s || '')
        .replace(/<!---->/g, '')
        .replace(/&lt;!----&gt;/g, '')
        .trim();
    data.lastOrderText = cleanArtifacts(data.lastOrderText);

    const orderAgeClass = existing?.lastOrder
      ? classifyLastOrderAge({ issuedAt: existing.lastOrder.issuedAt })
      : 'normal';

    // Sanitize potentially stored HTML for preview (very basic, strips script tags)
    const sanitizeHtml = (raw: string) =>
      (raw || '')
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .replace(/on[a-zA-Z]+="[^"]*"/g, '')
        .replace(/on[a-zA-Z]+='[^']*'/g, '');

    const safeLastOrderPreview = sanitizeHtml(data.lastOrderText);

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
        <textarea
          name="lastOrderText"
          rows="3"
          placeholder="Orden reciente (puede contener HTML para formato)"
        >
${data.lastOrderText}</textarea
        >
        <div class="last-order-preview-wrapper">
          <label style="margin-top:4px; font-weight:bold;">Vista Previa:</label>
          <div class="last-order-preview" data-preview="lastOrder">
            ${unsafeHTML(safeLastOrderPreview || '<em>(sin contenido)</em>')}
          </div>
        </div>
        ${existing?.lastOrder
          ? html`<div class="last-order-meta ${orderAgeClass}">
              Emitida: ${new Date(existing.lastOrder.issuedAt).toLocaleString()}
            </div>`
          : ''}
        <p class="hint small">
          El contenido HTML se renderiza en la vista previa. Se eliminan scripts y eventos
          inseguros.
        </p>
      </div>

      <input type="hidden" name="organizationId" value="${organizationId}" />
      <p class="hint">
        ${mode === 'create' ? 'Crear nueva patrulla para organización.' : 'Actualizar patrulla.'}
      </p>
    </form>`;

    let htmlString = renderTemplateToString(template);
    // Remove lit-html placeholder comment artifacts which appear when serializing templates
    // These show up especially inside <textarea> contents as `<!---->` or encoded variants
    htmlString = htmlString.replace(/<!---->/g, '').replace(/&lt;!----&gt;/g, '');
    return htmlString;
  }

  private renderStatInput(label: string, key: string, value: number) {
    return html`<div class="stat-input">
      <label>${label}</label
      ><input
        type="number"
        name="stat_${key}"
        value="${value}"
        min="${GUARD_STAT_MIN}"
        max="${GUARD_STAT_MAX}"
      />
    </div>`;
  }

  static async create(organizationId: string) {
    return new AddOrEditPatrolDialog().show('create', organizationId);
  }
  static async edit(organizationId: string, patrol: Patrol) {
    return new AddOrEditPatrolDialog().show('edit', organizationId, patrol);
  }
}
