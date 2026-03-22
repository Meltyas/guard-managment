/**
 * Gang Manager - Manages gangs using game.settings
 * History is stored per-gang, not as a global log.
 */
import type { Gang, GangAction, GangHistoryEntry, GangMember } from '../types/gangs';

export class GangManager {
  private gangs: Map<string, Gang> = new Map();

  public async initialize(): Promise<void> {
    await this.loadFromSettings();
    console.log('GangManager | Initialized');
  }

  // --- Settings persistence ---

  public async loadFromSettings(): Promise<void> {
    try {
      const gangs = game?.settings?.get('guard-management', 'gangs' as any) as Gang[] | null;
      if (gangs && Array.isArray(gangs)) {
        this.gangs.clear();
        for (const g of gangs) {
          // Migration: ensure arrays exist
          if (!g.history) g.history = [];
          if (!Array.isArray(g.leaders)) g.leaders = [];
          if (!Array.isArray(g.subleaders)) g.subleaders = [];
          if (!Array.isArray(g.members)) g.members = [];
          if (typeof g.notes !== 'string') g.notes = '';
          if (!g.status) g.status = 'active';
          this.gangs.set(g.id, g);
        }
        console.log(`GangManager | Loaded ${gangs.length} gangs from settings`);
      }
    } catch (e) {
      console.warn('GangManager | loadFromSettings failed:', e);
    }
  }

  private async _saveToSettingsAsync(): Promise<void> {
    try {
      if (!game?.ready) return;
      const data = Array.from(this.gangs.values());
      await game?.settings?.set('guard-management', 'gangs' as any, data);
      console.log(`GangManager | Saved ${data.length} gangs to settings`);
    } catch (error) {
      console.error('GangManager | Error saving gangs:', error);
    }
  }

  // --- Helpers ---

  private getUserName(): string {
    return (game as any)?.user?.name || 'Unknown';
  }

  private addHistoryEntry(gang: Gang, action: GangAction, details?: string): void {
    const gm = (window as any).GuardManagement;
    const currentTurn = gm?.phaseManager?.getCurrentTurn() ?? undefined;
    const entry: GangHistoryEntry = {
      action,
      timestamp: Date.now(),
      performedBy: this.getUserName(),
      details,
      phase: currentTurn,
    };
    gang.history.push(entry);
  }

  public async removeHistoryEntry(gangId: string, timestamp: number): Promise<boolean> {
    const gang = this.gangs.get(gangId);
    if (!gang) return false;
    const idx = gang.history.findIndex((e) => e.timestamp === timestamp);
    if (idx === -1) return false;
    gang.history.splice(idx, 1);
    gang.updatedAt = Date.now();
    this.gangs.set(gangId, gang);
    await this._saveToSettingsAsync();
    return true;
  }

  // --- CRUD ---

  public getAllGangs(): Gang[] {
    return Array.from(this.gangs.values());
  }

  public getActiveGangs(): Gang[] {
    return this.getAllGangs().filter((g) => g.status === 'active');
  }

  public getGang(id: string): Gang | null {
    return this.gangs.get(id) || null;
  }

  public searchGangs(query: string): Gang[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.getAllGangs();
    return this.getAllGangs().filter((g) => g.name.toLowerCase().includes(q));
  }

  public async addGang(data: { name: string; img?: string; notes?: string }): Promise<Gang> {
    const id = foundry.utils.randomID();
    const now = Date.now();
    const gang: Gang = {
      id,
      name: data.name,
      img: data.img,
      leaders: [],
      subleaders: [],
      members: [],
      notes: data.notes || '',
      status: 'active',
      history: [],
      createdAt: now,
      updatedAt: now,
    };
    this.addHistoryEntry(gang, 'created', `Banda "${data.name}" registrada`);
    this.gangs.set(id, gang);
    await this._saveToSettingsAsync();
    return gang;
  }

  public async updateGang(id: string, updates: Partial<Gang>): Promise<Gang | null> {
    const gang = this.gangs.get(id);
    if (!gang) return null;
    const updated: Gang = {
      ...gang,
      ...updates,
      id: gang.id,
      history: gang.history,
      updatedAt: Date.now(),
    };
    this.gangs.set(id, updated);
    await this._saveToSettingsAsync();
    return updated;
  }

  public async deleteGang(id: string): Promise<boolean> {
    const deleted = this.gangs.delete(id);
    if (deleted) {
      await this._saveToSettingsAsync();
    }
    return deleted;
  }

  // --- Notes ---

  public async updateNotes(id: string, notes: string): Promise<Gang | null> {
    const gang = this.gangs.get(id);
    if (!gang) return null;
    this.addHistoryEntry(gang, 'notes_updated', 'Notas actualizadas');
    gang.notes = notes;
    gang.updatedAt = Date.now();
    this.gangs.set(id, gang);
    await this._saveToSettingsAsync();
    return gang;
  }

  // --- Member management ---

