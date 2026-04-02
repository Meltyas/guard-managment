import { AddOrEditPatrolDialog } from '../dialogs/AddOrEditPatrolDialog';
import { GuardOrganizationDialog } from '../dialogs/GuardOrganizationDialog';
import { GuardRollDialog } from '../dialogs/GuardRollDialog';
import { DEFAULT_GUARD_STATS, GuardOrganization, GuardStats, Patrol } from '../types/entities';
import { PatrolChangeOp, PatrolManager } from './PatrolManager';

export class GuardOrganizationManager {
  private organization: GuardOrganization | null = null; // Solo una organización
  private dialog: GuardOrganizationDialog;
  private patrolManager: PatrolManager; // Integration

  constructor() {
    this.dialog = new GuardOrganizationDialog();
    this.patrolManager = new PatrolManager((patrol, op: PatrolChangeOp, ctx) => {
      // Sin snapshots: solo mantenemos la lista de IDs y actualizamos versión
      try {
        if (!this.organization) return;
        if (patrol.organizationId !== this.organization.id) return;
        if (op === 'delete') {
          const idx = this.organization.patrols.indexOf(patrol.id);
          if (idx >= 0) this.organization.patrols.splice(idx, 1);
          this.organization.updatedAt = new Date();
          this.organization.version += 1;
          this.saveOrganization(this.organization);
          return;
        }
        if (!this.organization.patrols.includes(patrol.id)) {
          this.organization.patrols.push(patrol.id);
        }

        // If derived stats changed, we don't need to save organization unless patrol list changed
        if (ctx?.field === 'derivedStats') return;

        if (op === 'create' || ctx?.field === 'patrolEffects' || ctx?.field === 'baseStats') {
          this.patrolManager.recalcDerived(patrol.id, this.calculateEffectiveOrgStats());
        }
        this.organization.updatedAt = new Date();
        this.organization.version += 1;
        this.saveOrganization(this.organization);
      } catch (e) {
        console.warn('GuardOrganizationManager | patrol onChange sync failed', e);
      }
    });
  }

  public async initialize(): Promise<void> {
    console.log('GuardOrganizationManager | Initializing...');
    // Asegurar carga de patrullas persistidas en flags antes de cargar organización
    try {
      await this.patrolManager.initialize();
    } catch (e) {
      console.warn('GuardOrganizationManager | patrolManager initialize failed', e);
    }
    await this.loadOrganization();

    if (this.organization) {
      this.recalcAllPatrols();
    }

    // Si no hay organización, intentar obtenerla del GM o crear una por defecto
    if (!this.organization) {
      if (!(game as any)?.user?.isGM) {
        // Si no somos GM, solicitar sync al GM
        console.log('GuardOrganizationManager | No organization found, requesting sync from GM...');
        await this.requestOrganizationSync();

        // Esperar un poco para que llegue el sync
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await this.loadOrganization();
      }

      // Si aún no hay organización (somos GM o no hubo respuesta), crear por defecto
      if (!this.organization) {
        await this.createDefaultOrganization();
      }
    }

    console.log('GuardOrganizationManager | Initialized successfully');
  }

  /**
   * Crear organización por defecto
   */
  private async createDefaultOrganization(): Promise<void> {
    console.log('GuardOrganizationManager | Creating default organization...');

    const defaultOrg: GuardOrganization = {
      id: foundry.utils.randomID(),
      name: 'Guardia de la Ciudad',
      subtitle: 'Organización de Guardias Principal',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      baseStats: { ...DEFAULT_GUARD_STATS },
      activeModifiers: [],
      resources: [],
      reputation: [],
      patrols: [],
      auxiliaries: [],
      // patrolSnapshots eliminado: datos de patrulla se guardan centralizados en PatrolManager / flags
    } as any;

    await this.saveOrganization(defaultOrg);

    // Semillas iniciales de recursos y reputación (solo GM, y solo si no existen aún)
    await this.seedInitialResourcesAndReputation(defaultOrg.id);

    console.log('GuardOrganizationManager | Default organization created');
  }

