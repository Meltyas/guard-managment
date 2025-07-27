/**
 * Base Warehouse Manager
 * Generic manager for all warehouse items
 */

import {
  BaseWarehouseItem,
  WarehouseItemEvent,
  WarehouseItemType,
  WarehouseTemplate,
} from '../types/warehouse';

export abstract class BaseWarehouseManager<T extends BaseWarehouseItem> {
  protected items: Map<string, T> = new Map();
  protected templates: Map<string, WarehouseTemplate<T>> = new Map();
  protected itemType: WarehouseItemType<T>;

  constructor(itemType: WarehouseItemType<T>) {
    this.itemType = itemType;
  }

  /**
   * Initialize the manager
   */
  public async initialize(): Promise<void> {
    await this.loadData();
    await this.loadTemplates();
  }

  /**
   * Create a new item
   */
  public createItem(data: Partial<T>): T {
    const validation = this.itemType.validate(data);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`);
    }

    const item: T = {
      id: this.generateId(),
      name: data.name || '',
      description: data.description || '',
      organizationId: data.organizationId || '',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...this.itemType.createNew(),
      ...data,
    } as T;

    this.items.set(item.id, item);
    this.saveData();
    this.triggerEvent('create', item);

    return item;
  }

  /**
   * Update an existing item
   */
  public updateItem(id: string, data: Partial<T>): T {
    const existingItem = this.items.get(id);
    if (!existingItem) {
      throw new Error(`Item with id ${id} not found`);
    }

    const updatedData = {
      ...existingItem,
      ...data,
      updatedAt: new Date(),
      version: existingItem.version + 1,
    };
    const validation = this.itemType.validate(updatedData);

    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`);
    }

    const updatedItem = updatedData as T;
    this.items.set(id, updatedItem);
    this.saveData();
    this.triggerEvent('update', updatedItem, existingItem);

    return updatedItem;
  }

  /**
   * Delete an item
   */
  public deleteItem(id: string): void {
    const item = this.items.get(id);
    if (!item) {
      throw new Error(`Item with id ${id} not found`);
    }

    this.items.delete(id);
    this.saveData();
    this.triggerEvent('delete', item);
  }

  /**
   * Get item by ID
   */
  public getItem(id: string): T | undefined {
    return this.items.get(id);
  }

  /**
   * Get all items for an organization
   */
  public getItemsByOrganization(organizationId: string): T[] {
    return Array.from(this.items.values()).filter((item) => item.organizationId === organizationId);
  }

  /**
   * Get all items
   */
  public getAllItems(): T[] {
    return Array.from(this.items.values());
  }

  /**
   * Template management
   */
  public createTemplate(name: string, description: string, baseItem: T): WarehouseTemplate<T> {
    const template: WarehouseTemplate<T> = {
      id: this.generateId(),
      name,
      description,
      category: this.itemType.category.id,
      data: this.stripBaseProperties(baseItem),
    };

    this.templates.set(template.id, template);
    this.saveTemplates();

    return template;
  }

  public getTemplate(id: string): WarehouseTemplate<T> | undefined {
    return this.templates.get(id);
  }

  public getAllTemplates(): WarehouseTemplate<T>[] {
    return Array.from(this.templates.values());
  }

  public deleteTemplate(id: string): void {
    this.templates.delete(id);
    this.saveTemplates();
  }

  public createItemFromTemplate(
    templateId: string,
    organizationId: string,
    overrides: Partial<T> = {}
  ): T {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template with id ${templateId} not found`);
    }

    return this.createItem({
      ...template.data,
      organizationId,
      ...overrides,
    } as Partial<T>);
  }

  /**
   * Render methods for UI integration
   */
  public renderItemInfo(item: T): string {
    return this.itemType.renderInfo(item);
  }

  public renderChatMessage(item: T, action: string): string {
    return this.itemType.renderChatMessage(item, action);
  }

  /**
   * Abstract methods to be implemented by subclasses
   */
  protected abstract loadData(): Promise<void>;
  protected abstract saveData(): Promise<void>;
  protected abstract loadTemplates(): Promise<void>;
  protected abstract saveTemplates(): Promise<void>;

  /**
   * Utility methods
   */
  protected generateId(): string {
    return `${this.itemType.category.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected stripBaseProperties(
    item: T
  ): Omit<T, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'version'> {
    const { id, organizationId, createdAt, updatedAt, version, ...data } = item;
    return data as Omit<T, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'version'>;
  }

  protected triggerEvent(operation: string, item: T, previousItem?: T): void {
    const event = new CustomEvent(`warehouse:${this.itemType.category.id}:${operation}`, {
      detail: {
        operation,
        item,
        previousItem,
        organizationId: item.organizationId,
      } as WarehouseItemEvent<T>,
    });

    document.dispatchEvent(event);
  }
}
