import { DEFAULT_GUARD_STATS, GuardOrganization, GuardStats } from '../types/entities';

export class GuardOrganizationManager {
  constructor() {
    // Simple constructor
  }

  public async initialize(): Promise<void> {
    console.log('GuardOrganizationManager initialized');
  }

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

  public async getAllOrganizations(): Promise<GuardOrganization[]> {
    try {
      const savedOrganizations = game?.settings?.get(
        'guard-management',
        'guardOrganizations'
      ) as GuardOrganization[];
      return Array.isArray(savedOrganizations) ? savedOrganizations : [];
    } catch (error) {
      return [];
    }
  }
}
