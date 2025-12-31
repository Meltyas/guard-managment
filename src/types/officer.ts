/**
 * Officer Types
 * System for managing patrol officers with actor assignment, title, and pros/cons
 */

import { BaseEntity } from './entities';

/**
 * Officer entity with actor assignment and characteristics
 */
export interface Officer extends BaseEntity {
  // Actor assignment
  actorId: string;
  actorName: string;
  actorImg?: string;

  // Custom title for the officer
  title: string;

  // Patrol Skills (special abilities)
  patrolSkills: PatrolSkill[];

  // Pros (positive characteristics)
  pros: OfficerTrait[];

  // Cons (negative characteristics)
  cons: OfficerTrait[];

  // Optional metadata
  organizationId?: string; // If officer is tied to organization
}

/**
 * Patrol skill with hope cost
 */
export interface PatrolSkill {
  id: string;
  title: string;
  description: string; // Rich text
  hopeCost: number; // 0-5
  createdAt: Date;
}

/**
 * Individual trait (pro or con)
 */
export interface OfficerTrait {
  id: string;
  title: string;
  description: string; // Rich text
  createdAt: Date;
}

/**
 * Data structure for creating/editing officers
 */
export interface OfficerFormData {
  actorId: string;
  actorName: string;
  actorImg?: string;
  title: string;
  patrolSkills: Omit<PatrolSkill, 'id' | 'createdAt'>[];
  pros: Omit<OfficerTrait, 'id' | 'createdAt'>[];
  cons: Omit<OfficerTrait, 'id' | 'createdAt'>[];
  organizationId?: string;
}
}
