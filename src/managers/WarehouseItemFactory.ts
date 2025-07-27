/**
 * Warehouse Item Factory
 * Registry and factory for different warehouse item types
 */

import {
  BaseWarehouseItem,
  WarehouseItemCategory,
  WarehouseItemDialogConfig,
  WarehouseItemType,
} from '../types/warehouse';
import { BaseWarehouseManager } from './BaseWarehouseManager';

export interface WarehouseItemTypeRegistration {
  type: WarehouseItemType<any>;
  manager: BaseWarehouseManager<any>;
  dialogConfig: WarehouseItemDialogConfig<any>;
}

export class WarehouseItemFactory {
  private static instance: WarehouseItemFactory;
  private registrations: Map<string, WarehouseItemTypeRegistration> = new Map();

  private constructor() {}

  public static getInstance(): WarehouseItemFactory {
    if (!WarehouseItemFactory.instance) {
      WarehouseItemFactory.instance = new WarehouseItemFactory();
    }
    return WarehouseItemFactory.instance;
  }

  /**
   * Register a new warehouse item type
   */
  public registerType(categoryId: string, registration: WarehouseItemTypeRegistration): void {
    this.registrations.set(categoryId, registration);
  }

  /**
   * Get a registered type
   */
  public getType(categoryId: string): WarehouseItemTypeRegistration | undefined {
    return this.registrations.get(categoryId);
  }

  /**
   * Get all registered categories
   */
  public getAllCategories(): WarehouseItemCategory[] {
    return Array.from(this.registrations.values()).map((reg) => reg.type.category);
  }

  /**
   * Get manager for a specific type
   */
  public getManager(categoryId: string): BaseWarehouseManager<any> | undefined {
    const registration = this.registrations.get(categoryId);
    return registration?.manager;
  }

  /**
   * Get dialog config for a specific type
   */
  public getDialogConfig(categoryId: string): WarehouseItemDialogConfig<any> | undefined {
    const registration = this.registrations.get(categoryId);
    return registration?.dialogConfig;
  }

  /**
   * Initialize all registered managers
   */
  public async initializeAll(): Promise<void> {
    const initPromises = Array.from(this.registrations.values()).map((reg) =>
      reg.manager.initialize()
    );
    await Promise.all(initPromises);
  }

  /**
   * Get all items across all types for an organization
   */
  public getAllItemsForOrganization(organizationId: string): BaseWarehouseItem[] {
    const items: BaseWarehouseItem[] = [];

    for (const registration of this.registrations.values()) {
      items.push(...registration.manager.getItemsByOrganization(organizationId));
    }

    return items;
  }

  /**
   * Get count of items by category for an organization
   */
  public getItemCountsByCategory(organizationId: string): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const [categoryId, registration] of this.registrations.entries()) {
      counts[categoryId] = registration.manager.getItemsByOrganization(organizationId).length;
    }

    return counts;
  }

  /**
   * Render all items for guard info display
   */
  public renderAllItemsForGuardInfo(organizationId: string): Record<string, string[]> {
    const rendered: Record<string, string[]> = {};

    for (const [categoryId, registration] of this.registrations.entries()) {
      const items = registration.manager.getItemsByOrganization(organizationId);
      rendered[categoryId] = items.map((item) => registration.manager.renderItemInfo(item));
    }

    return rendered;
  }
}
