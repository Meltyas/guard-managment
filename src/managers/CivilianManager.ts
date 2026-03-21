/**
 * CivilianManager
 * Manages CRUD operations for civilian personnel (non-military staff)
 * Reuses OfficerManager logic with a separate settings key
 */

import type { Officer } from '../types/officer';
import { OfficerManager } from './OfficerManager';

export class CivilianManager extends OfficerManager {
  constructor(onChange?: (officer: Officer, operation: 'create' | 'update' | 'delete') => void) {
    super(onChange, 'civilians');
  }
}
