/**
 * Core Traits - Composable behaviors for entities
 * These traits can be mixed and matched for different entity types
 */

import { TemplateResult } from 'lit-html';

// ============================================================================
// Base Trait Interfaces
// ============================================================================

export interface Identifiable {
  id: string;
  name: string;
  version: number;
}

export interface Renderable<T> {
  renderItem(entity: T, options?: RenderOptions): TemplateResult | null;
  renderCompact?(entity: T, options?: RenderOptions): TemplateResult | null;
}

export interface Chattable<T> {
  generateChatHTML(entity: T, context?: ChatContext): string;
  sendToChat(entity: T, context?: ChatContext): Promise<void>;
}

export interface Validateable<T> {
  validate(entity: T): ValidationResult;
  validatePartial?(partial: Partial<T>): ValidationResult;
}

export interface Syncable<T> {
  sync(entity: T): Promise<SyncResult>;
  resolveConflict?(local: T, remote: T): T;
}

export interface Manageable<T> {
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
  getById(id: string): Promise<T | null>;
  getAll(): Promise<T[]>;
}

// ============================================================================
// Common Option Interfaces
// ============================================================================

export interface RenderOptions {
  showActions?: boolean;
  showSendToChat?: boolean;
  compact?: boolean;
  contextId?: string;
  customActions?: ActionButton[];
  cssClasses?: string[];
}

export interface ActionButton {
  icon: string;
  title: string;
  action: string;
  cssClass?: string;
  data?: Record<string, string>;
}

export interface ChatContext {
  organizationName?: string;
  whisperTo?: string[];
  additionalData?: Record<string, any>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
}

export interface SyncResult {
  success: boolean;
  conflictResolved?: boolean;
  error?: string;
  updatedEntity?: any;
}

// ============================================================================
// Entity Configuration System
// ============================================================================

export interface EntityConfig<T> {
  entityType: string;
  displayName: string;
  pluralName: string;

  // Renderer configuration
  renderer?: EntityRenderer<T>;

  // Chat integration
  chatIntegration?: ChatIntegration<T>;

  // Validation rules
  validator?: EntityValidator<T>;

  // Manager configuration
  manager?: EntityManagerConfig;

  // Custom extensions
  extensions?: EntityExtension<T>[];
}

export interface EntityRenderer<T> {
  fieldRenderers: Map<keyof T, FieldRenderer<T>>;
  templateOverrides?: Map<string, (entity: T, options: RenderOptions) => TemplateResult>;
  defaultActions?: ActionButton[];
}

export interface FieldRenderer<T> {
  render(value: any, entity: T, field: keyof T): TemplateResult;
  validate?(value: any): boolean;
}

export interface ChatIntegration<T> {
  chatTemplate: (entity: T, context: ChatContext) => string;
  chatFlags?: (entity: T) => Record<string, any>;
  beforeSend?: (entity: T, context: ChatContext) => ChatContext;
}

export interface EntityValidator<T> {
  rules: ValidationRule<T>[];
  customValidators?: Map<keyof T, (value: any, entity: T) => ValidationResult>;
}

export interface ValidationRule<T> {
  field: keyof T;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any, entity: T) => boolean;
  message: string;
}

export interface EntityManagerConfig {
  storageKey: string;
  documentType?: string;
  cacheEnabled?: boolean;
  syncStrategy?: 'immediate' | 'batched' | 'manual';
}

export interface EntityExtension<T> {
  name: string;
  canHandle(entity: T, context?: any): boolean;
  extend(entity: T, context?: any): T | Promise<T>;
  priority?: number;
}
