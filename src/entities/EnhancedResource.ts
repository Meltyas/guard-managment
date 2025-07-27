/**
 * Enhanced Resource Implementation using Warehouse System
 * Example of how to migrate existing resources to the new generic system
 */

import { BaseWarehouseItemDialog } from '../dialogs/BaseWarehouseItemDialog';
import { BaseWarehouseManager } from '../managers/BaseWarehouseManager';
import { BaseWarehouseItem, WarehouseItemCategory, WarehouseItemType } from '../types/warehouse';

// Enhanced Resource interface extending BaseWarehouseItem
export interface EnhancedResource extends BaseWarehouseItem {
  quantity: number;
  category: ResourceCategory;
  rarity: ResourceRarity;
  value?: number;
}

export enum ResourceCategory {
  WEAPONS = 'weapons',
  ARMOR = 'armor',
  SUPPLIES = 'supplies',
  MATERIALS = 'materials',
  TOOLS = 'tools',
  MAGICAL = 'magical',
}

export enum ResourceRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  LEGENDARY = 'legendary',
}

// Resource category definition
export const RESOURCE_CATEGORY: WarehouseItemCategory = {
  id: 'resources',
  name: 'Recursos',
  icon: '📦',
  description: 'Materiales y suministros de la organización',
  singularName: 'Recurso',
  pluralName: 'Recursos',
};

