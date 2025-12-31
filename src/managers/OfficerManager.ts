/**
 * OfficerManager
 * Manages CRUD operations for patrol officers
 */

import type { Officer, OfficerTrait, PatrolSkill } from '../types/officer';

export class OfficerManager {
  private officers: Map<string, Officer> = new Map();
  private onChange?: (officer: Officer, operation: 'create' | 'update' | 'delete') => void;

  constructor(onChange?: (officer: Officer, operation: 'create' | 'update' | 'delete') => void) {
    this.onChange = onChange;
  }

  /**
   * Initialize - load officers from Foundry actor
   */
  public async initialize(): Promise<void> {
    await this.loadFromActor();
  }

  /**
   * Load officers from the organization actor
   */
  private async loadFromActor(): Promise<void> {
    try {
      if (!game?.actors) return;

      // Find organization actor with officers
      const candidates = game.actors.filter(
        (a: any) => a?.flags?.['guard-management']?.orgStore === true
      );

      const actor: any = candidates[0];
      if (!actor) {
        console.log('OfficerManager | No organization actor found');
        return;
      }

      const officers = actor.getFlag('guard-management', 'officers') as Officer[] | undefined;
      if (officers && Array.isArray(officers)) {
        this.load(officers);
        console.log(`OfficerManager | Loaded ${officers.length} officers from actor`);
      }
    } catch (error) {
      console.error('OfficerManager | Error loading officers:', error);
    }
  }

  /**
   * Save officers to the organization actor
   */
  private async saveToActor(): Promise<void> {
    try {
      if (!game?.actors) return;

      // Find organization actor
      const candidates = game.actors.filter(
        (a: any) => a?.flags?.['guard-management']?.orgStore === true
      );

      let actor: any = candidates[0];

      // If no actor exists and user is GM, create one
      if (!actor && (game as any).user?.isGM) {
        console.log('OfficerManager | Creating organization actor for officers');
        const fallbackType = (CONFIG as any).Actor?.type || 'character';
        actor = await (game as any).actors.documentClass.create({
          name: 'Guard Organization Data',
          type: fallbackType,
          flags: {
            'guard-management': {
              orgStore: true,
            },
          },
        });
      }

      if (!actor) {
        console.warn('OfficerManager | No actor available to save officers');
        return;
      }

      // Save officers to actor flags
      await actor.setFlag('guard-management', 'officers', this.export());
      console.log(`OfficerManager | Saved ${this.officers.size} officers to actor`);
    } catch (error) {
      console.error('OfficerManager | Error saving officers:', error);
    }
  }

