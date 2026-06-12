/**
 * DecisionManager — stores guard decisions as a talent-tree structure.
 *
 * Each decision has a grid position (col, row), optional parent connections,
 * and visibility state. The GM controls what players can see.
 *
 * States:
 *   visible: false           → hidden (GM sees dimmed; players don't see it)
 *   visible: true, 'locked'  → shown as locked/future (padlock, dimmed)
 *   visible: true, 'unlocked'→ fully revealed
 *
 * Sections group decisions into separate trees (e.g. "Internas", "Sociales").
 */

export type DecisionState = 'locked' | 'unlocked';

export interface DecisionSection {
  id: string;
  name: string;
  order: number; // display order (0-based)
}

export interface GuardDecision {
  id: string;
  name: string;
  img: string;
  description: string; // Rich HTML
  col: number;         // Grid column (0-based)
  row: number;         // Grid row (0-based)
  parentIds: string[]; // IDs of decisions this connects FROM (incoming edges)
  visible: boolean;    // Whether players can see this node at all
  state: DecisionState;// 'locked' = visible but unavailable; 'unlocked' = available
  section: string;     // ID of the DecisionSection this node belongs to
  createdAt: number;
}

export class DecisionManager {
  private decisions: Map<string, GuardDecision> = new Map();
  private sections: Map<string, DecisionSection> = new Map();

  public async initialize(): Promise<void> {
    await this.loadSectionsFromSettings();
    await this.loadFromSettings();
  }

  // ─── Sections ────────────────────────────────────────────────────────────

  public async loadSectionsFromSettings(): Promise<void> {
    const data = game?.settings?.get('guard-management', 'decisionSections') as DecisionSection[];
    if (Array.isArray(data) && data.length > 0) {
      this.sections.clear();
      for (const s of data) this.sections.set(s.id, s);
    } else {
      // Default section so existing trees still work
      if (this.sections.size === 0) {
        const def: DecisionSection = { id: 'default', name: 'Árbol Principal', order: 0 };
        this.sections.set(def.id, def);
      }
    }
  }

  private async _saveSections(): Promise<void> {
    await game?.settings?.set(
      'guard-management',
      'decisionSections',
      Array.from(this.sections.values())
    );
  }

  public getAllSections(): DecisionSection[] {
    return Array.from(this.sections.values()).sort((a, b) => a.order - b.order);
  }

  public getSection(id: string): DecisionSection | undefined {
    return this.sections.get(id);
  }

  public async createSection(data: Partial<DecisionSection>): Promise<DecisionSection> {
    const maxOrder = Math.max(-1, ...Array.from(this.sections.values()).map((s) => s.order));
    const section: DecisionSection = {
      id: foundry.utils.randomID(),
      name: data.name ?? 'Nueva Sección',
      order: data.order ?? maxOrder + 1,
    };
    this.sections.set(section.id, section);
    await this._saveSections();
    window.dispatchEvent(new CustomEvent('guard-management:decisions-changed'));
    return section;
  }

  public async updateSection(id: string, updates: Partial<DecisionSection>): Promise<DecisionSection | null> {
    const section = this.sections.get(id);
    if (!section) return null;
    const updated: DecisionSection = { ...section, ...updates, id };
    this.sections.set(id, updated);
    await this._saveSections();
    window.dispatchEvent(new CustomEvent('guard-management:decisions-changed'));
    return updated;
  }

  public async deleteSection(id: string): Promise<boolean> {
    if (!this.sections.has(id)) return false;
    // Reassign nodes belonging to deleted section to 'default'
    const fallback = this.getAllSections().find((s) => s.id !== id)?.id ?? 'default';
    for (const [, dec] of this.decisions) {
      if (dec.section === id) dec.section = fallback;
    }
    this.sections.delete(id);
    await this._saveSections();
    await this._save();
    window.dispatchEvent(new CustomEvent('guard-management:decisions-changed'));
    return true;
  }

  // ─── Decisions ────────────────────────────────────────────────────────────

  public async loadFromSettings(): Promise<void> {
    const data = game?.settings?.get('guard-management', 'decisions') as GuardDecision[];
    // Ensure at least one section exists before loading nodes
    if (this.sections.size === 0) {
      const def: DecisionSection = { id: 'default', name: 'Árbol Principal', order: 0 };
      this.sections.set(def.id, def);
    }
    const defaultSectionId = this.getAllSections()[0]?.id ?? 'default';

    if (Array.isArray(data)) {
      this.decisions.clear();
      for (const item of data) {
        // Migrate old entries that lack new fields
        const migrated: GuardDecision = {
          ...item,
          col: item.col ?? 0,
          row: item.row ?? 0,
          parentIds: item.parentIds ?? [],
          visible: item.visible ?? true,
          state: item.state ?? 'unlocked',
          section: item.section ?? defaultSectionId,
        };
        this.decisions.set(migrated.id, migrated);
      }
    }
  }

  private async _save(): Promise<void> {
    await game?.settings?.set(
      'guard-management',
      'decisions',
      Array.from(this.decisions.values())
    );
  }

  public getAllDecisions(): GuardDecision[] {
    return Array.from(this.decisions.values());
  }

  public getDecision(id: string): GuardDecision | undefined {
    return this.decisions.get(id);
  }

  public async createDecision(data: Partial<GuardDecision>): Promise<GuardDecision> {
    const defaultSectionId = this.getAllSections()[0]?.id ?? 'default';
    const decision: GuardDecision = {
      id: foundry.utils.randomID(),
      name: data.name ?? 'Nueva Decisión',
      img: data.img ?? 'icons/svg/d20-grey.svg',
      description: data.description ?? '',
      col: data.col ?? 0,
      row: data.row ?? 0,
      parentIds: data.parentIds ?? [],
      visible: data.visible ?? false,
      state: data.state ?? 'locked',
      section: data.section ?? defaultSectionId,
      createdAt: Date.now(),
    };
    this.decisions.set(decision.id, decision);
    await this._save();
    window.dispatchEvent(new CustomEvent('guard-management:decisions-changed'));
    return decision;
  }

  public async updateDecision(id: string, updates: Partial<GuardDecision>): Promise<GuardDecision | null> {
    const decision = this.decisions.get(id);
    if (!decision) return null;
    const updated: GuardDecision = { ...decision, ...updates, id };
    this.decisions.set(id, updated);
    await this._save();
    window.dispatchEvent(new CustomEvent('guard-management:decisions-changed'));
    return updated;
  }

  public async deleteDecision(id: string): Promise<boolean> {
    // Also remove this id from any parentIds references
    for (const [, dec] of this.decisions) {
      if (dec.parentIds.includes(id)) {
        dec.parentIds = dec.parentIds.filter((p) => p !== id);
      }
    }
    const deleted = this.decisions.delete(id);
    if (deleted) {
      await this._save();
      window.dispatchEvent(new CustomEvent('guard-management:decisions-changed'));
    }
    return deleted;
  }
}
