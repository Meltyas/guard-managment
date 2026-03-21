import { GuardRollDialog } from '../dialogs/GuardRollDialog';
import { GuardStats, Patrol, PatrolEffectInstance, PatrolLastOrder } from '../types/entities';

/**
 * Simple in-memory PatrolManager (initial implementation for TDD Green phase)
 * Later can integrate with documents / persistence.
 */
export type PatrolChangeOp = 'create' | 'update' | 'delete';
export type PatrolChangeCallback = (patrol: Patrol, op: PatrolChangeOp, ctx?: any) => void;

export class PatrolManager {
  private patrols: Map<string, Patrol> = new Map();
  private onChange?: PatrolChangeCallback;

  /** Inicializa cargando desde settings (si existen). GuardOrganizationManager volverá a hidratar snapshots igualmente. */
  public async initialize(): Promise<void> {
    await this.loadFromSettings();
  }

  constructor(onChange?: PatrolChangeCallback) {
    this.onChange = onChange;
  }

  public async createPatrol(
    data: Partial<Patrol> & { name: string; organizationId: string; baseStats: GuardStats }
  ): Promise<Patrol> {
    const id = (globalThis as any).foundry?.utils?.randomID?.() || crypto.randomUUID();
    const now = Date.now();
    const patrol: Patrol = {
      id,
      name: data.name.trim(),
      organizationId: data.organizationId,
      subtitle: data.subtitle || '',
      version: 1,
      createdAt: new Date(now),
      updatedAt: new Date(now),
      baseStats: { ...data.baseStats },
      derivedStats: { ...data.baseStats }, // initial equals base until recalculated
      officerId: null,
      officer: null,
      soldiers: [],
      soldierSlots: data.soldierSlots || 5, // Default to 5 if not provided
      patrolEffects: [],
      lastOrder: null,
      // deprecated legacy padding
      leaderId: undefined,
      unitCount: 0,
      customModifiers: [],
      activeEffects: [],
      status: 'idle',
      calculatedStats: undefined,
    };
    this.patrols.set(id, patrol);
    this.onChange?.(patrol, 'create');
    // Persistir inmediatamente para no perder datos en F5 rápido
    await this.persistToSettings();
    return patrol;
  }

  public getPatrol(id: string): Patrol | undefined {
    return this.patrols.get(id);
  }

  public list(): Patrol[] {
    return Array.from(this.patrols.values());
  }

  public async updateLastOrder(patrolId: string, text: string): Promise<Patrol | undefined> {
    const patrol = this.patrols.get(patrolId);
    if (!patrol) return undefined;

    if (text.includes('[object Object]')) {
      console.warn('PatrolManager | updateLastOrder received [object Object], ignoring update');
      return patrol;
    }

    patrol.lastOrder = { text: text.trim(), issuedAt: Date.now() } as PatrolLastOrder;
    patrol.version += 1;
    patrol.updatedAt = new Date();
    this.onChange?.(patrol, 'update', { field: 'lastOrder' });
    // Persist immediately to avoid data loss on refresh
    await this.persistToSettings();
    return patrol;
  }

  public async recalcDerived(
    patrolId: string,
    orgModifiers?: Partial<GuardStats>
  ): Promise<Patrol | undefined> {
    const patrol = this.patrols.get(patrolId);
    if (!patrol) return undefined;
    const modifiers = orgModifiers || {};

    // Aggregate patrolEffects modifiers
    const effectsTotal: Partial<GuardStats> = {};
    for (const eff of patrol.patrolEffects) {
      for (const [k, v] of Object.entries(eff.modifiers)) {
        effectsTotal[k] = (effectsTotal[k] || 0) + (v || 0);
      }
    }

    patrol.derivedStats = { ...patrol.baseStats } as GuardStats;
    for (const key of Object.keys(patrol.baseStats)) {
      const base = patrol.baseStats[key] || 0;
      const org = (modifiers as any)[key] || 0;
      const eff = (effectsTotal as any)[key] || 0;
      (patrol.derivedStats as any)[key] = base + org + eff;
    }
    patrol.version += 1;
    patrol.updatedAt = new Date();
    this.onChange?.(patrol, 'update', { field: 'derivedStats' });
    await this.persistToSettings();
    return patrol;
  }

