/**
 * Guard Management Types for Foundryborne/Daggerheart
 * Core entity interfaces and type definitions
 */

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
  /** Optional serialized patrol snapshots for persistence */
  patrolSnapshots?: Patrol[]; // <-- added for persistence of patrol data
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
  officer: PatrolOfficer | null; // Single officer
  soldiers: PatrolSoldier[]; // Members list (can contain duplicates)

  // Effects applied directly to this patrol
  patrolEffects: PatrolEffectInstance[]; // Replaces customModifiers/activeEffects

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
  modifiers: Partial<GuardStats>;
  expiresAt?: number; // epoch ms
}

export interface PatrolLastOrder {
  text: string;
  issuedAt: number; // epoch ms
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
  robustismo: 0,
  analitica: 0,
  subterfugio: 0,
  elocuencia: 0,
};

export const DEFAULT_CONFIG: GuardManagementConfig = {
  maxPatrolUnits: 12,
  defaultGuardStats: DEFAULT_GUARD_STATS,
  enableRealTimeSync: true,
  conflictResolutionStrategy: 'gm-override',
};
