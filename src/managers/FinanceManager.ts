/**
 * Finance Manager - Manages budget entries and expenses using game.settings
 */
import type {
  BudgetEntry,
  BudgetEntryType,
  Expense,
  ExpenseType,
  FinanceData,
  FinanceHistoryEntry,
  FinanceLogEntry,
  FinanceAction,
} from '../types/finances';
import { DEFAULT_FINANCE_DATA } from '../types/finances';

export class FinanceManager {
  private data: FinanceData = {
    ...DEFAULT_FINANCE_DATA,
    budgetEntries: [],
    expenses: [],
    history: [],
  };

  public async initialize(): Promise<void> {
    await this.loadFromSettings();
    console.log('FinanceManager | Initialized, total budget:', this.data.totalBudget);
  }

  // --- Settings persistence ---

  public async loadFromSettings(): Promise<void> {
    try {
      const stored = game?.settings?.get(
        'guard-management',
        'finances' as any
      ) as FinanceData | null;
      if (stored && typeof stored === 'object') {
        this.data = {
          totalBudget: stored.totalBudget ?? 0,
          budgetEntries: Array.isArray(stored.budgetEntries) ? stored.budgetEntries : [],
          expenses: Array.isArray(stored.expenses) ? stored.expenses : [],
          showIllegalSection: stored.showIllegalSection ?? false,
          history: Array.isArray(stored.history) ? stored.history : [],
          log: Array.isArray(stored.log) ? stored.log : [],
        };
      }
    } catch (e) {
      console.warn('FinanceManager | loadFromSettings failed:', e);
    }
  }

  private async _saveToSettingsAsync(): Promise<void> {
    try {
      if (!game?.ready) return;
      await game?.settings?.set('guard-management', 'finances' as any, { ...this.data });
      console.log('FinanceManager | Saved, total budget:', this.data.totalBudget);
    } catch (error) {
      console.error('FinanceManager | Error saving:', error);
    }
  }

  /** Add a log entry to the finance registro */
  private _addLog(action: FinanceAction, details?: string, phase?: number): void {
    this.data.log.push({
      action,
      timestamp: Date.now(),
      performedBy: (game as any)?.user?.name || 'Unknown',
      details,
      phase,
    });
  }

  /** Warn GM when budget reaches 0 or below via chat message */
  private _checkBudgetWarning(): void {
    if (this.data.totalBudget <= 0 && (game as any)?.user?.isGM) {
      const ChatMessage = (CONFIG as any).ChatMessage?.documentClass;
      if (ChatMessage) {
        ChatMessage.create({
          content: `<div style="text-align:center;padding:8px;">
            <strong style="color:#e74c3c;">⚠️ ¡Presupuesto Agotado!</strong><br/>
            <span style="color:#ccc;">El presupuesto total es <strong>${this.data.totalBudget}</strong>.</span>
          </div>`,
          whisper: [(game as any).user.id],
        });
      }
    }
  }

  // --- Budget Entries ---

  public getAllBudgetEntries(): BudgetEntry[] {
    return [...this.data.budgetEntries];
  }

  public getBudgetEntriesByType(type: BudgetEntryType): BudgetEntry[] {
    return this.data.budgetEntries.filter((e) => e.type === type);
  }

  public getLegalBudgetEntries(): BudgetEntry[] {
    return this.data.budgetEntries.filter((e) => !e.illegal);
  }

  public getIllegalBudgetEntries(): BudgetEntry[] {
    return this.data.budgetEntries.filter((e) => e.illegal);
  }

  public async addBudgetEntry(
    entry: Omit<BudgetEntry, 'id' | 'createdAt' | 'createdBy'>
  ): Promise<BudgetEntry> {
    const newEntry: BudgetEntry = {
      ...entry,
      id: foundry.utils.randomID(),
      createdAt: Date.now(),
      createdBy: (game as any)?.user?.name || 'Unknown',
    };
    this.data.budgetEntries.push(newEntry);

    // Extraordinary entries add to total immediately
    if (newEntry.type === 'extraordinary' && !newEntry.processed) {
      this.data.totalBudget += newEntry.amount;
      newEntry.processed = true;
    }

    this._addLog('income_added', `Ingreso añadido: "${newEntry.name}" (${newEntry.amount})`);
    await this._saveToSettingsAsync();
    window.dispatchEvent(new CustomEvent('guard-finances-updated'));
    return newEntry;
  }

  public async updateBudgetEntry(id: string, updates: Partial<BudgetEntry>): Promise<boolean> {
    const idx = this.data.budgetEntries.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    const old = this.data.budgetEntries[idx];
    this.data.budgetEntries[idx] = { ...old, ...updates, id: old.id };
    this._addLog('income_edited', `Ingreso editado: "${this.data.budgetEntries[idx].name}"`);
    await this._saveToSettingsAsync();
    window.dispatchEvent(new CustomEvent('guard-finances-updated'));
    return true;
  }

  public async removeBudgetEntry(id: string): Promise<boolean> {
    const idx = this.data.budgetEntries.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    const removed = this.data.budgetEntries.splice(idx, 1)[0];
    this._addLog('income_removed', `Ingreso eliminado: "${removed.name}" (${removed.amount})`);
    await this._saveToSettingsAsync();
    window.dispatchEvent(new CustomEvent('guard-finances-updated'));
    return true;
  }

  // --- Expenses ---

  public getAllExpenses(): Expense[] {
    return [...this.data.expenses];
  }

  public getExpensesByType(type: ExpenseType): Expense[] {
    return this.data.expenses.filter((e) => e.type === type);
  }