// Resource type configuration
export const RESOURCE_TYPE: WarehouseItemType<EnhancedResource> = {
  category: RESOURCE_CATEGORY,

  createNew: () => ({
    quantity: 1,
    category: ResourceCategory.SUPPLIES,
    rarity: ResourceRarity.COMMON,
  }),

  validate: (data: Partial<EnhancedResource>) => {
    const errors: { field: string; message: string }[] = [];

    if (!data.name || data.name.trim() === '') {
      errors.push({ field: 'name', message: 'El nombre es requerido' });
    }

    if (!data.description || data.description.trim() === '') {
      errors.push({ field: 'description', message: 'La descripción es requerida' });
    }

    if (data.quantity !== undefined && data.quantity < 0) {
      errors.push({ field: 'quantity', message: 'La cantidad no puede ser negativa' });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  renderInfo: (resource: EnhancedResource) => {
    const rarityIcon = getRarityIcon(resource.rarity);
    const categoryIcon = getCategoryIcon(resource.category);

    return `
      <div class="resource-info">
        <span class="resource-icon">${categoryIcon}${rarityIcon}</span>
        <span class="resource-name">${resource.name}</span>
        <span class="resource-quantity">x${resource.quantity}</span>
        ${resource.value ? `<span class="resource-value">(${resource.value} oro)</span>` : ''}
      </div>
    `;
  },

  renderChatMessage: (resource: EnhancedResource, action: string) => {
    const actionText = getChatActionText(action);
    const rarityClass = `rarity-${resource.rarity}`;

    return `
      <div class="chat-message resource-message">
        <div class="message-header ${rarityClass}">
          <strong>${actionText}: ${resource.name}</strong>
        </div>
        <div class="message-content">
          <p><strong>Descripción:</strong> ${resource.description}</p>
          <p><strong>Cantidad:</strong> ${resource.quantity}</p>
          <p><strong>Categoría:</strong> ${getCategoryName(resource.category)}</p>
          <p><strong>Rareza:</strong> ${getRarityName(resource.rarity)}</p>
          ${resource.value ? `<p><strong>Valor:</strong> ${resource.value} oro</p>` : ''}
        </div>
      </div>
    `;
  },
};

// Enhanced Resource Manager
export class EnhancedResourceManager extends BaseWarehouseManager<EnhancedResource> {
  constructor() {
    super(RESOURCE_TYPE);
  }

  protected async loadData(): Promise<void> {
    // Implementation for loading from Foundry storage
    try {
      const data = (await game.settings.get('guard-management', 'enhanced-resources')) || {};
      this.items.clear();

      Object.entries(data).forEach(([id, resourceData]) => {
        this.items.set(id, resourceData as EnhancedResource);
      });
    } catch (error) {
      console.error('Error loading enhanced resources:', error);
    }
  }

  protected async saveData(): Promise<void> {
    try {
      const data = Object.fromEntries(this.items.entries());
      await game.settings.set('guard-management', 'enhanced-resources', data);
    } catch (error) {
      console.error('Error saving enhanced resources:', error);
    }
  }

  protected async loadTemplates(): Promise<void> {
    try {
      const data =
        (await game.settings.get('guard-management', 'enhanced-resource-templates')) || {};
      this.templates.clear();

      Object.entries(data).forEach(([id, templateData]) => {
        this.templates.set(id, templateData as any);
      });
    } catch (error) {
      console.error('Error loading enhanced resource templates:', error);
    }
  }

  protected async saveTemplates(): Promise<void> {
    try {
      const data = Object.fromEntries(this.templates.entries());
      await game.settings.set('guard-management', 'enhanced-resource-templates', data);
    } catch (error) {
      console.error('Error saving enhanced resource templates:', error);
    }
  }

  // Enhanced methods specific to resources
  public getResourcesByCategory(
    organizationId: string,
    category: ResourceCategory
  ): EnhancedResource[] {
    return this.getItemsByOrganization(organizationId).filter((r) => r.category === category);
  }

  public getTotalValue(organizationId: string): number {
    return this.getItemsByOrganization(organizationId).reduce(
      (total, resource) => total + (resource.value || 0) * resource.quantity,
      0
    );
  }

  public adjustQuantity(resourceId: string, adjustment: number): EnhancedResource {
    const resource = this.getItem(resourceId);
    if (!resource) {
      throw new Error(`Resource with id ${resourceId} not found`);
    }

    const newQuantity = Math.max(0, resource.quantity + adjustment);
    return this.updateItem(resourceId, { quantity: newQuantity });
  }
}

// Enhanced Resource Dialog
export class EnhancedResourceDialog extends BaseWarehouseItemDialog<EnhancedResource> {
  public static async show(item?: EnhancedResource): Promise<EnhancedResource | null> {
    const config = {
      title: item ? 'Editar Recurso' : 'Nuevo Recurso',
      width: 500,
      height: 600,
      resizable: true,

      renderContent: async (resource?: EnhancedResource) => {
        return `
          <form class="enhanced-resource-form">
            <div class="form-group">
              <label for="name">Nombre:</label>
              <input type="text" id="name" name="name" value="${resource?.name || ''}" required>
            </div>

            <div class="form-group">
              <label for="description">Descripción:</label>
              <textarea id="description" name="description" rows="3" required>${resource?.description || ''}</textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="quantity">Cantidad:</label>
                <input type="number" id="quantity" name="quantity" value="${resource?.quantity || 1}" min="0" required>
              </div>

              <div class="form-group">
                <label for="value">Valor (oro):</label>
                <input type="number" id="value" name="value" value="${resource?.value || ''}" min="0" step="0.01">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="category">Categoría:</label>
                <select id="category" name="category" required>
                  ${Object.values(ResourceCategory)
                    .map(
                      (cat) =>
                        `<option value="${cat}" ${resource?.category === cat ? 'selected' : ''}>${getCategoryName(cat)}</option>`
                    )
                    .join('')}
                </select>
              </div>

              <div class="form-group">
                <label for="rarity">Rareza:</label>
                <select id="rarity" name="rarity" required>
                  ${Object.values(ResourceRarity)
                    .map(
                      (rarity) =>
                        `<option value="${rarity}" ${resource?.rarity === rarity ? 'selected' : ''}>${getRarityName(rarity)}</option>`
                    )
                    .join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label for="image">Imagen (URL):</label>
              <input type="url" id="image" name="image" value="${resource?.image || ''}">
            </div>

            <div class="form-actions">
              <button type="submit" class="btn btn-primary">${item ? 'Actualizar' : 'Crear'}</button>
              <button type="button" class="btn btn-secondary" data-action="cancel">Cancelar</button>
            </div>
          </form>
        `;
      },

      handleSubmit: async (
        formData: FormData,
        resource?: EnhancedResource
      ): Promise<EnhancedResource> => {
        const manager = new EnhancedResourceManager();
        await manager.initialize();

        const data: Partial<EnhancedResource> = {
          name: formData.get('name') as string,
          description: formData.get('description') as string,
          quantity: parseInt(formData.get('quantity') as string),
          category: formData.get('category') as ResourceCategory,
          rarity: formData.get('rarity') as ResourceRarity,
          image: (formData.get('image') as string) || undefined,
          value: formData.get('value') ? parseFloat(formData.get('value') as string) : undefined,
        };

        if (resource) {
          return manager.updateItem(resource.id, data);
        } else {
          // Get organization ID from context or current guard
          const organizationId = 'current-org'; // This should come from context
          return manager.createItem({ ...data, organizationId });
        }
      },

      validateForm: (formData: FormData) => {
        return RESOURCE_TYPE.validate({
          name: formData.get('name') as string,
          description: formData.get('description') as string,
          quantity: parseInt(formData.get('quantity') as string),
        });
      },
    };

    const dialog = new EnhancedResourceDialog(config, item);
    return dialog.show();
  }
}

// Utility functions
function getRarityIcon(rarity: ResourceRarity): string {
  const icons = {
    [ResourceRarity.COMMON]: '⚪',
    [ResourceRarity.UNCOMMON]: '🟢',
    [ResourceRarity.RARE]: '🔵',
    [ResourceRarity.LEGENDARY]: '🟡',
  };
  return icons[rarity];
}

function getCategoryIcon(category: ResourceCategory): string {
  const icons = {
    [ResourceCategory.WEAPONS]: '⚔️',
    [ResourceCategory.ARMOR]: '🛡️',
    [ResourceCategory.SUPPLIES]: '📦',
    [ResourceCategory.MATERIALS]: '🪨',
    [ResourceCategory.TOOLS]: '🔧',
    [ResourceCategory.MAGICAL]: '✨',
  };
  return icons[category];
}

function getCategoryName(category: ResourceCategory): string {
  const names = {
    [ResourceCategory.WEAPONS]: 'Armas',
    [ResourceCategory.ARMOR]: 'Armaduras',
    [ResourceCategory.SUPPLIES]: 'Suministros',
    [ResourceCategory.MATERIALS]: 'Materiales',
    [ResourceCategory.TOOLS]: 'Herramientas',
    [ResourceCategory.MAGICAL]: 'Objetos Mágicos',
  };
  return names[category];
}

function getRarityName(rarity: ResourceRarity): string {
  const names = {
    [ResourceRarity.COMMON]: 'Común',
    [ResourceRarity.UNCOMMON]: 'Poco Común',
    [ResourceRarity.RARE]: 'Raro',
    [ResourceRarity.LEGENDARY]: 'Legendario',
  };
  return names[rarity];
}

function getChatActionText(action: string): string {
  const actions: Record<string, string> = {
    create: 'Recurso Añadido',
    update: 'Recurso Actualizado',
    delete: 'Recurso Eliminado',
  };
  return actions[action] || 'Recurso Modificado';
}