  public async addLeader(id: string, member: GangMember): Promise<Gang | null> {
    const gang = this.gangs.get(id);
    if (!gang) return null;
    if (gang.leaders.some((l) => l.actorId === member.actorId)) return gang;
    gang.leaders.push(member);
    this.addHistoryEntry(gang, 'leader_added', `Líder añadido: ${member.name}`);
    gang.updatedAt = Date.now();
    this.gangs.set(id, gang);
    await this._saveToSettingsAsync();
    return gang;
  }

  public async removeLeader(id: string, actorId: string): Promise<Gang | null> {
    const gang = this.gangs.get(id);
    if (!gang) return null;
    const member = gang.leaders.find((l) => l.actorId === actorId);
    if (!member) return gang;
    gang.leaders = gang.leaders.filter((l) => l.actorId !== actorId);
    this.addHistoryEntry(gang, 'leader_removed', `Líder removido: ${member.name}`);
    gang.updatedAt = Date.now();
    this.gangs.set(id, gang);
    await this._saveToSettingsAsync();
    return gang;
  }

  public async addSubleader(id: string, member: GangMember): Promise<Gang | null> {
    const gang = this.gangs.get(id);
    if (!gang) return null;
    if (gang.subleaders.some((l) => l.actorId === member.actorId)) return gang;
    gang.subleaders.push(member);
    this.addHistoryEntry(gang, 'subleader_added', `Sublíder añadido: ${member.name}`);
    gang.updatedAt = Date.now();
    this.gangs.set(id, gang);
    await this._saveToSettingsAsync();
    return gang;
  }

  public async removeSubleader(id: string, actorId: string): Promise<Gang | null> {
    const gang = this.gangs.get(id);
    if (!gang) return null;
    const member = gang.subleaders.find((l) => l.actorId === actorId);
    if (!member) return gang;
    gang.subleaders = gang.subleaders.filter((l) => l.actorId !== actorId);
    this.addHistoryEntry(gang, 'subleader_removed', `Sublíder removido: ${member.name}`);
    gang.updatedAt = Date.now();
    this.gangs.set(id, gang);
    await this._saveToSettingsAsync();
    return gang;
  }

  public async addMember(id: string, member: GangMember): Promise<Gang | null> {
    const gang = this.gangs.get(id);
    if (!gang) return null;
    if (gang.members.some((m) => m.actorId === member.actorId)) return gang;
    gang.members.push(member);
    this.addHistoryEntry(gang, 'member_added', `Miembro añadido: ${member.name}`);
    gang.updatedAt = Date.now();
    this.gangs.set(id, gang);
    await this._saveToSettingsAsync();
    return gang;
  }

  public async removeMember(id: string, actorId: string): Promise<Gang | null> {
    const gang = this.gangs.get(id);
    if (!gang) return null;
    const member = gang.members.find((m) => m.actorId === actorId);
    if (!member) return gang;
    gang.members = gang.members.filter((m) => m.actorId !== actorId);
    this.addHistoryEntry(gang, 'member_removed', `Miembro removido: ${member.name}`);
    gang.updatedAt = Date.now();
    this.gangs.set(id, gang);
    await this._saveToSettingsAsync();
    return gang;
  }

  // --- Status changes ---

  public async incrementMemberCount(
    id: string,
    actorId: string,
    role: 'subleader' | 'member'
  ): Promise<Gang | null> {
    const gang = this.gangs.get(id);
    if (!gang) return null;
    const list = role === 'subleader' ? gang.subleaders : gang.members;
    const member = list.find((m) => m.actorId === actorId);
    if (!member) return gang;
    member.count = (member.count || 1) + 1;
    gang.updatedAt = Date.now();
    this.gangs.set(id, gang);
    await this._saveToSettingsAsync();
    return gang;
  }

  public async decrementMemberCount(
    id: string,
    actorId: string,
    role: 'subleader' | 'member'
  ): Promise<Gang | null> {
    const gang = this.gangs.get(id);
    if (!gang) return null;
    const list = role === 'subleader' ? gang.subleaders : gang.members;
    const member = list.find((m) => m.actorId === actorId);
    if (!member) return gang;
    const current = member.count || 1;
    if (current <= 1) return gang;
    member.count = current - 1;
    gang.updatedAt = Date.now();
    this.gangs.set(id, gang);
    await this._saveToSettingsAsync();
    return gang;
  }

  public async changeStatus(id: string, newStatus: Gang['status']): Promise<Gang | null> {
    const gang = this.gangs.get(id);
    if (!gang) return null;
    const oldStatus = gang.status;
    if (oldStatus === newStatus) return gang;
    gang.status = newStatus;
    this.addHistoryEntry(gang, 'status_changed', `Estado: ${oldStatus} → ${newStatus}`);
    gang.updatedAt = Date.now();
    this.gangs.set(id, gang);
    await this._saveToSettingsAsync();
    return gang;
  }

  public getCount(): number {
    return this.gangs.size;
  }
}