  /**
   * Crear recursos y reputaciones iniciales si no existen (idempotente)
   */
  private async seedInitialResourcesAndReputation(orgId: string): Promise<void> {
    try {
      const user = (game as any)?.user;
      if (!user?.isGM) return; // Solo el GM siembra
      if (!game?.items) return;

      const existingForOrg = game.items.filter(
        (i: any) =>
          i.system?.organizationId === orgId && i.type?.startsWith('guard-management.guard-')
      );
      const hasSeedResource = existingForOrg.some(
        (i: any) => i.type === 'guard-management.guard-resource'
      );
      const hasSeedReputation = existingForOrg.some(
        (i: any) => i.type === 'guard-management.guard-reputation'
      );

      // Si ya hay al menos un recurso y una reputación, asumimos que ya se sembró
      if (hasSeedResource && hasSeedReputation) return;

      const createdResourceIds: string[] = [];
      const createdReputationIds: string[] = [];

      // Recursos solicitados
      const resourceSeeds = [
        {
          name: 'Presupuesto',
          description: 'Cada unidad sostiene la operativa de una patrulla estándar',
          quantity: 10,
        },
        {
          name: 'Equipamiento',
          description: 'Cada unidad equipa a una patrulla estándar',
          quantity: 5,
        },
      ];

      // Obtener los managers de los managers globales
      const gm = (window as any).GuardManagement;
      if (!gm?.resourceManager || !gm?.reputationManager) {
        console.error(
          'GuardOrganizationManager | resourceManager or reputationManager not available'
        );
        return;
      }

      for (const r of resourceSeeds) {
        const resource = await gm.resourceManager.createResource({
          ...r,
          organizationId: orgId,
        });
        if (resource?.id) createdResourceIds.push(resource.id);
      }

      // Reputaciones solicitadas (Neutral = nivel 4)
      const reputationSeeds = [
        {
          name: 'Luparanos',
          description: 'La población luparana',
          level: 4,
        },
        {
          name: 'Platas Doradas',
          description: 'La guardia más conocida del Árbol',
          level: 4,
        },
      ];

      for (const rep of reputationSeeds) {
        const reputation = await gm.reputationManager.createReputation({
          ...rep,
          organizationId: orgId,
        });
        if (reputation?.id) createdReputationIds.push(reputation.id);
      }

      if (!this.organization || this.organization.id !== orgId) return;

      if (createdResourceIds.length || createdReputationIds.length) {
        const updated: Partial<GuardOrganization> = {
          resources: [...(this.organization.resources || []), ...createdResourceIds],
          reputation: [...(this.organization.reputation || []), ...createdReputationIds],
          updatedAt: new Date(),
        } as any;

        // Usar updateOrganization para incrementar versión
        await this.updateOrganization(updated);
      }
    } catch (error) {
      console.error('GuardOrganizationManager | Error seeding initial data:', error);
    }
  }

  /**
   * Show dialog to edit the organization (no create, solo edit)
   */
  public async showEditDialog(): Promise<GuardOrganization | null> {
    if (!this.organization) {
      console.warn('GuardOrganizationManager | No organization to edit');
      ui?.notifications?.warn('No hay organización para editar');
      return null;
    }

    const result = await this.dialog.show('edit', this.organization);
    if (result) {
      await this.saveOrganization(result);
      console.log(`GuardOrganizationManager | Updated organization: ${result.name} (${result.id})`);
    }
    return result;
  }

  /**
   * Create a new organization programmatically (reemplaza la existente)
   */
  public async createOrganization(organizationData: {
    name: string;
    subtitle?: string;
    baseStats?: GuardStats;
  }): Promise<GuardOrganization> {
    // Validate required fields
    if (!organizationData.name || organizationData.name.trim().length === 0) {
      throw new Error('Organization name is required and cannot be empty');
    }

    const newOrganization: GuardOrganization = {
      id: foundry.utils.randomID(),
      name: organizationData.name.trim(),
      subtitle: organizationData.subtitle?.trim() || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      baseStats: organizationData.baseStats || { ...DEFAULT_GUARD_STATS },
      activeModifiers: [],
      resources: [],
      reputation: [],
      patrols: [],
      auxiliaries: [],
      // patrolSnapshots removido (se centraliza en PatrolManager)
    } as any;

    await this.saveOrganization(newOrganization);
    return newOrganization;
  }

