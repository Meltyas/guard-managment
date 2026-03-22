// People of Interest (POI) type definitions

export type PoiStatus = 'active' | 'released' | 'imprisoned' | 'deceased' | 'unknown';

export const POI_STATUS_LABELS: Record<PoiStatus, string> = {
  active: 'Activo',
  released: 'Liberado',
  imprisoned: 'Encarcelado',
  deceased: 'Fallecido',
  unknown: 'Desconocido',
};

export type PoiAction =
  | 'created'
  | 'name_updated'
  | 'image_updated'
  | 'notes_updated'
  | 'status_changed'
  | 'crime_added'
  | 'crime_removed'
  | 'gang_added'
  | 'gang_removed'
  | 'actor_linked'
  | 'actor_unlinked';

export interface PersonOfInterest {
  id: string;
  name: string;
  actorId?: string;
  img?: string;
  notes: string;
  possibleCrimes: string[];
  gangIds: string[];
  status: PoiStatus;
  history: PoiHistoryEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface PoiHistoryEntry {
  action: PoiAction;
  timestamp: number;
  performedBy: string;
  details?: string;
  phase?: number;
}
