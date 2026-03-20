/**
 * Officer Types
 * System for managing patrol officers with actor assignment, title, and pros/cons
 */

import { BaseEntity } from './entities';

/**
 * Patrol skill with hope cost – multiple per officer
 */
export interface OfficerSkill {
  id: string;
  name: string;
  image?: string;
  hopeCost: number; // 0-5
}

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

  // Skills shown in patrol card and general panel
  skills: OfficerSkill[];

  // Pros (positive characteristics)
  pros: OfficerTrait[];

  // Cons (negative characteristics)
  cons: OfficerTrait[];

  // Optional metadata
  organizationId?: string;
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
  skills: Omit<OfficerSkill, 'id'>[];
  pros: Omit<OfficerTrait, 'id' | 'createdAt'>[];
  cons: Omit<OfficerTrait, 'id' | 'createdAt'>[];
  organizationId?: string;
}