  public async assignOfficer(patrolId: string, officer: any) {
    const patrol = this.patrols.get(patrolId);
    if (!patrol) return undefined;
    patrol.officer = { ...officer };
    patrol.version += 1;
    patrol.updatedAt = new Date();
    this.onChange?.(patrol, 'update', { field: 'officer' });
    await this.persistToSettings();
    return patrol;
  }

  public async addSoldier(patrolId: string, soldier: any) {
    const patrol = this.patrols.get(patrolId);
    if (!patrol) return undefined;
    patrol.soldiers.push({ ...soldier });
    patrol.version += 1;
    patrol.updatedAt = new Date();
    this.onChange?.(patrol, 'update', { field: 'soldiers' });
    await this.persistToSettings();
    return patrol;
  }

  public async addEffect(patrolId: string, effect: PatrolEffectInstance) {
    const patrol = this.patrols.get(patrolId);
    if (!patrol) return undefined;
    patrol.patrolEffects.push(effect);
    patrol.version += 1;
    patrol.updatedAt = new Date();
    this.onChange?.(patrol, 'update', { field: 'patrolEffects', op: 'add' });
    await this.persistToSettings();
    return patrol;
  }

  /** Remove a patrol effect by id */
  public async removeEffect(patrolId: string, effectId: string) {
    const patrol = this.patrols.get(patrolId);
    if (!patrol) return undefined;
    const before = patrol.patrolEffects.length;
    patrol.patrolEffects = patrol.patrolEffects.filter((e) => e.id !== effectId);
    if (patrol.patrolEffects.length !== before) {
      patrol.version += 1;
      patrol.updatedAt = new Date();
      this.onChange?.(patrol, 'update', { field: 'patrolEffects', op: 'remove', effectId });
      await this.persistToSettings();
    }
    return patrol;
  }

  public async deletePatrol(patrolId: string): Promise<boolean> {
    const patrol = this.patrols.get(patrolId);
    const deleted = this.patrols.delete(patrolId);
    if (deleted && patrol) {
      this.onChange?.(patrol, 'delete');
      // Persistir inmediatamente la eliminación
      await this.persistToSettings();
    }
    return deleted;
  }

  public async updatePatrol(
    patrolId: string,
    updates: Partial<Patrol>
  ): Promise<Patrol | undefined> {
    const patrol = this.patrols.get(patrolId);
    if (!patrol) return undefined;
    const now = new Date();
    const merged: Patrol = {
      ...patrol,
      ...updates,
      id: patrol.id,
      version: patrol.version + 1,
      updatedAt: now,
    };
    // Keep derivedStats unless baseStats changed (will be recalculated externally)
    let ctx: any = undefined;
    if (updates.baseStats) {
      merged.derivedStats = { ...updates.baseStats } as any;
      ctx = { field: 'baseStats' };
    }
    this.patrols.set(patrolId, merged);
    this.onChange?.(merged, 'update', ctx);
    await this.persistToSettings();
    return merged;
  }

  /** Obtiene todos los patrols actuales */
  public getAll(): Patrol[] {
    return Array.from(this.patrols.values());
  }

  /** Persiste lista completa de patrol snapshots a game settings */
  private async persistToSettings(): Promise<void> {
    try {
      // Don't save if game is not ready yet
      if (!game?.ready) {
        console.warn('PatrolManager | Cannot save - game not ready yet');
        return;
      }

      // Players can also save patrols (settings will sync automatically)
      // No GM check needed - Foundry handles permissions

      // Guardar estructura completa (patrolEffects incluidos)
      const data = this.getAll();

      // Save to world settings - automatically syncs to all clients
      await game?.settings?.set('guard-management', 'patrols', data);

      console.log(`PatrolManager | Saved ${data.length} patrols to settings`);
    } catch (error) {
      console.error('PatrolManager | Error saving patrols:', error);
    }
  }

