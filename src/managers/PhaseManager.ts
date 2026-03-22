/**
 * PhaseManager - Manages day/night phase and turn tracking
 * Data stored in game.settings following the module pattern
 */

import type { PhaseData, DayNightPhase, PhaseTurnEntry } from '../types/entities';

export class PhaseManager {
  private data: PhaseData = { currentPhase: 'day', currentTurn: 1, history: [] };

  public async initialize(): Promise<void> {
    await this.loadFromSettings();
    console.log('PhaseManager | Initialized:', `Turn ${this.data.currentTurn}, Phase ${this.data.currentPhase}`);
  }

  // --- Settings persistence ---

  public async loadFromSettings(): Promise<void> {
    try {
      const stored = game?.settings?.get('guard-management', 'phaseData' as any) as PhaseData | null;
      if (stored && typeof stored === 'object' && stored.currentPhase) {
        this.data = {
          currentPhase: stored.currentPhase,
          currentTurn: stored.currentTurn ?? 1,
          history: Array.isArray(stored.history) ? stored.history : [],
        };
      }
    } catch (e) {
      console.warn('PhaseManager | loadFromSettings failed:', e);
    }
  }

  private async _saveToSettingsAsync(): Promise<void> {
    await game?.settings?.set('guard-management', 'phaseData' as any, this.data);
  }

  // --- Getters ---

  public getCurrentPhase(): DayNightPhase {
    return this.data.currentPhase;
  }

  public getCurrentTurn(): number {
    return this.data.currentTurn;
  }

  public getPhaseData(): PhaseData {
    return { ...this.data };
  }

  // --- Turn advancement ---

  /** Calculate phase from turn number: odd = day, even = night */
  public static phaseForTurn(turn: number): DayNightPhase {
    return turn % 2 === 1 ? 'day' : 'night';
  }

  public async advanceTurn(): Promise<PhaseData> {
    return this.goToTurn(this.data.currentTurn + 1);
  }

  public async goBackTurn(): Promise<PhaseData> {
    if (this.data.currentTurn <= 1) return { ...this.data };
    return this.goToTurn(this.data.currentTurn - 1);
  }

  public async goToTurn(targetTurn: number): Promise<PhaseData> {
    if (targetTurn < 1) targetTurn = 1;
    const userName = (game as any)?.user?.name || 'Unknown';
    const previousTurn = this.data.currentTurn;
    const newPhase = PhaseManager.phaseForTurn(targetTurn);

    const entry: PhaseTurnEntry = {
      turn: targetTurn,
      phase: newPhase,
      advancedAt: Date.now(),
      advancedBy: userName,
    };

    this.data.currentPhase = newPhase;
    this.data.currentTurn = targetTurn;
    this.data.history.push(entry);

    // Dispatch event BEFORE saving so the animation starts
    // before onChange triggers updateFromPhaseManager()
    window.dispatchEvent(new CustomEvent('guard-phase-advanced', {
      detail: { phase: newPhase, turn: targetTurn, previousTurn },
    }));

    await this._saveToSettingsAsync();

    return { ...this.data };
  }
}
