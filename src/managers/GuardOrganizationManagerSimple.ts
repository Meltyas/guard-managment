import { DEFAULT_GUARD_STATS, GuardOrganization, GuardStats } from '../types/entities';

export class GuardOrganizationManager {
  constructor() {
    // Simple constructor for now
  }

  /**
   * Create a new guard organization
   */
  public async createOrganization(organizationData: {
    name: string;
    subtitle?: string;
    baseStats?: GuardStats;
  }): Promise<GuardOrganization> {
    const newOrganization: GuardOrganization = {
      id: foundry.utils.randomID(),
      name: organizationData.name,
      subtitle: organizationData.subtitle || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      baseStats: organizationData.baseStats || { ...DEFAULT_GUARD_STATS },
      activeModifiers: [],
      resources: [],
      reputation: [],
      patrols: [],
    };

    return newOrganization;
  }

  /**
   * Get all guard organizations
   */
  public async getAllOrganizations(): Promise<GuardOrganization[]> {
    try {
      const savedOrganizations = game?.settings?.get(
        'guard-management',
        'guardOrganizations'
      ) as GuardOrganization[];
      return Array.isArray(savedOrganizations) ? savedOrganizations : [];
    } catch (error) {
      console.error('Failed to get all organizations', error);
      return [];
    }
  }
}