  /** Carga (si existen) los patrols guardados previamente */
  public async loadFromSettings(): Promise<void> {
    try {
      const stored = game?.settings?.get('guard-management', 'patrols') as any[];
      if (Array.isArray(stored)) {
        this.patrols.clear();
        for (const p of stored) {
          // Asegurar fechas
          if (p.createdAt && typeof p.createdAt === 'string') p.createdAt = new Date(p.createdAt);
          if (p.updatedAt && typeof p.updatedAt === 'string') p.updatedAt = new Date(p.updatedAt);

          // SANITIZE: Check for corrupted lastOrder
          if (p.lastOrder && typeof p.lastOrder.text === 'string') {
            if (p.lastOrder.text.includes('[object ')) {
              console.warn(`PatrolManager | Sanitizing corrupted lastOrder for patrol ${p.id}`);
              p.lastOrder = null;
            }
          }

          this.patrols.set(p.id, p);
        }
        console.log('PatrolManager | Loaded patrols from settings');
      }
    } catch (e) {
      console.warn('PatrolManager | loadFromSettings failed:', e);
    }
  }

  public async rollStat(patrolId: string, stat?: keyof GuardStats): Promise<void> {
    const patrol = this.patrols.get(patrolId);
    if (!patrol) return;

    const activeModifiers: { name: string; value: number }[] = [];
    for (const eff of patrol.patrolEffects) {
      activeModifiers.push({ name: eff.label, value: 0 });
    }

    const config: any = await GuardRollDialog.create(
      patrol,
      activeModifiers,
      (stat as string) || ''
    );
    if (config) {
      await this.performRoll(patrol, config);
    }
  }

