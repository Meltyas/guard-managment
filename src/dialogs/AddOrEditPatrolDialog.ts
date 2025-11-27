import { GUARD_STAT_MAX, GUARD_STAT_MIN, GuardStats, Patrol } from '../types/entities';

interface PatrolDialogData {
  name: string;
  subtitle: string;
  baseStats: GuardStats;
  organizationId: string;
  soldierSlots: number;
}

export class AddOrEditPatrolDialog {
  async show(
    mode: 'create' | 'edit',
    organizationId: string,
    existing?: Patrol
  ): Promise<Patrol | null> {
    const content = await this.generateContent(mode, organizationId, existing);
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
                soldierSlots: parseInt(fd.get('soldierSlots') as string) || 5,
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
                  soldierSlots: data.soldierSlots,
                } as any);
                // persist via manager helper
                orgMgr.upsertPatrolSnapshot(patrolMgr.getPatrol(created.id)!);
                resultPatrol = created;
              } else if (existing) {
                patrolMgr.updatePatrol(existing.id, {
                  name: data.name.trim(),
                  subtitle: data.subtitle.trim(),
                  baseStats: data.baseStats,
                  soldierSlots: data.soldierSlots,
                });
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

  private async generateContent(
    mode: 'create' | 'edit',
    organizationId: string,
    existing?: Patrol
  ): Promise<string> {
    const data: PatrolDialogData = {
      name: existing?.name || '',
      subtitle: existing?.subtitle || '',
      organizationId,
      soldierSlots: existing?.soldierSlots || 5,
      baseStats: existing?.baseStats || {
        robustismo: 0,
        analitica: 0,
        subterfugio: 0,
        elocuencia: 0,
      },
    };

    const stats = [
      { label: 'Robustismo', key: 'robustismo', value: data.baseStats.robustismo },
      { label: 'Analítica', key: 'analitica', value: data.baseStats.analitica },
      { label: 'Subterfugio', key: 'subterfugio', value: data.baseStats.subterfugio },
      { label: 'Elocuencia', key: 'elocuencia', value: data.baseStats.elocuencia },
    ];

    const slotOptions = Array.from({ length: 11 }, (_, i) => i + 1).map((n) => ({
      value: n,
      label: `${n} Soldado${n > 1 ? 's' : ''}`,
      selected: n === data.soldierSlots,
    }));

    const templatePath = 'modules/guard-management/templates/dialogs/add-edit-patrol.hbs';
    return await renderTemplate(templatePath, {
      ...data,
      stats,
      slotOptions,
      isCreate: mode === 'create',
      minStat: GUARD_STAT_MIN,
      maxStat: GUARD_STAT_MAX,
    });
  }

  static async create(organizationId: string) {
    return new AddOrEditPatrolDialog().show('create', organizationId);
  }
  static async edit(organizationId: string, patrol: Patrol) {
    return new AddOrEditPatrolDialog().show('edit', organizationId, patrol);
  }
}
