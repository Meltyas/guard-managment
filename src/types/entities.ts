/**
 * Guard Management Types for Foundryborne/Daggerheart
 * Core entity interfaces and type definitions
 */

// Re-export crime system types
export {
  DEFAULT_SENTENCE_CONFIG,
  OFFENSE_LABELS,
  OFFENSE_TYPES,
  OFFENSE_TYPE_FROM_SPANISH,
} from './crimes';
export type { Crime, CurrencyFine, OffenseType, SentenceConfig, SentenceEntry } from './crimes';

// Base entity interface
export interface BaseEntity {
  id: string;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
  version: number;
}

// Guard Organization (La Guardia - Main Container)
export interface GuardOrganization extends BaseEntity {
  subtitle: string;
  baseStats: GuardStats;
  activeModifiers: string[]; // IDs of applied GuardModifiers
  resources: string[]; // IDs of associated Resources
  reputation: string[]; // IDs of associated Reputation entries
  patrols: string[]; // IDs of associated Patrols
  auxiliaries: string[]; // IDs of associated Auxiliary units
  // patrolSnapshots eliminado: PatrolManager centraliza el estado
}

export interface GuardStats {
  agility: number; // Agilidad
  strength: number; // Fuerza
  finesse: number; // Destreza
  instinct: number; // Instinto
  presence: number; // Presencia
  knowledge: number; // Conocimiento
  [key: string]: number; // Support for future stats
}

// Global guard stat bounds (used across dialogs & models)
export const GUARD_STAT_MIN = -99;
export const GUARD_STAT_MAX = 99;

// Guard Modifiers (Organizational Effects)
export interface GuardModifier extends BaseEntity {
  description: string;
  type: EffectType;
  image?: string;
  statModifications: StatModification[];
  organizationId: string; // Reference to GuardOrganization
}

export interface StatModification {
  statName: keyof GuardStats;
  value: number; // Can be positive or negative
}

export type EffectType = 'positive' | 'negative' | 'neutral';

// Resources (Organizational Level)
export interface Resource extends BaseEntity {
  description: string;
  quantity: number;
  image?: string;
  organizationId: string; // Reference to GuardOrganization
}

// Reputation (Organizational Level)
export interface Reputation extends BaseEntity {
  description: string;
  level: ReputationLevel;
  image?: string;
  organizationId: string; // Reference to GuardOrganization
}

export enum ReputationLevel {
  Enemigos = 1,
  Hostiles = 2,
  Desconfiados = 3,
  Neutrales = 4,
  Amistosos = 5,
  Confiados = 6,
  Aliados = 7,
}

export const REPUTATION_LABELS: Record<ReputationLevel, string> = {
  [ReputationLevel.Enemigos]: 'Enemigos',
  [ReputationLevel.Hostiles]: 'Hostiles',
  [ReputationLevel.Desconfiados]: 'Desconfiados',
  [ReputationLevel.Neutrales]: 'Neutrales',
  [ReputationLevel.Amistosos]: 'Amistosos',
  [ReputationLevel.Confiados]: 'Confiados',
  [ReputationLevel.Aliados]: 'Aliados',
};

// Patrols (Operational Units)
export interface Patrol extends BaseEntity {
  // Core relational
  organizationId: string; // Reference to GuardOrganization
  subtitle?: string;

  // Base & derived stats
  baseStats: GuardStats; // Raw patrol stats (editable)
  derivedStats?: GuardStats; // Calculated from base + organization + effects

  // Officer & soldiers
  officerId: string | null; // Reference to Officer entity from OfficerManager
  officer: PatrolOfficer | null; // Single officer (legacy actor-based)
  soldiers: PatrolSoldier[]; // Members list (can contain duplicates)
  soldierSlots: number; // Number of available slots for soldiers (1-11)

  // Effects applied directly to this patrol
  patrolEffects: PatrolEffectInstance[]; // Replaces customModifiers/activeEffects

  // Hope pool for this patrol
  currentHope?: number; // 0 to maxHope
  maxHope?: number; // 0-6, default 0 (inherited from org or per-patrol)

  // Spellcasting abilities (up to 6)
  patrolSpells?: PatrolSpellAbility[];

  // Last order issued to patrol
  lastOrder: PatrolLastOrder | null;

  // Versioning & metadata already from BaseEntity (version, createdAt, updatedAt)

  // ===================== Deprecated (kept for legacy example compatibility) =====================
  /** @deprecated Use officer.actorId instead */
  leaderId?: string;
  /** @deprecated Use soldiers.length instead */
  unitCount?: number;
  /** @deprecated Use patrolEffects[].modifiers aggregation */
  customModifiers?: StatModification[];
  /** @deprecated Use patrolEffects */
  activeEffects?: string[]; // legacy ids
  /** @deprecated Future status system TBD */
  status?: PatrolStatus;
  /** @deprecated Use derivedStats */
  calculatedStats?: GuardStats;
}