  public async addExpense(
    expense: Omit<Expense, 'id' | 'createdAt' | 'createdBy'>
  ): Promise<Expense> {
    const newExpense: Expense = {
      ...expense,
      id: foundry.utils.randomID(),
      createdAt: Date.now(),
      createdBy: (game as any)?.user?.name || 'Unknown',
    };
    this.data.expenses.push(newExpense);

    // Specific expenses deduct immediately
    if (newExpense.type === 'specific' && !newExpense.processed) {
      this.data.totalBudget -= newExpense.amount;
      newExpense.processed = true;
    }

    this._addLog('expense_added', `Gasto añadido: "${newExpense.name}" (${newExpense.amount})`);
    await this._saveToSettingsAsync();
    this._checkBudgetWarning();
    window.dispatchEvent(new CustomEvent('guard-finances-updated'));
    return newExpense;
  }

  public async updateExpense(id: string, updates: Partial<Expense>): Promise<boolean> {
    const idx = this.data.expenses.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    const old = this.data.expenses[idx];
    this.data.expenses[idx] = { ...old, ...updates, id: old.id };
    this._addLog('expense_edited', `Gasto editado: "${this.data.expenses[idx].name}"`);
    await this._saveToSettingsAsync();
    window.dispatchEvent(new CustomEvent('guard-finances-updated'));
    return true;
  }

  public async removeExpense(id: string): Promise<boolean> {
    const idx = this.data.expenses.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    const removed = this.data.expenses.splice(idx, 1)[0];
    this._addLog('expense_removed', `Gasto eliminado: "${removed.name}" (${removed.amount})`);
    await this._saveToSettingsAsync();
    window.dispatchEvent(new CustomEvent('guard-finances-updated'));
    return true;
  }

  // --- Budget calculations ---

  public getTotalBudget(): number {
    return this.data.totalBudget;
  }

  public async setTotalBudget(amount: number): Promise<void> {
    const old = this.data.totalBudget;
    this.data.totalBudget = amount;
    this._addLog('total_adjusted', `Total ajustado: ${old} → ${amount}`);
    await this._saveToSettingsAsync();
    window.dispatchEvent(new CustomEvent('guard-finances-updated'));
  }

  /** Projected budget for next turn: total + recurring income - recurring expenses */
  public getExpectedNextTurn(): number {
    const recurringIncome = this.data.budgetEntries
      .filter((e) => e.type === 'recurring')
      .reduce((sum, e) => sum + e.amount, 0);

    const recurringExpenses = this.data.expenses
      .filter((e) => e.type === 'recurring')
      .reduce((sum, e) => sum + e.amount, 0);

    return this.data.totalBudget + recurringIncome - recurringExpenses;
  }

  /** Get net recurring (income - expenses) */
  public getRecurringNet(): number {
    const recurringIncome = this.data.budgetEntries
      .filter((e) => e.type === 'recurring')
      .reduce((sum, e) => sum + e.amount, 0);

    const recurringExpenses = this.data.expenses
      .filter((e) => e.type === 'recurring')
      .reduce((sum, e) => sum + e.amount, 0);

    return recurringIncome - recurringExpenses;
  }

  // --- Phase processing ---

  public async processPhase(turn: number): Promise<void> {
    // Check if this turn was already processed
    if (this.data.history.some((h) => h.turn === turn)) {
      console.log(`FinanceManager | Turn ${turn} already processed, skipping`);
      return;
    }

    const recurringIncome = this.data.budgetEntries
      .filter((e) => e.type === 'recurring')
      .reduce((sum, e) => sum + e.amount, 0);

    const recurringExpenses = this.data.expenses
      .filter((e) => e.type === 'recurring')
      .reduce((sum, e) => sum + e.amount, 0);

    const net = recurringIncome - recurringExpenses;
    this.data.totalBudget += net;

    const entry: FinanceHistoryEntry = {
      turn,
      recurringIncome,
      recurringExpenses,
      net,
      totalAfter: this.data.totalBudget,
      processedAt: Date.now(),
    };
    this.data.history.push(entry);

    this._addLog(
      'phase_processed',
      `Fase procesada: ingresos=${recurringIncome}, gastos=${recurringExpenses}, neto=${net > 0 ? '+' : ''}${net}, total=${this.data.totalBudget}`,
      turn
    );

    await this._saveToSettingsAsync();
    this._checkBudgetWarning();
    window.dispatchEvent(new CustomEvent('guard-finances-updated'));
    console.log(
      `FinanceManager | Phase ${turn} processed: income=${recurringIncome}, expenses=${recurringExpenses}, net=${net}, total=${this.data.totalBudget}`
    );
  }

  // --- Illegal section visibility ---

  public isIllegalSectionVisible(): boolean {
    return this.data.showIllegalSection;
  }

  public async toggleIllegalVisibility(): Promise<boolean> {
    this.data.showIllegalSection = !this.data.showIllegalSection;
    this._addLog(
      'illegal_toggled',
      this.data.showIllegalSection ? 'Sección ilegal visible para jugadores' : 'Sección ilegal oculta para jugadores'
    );
    await this._saveToSettingsAsync();
    window.dispatchEvent(new CustomEvent('guard-finances-updated'));
    return this.data.showIllegalSection;
  }

  // --- History ---

  public getHistory(): FinanceHistoryEntry[] {
    return [...this.data.history].sort((a, b) => b.turn - a.turn);
  }

  // --- Log (Registro) ---

  public getLog(): FinanceLogEntry[] {
    return [...(this.data.log || [])].sort((a, b) => b.timestamp - a.timestamp);
  }

  public async removeLogEntry(timestamp: number): Promise<boolean> {
    const idx = this.data.log.findIndex((e) => e.timestamp === timestamp);
    if (idx === -1) return false;
    this.data.log.splice(idx, 1);
    await this._saveToSettingsAsync();
    window.dispatchEvent(new CustomEvent('guard-finances-updated'));
    return true;
  }
}