  /**
   * Update the existing organization
   */
  public async updateOrganization(
    updates: Partial<Omit<GuardOrganization, 'id' | 'version'>>
  ): Promise<GuardOrganization | null> {
    if (!this.organization) {
      console.warn('GuardOrganizationManager | No organization to update');
      return null;
    }

    const updated: GuardOrganization = {
      ...this.organization,
      ...updates,
      id: this.organization.id,
      version: this.organization.version + 1,
    };

    // If baseStats changed, recalculate all patrols
    if (updates.baseStats || updates.activeModifiers) {
      this.organization = updated; // Update local ref first
      this.recalcAllPatrols();
    }

    await this.saveOrganization(updated);
    console.log(`GuardOrganizationManager | Updated organization: ${updated.name}`);
    return updated;
  }

  /**
   * Get the organization
   */
  public getOrganization(): GuardOrganization | null {
    return this.organization;
  }

  /**
   * Get all organizations (solo devuelve la única organización)
   */
  public getAllOrganizations(): GuardOrganization[] {
    return this.organization ? [this.organization] : [];
  }

  /**
   * Delete the organization (reemplaza con una nueva por defecto)
   */
  public async deleteOrganization(): Promise<boolean> {
    if (!this.organization) {
      console.warn('GuardOrganizationManager | No organization to delete');
      return false;
    }

    console.log(`GuardOrganizationManager | Deleting organization: ${this.organization.name}`);
    this.organization = null;
    await this.createDefaultOrganization();

    return true;
  }

  /**
   * Create sample organization for testing (reemplaza la existente)
   */
  public async createSampleOrganization(): Promise<void> {
    const sampleData = {
      name: 'Guardia de la Ciudad',
      subtitle: 'Protectores del Pueblo',
      baseStats: {
        agility: 8,
        strength: 10,
        finesse: 10,
        instinct: 8,
        presence: 10,
        knowledge: 10,
      },
    };

    await this.createOrganization(sampleData);
    console.log('GuardOrganizationManager | Created sample organization for testing');
  }

  /**
   * Save the organization
   */
  private async saveOrganization(
    organization: GuardOrganization,
    broadcast: boolean = true
  ): Promise<void> {
    this.organization = organization;
    await this.saveToSettings(broadcast);
  }

  /**
   * Save organization to game settings
   */
  private async saveToSettings(broadcast: boolean = true): Promise<void> {
    try {
      // Don't save if game is not ready yet
      if (!game?.ready) {
        console.log('GuardOrganizationManager | Skipping save - game not ready yet');
        return;
      }

      // Save to settings - now that we've configured permissions, both GM and Players can save
      await game?.settings?.set('guard-management', 'guardOrganization', this.organization);
      console.log('GuardOrganizationManager | Saved organization to settings', {
        user: game?.user?.name,
        isGM: game?.user?.isGM,
        resources: this.organization?.resources?.length,
        reputation: this.organization?.reputation?.length,
      });

      if (broadcast) this.broadcastOrganization();
    } catch (error) {
      // Si hay error de permisos con settings, simplemente continuar con la sincronización
      if (error instanceof Error && error.message?.includes('lacks permission')) {
        console.warn(
          'GuardOrganizationManager | User lacks permission to save to settings, using socket sync only'
        );
        if (broadcast) this.broadcastOrganization();
      } else {
        console.warn('GuardOrganizationManager | Could not save organization to settings:', error);
        if (broadcast) this.broadcastOrganization();
      }
    }
  }

  /**
   * Broadcast organization to all clients via socket
   */
  private broadcastOrganization(): void {
    if (!game?.socket || !this.organization) return;

    game.socket.emit('module.guard-management', {
      type: 'updateOrganization',
      data: this.organization,
      userId: game.user?.id,
    });

    console.log('GuardOrganizationManager | Broadcasted organization update via socket');
  }

