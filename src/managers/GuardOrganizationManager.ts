import { AddOrEditPatrolDialog } from '../dialogs/AddOrEditPatrolDialog';
import { GuardOrganizationDialog } from '../dialogs/GuardOrganizationDialog';
import { createGuardReputation, createGuardResource } from '../documents/index';
import { DEFAULT_GUARD_STATS, GuardOrganization, GuardStats, Patrol } from '../types/entities';
import { PatrolManager } from './PatrolManager';

export class GuardOrganizationManager {
  private organization: GuardOrganization | null = null; // Solo una organización
  private dialog: GuardOrganizationDialog;
  private patrolManager: PatrolManager; // Integration

  constructor() {
    this.dialog = new GuardOrganizationDialog();
    this.patrolManager = new PatrolManager();
  }

  public async initialize(): Promise<void> {
    console.log('GuardOrganizationManager | Initializing...');
    await this.loadOrganization();

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
      patrolSnapshots: [], // ensure initialization
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

      for (const r of resourceSeeds) {
        const doc: any = await createGuardResource({
          ...r,
          organizationId: orgId,
        });
        if (doc?.id) createdResourceIds.push(doc.id);
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
        const doc: any = await createGuardReputation({
          ...rep,
          organizationId: orgId,
        });
        if (doc?.id) createdReputationIds.push(doc.id);
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
      patrolSnapshots: [],
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
      baseStats: { robustismo: 12, analitica: 10, subterfugio: 8, elocuencia: 11 },
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
      // Solo el GM guarda en settings como backup (usando duck typing para evitar problemas de tipos)
      const user = game?.user as any;
      if (user?.isGM) {
        await game?.settings?.set('guard-management', 'guardOrganization', this.organization);
        console.log('GuardOrganizationManager | Saved organization to settings (GM backup)');
      }
      // Siempre intentar persistir en un Actor compartido para que jugadores puedan editar
      await this.saveToActor();
      if (broadcast) this.broadcastOrganization();
    } catch (error) {
      // Si hay error de permisos con settings, simplemente continuar con la sincronización
      if (error instanceof Error && error.message?.includes('lacks permission')) {
        console.log(
          'GuardOrganizationManager | User lacks permission to save to settings, using socket sync only'
        );
        await this.saveToActor();
        if (broadcast) this.broadcastOrganization();
      } else {
        console.warn('GuardOrganizationManager | Could not save organization to settings:', error);
        await this.saveToActor();
        if (broadcast) this.broadcastOrganization();
      }
    }
  }

  /** Persist organization into a dedicated Actor so players (with permissions) can modify */
  private async saveToActor(): Promise<void> {
    try {
      if (!this.organization) return;
      if (!game?.actors) return;
      // Buscar actor existente por flag
      const candidates = game.actors.filter(
        (a: any) => a?.flags?.['guard-management']?.orgStore === true
      );
      let actor: any = candidates[0];
      if (!actor) {
        // Crear actor si GM; si no, abortar silenciosamente
        if (!(game as any).user?.isGM) return;
        const fallbackType = (CONFIG as any).Actor?.type || 'character';
        // Asegurar carpeta
        let folder: any = null;
        try {
          const allFolders: any[] = (game as any).folders?.contents || [];
          folder =
            allFolders.find((f) => f.type === 'Actor' && f.name === 'Guard Management') || null;
          if (!folder) {
            folder = await (Folder as any).create({
              name: 'Guard Management',
              type: 'Actor',
              parent: null,
            });
            console.log('GuardOrganizationManager | Created folder Guard Management');
          }
        } catch {
          /* ignore */
        }
        actor = await (Actor as any).create({
          name: 'Guard Organization Store',
          type: fallbackType,
          flags: { 'guard-management': { orgStore: true } },
          ownership: { default: 3 }, // OBSERVER por defecto
          folder: folder?.id || null,
        });
        console.log('GuardOrganizationManager | Created organization actor store');
      }
      // Ensure actor in folder if GM
      if ((game as any).user?.isGM) {
        try {
          const allFolders: any[] = (game as any).folders?.contents || [];
          const targetFolder =
            allFolders.find((f) => f.type === 'Actor' && f.name === 'Guard Management') || null;
          if (targetFolder && actor.folder?.id !== targetFolder.id) {
            await actor.update({ folder: targetFolder.id });
            console.log(
              'GuardOrganizationManager | Moved organization actor to Guard Management folder'
            );
          }
        } catch {
          /* ignore */
        }
      }
      const current = actor?.getFlag('guard-management', 'organization');
      // Solo actualizar si versión nueva para evitar writes innecesarios
      if (!current || current.version !== this.organization.version) {
        await actor.setFlag('guard-management', 'organization', this.organization);
        // Guardar una copia ligera también en notas (opcional) para fácil inspección
        try {
          const summary = `${this.organization.name} v${this.organization.version} | Patrols: ${this.organization.patrols?.length || 0}`;
          // No sobreescribir bio largo existente
          if (!actor.system?.details?.biography || actor.system.details.biography === '') {
            await actor.update({ 'system.details.biography': { value: summary } });
          }
        } catch {
          /* ignore */
        }
        console.log('GuardOrganizationManager | Saved organization to actor flags');
      }
    } catch (e) {
      console.warn('GuardOrganizationManager | saveToActor failed:', e);
    }
  }

