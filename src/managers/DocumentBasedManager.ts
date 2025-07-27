/**
 * DocumentBasedManager - Replaces Settings-based storage with Document sub-types
 * Manages Guard Organizations, Patrols, Resources, and Reputation using Foundry Documents
 */

import {
  createGuardOrganization,
  createGuardReputation,
  createGuardResource,
  createPatrol,
} from '../documents/index.js';
import { GuardOrganization, Patrol, Reputation, Resource } from '../types/entities.js';

export class DocumentBasedManager {
  private initialized = false;

  constructor() {
    console.log('DocumentBasedManager | Constructor called');
  }

  /**
   * Initialize the manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('DocumentBasedManager | Initializing...');

    // Hook into document updates for real-time sync
    this.setupDocumentHooks();

    this.initialized = true;
    console.log('DocumentBasedManager | Initialization complete');
  }

  /**
   * Setup hooks for document changes
   */
  private setupDocumentHooks(): void {
    // Listen for Actor updates (Organizations and Patrols)
    Hooks.on('updateActor', (actor: any, data: any, _options: any, userId: string) => {
      if (actor.type?.startsWith('guard-management.')) {
        console.log(`DocumentBasedManager | Actor updated: ${actor.name} (${actor.type})`);
        this.onDocumentUpdate('actor', actor, data, userId);
      }
    });

    // Listen for Item updates (Resources and Reputation)
    Hooks.on('updateItem', (item: any, data: any, _options: any, userId: string) => {
      if (item.type?.startsWith('guard-management.')) {
        console.log(`DocumentBasedManager | Item updated: ${item.name} (${item.type})`);
        this.onDocumentUpdate('item', item, data, userId);
      }
    });

    // Listen for Actor creation
    Hooks.on('createActor', (actor: any, _options: any, userId: string) => {
      if (actor.type?.startsWith('guard-management.')) {
        console.log(`DocumentBasedManager | Actor created: ${actor.name} (${actor.type})`);
        this.onDocumentCreate('actor', actor, userId);
      }
    });

    // Listen for Item creation
    Hooks.on('createItem', (item: any, _options: any, userId: string) => {
      if (item.type?.startsWith('guard-management.')) {
        console.log(`DocumentBasedManager | Item created: ${item.name} (${item.type})`);
        this.onDocumentCreate('item', item, userId);
      }
    });

    // Listen for Actor deletion
    Hooks.on('deleteActor', (actor: any, _options: any, userId: string) => {
      if (actor.type?.startsWith('guard-management.')) {
        console.log(`DocumentBasedManager | Actor deleted: ${actor.name} (${actor.type})`);
        this.onDocumentDelete('actor', actor, userId);
      }
    });

    // Listen for Item deletion
    Hooks.on('deleteItem', (item: any, _options: any, userId: string) => {
      if (item.type?.startsWith('guard-management.')) {
        console.log(`DocumentBasedManager | Item deleted: ${item.name} (${item.type})`);
        this.onDocumentDelete('item', item, userId);
      }
    });
  }

  /**
   * Handle document updates
   */
  private onDocumentUpdate(
    docType: 'actor' | 'item',
    document: any,
    data: any,
    userId: string
  ): void {
    // Emit custom events for UI updates
    const event = new CustomEvent('guard-document-updated', {
      detail: {
        docType,
        document,
        data,
        userId,
        type: document.type,
      },
    });
    window.dispatchEvent(event);
  }

  /**
   * Handle document creation
   */
  private onDocumentCreate(docType: 'actor' | 'item', document: any, userId: string): void {
    const event = new CustomEvent('guard-document-created', {
      detail: {
        docType,
        document,
        userId,
        type: document.type,
      },
    });
    window.dispatchEvent(event);
  }

  /**
   * Handle document deletion
   */
  private onDocumentDelete(docType: 'actor' | 'item', document: any, userId: string): void {
    const event = new CustomEvent('guard-document-deleted', {
      detail: {
        docType,
        document,
        userId,
        type: document.type,
      },
    });
    window.dispatchEvent(event);
  }

  // === GUARD ORGANIZATION METHODS ===

  /**
   * Get all Guard Organizations
   */
  getGuardOrganizations(): any[] {
    if (!game?.actors) return [];

    return game.actors.filter((actor: any) => actor.type === 'guard-management.guard-organization');
  }

  /**
   * Get a Guard Organization by ID
   */
  getGuardOrganization(id: string): any | null {
    if (!game?.actors) return null;

    const actor = game.actors.get(id);
    return actor?.type === 'guard-management.guard-organization' ? actor : null;
  }

