/**
 * Resource Manager - Manages organizational resources
 */

import { Resource, ValidationError, ValidationResult } from '../types/entities';

export interface CreateResourceData {
  name: string;
  description: string;
  quantity: number;
  organizationId: string;
}

export interface UpdateResourceData {
  name?: string;
  description?: string;
  quantity?: number;
}

export class ResourceManager {
  private resources: Map<string, Resource> = new Map();

  /**
   * Initialize the Resource Manager
   */
  public async initialize(): Promise<void> {
    await this.loadResourceData();
  }

  /**
   * Create a new resource
   */
  public createResource(data: CreateResourceData): Resource {
    const validation = this.validateResourceData(data);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`);
    }

    const resource: Resource = {
      id: this.generateId(),
      name: data.name,
      description: data.description,
      quantity: data.quantity,
      organizationId: data.organizationId,
      version: 1,
    };

    this.resources.set(resource.id, resource);
    this.saveResourceData();

    return resource;
  }

  /**
   * Get a resource by ID
   */
  public getResource(id: string): Resource | null {
    return this.resources.get(id) || null;
  }

  /**
   * Get all resources for an organization
   */
  public getResourcesByOrganization(organizationId: string): Resource[] {
    return Array.from(this.resources.values()).filter((r) => r.organizationId === organizationId);
  }

  /**
   * Get all resources
   */
  public getAllResources(): Resource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Update an existing resource
   */
  public updateResource(id: string, updates: UpdateResourceData): Resource {
    const resource = this.resources.get(id);
    if (!resource) {
      throw new Error(`Resource not found: ${id}`);
    }

    const validation = this.validateResourceData(updates, true);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`);
    }

    const updated: Resource = {
      ...resource,
      ...updates,
      version: resource.version + 1,
    };

    this.resources.set(id, updated);
    this.saveResourceData();

    return updated;
  }

  /**
   * Delete a resource
   */
  public deleteResource(id: string): boolean {
    const resource = this.resources.get(id);
    if (!resource) {
      console.error(`ResourceManager | Resource not found: ${id}`);
      return false;
    }

    this.resources.delete(id);
    this.saveResourceData();

    return true;
  }

  /**
   * Spend resources (reduce quantity)
   */
  public spendResource(id: string, amount: number): Resource {
    const resource = this.resources.get(id);
    if (!resource) {
      throw new Error(`Resource not found: ${id}`);
    }

    if (amount < 0) {
      throw new Error('Spend amount must be positive');
    }

    if (resource.quantity < amount) {
      throw new Error(
        `Insufficient resources. Available: ${resource.quantity}, Required: ${amount}`
      );
    }

    return this.updateResource(id, { quantity: resource.quantity - amount });
  }

  /**
   * Gain resources (increase quantity)
   */
  public gainResource(id: string, amount: number): Resource {
    const resource = this.resources.get(id);
    if (!resource) {
      throw new Error(`Resource not found: ${id}`);
    }

    if (amount < 0) {
      throw new Error('Gain amount must be positive');
    }

    return this.updateResource(id, { quantity: resource.quantity + amount });
  }

  /**
   * Validate resource data
   */
  private validateResourceData(
    data: Partial<CreateResourceData>,
    isUpdate = false
  ): ValidationResult {
    const errors: ValidationError[] = [];

    // Name validation
    if (!isUpdate || data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        errors.push({ field: 'name', message: 'Resource name is required' });
      } else if (data.name.length > 100) {
        errors.push({ field: 'name', message: 'Resource name must be less than 100 characters' });
      }
    }

    // Description validation
    if (!isUpdate || data.description !== undefined) {
      if (!data.description || data.description.trim().length === 0) {
        errors.push({ field: 'description', message: 'Resource description is required' });
      } else if (data.description.length > 500) {
        errors.push({
          field: 'description',
          message: 'Resource description must be less than 500 characters',
        });
      }
    }

    // Quantity validation
    if (!isUpdate || data.quantity !== undefined) {
      if (typeof data.quantity !== 'number' || data.quantity < 0) {
        errors.push({
          field: 'quantity',
          message: 'Resource quantity must be a non-negative number',
        });
      }
    }

    // Organization ID validation (only for create)
    if (!isUpdate && (!data.organizationId || data.organizationId.trim().length === 0)) {
      errors.push({ field: 'organizationId', message: 'Organization ID is required' });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }

  /**
   * Load resource data from Foundry settings
   */
  private async loadResourceData(): Promise<void> {
    try {
      const data = (game?.settings?.get('guard-management', 'resources') as Resource[]) || [];
      this.resources.clear();

      for (const resource of data) {
        this.resources.set(resource.id, resource);
      }
    } catch (error) {
      console.error('ResourceManager | Error loading resource data:', error);
    }
  }

  /**
   * Save resource data to Foundry settings
   */
  private async saveResourceData(): Promise<void> {
    try {
      const data = Array.from(this.resources.values());
      await game?.settings?.set('guard-management', 'resources', data);
    } catch (error) {
      console.error('ResourceManager | Error saving resource data:', error);
    }
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.resources.clear();
  }
}
