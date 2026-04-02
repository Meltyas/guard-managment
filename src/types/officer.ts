/**
 * Officer Types
 * System for managing patrol officers with actor assignment, title, and pros/cons
 */

import { BaseEntity } from './entities';

/**
 * Optional skill shown in patrol and general panel
 */
export interface OfficerSkill {
  name: string;
  image?: string;
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

  // Optional single skill shown in patrol card and general panel
  skill?: OfficerSkill;

  // Pros (positive characteristics)
  pros: OfficerTrait[];

  // Cons (negative characteristics)
  cons: OfficerTrait[];

  // Optional metadata
  organizationId?: string; // If officer is tied to organization
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
  skill?: OfficerSkill;
  pros: Omit<OfficerTrait, 'id' | 'createdAt'>[];
  cons: Omit<OfficerTrait, 'id' | 'createdAt'>[];
  organizationId?: string;
}
