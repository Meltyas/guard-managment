/**
 * Guard Management Types for Foundryborne/Daggerheart
 * Core entity interfaces and type definitions
 */

// Base entity interface
export interface BaseEntity {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Guard Statistics (Base Stats)
export interface GuardStatistics extends BaseEntity {
  subtitle: string;
  baseStats: GuardStats;
  activeModifiers: string[]; // IDs of applied GuardModifiers
}

export interface GuardStats {
  robustismo: number; // Robustness
  analitica: number; // Analytical
  subterfugio: number; // Subterfuge
  elocuencia: number; // Eloquence
  [key: string]: number; // Support for future stats
}

// Guard Modifiers (Temporary Effects)
export interface GuardModifier extends BaseEntity {
  description: string;
  type: EffectType;
  image?: string;
  statModifications: StatModification[];
}

export interface StatModification {
  statName: keyof GuardStats;
  value: number; // Can be positive or negative
}

export type EffectType = 'positive' | 'negative' | 'neutral';

// Patrols
export interface Patrol extends BaseEntity {
  leaderId: string; // Reference to Foundry Actor ID
  unitCount: number; // 1-12 members
  baseGuardId: string; // Reference to GuardStatistics
  customModifiers: StatModification[];
  activeEffects: string[]; // IDs of applied PatrolEffects
  status: PatrolStatus;
  calculatedStats?: GuardStats; // Derived stats (calculated)
}

export type PatrolStatus = 'idle' | 'deployed' | 'recalled';

// Patrol Effects
export interface PatrolEffect extends BaseEntity {
  description: string;
  type: EffectType;
  image?: string;
  targetPatrolId?: string; // If applied to specific patrol
  statModifications: StatModification[];
}

// Resources
export interface Resource extends BaseEntity {
  description: string;
  quantity: number;
}

// Reputation
export interface Reputation extends BaseEntity {
  description: string;
  level: ReputationLevel;
}

export type ReputationLevel =
  | 'enemigos' // Enemies (1)
  | 'hostiles' // Hostile (2)
  | 'desconfiados' // Distrustful (3)
  | 'neutrales' // Neutral (4)
  | 'amistosos' // Friendly (5)
  | 'confiados' // Trusting (6)
  | 'aliados'; // Allies (7)

export const REPUTATION_LEVELS: Record<ReputationLevel, number> = {
  enemigos: 1,
  hostiles: 2,
  desconfiados: 3,
  neutrales: 4,
  amistosos: 5,
  confiados: 6,
  aliados: 7,
};

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
  robustismo: 10,
  analitica: 10,
  subterfugio: 10,
  elocuencia: 10,
};

export const DEFAULT_CONFIG: GuardManagementConfig = {
  maxPatrolUnits: 12,
  defaultGuardStats: DEFAULT_GUARD_STATS,
  enableRealTimeSync: true,
  conflictResolutionStrategy: 'gm-override',
};
