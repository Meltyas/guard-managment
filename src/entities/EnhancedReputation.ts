/**
 * Reputation Implementation using Warehouse System
 * Following exactly the same pattern as EnhancedResource
 */

import { BaseWarehouseItemDialog } from '../dialogs/BaseWarehouseItemDialog';
import { BaseWarehouseManager } from '../managers/BaseWarehouseManager';
import { REPUTATION_LABELS, ReputationLevel } from '../types/entities';
import {
  BaseWarehouseItem,
  ValidationResult,
  WarehouseItemCategory,
  WarehouseItemDialogConfig,
  WarehouseItemType,
} from '../types/warehouse';

// Reputation interface extending BaseWarehouseItem
export interface Reputation extends BaseWarehouseItem {
  level: ReputationLevel;

  // Reputation-specific properties
  faction?: string;
  relationship?: string;
  notes?: string;
  lastInteraction?: Date;
}

// Create/Update interfaces
export interface CreateReputationData {
  name: string;
  description: string;
  level: ReputationLevel;
  organizationId: string;
  image?: string;
  faction?: string;
  relationship?: string;
  notes?: string;
}

export interface UpdateReputationData {
  name?: string;
  description?: string;
  level?: ReputationLevel;
  image?: string;
  faction?: string;
  relationship?: string;
  notes?: string;
}

export const REPUTATION_CATEGORY: WarehouseItemCategory = {
  id: 'reputation',
  name: 'Reputation',
  description: 'Reputation entries with factions',
  icon: 'fas fa-handshake',
  singularName: 'Reputación',
  pluralName: 'Reputaciones',
};

