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
   * Initialize - load officers from world settings
   */
  public async initialize(): Promise<void> {
    await this.loadFromSettings();
  }

  /**
   * Load officers from world settings (public for onChange callback)
   */
  public async loadFromSettings(): Promise<void> {
    try {
      const officers = game?.settings?.get('guard-management', 'officers') as Officer[] | null;
      if (officers && Array.isArray(officers)) {
        // Deserialize dates
        const deserializedOfficers = officers.map((o) => ({
          ...o,
          createdAt: o.createdAt ? new Date(o.createdAt) : new Date(),
          updatedAt: o.updatedAt ? new Date(o.updatedAt) : new Date(),
          patrolSkills: (o.patrolSkills || []).map((s) => ({
            ...s,
            createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
          })),
          pros: (o.pros || []).map((p) => ({
            ...p,
            createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
          })),
          cons: (o.cons || []).map((c) => ({
            ...c,
            createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
          })),
        }));
        this.load(deserializedOfficers);
        console.log(`OfficerManager | Loaded ${officers.length} officers from settings`);
      }
    } catch (error) {
      console.error('OfficerManager | Error loading officers:', error);
    }
  }

  /**
   * Save officers to world settings (fire-and-forget)
   */
  private saveToSettings(): void {
    this._saveToSettingsAsync().catch((error) => {
      console.error('OfficerManager | Error in background save:', error);
    });
  }

  /**
   * Internal async save method to world settings (synchronized for all users)
   */
  private async _saveToSettingsAsync(): Promise<void> {
    try {
      const user = game?.user as any;
      if (!user?.isGM) {
        console.warn('OfficerManager | Only GM can save officers to settings');
        return;
      }

      // Serialize officers data with plain objects and ISO dates
      const officersData = this.export().map(officer => ({
        id: officer.id,
        name: officer.name,
        actorId: officer.actorId,
        actorName: officer.actorName,
        actorImg: officer.actorImg,
        title: officer.title,
        patrolSkills: officer.patrolSkills.map(s => ({
          id: s.id,
          title: s.title,
          description: s.description,
          hopeCost: s.hopeCost,
          createdAt: s.createdAt.toISOString()
        })),
        pros: officer.pros.map(p => ({
          id: p.id,
          title: p.title,
          description: p.description,
          createdAt: p.createdAt.toISOString()
        })),
        cons: officer.cons.map(c => ({
          id: c.id,
          title: c.title,
          description: c.description,
          createdAt: c.createdAt.toISOString()
        })),
        organizationId: officer.organizationId,
        version: officer.version,
        createdAt: officer.createdAt.toISOString(),
        updatedAt: officer.updatedAt.toISOString()
      }));

      // Save to world settings - automatically syncs to all clients
      await game?.settings?.set('guard-management', 'officers', officersData);

      console.log(`OfficerManager | Saved ${this.officers.size} officers to settings`);
    } catch (error) {
      console.error('OfficerManager | Error saving officers:', error);
    }
  }

  /**
   * Create a new officer
   */
  public async create(data: {
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
    await this._saveToSettingsAsync();

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
    this.saveToSettings();
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
    this.saveToSettings();
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
    this.saveToSettings();
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
    this.saveToSettings();
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
    this.saveToSettings();
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
    this.saveToSettings();
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
