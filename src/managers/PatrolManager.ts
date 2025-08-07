import { GuardStats, Patrol, PatrolEffectInstance, PatrolLastOrder } from '../types/entities';

/**
 * Simple in-memory PatrolManager (initial implementation for TDD Green phase)
 * Later can integrate with documents / persistence.
 */
export class PatrolManager {
  private patrols: Map<string, Patrol> = new Map();

  public createPatrol(
    data: Partial<Patrol> & { name: string; organizationId: string; baseStats: GuardStats }
  ): Patrol {
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
      officer: null,
      soldiers: [],
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
    return patrol;
  }

  public getPatrol(id: string): Patrol | undefined {
    return this.patrols.get(id);
  }

  public list(): Patrol[] {
    return Array.from(this.patrols.values());
  }

  public updateLastOrder(patrolId: string, text: string): Patrol | undefined {
    const patrol = this.patrols.get(patrolId);
    if (!patrol) return undefined;
    patrol.lastOrder = { text: text.trim(), issuedAt: Date.now() } as PatrolLastOrder;
    patrol.version += 1;
    patrol.updatedAt = new Date();
    return patrol;
  }

  public recalcDerived(patrolId: string, orgModifiers?: Partial<GuardStats>): Patrol | undefined {
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
    return patrol;
  }

  public assignOfficer(patrolId: string, officer: any) {
    const patrol = this.patrols.get(patrolId);
    if (!patrol) return undefined;
    patrol.officer = { ...officer };
    patrol.version += 1;
    patrol.updatedAt = new Date();
    return patrol;
  }

  public addSoldier(patrolId: string, soldier: any) {
    const patrol = this.patrols.get(patrolId);
    if (!patrol) return undefined;
    patrol.soldiers.push({ ...soldier });
    patrol.version += 1;
    patrol.updatedAt = new Date();
    return patrol;
  }

  public addEffect(patrolId: string, effect: PatrolEffectInstance) {
    const patrol = this.patrols.get(patrolId);
    if (!patrol) return undefined;
    patrol.patrolEffects.push(effect);
    patrol.version += 1;
    patrol.updatedAt = new Date();
    return patrol;
  }

  public deletePatrol(patrolId: string): boolean {
    return this.patrols.delete(patrolId);
  }

  public updatePatrol(patrolId: string, updates: Partial<Patrol>): Patrol | undefined {
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
    if (updates.baseStats) {
      merged.derivedStats = { ...updates.baseStats } as any;
    }
    this.patrols.set(patrolId, merged);
    return merged;
  }
}
