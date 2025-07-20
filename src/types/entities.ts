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

// Guard Organization (La Guardia - Main Container)
export interface GuardOrganization extends BaseEntity {
  subtitle: string;
  baseStats: GuardStats;
  activeModifiers: string[]; // IDs of applied GuardModifiers
  resources: string[]; // IDs of associated Resources
  reputation: string[]; // IDs of associated Reputation entries
  patrols: string[]; // IDs of associated Patrols
}

export interface GuardStats {
  robustismo: number; // Robustness
  analitica: number; // Analytical
  subterfugio: number; // Subterfuge
  elocuencia: number; // Eloquence
  [key: string]: number; // Support for future stats
}

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
  organizationId: string; // Reference to GuardOrganization
}

// Reputation (Organizational Level)
export interface Reputation extends BaseEntity {
  description: string;
  level: ReputationLevel;
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
  leaderId: string; // Reference to Foundry Actor ID
  unitCount: number; // 1-12 members
  organizationId: string; // Reference to GuardOrganization
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
