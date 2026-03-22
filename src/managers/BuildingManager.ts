/**
 * Building Manager - Manages buildings using game.settings
 */
import type { Building, BuildingGangLink, BuildingTag } from '../types/buildings';

export class BuildingManager {
  private buildings: Map<string, Building> = new Map();

  public async initialize(): Promise<void> {
    await this.loadFromSettings();
    console.log('BuildingManager | Initialized');
  }

  // --- Settings persistence ---

  public async loadFromSettings(): Promise<void> {
    try {
      const buildings = game?.settings?.get('guard-management', 'buildings' as any) as
        | Building[]
        | null;
      if (buildings && Array.isArray(buildings)) {
        this.buildings.clear();
        for (const b of buildings) {
          if (!Array.isArray(b.tags)) b.tags = [];
          if (typeof b.description !== 'string') b.description = '';
          this.buildings.set(b.id, b);
        }
        console.log(`BuildingManager | Loaded ${buildings.length} buildings from settings`);
      }
    } catch (e) {
      console.warn('BuildingManager | loadFromSettings failed:', e);
    }
  }

  private async _saveToSettingsAsync(): Promise<void> {
    try {
      if (!game?.ready) return;
      const data = Array.from(this.buildings.values());
      await game?.settings?.set('guard-management', 'buildings' as any, data);
      console.log(`BuildingManager | Saved ${data.length} buildings to settings`);
    } catch (error) {
      console.error('BuildingManager | Error saving buildings:', error);
    }
  }

  // --- CRUD ---

  public getAllBuildings(): Building[] {
    return Array.from(this.buildings.values());
  }

  public getBuilding(id: string): Building | null {
    return this.buildings.get(id) || null;
  }

  public async addBuilding(data: {
    name: string;
    description?: string;
    img?: string;
    tags?: BuildingTag[];
    gangLink?: BuildingGangLink;
  }): Promise<Building> {
    const id = foundry.utils.randomID();
    const now = Date.now();
    const building: Building = {
      id,
      name: data.name,
      description: data.description || '',
      img: data.img,
      tags: data.tags || [],
      gangLink: data.gangLink,
      createdAt: now,
      updatedAt: now,
    };
    this.buildings.set(id, building);
    await this._saveToSettingsAsync();
    return building;
  }

  public async updateBuilding(id: string, updates: Partial<Building>): Promise<Building | null> {
    const building = this.buildings.get(id);
    if (!building) return null;
    const updated: Building = {
      ...building,
      ...updates,
      id: building.id,
      updatedAt: Date.now(),
    };
    this.buildings.set(id, updated);
    await this._saveToSettingsAsync();
    return updated;
  }

  public async deleteBuilding(id: string): Promise<boolean> {
    const deleted = this.buildings.delete(id);
    if (deleted) {
      await this._saveToSettingsAsync();
    }
    return deleted;
  }

  public getCount(): number {
    return this.buildings.size;
  }

  public getBuildingsByTag(tag: BuildingTag): Building[] {
    return this.getAllBuildings().filter((b) => b.tags.includes(tag));
  }

  public getBuildingsByGang(gangId: string): Building[] {
    return this.getAllBuildings().filter((b) => b.gangLink?.gangId === gangId);
  }
}