  /**
   * Handle incoming socket messages
   */
  public async handleSocketMessage(data: any): Promise<void> {
    if (!game) return;

    if (data.type === 'openOrganizationDialogForPlayers' && data.userId !== game.user?.id) {
      if ((game as any)?.user?.isGM) return;

      const gm = (window as any).GuardManagement;
      const targetTab = data?.data?.tab || 'general';

      console.log('GuardOrganizationManager | Received open dialog broadcast', {
        tab: targetTab,
        fromUser: data?.userId,
        localUser: game.user?.id,
      });

      try {
        await gm?.guardDialogManager?.showManageOrganizationsDialog(undefined, targetTab);
        ui?.notifications?.info('El GM abrió la vista de organización para ti');
      } catch (error) {
        console.error(
          'GuardOrganizationManager | Error opening organization dialog from GM broadcast:',
          error
        );
      }
      return;
    }

    if (data.type === 'updateOrganization' && data.userId !== game.user?.id) {
      this.organization = data.data;
      console.log('GuardOrganizationManager | Received organization update via socket');

      const isGM = (game as any)?.user?.isGM;
      if (isGM) {
        // Persist without rebroadcast to avoid loops
        await game?.settings?.set('guard-management', 'guardOrganization', this.organization);
        console.log('GuardOrganizationManager | GM persisted received organization to settings');
      }

      if (!(game as any)?.user?.isGM) {
        console.log(
          'GuardOrganizationManager | Non-GM received organization data, stored in memory'
        );
      }

      // Obtener el nombre del usuario que hizo el cambio
      const users = game.users as any;
      const userName = users?.get(data.userId)?.name || 'otro jugador';

      // Opcional: mostrar notificación de que se actualizó
      ui?.notifications?.info(`Organización actualizada por ${userName}`);
    } else if (data.type === 'requestOrganization') {
      // Solo el GM responde con su organización guardada
      if ((game as any)?.user?.isGM && this.organization) {
        console.log('GuardOrganizationManager | GM responding to organization sync request');
        this.broadcastOrganization();
      }
    }
  }

  /**
   * Request current organization from other clients
   */
  public async requestOrganizationSync(): Promise<void> {
    if (!game?.socket) return;

    game.socket.emit('module.guard-management', {
      type: 'requestOrganization',
      userId: game.user?.id,
    });

    console.log('GuardOrganizationManager | Requested organization sync from other clients');
  }

  /**
   * Public alias for loadOrganization - called from settings onChange on all clients
   */
  public async loadFromSettings(): Promise<void> {
    await this.loadOrganization();
  }

  /**
   * Load organization from game settings
   */
  private async loadOrganization(): Promise<void> {
    try {
      const savedOrganization = game?.settings?.get(
        'guard-management',
        'guardOrganization'
      ) as GuardOrganization | null;
      this.organization = savedOrganization;

      // hydrate patrol manager from snapshots if present
      // Ya no hidratamos desde patrolSnapshots; PatrolManager carga desde su propio flag

      if (this.organization) {
        console.log(`GuardOrganizationManager | Loaded organization: ${this.organization.name}`);
        // Fallback: si hay IDs de patrullas pero PatrolManager aún no tiene objetos, esperar un momento
        if (this.organization.patrols?.length) {
          const anyPatrol = this.organization.patrols.some(
            (id) => !!this.patrolManager.getPatrol(id)
          );
          if (!anyPatrol) {
            console.log('GuardOrganizationManager | Waiting for patrols to load from settings...');
          }
          // Migración legacy: si todavía existe una propiedad antigua patrolSnapshots en los datos persistidos
          const legacy: any = this.organization as any;
          if (Array.isArray(legacy.patrolSnapshots) && legacy.patrolSnapshots.length) {
            let migrated = 0;
            for (const snap of legacy.patrolSnapshots) {
              if (!snap?.id) continue;
              if (!this.patrolManager.getPatrol(snap.id)) {
                // Insertar directamente en el map interno (uso interno controlado)
                (this.patrolManager as any).patrols?.set?.(snap.id, { ...snap });
                migrated++;
              }
            }
            if (migrated) {
              console.log(`GuardOrganizationManager | Migrated ${migrated} legacy patrolSnapshots`);
              // Persistir a flags para que quede guardado en el nuevo formato
              try {
                await (this.patrolManager as any).persistToSettings?.();
              } catch {
                /* ignore */
              }
              // Eliminar la propiedad legacy para no re-migrar
              delete legacy.patrolSnapshots;
              // Guardar organización sin la propiedad obsoleta
              await this.saveOrganization(this.organization, false);
            }
          }
        }
      } else {
        console.log('GuardOrganizationManager | No saved organization found');
      }
    } catch (error) {
      console.error('GuardOrganizationManager | Error loading organization:', error);
    }
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.organization = null;
    console.log('GuardOrganizationManager | Cleaned up');
  }