  /**
   * Create a new Guard Organization
   */
  async createGuardOrganization(data: Partial<GuardOrganization>): Promise<any> {
    return await createGuardOrganization(data);
  }

  /**
   * Update a Guard Organization
   */
  async updateGuardOrganization(id: string, data: Partial<GuardOrganization>): Promise<boolean> {
    const org = this.getGuardOrganization(id);
    if (!org) return false;

    const updateData: any = {};

    if (data.name) updateData.name = data.name;
    if (data.subtitle) updateData['system.subtitle'] = data.subtitle;
    if (data.baseStats) updateData['system.baseStats'] = data.baseStats;
    if (data.version) updateData['system.version'] = data.version;

    await org.update(updateData);
    return true;
  }

  /**
   * Delete a Guard Organization
   */
  async deleteGuardOrganization(id: string): Promise<boolean> {
    const org = this.getGuardOrganization(id);
    if (!org) return false;

    // Also delete associated patrols, resources, and reputation
    await this.cleanupOrganizationReferences(id);

    await org.delete();
    return true;
  }

  // === PATROL METHODS ===

  /**
   * Get all Patrols
   */
  getPatrols(): any[] {
    if (!game?.actors) return [];

    return game.actors.filter((actor: any) => actor.type === 'guard-management.patrol');
  }

  /**
   * Get Patrols for a specific organization
   */
  getPatrolsForOrganization(organizationId: string): any[] {
    return this.getPatrols().filter(
      (patrol: any) => patrol.system.organizationId === organizationId
    );
  }

  /**
   * Create a new Patrol
   */
  async createPatrol(data: Partial<Patrol>): Promise<any> {
    const patrol = await createPatrol(data);

    // Add patrol to organization's patrol list
    if (data.organizationId) {
      const org = this.getGuardOrganization(data.organizationId);
      if (org) {
        await org.system.addPatrol(patrol.id);
      }
    }

    return patrol;
  }

  /**
   * Update a Patrol
   */
  async updatePatrol(id: string, data: Partial<Patrol>): Promise<boolean> {
    const patrol = game?.actors?.get(id);
    if (!patrol || patrol.type !== 'guard-management.patrol') return false;

    const updateData: any = {};

    if (data.name) updateData.name = data.name;
    if (data.leaderId) updateData['system.leaderId'] = data.leaderId;
    if (data.unitCount) updateData['system.unitCount'] = data.unitCount;
    if (data.status) updateData['system.status'] = data.status;
    if (data.version) updateData['system.version'] = data.version;

    await patrol.update(updateData);
    return true;
  }

  /**
   * Delete a Patrol
   */
  async deletePatrol(id: string): Promise<boolean> {
    const patrol = game?.actors?.get(id);
    if (!patrol || patrol.type !== 'guard-management.patrol') return false;

    // Remove from organization's patrol list
    const organizationId = patrol.system.organizationId;
    if (organizationId) {
      const org = this.getGuardOrganization(organizationId);
      if (org) {
        await org.system.removePatrol(id);
      }
    }

    await patrol.delete();
    return true;
  }

  // === RESOURCE METHODS ===

  /**
   * Get all Guard Resources
   */
  getGuardResources(): any[] {
    if (!game?.items) return [];

    return game.items.filter((item: any) => item.type === 'guard-management.guard-resource');
  }

  /**
   * Get Resources for a specific organization
   */
  getResourcesForOrganization(organizationId: string): any[] {
    return this.getGuardResources().filter(
      (resource: any) => resource.system.organizationId === organizationId
    );
  }

  /**
   * Create a new Guard Resource
   */
  async createGuardResource(data: Partial<Resource>): Promise<any> {
    const resource = await createGuardResource(data);

    // Add resource to organization's resource list
    if (data.organizationId) {
      const org = this.getGuardOrganization(data.organizationId);
      if (org) {
        await org.system.addResource(resource.id);
      }
    }

    return resource;
  }

