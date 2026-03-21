/**
 * OfficerManager
 * Manages CRUD operations for patrol officers
 */

import type { Officer, OfficerSkill, OfficerTrait } from '../types/officer';

export class OfficerManager {
  private officers: Map<string, Officer> = new Map();
  private onChange?: (officer: Officer, operation: 'create' | 'update' | 'delete') => void;
  protected settingsKey: string;

  constructor(
    onChange?: (officer: Officer, operation: 'create' | 'update' | 'delete') => void,
    settingsKey: string = 'officers'
  ) {
    this.onChange = onChange;
    this.settingsKey = settingsKey;
  }

  protected get logPrefix(): string {
    return this.settingsKey === 'officers' ? 'OfficerManager' : 'CivilianManager';
  }

  public async initialize(): Promise<void> {
    await this.loadFromSettings();
  }

  public async loadFromSettings(): Promise<void> {
    try {
      const officers = game?.settings?.get('guard-management', this.settingsKey) as Officer[] | null;
      if (officers && Array.isArray(officers)) {
        const deserializedOfficers = officers.map((o) => ({
          ...o,
          // Migrate legacy single skill to skills array
          skills:
            (o as any).skills ||
            ((o as any).skill
              ? [
                  {
                    id: foundry.utils.randomID(),
                    name: (o as any).skill.name,
                    image: (o as any).skill.image,
                    hopeCost: 0,
                  },
                ]
              : []),
          stats: (o as any).stats || {},
          createdAt: o.createdAt ? new Date(o.createdAt) : new Date(),
          updatedAt: o.updatedAt ? new Date(o.updatedAt) : new Date(),
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
        console.log(`${this.logPrefix} | Loaded ${officers.length} officers from settings`);
      }
    } catch (error) {
      console.error(`${this.logPrefix} | Error loading officers:`, error);
    }
  }

  private saveToSettings(): void {
    this._saveToSettingsAsync().catch((error) => {
      console.error(`${this.logPrefix} | Error in background save:`, error);
    });
  }

  private async _saveToSettingsAsync(): Promise<void> {
    try {
      if (!game?.ready) return;

      const officersData = this.export().map((officer) => ({
        id: officer.id,
        name: officer.name,
        actorId: officer.actorId,
        actorName: officer.actorName,
        actorImg: officer.actorImg,
        title: officer.title,
        stats: officer.stats || {},
        skills: (officer.skills || []).map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          image: s.image,
          hopeCost: s.hopeCost,
        })),
        pros: officer.pros.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          createdAt: p.createdAt.toISOString(),
        })),
        cons: officer.cons.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          createdAt: c.createdAt.toISOString(),
        })),
        organizationId: officer.organizationId,
        visibleToPlayers: officer.visibleToPlayers ?? false,
        version: officer.version,
        createdAt: officer.createdAt?.toISOString() ?? new Date().toISOString(),
        updatedAt: officer.updatedAt?.toISOString() ?? new Date().toISOString(),
      }));

      await game?.settings?.set('guard-management', this.settingsKey, officersData);
      console.log(`${this.logPrefix} | Saved ${this.officers.size} officers to settings`);
    } catch (error) {
      console.error(`${this.logPrefix} | Error saving officers:`, error);
    }
  }

  public async create(data: {
    actorId: string;
    actorName: string;
    actorImg?: string;
    title: string;
    stats?: Partial<import('../types/entities').GuardStats>;
    skills?: Omit<OfficerSkill, 'id'>[];
    pros?: Omit<OfficerTrait, 'id' | 'createdAt'>[];
    cons?: Omit<OfficerTrait, 'id' | 'createdAt'>[];
    organizationId?: string;
    visibleToPlayers?: boolean;
  }): Promise<Officer> {
    const id = foundry.utils.randomID();
    const now = new Date();

    const officer: Officer = {
      id,
      name: data.actorName,
      actorId: data.actorId,
      actorName: data.actorName,
      actorImg: data.actorImg,
      title: data.title,
      stats: data.stats || {},
      skills: (data.skills || []).map((s) => ({
        ...s,
        id: foundry.utils.randomID(),
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
      visibleToPlayers: data.visibleToPlayers ?? false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    this.officers.set(id, officer);
    this.onChange?.(officer, 'create');
    await this._saveToSettingsAsync();

    return officer;
  }

  public get(id: string): Officer | undefined {
    return this.officers.get(id);
  }

  public list(): Officer[] {
    return Array.from(this.officers.values());
  }

  public listByOrganization(organizationId: string): Officer[] {
    return this.list().filter((o) => o.organizationId === organizationId);
  }

  public update(
    id: string,
    updates: {
      title?: string;
      stats?: Partial<import('../types/entities').GuardStats>;
      skills?: OfficerSkill[];
      pros?: OfficerTrait[];
      cons?: OfficerTrait[];
      organizationId?: string;
      visibleToPlayers?: boolean;
      actorId?: string;
      actorName?: string;
      actorImg?: string;
    }
  ): Officer | undefined {
    const officer = this.officers.get(id);
    if (!officer) return undefined;

    if (updates.title !== undefined) officer.title = updates.title;
    if (updates.stats !== undefined) officer.stats = updates.stats;
    if (updates.skills !== undefined) officer.skills = updates.skills;
    if (updates.pros !== undefined) officer.pros = updates.pros;
    if (updates.cons !== undefined) officer.cons = updates.cons;
    if (updates.organizationId !== undefined) officer.organizationId = updates.organizationId;
    if (updates.visibleToPlayers !== undefined) officer.visibleToPlayers = updates.visibleToPlayers;
    if (updates.actorId !== undefined) officer.actorId = updates.actorId;
    if (updates.actorName !== undefined) officer.actorName = updates.actorName;
    if (updates.actorImg !== undefined) officer.actorImg = updates.actorImg;

    officer.version += 1;
    officer.updatedAt = new Date();

    this.onChange?.(officer, 'update');
    this.saveToSettings();
    return officer;
  }

  public delete(id: string): boolean {
    const officer = this.officers.get(id);
    if (!officer) return false;

    this.officers.delete(id);
    this.onChange?.(officer, 'delete');
    this.saveToSettings();
    return true;
  }

  public addPro(
    officerId: string,
    trait: Omit<OfficerTrait, 'id' | 'createdAt'>
  ): Officer | undefined {
    const officer = this.officers.get(officerId);
    if (!officer) return undefined;
    officer.pros.push({ ...trait, id: foundry.utils.randomID(), createdAt: new Date() });
    officer.version += 1;
    officer.updatedAt = new Date();
    this.onChange?.(officer, 'update');
    this.saveToSettings();
    return officer;
  }

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

  public addCon(
    officerId: string,
    trait: Omit<OfficerTrait, 'id' | 'createdAt'>
  ): Officer | undefined {
    const officer = this.officers.get(officerId);
    if (!officer) return undefined;
    officer.cons.push({ ...trait, id: foundry.utils.randomID(), createdAt: new Date() });
    officer.version += 1;
    officer.updatedAt = new Date();
    this.onChange?.(officer, 'update');
    this.saveToSettings();
    return officer;
  }

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

  public load(officers: Officer[]): void {
    this.officers.clear();
    officers.forEach((officer) => this.officers.set(officer.id, officer));
  }

  public export(): Officer[] {
    return this.list();
  }

  public clear(): void {
    this.officers.clear();
  }
}