  private async performRoll(patrol: Patrol, config: any) {
    const DualityRoll = (game as any).system.api.dice.DualityRoll;

    let formula = `1${config.roll.dice.dHope} + 1${config.roll.dice.dFear}`;

    const baseStats = patrol.baseStats;
    // const derivedStats = patrol.derivedStats || baseStats; // Rebuilding from components for breakdown

    const breakdown: any[] = [];

    if (config.roll.trait) {
      const stat = config.roll.trait as keyof GuardStats;

      // 1. Patrol Base Trait
      const baseValue = baseStats[stat] || 0;
      if (baseValue !== 0) {
        const label = config.roll.trait.charAt(0).toUpperCase() + config.roll.trait.slice(1);
        formula += ` ${baseValue >= 0 ? '+' : '-'} ${Math.abs(baseValue)}[${label}]`;
        breakdown.push({ label: label, value: baseValue });
      }

      // 2. Patrol Effects
      let effectsSum = 0;
      for (const eff of patrol.patrolEffects) {
        const val = eff.modifiers[stat] || 0;
        if (val !== 0) {
          formula += ` ${val >= 0 ? '+' : '-'} ${Math.abs(val)}[${eff.label}]`;
          effectsSum += val;
          breakdown.push({ label: eff.label, value: val });
        }
      }

      // 3. Organization Breakdown
      const gm = (window as any).GuardManagement;
      const orgManager = gm?.guardOrganizationManager;
      const organization = orgManager?.getOrganization();

      if (organization && organization.id === patrol.organizationId) {
        const orgNode: any = { label: 'Organización', value: 0, children: [] };
        let orgTotal = 0;

        // 3a. Organization Base
        const orgBase = organization.baseStats[stat] || 0;
        if (orgBase !== 0) {
          formula += ` ${orgBase >= 0 ? '+' : '-'} ${Math.abs(orgBase)}[Org. Base]`;
          orgNode.children.push({ label: 'Base', value: orgBase });
          orgTotal += orgBase;
        }

        // 3b. Organization Modifiers
        if (gm?.documentManager && organization.activeModifiers?.length) {
          const allModifiers = gm.documentManager.getGuardModifiers();
          for (const modId of organization.activeModifiers) {
            const mod = allModifiers.find((m: any) => m.id === modId);
            if (mod && mod.system?.statModifications) {
              for (const change of mod.system.statModifications) {
                if (change.statName === stat && change.value !== 0) {
                  formula += ` ${change.value >= 0 ? '+' : '-'} ${Math.abs(change.value)}[Org. ${mod.name}]`;
                  orgNode.children.push({ label: mod.name, value: change.value });
                  orgTotal += change.value;
                }
              }
            }
          }
        }

        if (orgTotal !== 0) {
          orgNode.value = orgTotal;
          breakdown.push(orgNode);
        }
      } else {
        // Fallback: Organization Bonus (Derived - Base - Effects)
        // This handles cases where organization is not loaded or ID mismatch
        const derivedStats = patrol.derivedStats || baseStats;
        const total = derivedStats[stat] || 0;
        const orgBonus = total - baseValue - effectsSum;

        if (orgBonus !== 0) {
          formula += ` ${orgBonus >= 0 ? '+' : '-'} ${Math.abs(orgBonus)}[Organization]`;
          breakdown.push({ label: 'Organización', value: orgBonus });
        }
      }
    }

    // Use BASE stats for the main trait value so modifiers are additive
    const traitsData = {
      robustismo: { value: baseStats.robustismo, label: 'Robustismo' },
      analitica: { value: baseStats.analitica, label: 'Analítica' },
      subterfugio: { value: baseStats.subterfugio, label: 'Subterfugio' },
      elocuencia: { value: baseStats.elocuencia, label: 'Elocuencia' },
    };

    const rollData = { traits: traitsData, bonuses: {} };

    const options = {
      roll: {
        ...config.roll,
        advantage: config.roll.advantage,
        trait: undefined, // Disable auto-trait addition by DualityRoll
      },
      source: {},
      data: rollData,
    };

    // Avoid adding +0 modifier if trait value is 0
    if (options.roll.trait && (traitsData as any)[options.roll.trait]?.value === 0) {
      delete options.roll.trait;
    }

    const roll = new DualityRoll(formula, rollData, options);

    roll.advantageNumber = Number(config.roll.dice.advantageNumber);
    roll.advantageFaces = config.roll.dice.advantageFaces;

    if (config.extraFormula) {
      const fullFormula = `${formula} + ${config.extraFormula}`;
      const complexRoll = new DualityRoll(fullFormula, rollData, options);
      complexRoll.advantageNumber = Number(config.roll.dice.advantageNumber);
      complexRoll.advantageFaces = config.roll.dice.advantageFaces;

      await complexRoll.evaluate();

      const evaluatedData = DualityRoll.postEvaluate(complexRoll, options);
      const messageData = {
        type: 'dualityRoll',
        user: (game as any).user.id,
        speaker: { alias: patrol.name },
        sound: (CONFIG as any).sounds.dice,
        system: {
          ...options,
          roll: evaluatedData,
          hasRoll: true,
          title: complexRoll.title,
        },
        rolls: [complexRoll],
        flags: {
          'guard-management': {
            breakdown: breakdown,
          },
        },
      };

      await (ChatMessage as any).create(messageData, { rollMode: config.selectedRollMode });
      return;
    }

    await roll.evaluate();

    const evaluatedData = DualityRoll.postEvaluate(roll, options);
    const messageData = {
      type: 'dualityRoll',
      user: (game as any).user.id,
      speaker: { alias: patrol.name },
      sound: (CONFIG as any).sounds.dice,
      system: {
        ...options,
        roll: evaluatedData,
        hasRoll: true,
        title: roll.title,
      },
      rolls: [roll],
      flags: {
        'guard-management': {
          breakdown: breakdown,
        },
      },
    };

    await (ChatMessage as any).create(messageData, { rollMode: config.selectedRollMode });
  }
}
