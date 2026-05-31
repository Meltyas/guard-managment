export type BuildingTag = 'civil' | 'auxiliar' | 'guardia' | 'publico' | 'oficial';

export const BUILDING_TAG_LABELS: Record<BuildingTag, string> = {
  civil: 'Civil',
  auxiliar: 'Auxiliar',
  guardia: 'Guardia',
  publico: 'Público',
  oficial: 'Oficial',
};

export const BUILDING_TAG_ICONS: Record<BuildingTag, string> = {
  civil: 'fas fa-home',
  auxiliar: 'fas fa-hands-helping',
  guardia: 'fas fa-shield-alt',
  publico: 'fas fa-landmark',
  oficial: 'fas fa-flag',
};

export type BuildingZone =
  | 'claro-entrada'
  | 'claro-obrero'
  | 'claro-central'
  | 'claro-fronterizo'
  | 'claro-noble'
  | 'zona-salvaje'
  | 'bajo-arbol'
  | 'fuera-arboria';

export const BUILDING_ZONE_LABELS: Record<BuildingZone, string> = {
  'claro-entrada': 'Claro de Entrada',
  'claro-obrero': 'Claro Obrero',
  'claro-central': 'Claro Central',
  'claro-fronterizo': 'Claro Fronterizo',
  'claro-noble': 'Claro Noble',
  'zona-salvaje': 'Zona Salvaje',
  'bajo-arbol': 'Bajo Árbol',
  'fuera-arboria': 'Fuera de Arboria',
};

export const BUILDING_ZONE_ICONS: Record<BuildingZone, string> = {
  'claro-entrada': 'fas fa-archway',
  'claro-obrero': 'fas fa-hammer',
  'claro-central': 'fas fa-circle-dot',
  'claro-fronterizo': 'fas fa-border-all',
  'claro-noble': 'fas fa-crown',
  'zona-salvaje': 'fas fa-tree',
  'bajo-arbol': 'fas fa-leaf',
  'fuera-arboria': 'fas fa-map-signs',
};

export const BUILDING_ZONE_ORDER: BuildingZone[] = [
  'claro-entrada',
  'claro-obrero',
  'claro-central',
  'claro-fronterizo',
  'claro-noble',
  'zona-salvaje',
  'bajo-arbol',
  'fuera-arboria',
];

export interface BuildingGangLink {
  gangId: string;
  gangName: string;
  notes: string;
}

export interface BuildingChangelogEntry {
  userId: string;
  userName: string;
  timestamp: number;
  changes: { field: string; from: string; to: string }[];
}

export interface Building {
  id: string;
  name: string;
  description: string;
  img?: string;
  tags: BuildingTag[];
  zone: BuildingZone;
  gangLink?: BuildingGangLink;
  /** Si es true el edificio aparece en la vista de zonas (activado por un jugador o el GM) */
  active: boolean;
  /** Si es true el GM lo oculta del activador; los jugadores no pueden verlo ni activarlo */
  hidden: boolean;
  changelog: BuildingChangelogEntry[];
  createdAt: number;
  updatedAt: number;
}
