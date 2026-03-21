/**
 * AuxiliaryManager
 * Manages CRUD operations for auxiliary units (civilian-led support groups)
 * Reuses PatrolManager logic with a separate settings key
 */

import { PatrolChangeCallback, PatrolManager } from './PatrolManager';

export class AuxiliaryManager extends PatrolManager {
  constructor(onChange?: PatrolChangeCallback) {
    super(onChange, 'auxiliaries');
  }
}
