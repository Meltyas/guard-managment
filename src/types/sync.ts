/**
 * Types and interfaces for data synchronization
 */

export interface SyncData {
  id: string;
  type: 'guard' | 'patrol' | 'alert';
  timestamp: number;
  userId: string;
  data: any;
  version: number;
}

export interface GuardData {
  id: string;
  name: string;
  position: { x: number; y: number };
  status: 'active' | 'inactive' | 'alert';
  assignedArea: string;
  lastUpdate: number;
}

export interface SyncConflict {
  localData: SyncData;
  remoteData: SyncData;
  conflictType: 'version' | 'timestamp' | 'user';
}

export type SyncStrategy = 'last-write-wins' | 'gm-priority' | 'manual-resolve';

export interface SyncOptions {
  strategy: SyncStrategy;
  autoSync: boolean;
  syncInterval: number;
  conflictResolution: 'auto' | 'manual';
}
