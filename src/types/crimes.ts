/**
 * Crime System Types
 * Defines crime catalog entries, offense types, and sentence configuration
 */

/** Offense severity type */
export type OffenseType = 'capital' | 'major' | 'minor' | 'light' | 'fine';

/** All offense types ordered by severity (lowest to highest) */
export const OFFENSE_TYPES: OffenseType[] = ['fine', 'light', 'minor', 'major', 'capital'];

/** Severity index for sorting (lower = less severe) */
export const OFFENSE_SEVERITY: Record<OffenseType, number> = {
  fine: 0,
  light: 1,
  minor: 2,
  major: 3,
  capital: 4,
};

/** Spanish labels for offense types */
export const OFFENSE_LABELS: Record<OffenseType, string> = {
  capital: 'Capital',
  major: 'Mayor',
  minor: 'Menor',
  light: 'Leve',
  fine: 'Multa',
};

/** Map from Spanish input (case-insensitive) to OffenseType for bulk import */
export const OFFENSE_TYPE_FROM_SPANISH: Record<string, OffenseType> = {
  capital: 'capital',
  mayor: 'major',
  menor: 'minor',
  leve: 'light',
  multa: 'fine',
};

/** A crime in the catalog */
export interface Crime {
  id: string;
  name: string;
  description: string;
  offenseType: OffenseType;
  customSentence: string;
  version: number;
}

/** Currency fine amounts (matches Daggerheart currency denominations) */
export interface CurrencyFine {
  coins: number;
  handfuls: number;
  bags: number;
  chests: number;
}

/** Sentence configuration for a single offense type */
export interface SentenceEntry {
  turns: number | 'permanent' | 'execution';
  fine: CurrencyFine;
}

/** Full sentence configuration (one entry per offense type) */
export type SentenceConfig = Record<OffenseType, SentenceEntry>;

/** Default sentence configuration */
export const DEFAULT_SENTENCE_CONFIG: SentenceConfig = {
  capital: {
    turns: 'execution',
    fine: { coins: 0, handfuls: 0, bags: 0, chests: 0 },
  },
  major: {
    turns: 8,
    fine: { coins: 0, handfuls: 2, bags: 1, chests: 0 },
  },
  minor: {
    turns: 4,
    fine: { coins: 0, handfuls: 1, bags: 0, chests: 0 },
  },
  light: {
    turns: 2,
    fine: { coins: 5, handfuls: 0, bags: 0, chests: 0 },
  },
  fine: {
    turns: 0,
    fine: { coins: 10, handfuls: 0, bags: 0, chests: 0 },
  },
};