  public getPatrolManager(): PatrolManager {
    return this.patrolManager;
  }

  /** Upsert a patrol snapshot and ensure organization arrays updated & persisted */
  /** @deprecated snapshots eliminados */
  public upsertPatrolSnapshot(_patrol: Patrol): void {
    /* no-op */
  }

  // Helper: create patrol and attach to organization
  public async createPatrolForOrganization(data: {
    name: string;
    baseStats: GuardStats;
  }): Promise<Patrol | null> {
    if (!this.organization) {
      console.warn('GuardOrganizationManager | No organization for patrol creation');
      return null;
    }
    const patrol = await this.patrolManager.createPatrol({
      name: data.name,
      organizationId: this.organization.id,
      baseStats: data.baseStats,
    } as any);
    // Solo guardar ID y actualizar organización
    if (!this.organization.patrols.includes(patrol.id)) this.organization.patrols.push(patrol.id);
    this.organization.updatedAt = new Date();
    this.organization.version += 1;
    this.saveOrganization(this.organization);
    return patrol;
  }

  public listOrganizationPatrols(): Patrol[] {
    if (!this.organization) return [];
    const result: Patrol[] = [];
    let changed = false;
    for (const id of [...this.organization.patrols]) {
      let p = this.patrolManager.getPatrol(id);
      if (!p) {
        // Si no existe, los datos se cargarán automáticamente via settings onChange
        console.warn(`GuardOrganizationManager | Patrol ${id} not found, may load later`);
      }
      if (p) result.push(p);
      else {
        // ID huérfano: limpiar para mantener consistencia
        const idx = this.organization.patrols.indexOf(id);
        if (idx >= 0) {
          this.organization.patrols.splice(idx, 1);
          changed = true;
        }
      }
    }
    if (changed) {
      this.organization.updatedAt = new Date();
      this.organization.version += 1;
      // Guardar silenciosamente (sin broadcast redundante)
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.saveOrganization(this.organization, false);
    }
    return result;
  }

  /**
   * Compatibility helper for older panel bundles that still call listOrganizationAuxiliaries().
   * Auxiliary units are stored as Patrol-like records referenced by organization.auxiliaries.
   */
  public listOrganizationAuxiliaries(): Patrol[] {
    if (!this.organization) return [];

    const auxiliaryIds = Array.isArray((this.organization as any).auxiliaries)
      ? [...((this.organization as any).auxiliaries as string[])]
      : [];

    if (!auxiliaryIds.length) return [];

    const result: Patrol[] = [];
    let changed = false;

    for (const id of auxiliaryIds) {
      const unit = this.patrolManager.getPatrol(id);
      if (unit) {
        result.push(unit);
      } else {
        const idx = (this.organization as any).auxiliaries.indexOf(id);
        if (idx >= 0) {
          (this.organization as any).auxiliaries.splice(idx, 1);
          changed = true;
        }
      }
    }

    if (changed) {
      this.organization.updatedAt = new Date();
      this.organization.version += 1;
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.saveOrganization(this.organization, false);
    }

    return result;
  }

