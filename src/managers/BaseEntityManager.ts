/**
 * Base Entity Manager - Generic manager implementing Manageable trait
 * Provides common CRUD operations that can be extended for specific entities
 */

import { EntityFactory } from '../core/entity-framework';
import {
  EntityConfig,
  EntityManagerConfig,
  Identifiable,
  Manageable,
  Validateable,
} from '../core/traits';

/**
 * Generic Base Manager for entities
 * Implements common CRUD operations with validation
 */
export abstract class BaseEntityManager<T extends Identifiable> implements Manageable<T> {
  protected entities: Map<string, T> = new Map();
  protected config: EntityConfig<T>;
  protected managerConfig: EntityManagerConfig;
  protected validator: Validateable<T>;

  constructor(config: EntityConfig<T>) {
    this.config = config;
    this.managerConfig = config.manager || {
      storageKey: config.entityType,
      cacheEnabled: true,
      syncStrategy: 'immediate',
    };
    this.validator = EntityFactory.createValidator(config);
  }

  /**
   * Initialize the manager (load data from storage)
   */
  public async initialize(): Promise<void> {
    await this.loadData();
  }

  /**
   * Create a new entity
   */
  public async create(data: Partial<T>): Promise<T> {
    // Validate the data
    const validation = this.validator.validatePartial
      ? this.validator.validatePartial(data)
      : this.validator.validate(data as T);

    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`);
    }

    // Create the entity with generated ID and version
    const entity = this.createEntityFromData(data);

    // Apply extensions before storing
    const processedEntity = await this.applyExtensions(entity);

    // Store the entity
    this.entities.set(processedEntity.id, processedEntity);

    // Save if immediate sync is enabled
    if (this.managerConfig.syncStrategy === 'immediate') {
      await this.saveData();
    }

    return processedEntity;
  }

  /**
   * Get entity by ID
   */
  public async getById(id: string): Promise<T | null> {
    const entity = this.entities.get(id) || null;

    if (entity && this.config.extensions?.length) {
      // Apply extensions to fresh data
      return await this.applyExtensions(entity);
    }

    return entity;
  }

  /**
   * Get all entities
   */
  public async getAll(): Promise<T[]> {
    const entities = Array.from(this.entities.values());

    if (this.config.extensions?.length) {
      // Apply extensions to all entities
      const processedEntities = await Promise.all(
        entities.map((entity) => this.applyExtensions(entity))
      );
      return processedEntities;
    }

    return entities;
  }

  /**
   * Update an existing entity
   */
  public async update(id: string, data: Partial<T>): Promise<T> {
    const existingEntity = this.entities.get(id);
    if (!existingEntity) {
      throw new Error(`${this.config.displayName} not found: ${id}`);
    }

    // Create updated entity
    const updatedEntity = {
      ...existingEntity,
      ...data,
      version: existingEntity.version + 1,
    } as T;

    // Validate the updated entity
    const validation = this.validator.validate(updatedEntity);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`);
    }

    // Apply extensions
    const processedEntity = await this.applyExtensions(updatedEntity);

    // Store the updated entity
    this.entities.set(id, processedEntity);

    // Save if immediate sync is enabled
    if (this.managerConfig.syncStrategy === 'immediate') {
      await this.saveData();
    }

    return processedEntity;
  }

  /**
   * Delete an entity
   */
  public async delete(id: string): Promise<boolean> {
    const entity = this.entities.get(id);
    if (!entity) {
      console.error(`${this.config.displayName} not found: ${id}`);
      return false;
    }

    this.entities.delete(id);

    // Save if immediate sync is enabled
    if (this.managerConfig.syncStrategy === 'immediate') {
      await this.saveData();
    }

    return true;
  }

  /**
   * Apply entity extensions in priority order
   */
  protected async applyExtensions(entity: T, context?: any): Promise<T> {
    if (!this.config.extensions?.length) {
      return entity;
    }

    let processedEntity = entity;

    // Sort extensions by priority (higher priority first)
    const sortedExtensions = [...this.config.extensions].sort(
      (a, b) => (b.priority || 0) - (a.priority || 0)
    );

    for (const extension of sortedExtensions) {
      if (extension.canHandle(processedEntity, context)) {
        try {
          processedEntity = await extension.extend(processedEntity, context);
        } catch (error) {
          console.error(`Error applying extension ${extension.name}:`, error);
        }
      }
    }

    return processedEntity;
  }

  /**
   * Create entity from partial data - to be implemented by subclasses
   */
  protected abstract createEntityFromData(data: Partial<T>): T;

  /**
   * Load data from storage
   */
  protected async loadData(): Promise<void> {
    try {
      const data =
        (game?.settings?.get('guard-management', this.managerConfig.storageKey) as T[]) || [];
      this.entities.clear();

      for (const entity of data) {
        this.entities.set(entity.id, entity);
      }

      console.log(`✅ Loaded ${data.length} ${this.config.pluralName}`);
    } catch (error) {
      console.error(`Error loading ${this.config.pluralName}:`, error);
    }
  }

  /**
   * Save data to storage
   */
  protected async saveData(): Promise<void> {
    try {
      const data = Array.from(this.entities.values());
      await game?.settings?.set('guard-management', this.managerConfig.storageKey, data);

      console.log(`💾 Saved ${data.length} ${this.config.pluralName}`);
    } catch (error) {
      console.error(`Error saving ${this.config.pluralName}:`, error);
    }
  }

  /**
   * Force save (for batched sync strategy)
   */
  public async forceSave(): Promise<void> {
    await this.saveData();
  }

  /**
   * Generate a unique ID
   */
  protected generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.entities.clear();
  }

  /**
   * Get entity count
   */
  public getCount(): number {
    return this.entities.size;
  }

  /**
   * Check if entity exists
   */
  public exists(id: string): boolean {
    return this.entities.has(id);
  }
}
