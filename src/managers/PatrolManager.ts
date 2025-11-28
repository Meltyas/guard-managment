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
  // Persistencia en actor (unificada con organización)
  private saveTimer: any = null;
  private saveDelay = 300; // ms debounce para evitar spam de writes
  private retryTimer: any = null;
  private retryCount = 0;
  private maxRetries = 5;

  /** Inicializa cargando desde actor (si existe). GuardOrganizationManager volverá a hidratar snapshots igualmente. */
  public async initialize(): Promise<void> {
    await this.loadFromActor();
    this.setupActorWatchers();
  }

  /** Re-hidratar manualmente (usado después de cargar la organización si la primera carga fue antes de que el actor existiera) */
  public async hydrateFromActor(): Promise<void> {
    await this.loadFromActor();
  }

  constructor(onChange?: PatrolChangeCallback) {
    this.onChange = onChange;
  }

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
    this.persistToActor().catch(() => this.queueSave());
    this.queueSave();
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

    if (text.includes('[object Object]')) {
      console.warn('PatrolManager | updateLastOrder received [object Object], ignoring update');
      return patrol;
    }

    patrol.lastOrder = { text: text.trim(), issuedAt: Date.now() } as PatrolLastOrder;
    patrol.version += 1;
    patrol.updatedAt = new Date();
    this.onChange?.(patrol, 'update', { field: 'lastOrder' });
    // Persist immediately to avoid data loss on refresh
    this.persistToActor().catch(() => this.queueSave());
    this.queueSave();
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
    this.onChange?.(patrol, 'update', { field: 'derivedStats' });
    this.queueSave();
    return patrol;
  }

  public assignOfficer(patrolId: string, officer: any) {
    const patrol = this.patrols.get(patrolId);
    if (!patrol) return undefined;
    patrol.officer = { ...officer };
    patrol.version += 1;
    patrol.updatedAt = new Date();
    this.onChange?.(patrol, 'update', { field: 'officer' });
    this.queueSave();
    return patrol;
  }

  public addSoldier(patrolId: string, soldier: any) {
    const patrol = this.patrols.get(patrolId);
    if (!patrol) return undefined;
    patrol.soldiers.push({ ...soldier });
    patrol.version += 1;
    patrol.updatedAt = new Date();
    this.onChange?.(patrol, 'update', { field: 'soldiers' });
    this.queueSave();
    return patrol;
  }

  public addEffect(patrolId: string, effect: PatrolEffectInstance) {
    const patrol = this.patrols.get(patrolId);
    if (!patrol) return undefined;
    patrol.patrolEffects.push(effect);
    patrol.version += 1;
    patrol.updatedAt = new Date();
    this.onChange?.(patrol, 'update', { field: 'patrolEffects', op: 'add' });
    this.queueSave();
    return patrol;
  }

  /** Remove a patrol effect by id */
  public removeEffect(patrolId: string, effectId: string) {
    const patrol = this.patrols.get(patrolId);
    if (!patrol) return undefined;
    const before = patrol.patrolEffects.length;
    patrol.patrolEffects = patrol.patrolEffects.filter((e) => e.id !== effectId);
    if (patrol.patrolEffects.length !== before) {
      patrol.version += 1;
      patrol.updatedAt = new Date();
      this.onChange?.(patrol, 'update', { field: 'patrolEffects', op: 'remove', effectId });
      this.queueSave();
    }
    return patrol;
  }

  public deletePatrol(patrolId: string): boolean {
    const patrol = this.patrols.get(patrolId);
    const deleted = this.patrols.delete(patrolId);
    if (deleted && patrol) {
      this.onChange?.(patrol, 'delete');
      // Persistir inmediatamente la eliminación
      this.persistToActor().catch(() => this.queueSave());
      this.queueSave();
    }
    return deleted;
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
    let ctx: any = undefined;
    if (updates.baseStats) {
      merged.derivedStats = { ...updates.baseStats } as any;
      ctx = { field: 'baseStats' };
    }
    this.patrols.set(patrolId, merged);
    this.onChange?.(merged, 'update', ctx);
    this.queueSave();
    return merged;
  }

  /** Obtiene todos los patrols actuales */
  public getAll(): Patrol[] {
    return Array.from(this.patrols.values());
  }

  /** Programa guardado debounced a actor flags */
  private queueSave(): void {
    try {
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => {
        this.saveTimer = null;
        this.persistToActor().catch((e) =>
          console.warn('PatrolManager | persistToActor failed:', e)
        );
      }, this.saveDelay);
    } catch (e) {
      console.warn('PatrolManager | queueSave error', e);
    }
  }

  /** Localiza el actor store (creación delegada a GuardOrganizationManager) */
  private findOrgActor(): any | null {
    try {
      if (!game?.actors) return null;
      const matches = game.actors.filter(
        (a: any) => a?.flags?.['guard-management']?.orgStore === true
      );
      return matches[0] || null;
    } catch {
      return null;
    }
  }

  /** Persiste lista completa de patrol snapshots al actor (flag separado) */
  private async persistToActor(): Promise<void> {
    const actor = this.findOrgActor();
    if (!actor) {
      // Reintentar con backoff ligero si actor aún no está listo
      if (this.retryCount < this.maxRetries) {
        const delay = 200 * Math.pow(2, this.retryCount); // 200,400,800,...
        this.retryCount += 1;
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => {
          this.persistToActor().catch((e) =>
            console.warn('PatrolManager | retry persistToActor failed:', e)
          );
        }, delay);
      } else {
        console.warn('PatrolManager | Max retries reached, patrols not persisted yet');
      }
      return;
    }
    // Reset retry counters al encontrar actor
    this.retryCount = 0;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    // Guardar estructura ligera (patrolEffects incluidos)
    const data = this.getAll();
    const current = await actor.getFlag('guard-management', 'patrols');
    // Evitar writes si no hay cambios de versión totales (simple heurística)
    const latestVersion = Math.max(0, ...data.map((p) => p.version || 0));
    const currentLatest = Array.isArray(current)
      ? Math.max(0, ...current.map((p: any) => p.version || 0))
      : -1;
    if (current && latestVersion === currentLatest && (current as any).length === data.length) {
      return;
    }
    await actor.setFlag('guard-management', 'patrols', data);
    // También almacenar resumen simple para debug rápido
    try {
      if ((game as any).user?.isGM) {
        const summary = `Patrols: ${data.length} | vMax ${latestVersion}`;
        if (!actor.system?.details?.biography?.value?.includes('Patrols:')) {
          await actor.update({ 'system.details.biography': { value: summary } });
        }
      }
    } catch {
      /* ignore */
    }
    try {
      window.dispatchEvent(new CustomEvent('guard-patrols-updated'));
    } catch {
      /* ignore */
    }
  }

  /** Carga (si existen) los patrols guardados previamente */
  private async loadFromActor(): Promise<void> {
    try {
      const actor = this.findOrgActor();
      if (!actor) return;
      const stored = await actor.getFlag('guard-management', 'patrols');
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
        console.log('PatrolManager | Loaded patrols from actor flag');
        // Notificar para que UI pueda re-renderizar
        for (const patrol of this.patrols.values()) {
          this.onChange?.(patrol, 'update', { field: 'hydrate' });
        }
        try {
          window.dispatchEvent(new CustomEvent('guard-patrols-updated'));
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      console.warn('PatrolManager | loadFromActor failed:', e);
    }
  }

  /** Establece watchers para actualizarse cuando el actor orgStore cambie */
  private setupActorWatchers(): void {
    try {
      // Evitar registrar múltiples veces
      const key = '__guard_mgmt_patrol_watch';
      if ((game as any)[key]) return;
      (game as any)[key] = true;
      Hooks.on('updateActor', (actor: any, diff: any) => {
        try {
          if (!actor?.flags?.['guard-management']?.orgStore) return;
          // Si cambió flag de patrols, recargar
          if (diff?.flags?.['guard-management']?.patrols !== undefined) {
            this.loadFromActor();
          }
        } catch (e) {
          console.warn('PatrolManager | updateActor watcher error', e);
        }
      });
      Hooks.on('createActor', (actor: any) => {
        try {
          if (actor?.flags?.['guard-management']?.orgStore) {
            // Reintento rápido de carga inicial
            this.loadFromActor();
          }
        } catch {
          /* ignore */
        }
      });
    } catch (e) {
      console.warn('PatrolManager | setupActorWatchers failed', e);
    }
  }
}