  /**
   * Create a new officer
   */
  public create(data: {
    actorId: string;
    actorName: string;
    actorImg?: string;
    title: string;
    patrolSkills?: Omit<PatrolSkill, 'id' | 'createdAt'>[];
    pros?: Omit<OfficerTrait, 'id' | 'createdAt'>[];
    cons?: Omit<OfficerTrait, 'id' | 'createdAt'>[];
    organizationId?: string;
  }): Officer {
    const id = foundry.utils.randomID();
    const now = new Date();

    const officer: Officer = {
      id,
      name: data.actorName, // Use actor name as officer name
      actorId: data.actorId,
      actorName: data.actorName,
      actorImg: data.actorImg,
      title: data.title,
      patrolSkills: (data.patrolSkills || []).map((s) => ({
        ...s,
        id: foundry.utils.randomID(),
        createdAt: now,
      })),
      pros: (data.pros || []).map((p) => ({
        ...p,
        id: foundry.utils.randomID(),
        createdAt: now,
      })),
      cons: (data.cons || []).map((c) => ({
        ...c,
        id: foundry.utils.randomID(),
        createdAt: now,
      })),
      organizationId: data.organizationId,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    this.officers.set(id, officer);
    this.onChange?.(officer, 'create');
    this.saveToActor(); // Persist to Foundry

    return officer;
  }

  /**
   * Get officer by ID
   */
  public get(id: string): Officer | undefined {
    return this.officers.get(id);
  }

  /**
   * List all officers
   */
  public list(): Officer[] {
    return Array.from(this.officers.values());
  }

  /**
   * List officers by organization
   */
  public listByOrganization(organizationId: string): Officer[] {
    return this.list().filter((o) => o.organizationId === organizationId);
  }

  /**
   * Update an existing officer
   */
  public update(
    id: string,
    updates: {
      title?: string;
      patrolSkills?: PatrolSkill[];
      pros?: OfficerTrait[];
      cons?: OfficerTrait[];
      organizationId?: string;
    }
  ): Officer | undefined {
    const officer = this.officers.get(id);
    if (!officer) return undefined;

    if (updates.title !== undefined) officer.title = updates.title;
    if (updates.patrolSkills !== undefined) officer.patrolSkills = updates.patrolSkills;
    if (updates.pros !== undefined) officer.pros = updates.pros;
    if (updates.cons !== undefined) officer.cons = updates.cons;
    if (updates.organizationId !== undefined) officer.organizationId = updates.organizationId;

    officer.version += 1;
    officer.updatedAt = new Date();

    this.onChange?.(officer, 'update');
    this.saveToActor();
    return officer;
  }

  /**
   * Delete an officer
   */
  public delete(id: string): boolean {
    const officer = this.officers.get(id);
    if (!officer) return false;

    this.officers.delete(id);
    this.onChange?.(officer, 'delete');
    this.saveToActor();
    return true;
  }

  /**
   * Add a pro to an officer
   */
  public addPro(
    officerId: string,
    trait: Omit<OfficerTrait, 'id' | 'createdAt'>
  ): Officer | undefined {
    const officer = this.officers.get(officerId);
    if (!officer) return undefined;

    const newPro: OfficerTrait = {
      ...trait,
      id: foundry.utils.randomID(),
      createdAt: new Date(),
    };

    officer.pros.push(newPro);
    officer.version += 1;
    officer.updatedAt = new Date();

    this.onChange?.(officer, 'update');
    this.saveToActor();
    return officer;
  }

  /**
   * Remove a pro from an officer
   */
  public removePro(officerId: string, proId: string): Officer | undefined {
    const officer = this.officers.get(officerId);
    if (!officer) return undefined;

    officer.pros = officer.pros.filter((p) => p.id !== proId);
    officer.version += 1;
    officer.updatedAt = new Date();

    this.onChange?.(officer, 'update');
    this.saveToActor();
    return officer;
  }

  /**
   * Add a con to an officer
   */
  public addCon(
    officerId: string,
    trait: Omit<OfficerTrait, 'id' | 'createdAt'>
  ): Officer | undefined {
    const officer = this.officers.get(officerId);
    if (!officer) return undefined;

    const newCon: OfficerTrait = {
      ...trait,
      id: foundry.utils.randomID(),
      createdAt: new Date(),
    };

    officer.cons.push(newCon);
    officer.version += 1;
    officer.updatedAt = new Date();

    this.onChange?.(officer, 'update');
    this.saveToActor();
    return officer;
  }

  /**
   * Remove a con from an officer
   */
  public removeCon(officerId: string, conId: string): Officer | undefined {
    const officer = this.officers.get(officerId);
    if (!officer) return undefined;

    officer.cons = officer.cons.filter((c) => c.id !== conId);
    officer.version += 1;
    officer.updatedAt = new Date();

    this.onChange?.(officer, 'update');
    this.saveToActor();
    return officer;
  }

  /**
   * Load officers from data
   */
  public load(officers: Officer[]): void {
    this.officers.clear();
    officers.forEach((officer) => {
      this.officers.set(officer.id, officer);
    });
  }

  /**
   * Export all officers
   */
  public export(): Officer[] {
    return this.list();
  }

  /**
   * Clear all officers
   */
  public clear(): void {
    this.officers.clear();
  }
}
