/**
 * Finance System Types
 * Budget entries, expenses, and finance tracking
 */

export type BudgetEntryType = 'recurring' | 'extraordinary';
export type ExpenseType = 'recurring' | 'specific';
export type FinanceRefType = 'patrol' | 'auxiliary' | 'building' | 'prisoner';

/** Optional reference to another entity */
export interface FinanceReference {
  type: FinanceRefType;
  id: string;
  name: string;
}

/** A budget entry (income source) */
export interface BudgetEntry {
  id: string;
  name: string;
  description: string;
  amount: number;
  type: BudgetEntryType;
  illegal: boolean;
  processed: boolean;
  reference?: FinanceReference;
  createdAt: number;
  createdBy: string;
}

/** An expense */
export interface Expense {
  id: string;
  name: string;
  description: string;
  amount: number;
  type: ExpenseType;
  illegal: boolean;
  processed: boolean;
  reference?: FinanceReference;
  createdAt: number;
  createdBy: string;
}

/** Actions tracked in the finance log */
export type FinanceAction =
  | 'income_added'
  | 'income_edited'
  | 'income_removed'
  | 'expense_added'
  | 'expense_edited'
  | 'expense_removed'
  | 'total_adjusted'
  | 'phase_processed'
  | 'illegal_toggled';

/** Log entry for finance actions (follows standard registro pattern) */
export interface FinanceLogEntry {
  action: FinanceAction;
  timestamp: number;
  performedBy: string;
  details?: string;
  phase?: number;
}

/** Record of a phase processing */
export interface FinanceHistoryEntry {
  turn: number;
  recurringIncome: number;
  recurringExpenses: number;
  net: number;
  totalAfter: number;
  processedAt: number;
}

/** Full finance data stored in game.settings */
export interface FinanceData {
  totalBudget: number;
  budgetEntries: BudgetEntry[];
  expenses: Expense[];
  showIllegalSection: boolean;
  history: FinanceHistoryEntry[];
  log: FinanceLogEntry[];
}

/** Default finance data */
export const DEFAULT_FINANCE_DATA: FinanceData = {
  totalBudget: 0,
  budgetEntries: [],
  expenses: [],
  showIllegalSection: false,
  history: [],
  log: [],
};

/** Icon map for reference types */
export const REF_TYPE_ICONS: Record<FinanceRefType, string> = {
  patrol: 'fas fa-users',
  auxiliary: 'fas fa-hands-helping',
  building: 'fas fa-building',
  prisoner: 'fas fa-dungeon',
};

/** Label map for reference types */
export const REF_TYPE_LABELS: Record<FinanceRefType, string> = {
  patrol: 'Patrulla',
  auxiliary: 'Auxiliar',
  building: 'Edificio',
  prisoner: 'Prisionero',
};