export const REPUTATION_TYPE: WarehouseItemType<Reputation> = {
  category: REPUTATION_CATEGORY,

  createNew: () => ({
    level: ReputationLevel.Neutrales,
    faction: '',
    relationship: '',
    notes: '',
    lastInteraction: new Date(),
  }),

  validate: (data: Partial<Reputation>): ValidationResult => {
    const errors: { field: string; message: string }[] = [];

    if (!data.name?.trim()) {
      errors.push({ field: 'name', message: 'El nombre de la facción es requerido' });
    }

    if (!data.description?.trim()) {
      errors.push({
        field: 'description',
        message: 'La descripción de la reputación es requerida',
      });
    }

    if (!data.organizationId?.trim()) {
      errors.push({ field: 'organizationId', message: 'El ID de organización es requerido' });
    }

    if (
      data.level !== undefined &&
      (typeof data.level !== 'number' || data.level < 1 || data.level > 7)
    ) {
      errors.push({ field: 'level', message: 'El nivel de reputación debe estar entre 1 y 7' });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  renderInfo: (reputation: Reputation) => {
    const levelText = REPUTATION_LABELS[reputation.level] || `Level ${reputation.level}`;
    const relationshipText = reputation.relationship ? ` (${reputation.relationship})` : '';

    return `
      <div class="reputation-info">
        <span class="reputation-icon"><i class="fas fa-handshake"></i></span>
        <span class="reputation-name">${reputation.name}</span>
        <span class="reputation-level">${levelText}</span>
        ${relationshipText ? `<span class="reputation-relationship">${relationshipText}</span>` : ''}
      </div>
    `;
  },

  renderChatMessage: (reputation: Reputation, action: string) => {
    const levelText = REPUTATION_LABELS[reputation.level] || `Level ${reputation.level}`;
    const actionText =
      action === 'create'
        ? 'Nueva reputación registrada'
        : action === 'update'
          ? 'Reputación actualizada'
          : action === 'delete'
            ? 'Reputación eliminada'
            : 'Reputación';

    return `
      <div class="chat-message reputation-message">
        <div class="message-header">
          <strong>${actionText}: ${reputation.name}</strong>
        </div>
        <div class="message-content">
          <p><strong>Descripción:</strong> ${reputation.description}</p>
          <p><strong>Nivel:</strong> ${levelText}</p>
          ${reputation.faction ? `<p><strong>Facción:</strong> ${reputation.faction}</p>` : ''}
          ${reputation.relationship ? `<p><strong>Relación:</strong> ${reputation.relationship}</p>` : ''}
          ${reputation.notes ? `<p><strong>Notas:</strong> ${reputation.notes}</p>` : ''}
        </div>
      </div>
    `;
  },
};

/**
 * Reputation Manager using Warehouse System
 */
export class ReputationManager extends BaseWarehouseManager<Reputation> {
  constructor() {
    super(REPUTATION_TYPE);
  }

  /**
   * Load data from Foundry settings
   */
  protected async loadData(): Promise<void> {
    try {
      const data = (game?.settings?.get('guard-management', 'reputations') as Reputation[]) || [];
      this.items.clear();

      for (const reputation of data) {
        this.items.set(reputation.id, reputation);
      }

      console.log(`ReputationManager | Loaded ${data.length} reputations`);
    } catch (error) {
      console.warn('ReputationManager | Error loading reputation data:', error);
    }
  }

  /**
   * Save data to Foundry settings
   */
  protected async saveData(): Promise<void> {
    try {
      const data = Array.from(this.items.values());
      await game?.settings?.set('guard-management', 'reputations', data);
      console.log(`ReputationManager | Saved ${data.length} reputations`);
    } catch (error) {
      console.error('ReputationManager | Error saving reputation data:', error);
    }
  }

  /**
   * Load templates from Foundry settings
   */
  protected async loadTemplates(): Promise<void> {
    try {
      const data = (game?.settings?.get('guard-management', 'reputation-templates') as any[]) || [];
      this.templates.clear();

      for (const template of data) {
        this.templates.set(template.id, template);
      }

      console.log(`ReputationManager | Loaded ${data.length} reputation templates`);
    } catch (error) {
      console.warn('ReputationManager | Error loading reputation templates:', error);
    }
  }

  /**
   * Save templates to Foundry settings
   */
  protected async saveTemplates(): Promise<void> {
    try {
      const data = Array.from(this.templates.values());
      await game?.settings?.set('guard-management', 'reputation-templates', data);
      console.log(`ReputationManager | Saved ${data.length} reputation templates`);
    } catch (error) {
      console.error('ReputationManager | Error saving reputation templates:', error);
    }
  }

  /**
   * Create a new reputation
   */
  public async createReputation(data: CreateReputationData): Promise<Reputation> {
    const reputationData: Partial<Reputation> = {
      ...data,
      id: crypto.randomUUID(),
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.createItem(reputationData);
  }

  /**
   * Update an existing reputation
   */
  public async updateReputation(id: string, updates: UpdateReputationData): Promise<Reputation> {
    return this.updateItem(id, updates);
  }

  /**
   * Get reputations by organization
   */
  public async getReputationsByOrganization(organizationId: string): Promise<Reputation[]> {
    const allReputations = await this.getAllItems();
    return allReputations.filter((rep) => rep.organizationId === organizationId);
  }

  /**
   * Improve reputation level
   */
  public async improveReputation(id: string, levels: number = 1): Promise<Reputation> {
    const reputation = await this.getItem(id);
    if (!reputation) {
      throw new Error(`Reputation not found: ${id}`);
    }

    const newLevel = Math.min(ReputationLevel.Aliados, reputation.level + levels);
    return this.updateReputation(id, { level: newLevel });
  }

  /**
   * Degrade reputation level
   */
  public async degradeReputation(id: string, levels: number = 1): Promise<Reputation> {
    const reputation = await this.getItem(id);
    if (!reputation) {
      throw new Error(`Reputation not found: ${id}`);
    }

    const newLevel = Math.max(ReputationLevel.Enemigos, reputation.level - levels);
    return this.updateReputation(id, { level: newLevel });
  }

  /**
   * Get reputation by faction name
   */
  public async getReputationByFaction(
    factionName: string,
    organizationId: string
  ): Promise<Reputation | null> {
    const reputations = await this.getReputationsByOrganization(organizationId);
    return (
      reputations.find(
        (rep) =>
          rep.faction?.toLowerCase() === factionName.toLowerCase() ||
          rep.name.toLowerCase() === factionName.toLowerCase()
      ) || null
    );
  }

  /**
   * Get reputations by level
   */
  public async getReputationsByLevel(level: ReputationLevel): Promise<Reputation[]> {
    const allReputations = await this.getAllItems();
    return allReputations.filter((rep) => rep.level === level);
  }
}

/**
 * Reputation Dialog using Warehouse System
 */
export class ReputationDialog extends BaseWarehouseItemDialog<Reputation> {
  constructor() {
    const config: WarehouseItemDialogConfig<Reputation> = {
      title: 'Reputación',
      renderContent: async (existingItem?: Reputation) => this.generateDialogContent(existingItem),
      handleSubmit: async (formData: FormData, existingItem?: Reputation) =>
        this.handleSubmitData(formData, existingItem),
    };
    super(config);
  }

  /**
   * Generate content for the reputation dialog
   */
  private generateDialogContent(existingItem?: Reputation): string {
    return `
      <form class="reputation-form warehouse-item-form">
        <div class="form-group">
          <label for="reputation-name">Nombre de la Facción:</label>
          <input
            type="text"
            id="reputation-name"
            name="name"
            value="${existingItem?.name || ''}"
            required
            placeholder="Introduce el nombre de la facción..."
          />
        </div>

        <div class="form-group">
          <label for="reputation-description">Descripción:</label>
          <textarea
            id="reputation-description"
            name="description"
            rows="3"
            required
            placeholder="Describe la relación de reputación..."
          >${existingItem?.description || ''}</textarea>
        </div>

        <div class="form-group">
          <label for="reputation-level">Nivel de Reputación:</label>
          <select id="reputation-level" name="level" required>
            ${Object.entries(REPUTATION_LABELS)
              .map(
                ([value, label]) =>
                  `<option value="${value}" ${existingItem?.level == parseInt(value) ? 'selected' : ''}>${label}</option>`
              )
              .join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="reputation-faction">Tipo de Facción:</label>
          <input
            type="text"
            id="reputation-faction"
            name="faction"
            value="${existingItem?.faction || ''}"
            placeholder="ej: Gremio, Gobierno, Criminal..."
          />
        </div>

        <div class="form-group">
          <label for="reputation-relationship">Relación:</label>
          <input
            type="text"
            id="reputation-relationship"
            name="relationship"
            value="${existingItem?.relationship || ''}"
            placeholder="ej: Socios Comerciales, Rivales Políticos..."
          />
        </div>

        <div class="form-group">
          <label for="reputation-notes">Notas:</label>
          <textarea
            id="reputation-notes"
            name="notes"
            rows="2"
            placeholder="Notas adicionales sobre esta reputación..."
          >${existingItem?.notes || ''}</textarea>
        </div>

        <div class="form-group">
          <label for="reputation-image">Imagen:</label>
          <div class="file-picker-container">
            <input
              type="text"
              id="reputation-image"
              name="image"
              value="${existingItem?.image || ''}"
              placeholder="Ruta a la imagen de la facción..."
            />
            <button type="button" class="file-picker-btn" data-target="reputation-image">
              <i class="fas fa-file-image"></i>
            </button>
          </div>
        </div>

        <input
          type="hidden"
          name="organizationId"
          value="${existingItem?.organizationId || ''}"
        />

        ${existingItem ? `<input type="hidden" name="id" value="${existingItem.id}" />` : ''}
      </form>
    `;
  }

  /**
   * Handle form submission
   */
  private async handleSubmitData(
    formData: FormData,
    existingItem?: Reputation
  ): Promise<Reputation> {
    const manager = new ReputationManager();
    await manager.initialize();

    const reputationData: Partial<Reputation> = {
      id: existingItem?.id,
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      level: parseInt(formData.get('level') as string) as ReputationLevel,
      faction: formData.get('faction') as string,
      relationship: formData.get('relationship') as string,
      notes: formData.get('notes') as string,
      image: formData.get('image') as string,
      organizationId: formData.get('organizationId') as string,
    };

    if (existingItem) {
      return manager.updateItem(existingItem.id, reputationData);
    } else {
      return manager.createItem(reputationData);
    }
  }

  /**
   * Show create dialog for reputation
   */
  public static async showCreateDialog(organizationId: string): Promise<Reputation | null> {
    const dialog = new ReputationDialog();
    return dialog.show();
  }

  /**
   * Show edit dialog for reputation
   */
  public static async showEditDialog(reputationId: string): Promise<Reputation | null> {
    const manager = new ReputationManager();
    const reputation = await manager.getItem(reputationId);

    if (!reputation) {
      ui.notifications?.error('Reputation not found');
      return null;
    }

    const dialog = new ReputationDialog();
    return dialog.show();
  }
}
