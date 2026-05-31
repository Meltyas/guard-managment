/**
 * Phase Events & Reports types
 *
 * - PhaseEvent: a scheduled event ("aviso") that fires at a specific turn.
 *   Supports one-off, recurring and random (RollTable) events, with player/GM
 *   visibility.
 * - PhaseReport: an automatically generated record produced every time a phase
 *   advances. Split into player-visible and GM-only entries.
 */

import type { DayNightPhase } from './entities';

/** Who can see an event / report entry */
export type EventVisibility = 'all' | 'players' | 'gm';

/** Event category (used for icons, filtering and chat styling) */
export type EventCategory =
  | 'aviso'
  | 'recordatorio'
  | 'economico'
  | 'prision'
  | 'banda'
  | 'aleatorio'
  | 'otro';

/** Lifecycle status of a scheduled event */
export type EventStatus = 'pending' | 'fired' | 'cancelled';

/** Recurrence behaviour */
export type RecurrenceMode = 'none' | 'everyNTurns' | 'everyDay' | 'everyNight';

export interface PhaseEventRecurrence {
  mode: RecurrenceMode;
  /** Interval in turns (used when mode === 'everyNTurns') */
  interval?: number;
  /** Stop recurring after this turn (inclusive). null = forever */
  endTurn?: number | null;
}

/** A scheduled phase event */
export interface PhaseEvent {
  id: string;
  title: string;
  description: string;
  /** Turn at which the event fires */
  triggerTurn: number;
  visibility: EventVisibility;
  category: EventCategory;
  status: EventStatus;
  recurrence: PhaseEventRecurrence;
  /** Optional RollTable id for random events (category === 'aleatorio') */
  rollTableId?: string;
  /** Whether to post a chat message when the event fires */
  notifyChat: boolean;
  /** Optional link to another entity (prisoner / gang / building id) */
  linkedId?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  firedAt?: number | null;
  version: number;
}

/** A single line inside a phase report */
export interface PhaseReportEntry {
  text: string;
  category: EventCategory | 'sistema';
  icon?: string;
  /** Source scheduled event id, if any */
  sourceEventId?: string;
  /** Source linked entity id, if any */
  sourceId?: string;
}

/** Auto-generated report for a single turn */
export interface PhaseReport {
  turn: number;
  phase: DayNightPhase;
  generatedAt: number;
  /** Entries visible to everyone (players + GM) */
  playerEntries: PhaseReportEntry[];
  /** Entries only the GM can see */
  gmEntries: PhaseReportEntry[];
}

/** Persisted blob stored under guard-management.phaseEventsData */
export interface PhaseEventsData {
  events: PhaseEvent[];
  reports: PhaseReport[];
}

export const DEFAULT_PHASE_EVENTS_DATA: PhaseEventsData = {
  events: [],
  reports: [],
};

// ---- Labels / icons (Spanish, user-facing) ----

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  aviso: 'Aviso',
  recordatorio: 'Recordatorio',
  economico: 'Económico',
  prision: 'Prisión',
  banda: 'Banda',
  aleatorio: 'Aleatorio',
  otro: 'Otro',
};

export const EVENT_CATEGORY_ICONS: Record<EventCategory | 'sistema', string> = {
  aviso: 'fas fa-bullhorn',
  recordatorio: 'fas fa-bell',
  economico: 'fas fa-coins',
  prision: 'fas fa-dungeon',
  banda: 'fas fa-skull-crossbones',
  aleatorio: 'fas fa-dice',
  otro: 'fas fa-circle-info',
  sistema: 'fas fa-gears',
};

export const EVENT_VISIBILITY_LABELS: Record<EventVisibility, string> = {
  all: 'Todos',
  players: 'Jugadores',
  gm: 'Solo DM',
};

export const RECURRENCE_LABELS: Record<RecurrenceMode, string> = {
  none: 'Una vez',
  everyNTurns: 'Cada N turnos',
  everyDay: 'Cada día',
  everyNight: 'Cada noche',
};

export const EVENT_CATEGORIES: EventCategory[] = [
  'aviso',
  'recordatorio',
  'economico',
  'prision',
  'banda',
  'aleatorio',
  'otro',
];

export const EVENT_VISIBILITIES: EventVisibility[] = ['all', 'players', 'gm'];