  /** Load from actor if available; used mainly for players */
  private async loadFromActor(): Promise<boolean> {
    try {
      if (!game?.actors) return false;
      const matches = game.actors.filter(
        (a: any) => a?.flags?.['guard-management']?.orgStore === true
      );
      const actor: any = matches[0];
      if (!actor) return false;
      const data = await actor.getFlag('guard-management', 'organization');
      if (data) {
        this.organization = data as any;
        console.log('GuardOrganizationManager | Loaded organization from actor flags');
        return true;
      }
    } catch (e) {
      console.warn('GuardOrganizationManager | loadFromActor failed:', e);
    }
    return false;
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
   * Load organization from game settings
   */
  private async loadOrganization(): Promise<void> {
    try {
      // Intentar primero actor (para que jugadores reciban datos actualizados si GM ya los puso allí)
      const actorLoaded = await this.loadFromActor();
      let savedOrganization: GuardOrganization | null = null;
      if (!actorLoaded) {
        savedOrganization = game?.settings?.get(
          'guard-management',
          'guardOrganization'
        ) as GuardOrganization | null;
        this.organization = savedOrganization;
      }

      // hydrate patrol manager from snapshots if present
      if (this.organization?.patrolSnapshots && Array.isArray(this.organization.patrolSnapshots)) {
        for (const snap of this.organization.patrolSnapshots) {
          // recreate minimal patrols inside patrolManager map
          this.patrolManager['patrols']?.set?.(snap.id, { ...snap });
        }
      }

      if (this.organization) {
        console.log(`GuardOrganizationManager | Loaded organization: ${this.organization.name}`);
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
  public upsertPatrolSnapshot(patrol: Patrol): void {
    if (!this.organization) return;
    // ensure id in patrols list
    if (!this.organization.patrols.includes(patrol.id)) {
      this.organization.patrols.push(patrol.id);
    }
    // ensure snapshots array exists
    this.organization.patrolSnapshots = this.organization.patrolSnapshots || [];
    const idx = this.organization.patrolSnapshots.findIndex((p) => p.id === patrol.id);
    if (idx >= 0) {
      this.organization.patrolSnapshots[idx] = patrol;
    } else {
      this.organization.patrolSnapshots.push(patrol);
    }
    this.organization.updatedAt = new Date();
    this.organization.version += 1;
    // Persist (broadcast handled inside)
    this.saveOrganization(this.organization);
  }

  // Helper: create patrol and attach to organization
  public createPatrolForOrganization(data: { name: string; baseStats: GuardStats }): Patrol | null {
    if (!this.organization) {
      console.warn('GuardOrganizationManager | No organization for patrol creation');
      return null;
    }
    const patrol = this.patrolManager.createPatrol({
      name: data.name,
      organizationId: this.organization.id,
      baseStats: data.baseStats,
    } as any);
    this.upsertPatrolSnapshot(patrol);
    return patrol;
  }

  public listOrganizationPatrols(): Patrol[] {
    if (!this.organization) return [];
    return this.organization.patrols
      .map((id) => this.patrolManager.getPatrol(id))
      .filter((p): p is Patrol => !!p);
  }

  public removePatrol(patrolId: string): boolean {
    if (!this.organization) return false;
    const idx = this.organization.patrols.indexOf(patrolId);
    if (idx === -1) return false;
    this.organization.patrols.splice(idx, 1);
    if (this.organization.patrolSnapshots) {
      this.organization.patrolSnapshots = this.organization.patrolSnapshots.filter(
        (p) => p.id !== patrolId
      );
    }
    this.organization.updatedAt = new Date();
    this.organization.version += 1;
    this.saveOrganization(this.organization);
    return true;
  }

  public recalcAllPatrols(orgModifiers?: Partial<GuardStats>) {
    if (!this.organization) return;
    for (const pid of this.organization.patrols) {
      this.patrolManager.recalcDerived(pid, orgModifiers);
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
}