export interface PatrolOfficer {
  actorId: string;
  tokenId?: string;
  name: string;
  img?: string;
  isLinked?: boolean;
  sceneId?: string;
}

export interface PatrolSoldier {
  actorId: string;
  tokenId?: string;
  name: string;
  img?: string;
  referenceType: 'linked' | 'unlinked';
  addedAt: number; // epoch ms
  sceneId?: string;
}

export interface PatrolEffectInstance {
  id: string; // internal id or reference id
  sourceType: 'temp' | 'organization' | 'manual';
  label: string;
  img?: string;
  description?: string;
  modifiers: Partial<GuardStats>;
  expiresAt?: number; // epoch ms
}

export interface PatrolLastOrder {
  text: string;
  issuedAt: number; // epoch ms
}

export interface PatrolSpellAbility {
  id: string;
  name: string; // e.g. "Lanza Llamas"
  modifier: number; // flat bonus added to the dHope + dFear roll
}

export type PatrolStatus = 'idle' | 'deployed' | 'recalled';

// Patrol Effects (template definitions for warehouse)
export interface PatrolEffect extends BaseEntity {
  description: string;
  type: EffectType;
  image?: string;
  targetPatrolId?: string; // If applied to specific patrol
  statModifications: StatModification[];
}

// GM Storage/Warehouse
export interface GMStorage {
  resources: Resource[];
  reputationEntries: Reputation[];
  patrolEffects: PatrolEffect[];
  guardModifiers: GuardModifier[];
}

// Sync-related types
export interface SyncEvent {
  id: string;
  entityType: EntityType;
  entityId: string;
  operation: SyncOperation;
  data: any;
  userId: string;
  timestamp: Date;
  version: number;
}

export type EntityType = 'guard' | 'patrol' | 'modifier' | 'effect' | 'resource' | 'reputation';

export type SyncOperation = 'create' | 'update' | 'delete';

// Dialog types for UI
export interface DialogData {
  mode: 'create' | 'edit';
  entity?: BaseEntity;
  title: string;
}

// Validation types
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
}

// Configuration types
export interface GuardManagementConfig {
  maxPatrolUnits: number;
  defaultGuardStats: GuardStats;
  enableRealTimeSync: boolean;
  conflictResolutionStrategy: 'gm-override' | 'timestamp' | 'manual';
}

// Default values
export const DEFAULT_GUARD_STATS: GuardStats = {
  agility: 0,
  strength: 0,
  finesse: 0,
  instinct: 0,
  presence: 0,
  knowledge: 0,
};

// ===================== Prison System =====================

/** Prisoner status within the prison system */
export type PrisonerStatus =
  | 'imprisoned'
  | 'forced_labor'
  | 'executed'
  | 'released'
  | 'transferred_to_prison'
  | 'death_row';

/** Actions that can be logged in prisoner history */
export type PrisonerAction =
  | 'entered'
  | 'released'
  | 'forced_labor'
  | 'transferred_to_prison'
  | 'sent_to_death_row'
  | 'executed'
  | 'notes_updated'
  | 'release_turn_updated'
  | 'sentence_applied'
  | 'sentence_completed';

/** Individual prisoner assigned to a temporary cell */
export interface Prisoner {
  id: string;
  actorId: string;
  tokenId?: string;
  name: string;
  img?: string;
  cellIndex: number;
  notes: string;
  releaseTurn: number | null;
  sentencePhases: number;
  sentenceStartPhase: number | null;
  crimes: string[]; // IDs of crimes from the crime catalog
  status: PrisonerStatus;
  history: PrisonerHistoryEntry[];
  createdAt: number;
  updatedAt: number;
}

/** History entry for a specific prisoner */
export interface PrisonerHistoryEntry {
  action: PrisonerAction;
  timestamp: number;
  performedBy: string;
  details?: string;
  phase?: number;
}

/** Configuration for the prison */
export interface PrisonConfig {
  cellCount: number;
  cellCapacity: number; // max prisoners per cell before overcrowding (default 1)
}

export const DEFAULT_CONFIG: GuardManagementConfig = {
  maxPatrolUnits: 12,
  defaultGuardStats: DEFAULT_GUARD_STATS,
  enableRealTimeSync: true,
  conflictResolutionStrategy: 'gm-override',
};

// ===================== Day/Night Phase System =====================

/** Phase of the day/night cycle */
export type DayNightPhase = 'day' | 'night';

/** Phase and turn tracking data stored in game.settings */
export interface PhaseData {
  currentPhase: DayNightPhase;
  currentTurn: number;
  history: PhaseTurnEntry[];
}

/** Record of a single turn advancement */
export interface PhaseTurnEntry {
  turn: number;
  phase: DayNightPhase;
  advancedAt: number; // epoch ms
  advancedBy: string; // user name
}

export const DEFAULT_PHASE_DATA: PhaseData = {
  currentPhase: 'day',
  currentTurn: 1,
  history: [],
};