  public removePatrol(patrolId: string): boolean {
    if (!this.organization) return false;
    const idx = this.organization.patrols.indexOf(patrolId);
    if (idx === -1) return false;
    this.organization.patrols.splice(idx, 1);
    // Sin snapshots; nada que eliminar adicional
    this.organization.updatedAt = new Date();
    this.organization.version += 1;
    this.saveOrganization(this.organization);
    return true;
  }

  public recalcAllPatrols(orgModifiers?: Partial<GuardStats>) {
    if (!this.organization) return;
    const modifiers = orgModifiers || this.calculateEffectiveOrgStats();
    for (const pid of this.organization.patrols) {
      this.patrolManager.recalcDerived(pid, modifiers);
    }
  }

  public async openCreatePatrolDialog(): Promise<Patrol | null> {
    if (!this.organization) return null;
    return AddOrEditPatrolDialog.create(this.organization.id);
  }

  public async openEditPatrolDialog(patrolId: string): Promise<Patrol | null> {
    if (!this.organization) return null;
    const patrol = this.patrolManager.getPatrol(patrolId);
    if (!patrol) return null;
    return AddOrEditPatrolDialog.edit(this.organization.id, patrol);
  }

  /**
   * Get active modifier objects
   */
  public getActiveModifiers(): any[] {
    if (!this.organization || !this.organization.activeModifiers?.length) return [];
    const gm = (window as any).GuardManagement;
    if (!gm?.modifierManager) return [];

    const allModifiers = gm.modifierManager.getAllModifiers();
    return allModifiers.filter((m: any) => this.organization!.activeModifiers.includes(m.id));
  }

  /**
   * Remove a modifier from the organization
   */
  public async removeModifier(modifierId: string): Promise<void> {
    if (!this.organization) return;

    const idx = this.organization.activeModifiers.indexOf(modifierId);
    if (idx === -1) return;

    const updatedModifiers = [...this.organization.activeModifiers];
    updatedModifiers.splice(idx, 1);

    await this.updateOrganization({
      activeModifiers: updatedModifiers,
    });
  }

  /**
   * Get detailed stats breakdown for UI
   */
  public getStatsBreakdown(): {
    base: GuardStats;
    total: GuardStats;
    modifiers: Record<keyof GuardStats, Array<{ name: string; img: string; value: number }>>;
  } {
    if (!this.organization) {
      return {
        base: { ...DEFAULT_GUARD_STATS },
        total: { ...DEFAULT_GUARD_STATS },
        modifiers: {
          agility: [],
          strength: [],
          finesse: [],
          instinct: [],
          presence: [],
          knowledge: [],
        },
      };
    }

    const base = { ...this.organization.baseStats };
    const total = { ...base };
    // Build modifiers map from actual keys in base — handles legacy stored keys gracefully
    const modifiers: Record<string, Array<{ name: string; img: string; value: number }>> = {};
    for (const key of Object.keys(base)) {
      modifiers[key] = [];
    }

    const gm = (window as any).GuardManagement;
    if (gm?.modifierManager && this.organization.activeModifiers?.length) {
      const allModifiers = gm.modifierManager.getAllModifiers();

      for (const modId of this.organization.activeModifiers) {
        const modifier = allModifiers.find((m: any) => m.id === modId);
        if (modifier && modifier.statModifications) {
          for (const mod of modifier.statModifications) {
            if (total[mod.statName] !== undefined) {
              total[mod.statName] += mod.value;
              modifiers[mod.statName].push({
                name: modifier.name,
                img: modifier.image || 'icons/svg/item-bag.svg',
                value: mod.value,
              });
            }
          }
        }
      }
    }

    return { base, total, modifiers };
  }

  /**
   * Calculate effective organization stats including modifiers
   */
  public calculateEffectiveOrgStats(): GuardStats {
    if (!this.organization) return { ...DEFAULT_GUARD_STATS };

    const stats = { ...this.organization.baseStats };
    const gm = (window as any).GuardManagement;

    if (gm?.modifierManager && this.organization.activeModifiers?.length) {
      const modifiers = gm.modifierManager.getAllModifiers();

      for (const modId of this.organization.activeModifiers) {
        const modifier = modifiers.find((m: any) => m.id === modId);
        if (modifier && modifier.statModifications) {
          for (const mod of modifier.statModifications) {
            if (stats[mod.statName] !== undefined) {
              stats[mod.statName] += mod.value;
            }
          }
        }
      }
    }

    return stats;
  }

