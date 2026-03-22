/**
 * Simple Resource Manager - Manages resources using game.settings
 * Migrated from Document-based to settings-based storage
 */

import type { Resource } from '../types/entities';

export class SimpleResourceManager {
  private resources: Map<string, Resource> = new Map();

  public async initialize(): Promise<void> {
    await this.loadFromSettings();
  }

  /**
   * Load resources from world settings (public for onChange callback)
   */
  public async loadFromSettings(): Promise<void> {
    try {
      const resources = game?.settings?.get('guard-management', 'resources') as Resource[] | null;
      if (resources && Array.isArray(resources)) {
        this.resources.clear();
        for (const r of resources) {
          this.resources.set(r.id, r);
        }
        console.log(`SimpleResourceManager | Loaded ${resources.length} resources from settings`);
      }
    } catch (e) {
      console.warn('SimpleResourceManager | loadFromSettings failed:', e);
    }
  }

  /**
   * Save resources to world settings
   */
  private async _saveToSettingsAsync(): Promise<void> {
    try {
      // Don't save if game is not ready yet
      if (!game?.ready) {
        console.log('SimpleResourceManager | Skipping save - game not ready yet');
        return;
      }

      const data = Array.from(this.resources.values());
      console.log('💾 SimpleResourceManager | Saving to settings...', {
        user: game?.user?.name,
        isGM: game?.user?.isGM,
        count: data.length,
      });
      await game?.settings?.set('guard-management', 'resources', data);
      console.log(`SimpleResourceManager | Saved ${data.length} resources to settings`);
    } catch (error) {
      console.error('SimpleResourceManager | Error saving resources:', error);
    }
  }

  /**
   * Create a new resource
   */
  public async createResource(data: {
    name: string;
    description: string;
    quantity: number;
    image?: string;
    organizationId: string;
  }): Promise<Resource> {
    const id = foundry.utils.randomID();

    const resource: Resource = {
      id,
      name: data.name,
      description: data.description,
      quantity: data.quantity,
      image: data.image || '',
      organizationId: data.organizationId,
      version: 1,
    };

    this.resources.set(id, resource);
    await this._saveToSettingsAsync();

    return resource;
  }

  /**
   * Get a resource by ID
   */
  public getResource(id: string): Resource | null {
    return this.resources.get(id) || null;
  }

  /**
   * Get all resources
   */
  public getAllResources(): Resource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Get resources for an organization
   */
  public getResourcesByOrganization(organizationId: string): Resource[] {
    return this.getAllResources().filter((r) => r.organizationId === organizationId);
  }

  /**
   * Update an existing resource
   */
  public async updateResource(id: string, updates: Partial<Resource>): Promise<Resource | null> {
    const resource = this.resources.get(id);
    if (!resource) return null;

    const updated: Resource = {
      ...resource,
      ...updates,
      id: resource.id,
      version: resource.version + 1,
    };

    this.resources.set(id, updated);
    await this._saveToSettingsAsync();

    return updated;
  }

  /**
   * Delete a resource
   */
  public async deleteResource(id: string): Promise<boolean> {
    const deleted = this.resources.delete(id);
    if (deleted) {
      await this._saveToSettingsAsync();
    }
    return deleted;
  }
}