  /**
   * Update a Guard Resource
   */
  async updateGuardResource(id: string, data: Partial<Resource>): Promise<boolean> {
    const resource = game?.items?.get(id);
    if (!resource || resource.type !== 'guard-management.guard-resource') return false;

    const updateData: any = {};

    if (data.name) updateData.name = data.name;
    if (data.description) updateData['system.description'] = data.description;
    if (data.quantity !== undefined) updateData['system.quantity'] = data.quantity;
    if (data.image !== undefined) {
      updateData['system.image'] = data.image;
      updateData.img = data.image; // También actualizar el campo img de Foundry
    }
    if (data.version) updateData['system.version'] = data.version;

    console.log('💾 About to update resource with:', {
      resourceId: id,
      inputData: data,
      updateData,
      currentSystemImage: resource.system?.image,
      currentImg: resource.img,
    });

    await resource.update(updateData);

    // Debug: Check what was actually saved
    const updatedResource = game?.items?.get(id);
    console.log('🔍 After update, resource system:', {
      resourceId: id,
      systemImage: updatedResource?.system?.image,
      imgField: updatedResource?.img,
      wholeSystem: updatedResource?.system,
    });

    return true;
  }

  /**
   * Delete a Guard Resource permanently
   */
  async deleteGuardResource(id: string): Promise<boolean> {
    const resource = game?.items?.get(id);
    if (!resource || resource.type !== 'guard-management.guard-resource') return false;

    try {
      // Remove resource from all organizations that have it
      const organizations = this.getGuardOrganizations();
      for (const org of organizations) {
        if (org.system?.resources?.includes(id)) {
          const newResources = org.system.resources.filter(
            (resourceId: string) => resourceId !== id
          );
          await this.updateGuardOrganization(org.id, {
            resources: newResources,
            version: (org.system.version || 0) + 1,
            updatedAt: new Date(),
          });
        }
      }

      // Delete the resource document
      await resource.delete();
      console.log(`✅ Resource ${resource.name} deleted permanently`);
      return true;
    } catch (error) {
      console.error('❌ Error deleting resource:', error);
      return false;
    }
  }

  // === REPUTATION METHODS ===

  /**
   * Get all Guard Reputations
   */
  getGuardReputations(): any[] {
    if (!game?.items) return [];

    return game.items.filter((item: any) => item.type === 'guard-management.guard-reputation');
  }

  /**
   * Get Reputations for a specific organization
   */
  getReputationsForOrganization(organizationId: string): any[] {
    return this.getGuardReputations().filter(
      (reputation: any) => reputation.system.organizationId === organizationId
    );
  }

  /**
   * Create a new Guard Reputation
   */
  async createGuardReputation(data: Partial<Reputation>): Promise<any> {
    const reputation = await createGuardReputation(data);

    // Add reputation to organization's reputation list
    if (data.organizationId) {
      const org = this.getGuardOrganization(data.organizationId);
      if (org) {
        await org.system.addReputation(reputation.id);
      }
    }

    return reputation;
  }

  // === UTILITY METHODS ===

  /**
   * Clean up references when an organization is deleted
   */
  private async cleanupOrganizationReferences(organizationId: string): Promise<void> {
    // Delete all patrols
    const patrols = this.getPatrolsForOrganization(organizationId);
    for (const patrol of patrols) {
      await patrol.delete();
    }

    // Delete all resources
    const resources = this.getResourcesForOrganization(organizationId);
    for (const resource of resources) {
      await resource.delete();
    }

    // Delete all reputation entries
    const reputations = this.getReputationsForOrganization(organizationId);
    for (const reputation of reputations) {
      await reputation.delete();
    }
  }

  /**
   * Create sample data for testing
   */
  async createSampleData(): Promise<void> {
    console.log('DocumentBasedManager | Creating sample data...');

    // Create a sample organization
    const org = await this.createGuardOrganization({
      name: 'City Watch',
      subtitle: 'Protectors of the Realm',
      baseStats: {
        robustismo: 12,
        analitica: 10,
        subterfugio: 8,
        elocuencia: 11,
      },
    });

    // Create a sample patrol
    await this.createPatrol({
      name: 'Alpha Patrol',
      organizationId: org.id,
      unitCount: 4,
      status: 'idle',
    });

    // Create sample resources
    await this.createGuardResource({
      name: 'Steel Weapons',
      description: 'High-quality steel swords and shields',
      quantity: 25,
      organizationId: org.id,
    });

    await this.createGuardResource({
      name: 'Healing Potions',
      description: 'Minor healing potions for field use',
      quantity: 12,
      organizationId: org.id,
    });

    // Create sample reputation
    await this.createGuardReputation({
      name: 'Noble Houses',
      description: 'Reputation with the local nobility',
      level: 5, // Amistosos
      organizationId: org.id,
    });

    console.log('DocumentBasedManager | Sample data created successfully');
  }

  /**
   * Cleanup when module is disabled
   */
  cleanup(): void {
    console.log('DocumentBasedManager | Cleaning up...');
    // Remove hooks if needed
    this.initialized = false;
  }
}
