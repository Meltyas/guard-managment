import { GUARD_STAT_MAX, GUARD_STAT_MIN, GuardStats, Patrol } from '../types/entities';
import { GuardModal } from '../ui/GuardModal.js';

interface PatrolDialogData {
  name: string;
  subtitle: string;
  baseStats: GuardStats;
  organizationId: string;
  soldierSlots: number;
  maxHope: number;
}

export type UnitType = 'patrol' | 'auxiliary';

export class AddOrEditPatrolDialog {
  async show(
    mode: 'create' | 'edit',
    organizationId: string,
    existing?: Patrol,
    unitType: UnitType = 'patrol'
  ): Promise<Patrol | null> {
    const content = await this.generateContent(mode, organizationId, existing, unitType);
    const labels =
      unitType === 'auxiliary'
        ? { create: 'Nuevo Auxiliar', edit: 'Editar Auxiliar' }
        : { create: 'Nueva Patrulla', edit: 'Editar Patrulla' };
    const title = mode === 'create' ? labels.create : labels.edit;

    try {
      return await GuardModal.openAsync<Patrol>({
        title,
        icon: 'fas fa-shield-alt',
        body: content,
        saveLabel: mode === 'create' ? 'Crear' : 'Guardar',
        onSave: async (bodyEl) => {
          const form = bodyEl.querySelector('form.guard-modal-form') as HTMLFormElement;
          if (!form) return false;
          const fd = new FormData(form);
          const data: PatrolDialogData = {
            name: (fd.get('name') as string) || '',
            subtitle: (fd.get('subtitle') as string) || '',
            organizationId: fd.get('organizationId') as string,
            soldierSlots: parseInt(fd.get('soldierSlots') as string) || 5,
            maxHope: Math.min(6, Math.max(0, parseInt(fd.get('maxHope') as string) || 0)),
            baseStats: {
              agility: (() => {
                const v = parseInt(fd.get('stat_agility') as string);
                return Number.isNaN(v) ? 0 : v;
              })(),
              strength: (() => {
                const v = parseInt(fd.get('stat_strength') as string);
                return Number.isNaN(v) ? 0 : v;
              })(),
              finesse: (() => {
                const v = parseInt(fd.get('stat_finesse') as string);
                return Number.isNaN(v) ? 0 : v;
              })(),
              instinct: (() => {
                const v = parseInt(fd.get('stat_instinct') as string);
                return Number.isNaN(v) ? 0 : v;
              })(),
              presence: (() => {
                const v = parseInt(fd.get('stat_presence') as string);
                return Number.isNaN(v) ? 0 : v;
              })(),
              knowledge: (() => {
                const v = parseInt(fd.get('stat_knowledge') as string);
                return Number.isNaN(v) ? 0 : v;
              })(),
            },
          };

          if (!data.name.trim()) {
            ui?.notifications?.error('El nombre es obligatorio');
            return false;
          }

          const gm = (window as any).GuardManagement;
          const orgMgr = gm?.guardOrganizationManager;
          if (!orgMgr) return false;
          const patrolMgr =
            unitType === 'auxiliary' ? orgMgr.getAuxiliaryManager() : orgMgr.getPatrolManager();

          if (mode === 'create') {
            const created = await patrolMgr.createPatrol({
              name: data.name.trim(),
              subtitle: data.subtitle.trim(),
              organizationId: data.organizationId,
              baseStats: data.baseStats,
              soldierSlots: data.soldierSlots,
              maxHope: data.maxHope,
              currentHope: 0,
            } as any);
            orgMgr.upsertPatrolSnapshot(patrolMgr.getPatrol(created.id)!);
            return created;
          } else if (existing) {
            patrolMgr.updatePatrol(existing.id, {
              name: data.name.trim(),
              subtitle: data.subtitle.trim(),
              baseStats: data.baseStats,
              soldierSlots: data.soldierSlots,
              maxHope: data.maxHope,
            });
            const updated = patrolMgr.getPatrol(existing.id) || null;
            if (updated) {
              orgMgr.upsertPatrolSnapshot(updated);
            }
            return updated as Patrol;
          }

          return false;
        },
      });
    } catch (e) {
      console.error('Error mostrando diálogo de patrulla', e);
      ui?.notifications?.error('Error al mostrar diálogo de patrulla');
      return null;
    }
  }

  private async generateContent(
    mode: 'create' | 'edit',
    organizationId: string,
    existing?: Patrol,
    unitType: UnitType = 'patrol'
  ): Promise<string> {
    const soldierLabel = unitType === 'auxiliary' ? 'Subalterno' : 'Soldado';
    const data: PatrolDialogData = {
      name: existing?.name || '',
      subtitle: existing?.subtitle || '',
      organizationId,
      soldierSlots: existing?.soldierSlots || 5,
      maxHope: existing?.maxHope ?? 0,
      baseStats: existing?.baseStats || {
        agility: 0,
        strength: 0,
        finesse: 0,
        instinct: 0,
        presence: 0,
        knowledge: 0,
      },
    };

    const stats = [
      { label: 'Agilidad', key: 'agility', value: data.baseStats.agility },
      { label: 'Fuerza', key: 'strength', value: data.baseStats.strength },
      { label: 'Destreza', key: 'finesse', value: data.baseStats.finesse },
      { label: 'Instinto', key: 'instinct', value: data.baseStats.instinct },
      { label: 'Presencia', key: 'presence', value: data.baseStats.presence },
      { label: 'Conocimiento', key: 'knowledge', value: data.baseStats.knowledge },
    ];

    const slotOptions = Array.from({ length: 11 }, (_, i) => i + 1).map((n) => ({
      value: n,
      label: `${n} ${soldierLabel}${n > 1 ? 's' : ''}`,
      selected: n === data.soldierSlots,
    }));

    const templatePath = 'modules/guard-management/templates/dialogs/add-edit-patrol.hbs';
    return await foundry.applications.handlebars.renderTemplate(templatePath, {
      ...data,
      stats,
      slotOptions,
      isCreate: mode === 'create',
      minStat: GUARD_STAT_MIN,
      maxStat: GUARD_STAT_MAX,
    });
  }

  static async create(organizationId: string, unitType: UnitType = 'patrol') {
    return new AddOrEditPatrolDialog().show('create', organizationId, undefined, unitType);
  }
  static async edit(organizationId: string, patrol: Patrol, unitType: UnitType = 'patrol') {
    return new AddOrEditPatrolDialog().show('edit', organizationId, patrol, unitType);
  }
}
