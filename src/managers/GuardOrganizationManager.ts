import { GuardOrganizationDialog } from '../dialogs/GuardOrganizationDialog';
import { DEFAULT_GUARD_STATS, GuardOrganization, GuardStats } from '../types/entities';

export class GuardOrganizationManager {
  private organization: GuardOrganization | null = null; // Solo una organización
  private dialog: GuardOrganizationDialog;

  constructor() {
    this.dialog = new GuardOrganizationDialog();
  }

  public async initialize(): Promise<void> {
    console.log('GuardOrganizationManager | Initializing...');
    await this.loadOrganization();

    // Si no hay organización, crear una por defecto
    if (!this.organization) {
      await this.createDefaultOrganization();
    }

    console.log('GuardOrganizationManager | Initialized successfully');
  }

  /**
   * Crear organización por defecto
   */
  private async createDefaultOrganization(): Promise<void> {
    console.log('GuardOrganizationManager | Creating default organization...');

    const defaultOrg: GuardOrganization = {
      id: foundry.utils.randomID(),
      name: 'Guardia de la Ciudad',
      subtitle: 'Organización de Guardias Principal',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      baseStats: { ...DEFAULT_GUARD_STATS },
      activeModifiers: [],
      resources: [],
      reputation: [],
      patrols: [],
    };

    await this.saveOrganization(defaultOrg);
    console.log('GuardOrganizationManager | Default organization created');
  }

  /**
   * Show dialog to edit the organization (no create, solo edit)
   */
  public async showEditDialog(): Promise<GuardOrganization | null> {
    if (!this.organization) {
      console.warn('GuardOrganizationManager | No organization to edit');
      ui?.notifications?.warn('No hay organización para editar');
      return null;
    }

    const result = await this.dialog.show('edit', this.organization);
    if (result) {
      await this.saveOrganization(result);
      console.log(`GuardOrganizationManager | Updated organization: ${result.name} (${result.id})`);
    }
    return result;
  }

  /**
   * Create a new organization programmatically (reemplaza la existente)
   */
  public async createOrganization(organizationData: {
    name: string;
    subtitle?: string;
    baseStats?: GuardStats;
  }): Promise<GuardOrganization> {
    // Validate required fields
    if (!organizationData.name || organizationData.name.trim().length === 0) {
      throw new Error('Organization name is required and cannot be empty');
    }

    const newOrganization: GuardOrganization = {
      id: foundry.utils.randomID(),
      name: organizationData.name.trim(),
      subtitle: organizationData.subtitle?.trim() || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      baseStats: organizationData.baseStats || { ...DEFAULT_GUARD_STATS },
      activeModifiers: [],
      resources: [],
      reputation: [],
      patrols: [],
    };

    await this.saveOrganization(newOrganization);
    return newOrganization;
  }

  /**
   * Update the existing organization
   */
  public async updateOrganization(
    updates: Partial<Omit<GuardOrganization, 'id' | 'createdAt' | 'version'>>
  ): Promise<GuardOrganization | null> {
    if (!this.organization) {
      console.warn('GuardOrganizationManager | No organization to update');
      return null;
    }

    const updated: GuardOrganization = {
      ...this.organization,
      ...updates,
      id: this.organization.id,
      createdAt: this.organization.createdAt,
      updatedAt: new Date(),
      version: this.organization.version + 1,
    };

    await this.saveOrganization(updated);
    console.log(`GuardOrganizationManager | Updated organization: ${updated.name}`);
    return updated;
  }

  /**
   * Get the organization
   */
  public getOrganization(): GuardOrganization | null {
    return this.organization;
  }

  /**
   * Get all organizations (solo devuelve la única organización)
   */
  public getAllOrganizations(): GuardOrganization[] {
    return this.organization ? [this.organization] : [];
  }

  /**
   * Delete the organization (reemplaza con una nueva por defecto)
   */
  public async deleteOrganization(): Promise<boolean> {
    if (!this.organization) {
      console.warn('GuardOrganizationManager | No organization to delete');
      return false;
    }

    console.log(`GuardOrganizationManager | Deleting organization: ${this.organization.name}`);
    this.organization = null;
    await this.createDefaultOrganization();

    return true;
  }

  /**
   * Create sample organization for testing (reemplaza la existente)
   */
  public async createSampleOrganization(): Promise<void> {
    const sampleData = {
      name: 'Guardia de la Ciudad',
      subtitle: 'Protectores del Pueblo',
      baseStats: { robustismo: 12, analitica: 10, subterfugio: 8, elocuencia: 11 },
    };

    await this.createOrganization(sampleData);
    console.log('GuardOrganizationManager | Created sample organization for testing');
  }

  /**
   * Save the organization
   */
  private async saveOrganization(organization: GuardOrganization): Promise<void> {
    this.organization = organization;
    await this.saveToSettings();
  }

  /**
   * Save organization to game settings
   */
  private async saveToSettings(): Promise<void> {
    try {
      await game?.settings?.set('guard-management', 'guardOrganization', this.organization);
      console.log('GuardOrganizationManager | Saved organization to settings');
    } catch (error) {
      console.error('GuardOrganizationManager | Error saving organization:', error);
    }
  }

  /**
   * Load organization from game settings
   */
  private async loadOrganization(): Promise<void> {
    try {
      const savedOrganization = game?.settings?.get(
        'guard-management',
        'guardOrganization'
      ) as GuardOrganization | null;

      this.organization = savedOrganization;

      if (savedOrganization) {
        console.log(`GuardOrganizationManager | Loaded organization: ${savedOrganization.name}`);
      } else {
        console.log('GuardOrganizationManager | No saved organization found');
      }
    } catch (error) {
      console.error('GuardOrganizationManager | Error loading organization:', error);
    }
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.organization = null;
    console.log('GuardOrganizationManager | Cleaned up');
  }
}