  public async rollStat(stat?: keyof GuardStats): Promise<void> {
    if (!this.organization) return;

    const activeModifiers = this.getActiveModifiers().map((m) => ({ name: m.name, value: 0 }));

    const config: any = await GuardRollDialog.create(
      this.organization,
      activeModifiers,
      (stat as string) || ''
    );
    if (config) {
      await this.performRoll(config);
    }
  }

  private async performRoll(config: any) {
    const DualityRoll = (game as any).system.api.dice.DualityRoll;

    const STAT_LABELS: Record<string, string> = {
      agility: 'Agilidad',
      strength: 'Fuerza',
      finesse: 'Destreza',
      instinct: 'Instinto',
      presence: 'Presencia',
      knowledge: 'Conocimiento',
    };

    // Construct base formula
    let formula = `1${config.roll.dice.dHope} + 1${config.roll.dice.dFear}`;

    const baseStats = this.organization!.baseStats;

    if (config.roll.trait) {
      const stat = config.roll.trait as keyof GuardStats;

      // 1. Base Trait
      const baseValue = baseStats[stat] || 0;
      if (baseValue !== 0) {
        const label = STAT_LABELS[stat] ?? stat;
        formula += ` ${baseValue >= 0 ? '+' : '-'} ${Math.abs(baseValue)}[${label}]`;
      }

      // 2. Active Modifiers
      const gm = (window as any).GuardManagement;
      if (gm?.modifierManager && this.organization!.activeModifiers?.length) {
        const allModifiers = gm.modifierManager.getAllModifiers();
        for (const modId of this.organization!.activeModifiers) {
          const mod = allModifiers.find((m: any) => m.id === modId);
          if (mod && mod.statModifications) {
            for (const change of mod.statModifications) {
              if (change.statName === stat && change.value !== 0) {
                formula += ` ${change.value >= 0 ? '+' : '-'} ${Math.abs(change.value)}[${mod.name}]`;
              }
            }
          }
        }
      }
    }

    const traitsData = {
      agility: { value: baseStats.agility, label: 'Agilidad' },
      strength: { value: baseStats.strength, label: 'Fuerza' },
      finesse: { value: baseStats.finesse, label: 'Destreza' },
      instinct: { value: baseStats.instinct, label: 'Instinto' },
      presence: { value: baseStats.presence, label: 'Presencia' },
      knowledge: { value: baseStats.knowledge, label: 'Conocimiento' },
    };

    const rollData = {
      traits: traitsData,
      bonuses: {},
      rules: { dualityRoll: { defaultHopeDice: 12, defaultFearDice: 12 } },
    };

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

    const rollLabel = {
      type: 'organization',
      name: this.organization!.name,
      stat: STAT_LABELS[config.roll.trait] ?? config.roll.trait ?? '',
    };

    const roll = new DualityRoll(formula, rollData, options);

    // Set advantage properties
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
        speaker: { alias: this.organization!.name },
        sound: (CONFIG as any).sounds.dice,
        system: {
          ...options,
          roll: evaluatedData,
          hasRoll: true,
          title: complexRoll.title,
        },
        rolls: [complexRoll],
        flags: { 'guard-management': { rollLabel } },
      };

      await (ChatMessage as any).create(messageData, { rollMode: config.selectedRollMode });
      return;
    }

    await roll.evaluate();

    const evaluatedData = DualityRoll.postEvaluate(roll, options);
    const messageData = {
      type: 'dualityRoll',
      user: (game as any).user.id,
      speaker: { alias: this.organization!.name },
      sound: (CONFIG as any).sounds.dice,
      system: {
        ...options,
        roll: evaluatedData,
        hasRoll: true,
        title: roll.title,
      },
      rolls: [roll],
      flags: { 'guard-management': { rollLabel } },
    };

    await (ChatMessage as any).create(messageData, { rollMode: config.selectedRollMode });
  }
}
