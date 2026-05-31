export type GangStatus = 'active' | 'disbanded' | 'arrested' | 'unknown';

export type GangAction =
  | 'created'
  | 'leader_added'
  | 'leader_removed'
  | 'subleader_added'
  | 'subleader_removed'
  | 'member_added'
  | 'member_removed'
  | 'notes_updated'
  | 'status_changed'
  | 'name_updated'
  | 'image_updated';

export const GANG_STATUS_LABELS: Record<GangStatus, string> = {
  active: 'Activa',
  disbanded: 'Disuelta',
  arrested: 'Arrestada',
  unknown: 'Desconocida',
};

export interface GangMember {
  actorId: string;
  name: string;
  img?: string;
  count?: number;
}

export interface Gang {
  id: string;
  name: string;
  img?: string;
  leaders: GangMember[];
  subleaders: GangMember[];
  members: GangMember[];
  notes: string;
  status: GangStatus;
  history: GangHistoryEntry[];
  createdAt: number;
  updatedAt: number;
  /** Si true, la banda está oculta en el panel. Por defecto true. */
  hidden?: boolean;
}

export interface GangHistoryEntry {
  action: GangAction;
  timestamp: number;
  performedBy: string;
  details?: string;
  phase?: number;
}
