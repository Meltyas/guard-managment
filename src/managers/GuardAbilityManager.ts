/**
 * GuardAbilityManager — stores guard abilities / favors.
 *
 * Abilities are Daggerheart-style cards the guard has acquired.
 * They can have a cost description, an image and rich HTML body.
 */

export interface GuardAbility {
  id: string;
  name: string;
  img: string;
  description: string; // Rich HTML — main ability text (includes cost)
  cost: string;        // Short cost label (e.g. "2 Esperanza", "1 turno", "")
  category: string;    // Free-text category / tag
  createdAt: number;
}

export class GuardAbilityManager {
  private abilities: Map<string, GuardAbility> = new Map();

  public async initialize(): Promise<void> {
    await this.loadFromSettings();
  }

  public async loadFromSettings(): Promise<void> {
    const data = game?.settings?.get('guard-management', 'guardAbilities') as GuardAbility[];
    if (Array.isArray(data)) {
      this.abilities.clear();
      for (const item of data) this.abilities.set(item.id, item);
    }
  }

  private async _save(): Promise<void> {
    await game?.settings?.set(
      'guard-management',
      'guardAbilities',
      Array.from(this.abilities.values())
    );
  }

  public getAllAbilities(): GuardAbility[] {
    return Array.from(this.abilities.values());
  }

  public getAbility(id: string): GuardAbility | undefined {
    return this.abilities.get(id);
  }

  public async createAbility(data: Partial<GuardAbility>): Promise<GuardAbility> {
    const ability: GuardAbility = {
      id: foundry.utils.randomID(),
      name: data.name ?? 'Nueva Habilidad',
      img: data.img ?? 'icons/svg/book.svg',
      description: data.description ?? '',
      cost: data.cost ?? '',
      category: data.category ?? '',
      createdAt: Date.now(),
    };
    this.abilities.set(ability.id, ability);
    await this._save();
    window.dispatchEvent(new CustomEvent('guard-management:abilities-changed'));
    return ability;
  }

  public async updateAbility(id: string, updates: Partial<GuardAbility>): Promise<GuardAbility | null> {
    const ability = this.abilities.get(id);
    if (!ability) return null;
    const updated = { ...ability, ...updates, id };
    this.abilities.set(id, updated);
    await this._save();
    window.dispatchEvent(new CustomEvent('guard-management:abilities-changed'));
    return updated;
  }

  public async deleteAbility(id: string): Promise<boolean> {
    const deleted = this.abilities.delete(id);
    if (deleted) {
      await this._save();
      window.dispatchEvent(new CustomEvent('guard-management:abilities-changed'));
    }
    return deleted;
  }
}
