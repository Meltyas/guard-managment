/**
 * Warehouse System Types
 * Generic types for all warehouse-managed items
 */

import { BaseEntity } from './entities';

/**
 * Base interface for all warehouse items
 */
export interface BaseWarehouseItem extends BaseEntity {
  description: string;
  organizationId: string;
  image?: string;
}

/**
 * Warehouse item category definition
 */
export interface WarehouseItemCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  singularName: string;
  pluralName: string;
}

/**
 * Warehouse item type configuration
 */
export interface WarehouseItemType<T extends BaseWarehouseItem = BaseWarehouseItem> {
  category: WarehouseItemCategory;
  createNew: () => Partial<T>;
  validate: (data: Partial<T>) => ValidationResult;
  renderInfo: (item: T) => string; // HTML para mostrar en guard info
  renderChatMessage: (item: T, action: string) => string; // HTML para chat messages
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Warehouse item operation types
 */
export type WarehouseOperation = 'create' | 'update' | 'delete' | 'view';

/**
 * Warehouse item event data
 */
export interface WarehouseItemEvent<T extends BaseWarehouseItem = BaseWarehouseItem> {
  operation: WarehouseOperation;
  item: T;
  previousItem?: T;
  organizationId: string;
}

/**
 * Dialog configuration for warehouse items
 */
export interface WarehouseItemDialogConfig<T extends BaseWarehouseItem = BaseWarehouseItem> {
  title: string;
  width?: number;
  height?: number;
  resizable?: boolean;
  renderContent: (item?: T) => Promise<string>;
  handleSubmit: (formData: FormData, item?: T) => Promise<T>;
  validateForm?: (formData: FormData) => ValidationResult;
}

/**
 * Template storage interface for warehouse items
 */
export interface WarehouseTemplate<T extends BaseWarehouseItem = BaseWarehouseItem> {
  id: string;
  name: string;
  description: string;
  data: Omit<T, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'version'>;
  category: string;
}
