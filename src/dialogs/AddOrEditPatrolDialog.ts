import {
  GUARD_STAT_MAX,
  GUARD_STAT_MIN,
  GuardStats,
  Patrol,
  PatrolSpellAbility,
  PatrolSpellcasting,
  SpellcastingType,
} from '../types/entities';
import { GuardModal } from '../ui/GuardModal.js';

interface PatrolDialogData {
  name: string;
  subtitle: string;
  baseStats: GuardStats;
  organizationId: string;
  soldierSlots: number;
  maxHope: number;
  patrolSpells: PatrolSpellAbility[];
  spellcasting: PatrolSpellcasting | undefined;
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
        onRender: (bodyEl) => {
          const typeSelect = bodyEl.querySelector('.spellcasting-type-select') as HTMLSelectElement;
          const dependentEls = bodyEl.querySelectorAll<HTMLElement>(
            '.spellcasting-stat-row, .spellcasting-identity-rows, .spellcasting-spells-list'
          );

          const applyVisibility = () => {
            const enabled = typeSelect.value !== 'none';
            dependentEls.forEach((el) => {
              el.style.opacity = enabled ? '1' : '0.4';
              el.style.pointerEvents = enabled ? '' : 'none';
            });
          };

          typeSelect?.addEventListener('change', applyVisibility);
          applyVisibility();
        },
        onSave: async (bodyEl) => {
          const form = bodyEl.querySelector('form.guard-modal-form') as HTMLFormElement;
          if (!form) return false;
          const fd = new FormData(form);

          // Parse spellcasting config
          const spellcastingType = fd.get('spellcasting_type') as string;
          const spellcasting: PatrolSpellcasting | undefined =
            spellcastingType !== 'none'
              ? {
                  type: spellcastingType as SpellcastingType,
                  stat: (fd.get('spellcasting_stat') as keyof GuardStats) || 'knowledge',
                  name: ((fd.get('spellcasting_name') as string) || '').trim() || undefined,
                  description:
                    ((fd.get('spellcasting_description') as string) || '').trim() || undefined,
                }
              : undefined;

          // Parse spell names (up to 6 slots)
          const patrolSpells: PatrolSpellAbility[] = [];
          for (let i = 0; i < 6; i++) {
            const spellName = ((fd.get(`spell_name_${i}`) as string) || '').trim();
            if (spellName) {
              const desc = ((fd.get(`spell_desc_${i}`) as string) || '').trim();
              const hopeCostRaw = parseInt(fd.get(`spell_hope_${i}`) as string);
              patrolSpells.push({
                id:
                  existing?.patrolSpells?.[i]?.id ||
                  (globalThis as any).foundry?.utils?.randomID?.() ||
                  crypto.randomUUID(),
                name: spellName,
                description: desc || undefined,
                hopeCost: Number.isNaN(hopeCostRaw) || hopeCostRaw <= 0 ? undefined : hopeCostRaw,
              });
            }
          }
          const data: PatrolDialogData = {
            name: (fd.get('name') as string) || '',
            subtitle: (fd.get('subtitle') as string) || '',
            organizationId: fd.get('organizationId') as string,
            soldierSlots: parseInt(fd.get('soldierSlots') as string) || 5,
            maxHope: Math.min(6, Math.max(0, parseInt(fd.get('maxHope') as string) || 0)),
            patrolSpells,
            spellcasting,
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
              patrolSpells: data.patrolSpells,
              spellcasting: data.spellcasting,
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
              patrolSpells: data.patrolSpells,
              spellcasting: data.spellcasting,
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
      patrolSpells: existing?.patrolSpells || [],
      spellcasting: existing?.spellcasting,
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

    // Build 6 spell slots (pre-filled from existing data)
    const spellSlots = Array.from({ length: 6 }, (_, i) => ({
      index: i,
      displayIndex: i + 1,
      name: data.patrolSpells[i]?.name || '',
      description: data.patrolSpells[i]?.description || '',
      hopeCost: data.patrolSpells[i]?.hopeCost ?? '',
    }));

    const STAT_OPTIONS = [
      { key: 'agility', label: 'Agilidad' },
      { key: 'strength', label: 'Fuerza' },
      { key: 'finesse', label: 'Destreza' },
      { key: 'instinct', label: 'Instinto' },
      { key: 'presence', label: 'Presencia' },
      { key: 'knowledge', label: 'Conocimiento' },
    ];
    const statOptions = STAT_OPTIONS.map((s) => ({
      ...s,
      selected: s.key === (data.spellcasting?.stat ?? 'knowledge'),
    }));

    const templatePath = 'modules/guard-management/templates/dialogs/add-edit-patrol.hbs';
    return await foundry.applications.handlebars.renderTemplate(templatePath, {
      ...data,
      stats,
      slotOptions,
      spellSlots,
      statOptions,
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
