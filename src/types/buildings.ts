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

export interface BuildingGangLink {
  gangId: string;
  gangName: string;
  notes: string;
}

export interface Building {
  id: string;
  name: string;
  description: string;
  img?: string;
  tags: BuildingTag[];
  gangLink?: BuildingGangLink;
  createdAt: number;
  updatedAt: number;
}
