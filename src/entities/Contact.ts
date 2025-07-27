/**
 * Contacts System - Example of new warehouse item type
 * Demonstrates how to create a completely new entity type using the warehouse system
 */

import { BaseWarehouseItemDialog } from '../dialogs/BaseWarehouseItemDialog';
import { BaseWarehouseManager } from '../managers/BaseWarehouseManager';
import { BaseWarehouseItem, WarehouseItemCategory, WarehouseItemType } from '../types/warehouse';

// Contact interface extending BaseWarehouseItem
export interface Contact extends BaseWarehouseItem {
  title: string; // Título o posición del contacto
  faction: string; // Facción a la que pertenece
  relationship: ContactRelationship;
  influence: ContactInfluence;
  location?: string; // Ubicación donde se puede encontrar
  specialties: string[]; // Especialidades o servicios que ofrece
  notes?: string; // Notas adicionales
  lastContact?: Date; // Última vez que se tuvo contacto
}

export enum ContactRelationship {
  ALLY = 'ally',
  FRIENDLY = 'friendly',
  NEUTRAL = 'neutral',
  SUSPICIOUS = 'suspicious',
  HOSTILE = 'hostile',
}

export enum ContactInfluence {
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
}

// Contact category definition
export const CONTACT_CATEGORY: WarehouseItemCategory = {
  id: 'contacts',
  name: 'Contactos',
  icon: '👥',
  description: 'Red de contactos e informantes de la organización',
  singularName: 'Contacto',
  pluralName: 'Contactos',
};

// Contact type configuration
export const CONTACT_TYPE: WarehouseItemType<Contact> = {
  category: CONTACT_CATEGORY,

  createNew: () => ({
    title: '',
    faction: '',
    relationship: ContactRelationship.NEUTRAL,
    influence: ContactInfluence.LOW,
    specialties: [],
  }),

  validate: (data: Partial<Contact>) => {
    const errors: { field: string; message: string }[] = [];

    if (!data.name || data.name.trim() === '') {
      errors.push({ field: 'name', message: 'El nombre es requerido' });
    }

    if (!data.title || data.title.trim() === '') {
      errors.push({ field: 'title', message: 'El título es requerido' });
    }

    if (!data.faction || data.faction.trim() === '') {
      errors.push({ field: 'faction', message: 'La facción es requerida' });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  renderInfo: (contact: Contact) => {
    const relationshipIcon = getRelationshipIcon(contact.relationship);
    const influenceIcon = getInfluenceIcon(contact.influence);

    return `
      <div class="contact-info">
        <span class="contact-icons">${relationshipIcon}${influenceIcon}</span>
        <div class="contact-details">
          <div class="contact-name">${contact.name}</div>
          <div class="contact-title">${contact.title}</div>
          <div class="contact-faction">${contact.faction}</div>
        </div>
      </div>
    `;
  },

  renderChatMessage: (contact: Contact, action: string) => {
    const actionText = getChatActionText(action);
    const relationshipClass = `relationship-${contact.relationship}`;

    return `
      <div class="chat-message contact-message">
        <div class="message-header ${relationshipClass}">
          <strong>${actionText}: ${contact.name}</strong>
        </div>
        <div class="message-content">
          <p><strong>Título:</strong> ${contact.title}</p>
          <p><strong>Facción:</strong> ${contact.faction}</p>
          <p><strong>Relación:</strong> ${getRelationshipName(contact.relationship)}</p>
          <p><strong>Influencia:</strong> ${getInfluenceName(contact.influence)}</p>
          ${contact.location ? `<p><strong>Ubicación:</strong> ${contact.location}</p>` : ''}
          ${contact.specialties.length > 0 ? `<p><strong>Especialidades:</strong> ${contact.specialties.join(', ')}</p>` : ''}
          ${contact.description ? `<p><strong>Descripción:</strong> ${contact.description}</p>` : ''}
          ${contact.notes ? `<p><strong>Notas:</strong> ${contact.notes}</p>` : ''}
        </div>
      </div>
    `;
  },
};

// Contact Manager
export class ContactManager extends BaseWarehouseManager<Contact> {
  constructor() {
    super(CONTACT_TYPE);
  }

  protected async loadData(): Promise<void> {
    try {
      const data = (game as any)?.settings?.get('guard-management', 'contacts') || {};
      this.items.clear();

      Object.entries(data).forEach(([id, contactData]) => {
        this.items.set(id, contactData as Contact);
      });
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  }

  protected async saveData(): Promise<void> {
    try {
      const data = Object.fromEntries(this.items.entries());
      await (game as any)?.settings?.set('guard-management', 'contacts', data);
    } catch (error) {
      console.error('Error saving contacts:', error);
    }
  }

  protected async loadTemplates(): Promise<void> {
    try {
      const data = (game as any)?.settings?.get('guard-management', 'contact-templates') || {};
      this.templates.clear();

      Object.entries(data).forEach(([id, templateData]) => {
        this.templates.set(id, templateData as any);
      });
    } catch (error) {
      console.error('Error loading contact templates:', error);
    }
  }

  protected async saveTemplates(): Promise<void> {
    try {
      const data = Object.fromEntries(this.templates.entries());
      await (game as any)?.settings?.set('guard-management', 'contact-templates', data);
    } catch (error) {
      console.error('Error saving contact templates:', error);
    }
  }

  // Contact-specific methods
  public getContactsByFaction(organizationId: string, faction: string): Contact[] {
    return this.getItemsByOrganization(organizationId).filter((c) => c.faction === faction);
  }

  public getContactsByRelationship(
    organizationId: string,
    relationship: ContactRelationship
  ): Contact[] {
    return this.getItemsByOrganization(organizationId).filter(
      (c) => c.relationship === relationship
    );
  }

  public getHighInfluenceContacts(organizationId: string): Contact[] {
    return this.getItemsByOrganization(organizationId).filter(
      (c) => c.influence === ContactInfluence.HIGH || c.influence === ContactInfluence.VERY_HIGH
    );
  }

  public updateLastContact(contactId: string): Contact {
    return this.updateItem(contactId, { lastContact: new Date() });
  }
}

// Contact Dialog
export class ContactDialog extends BaseWarehouseItemDialog<Contact> {
  public static async show(item?: Contact): Promise<Contact | null> {
    const config = {
      title: item ? 'Editar Contacto' : 'Nuevo Contacto',
      width: 600,
      height: 700,
      resizable: true,

      renderContent: async (contact?: Contact) => {
        const specialtiesText = contact?.specialties?.join(', ') || '';

        return `
          <form class="contact-form">
            <div class="form-group">
              <label for="name">Nombre:</label>
              <input type="text" id="name" name="name" value="${contact?.name || ''}" required>
            </div>

            <div class="form-group">
              <label for="title">Título/Posición:</label>
              <input type="text" id="title" name="title" value="${contact?.title || ''}" required>
            </div>

            <div class="form-group">
              <label for="faction">Facción/Organización:</label>
              <input type="text" id="faction" name="faction" value="${contact?.faction || ''}" required>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="relationship">Relación:</label>
                <select id="relationship" name="relationship" required>
                  ${Object.values(ContactRelationship)
                    .map(
                      (rel) =>
                        `<option value="${rel}" ${contact?.relationship === rel ? 'selected' : ''}>${getRelationshipName(rel)}</option>`
                    )
                    .join('')}
                </select>
              </div>

              <div class="form-group">
                <label for="influence">Influencia:</label>
                <select id="influence" name="influence" required>
                  ${Object.values(ContactInfluence)
                    .map(
                      (inf) =>
                        `<option value="${inf}" ${contact?.influence === inf ? 'selected' : ''}>${getInfluenceName(inf)}</option>`
                    )
                    .join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label for="location">Ubicación:</label>
              <input type="text" id="location" name="location" value="${contact?.location || ''}" placeholder="Donde se puede encontrar">
            </div>

            <div class="form-group">
              <label for="specialties">Especialidades:</label>
              <input type="text" id="specialties" name="specialties" value="${specialtiesText}" placeholder="Separadas por comas">
              <small>Servicios o información que puede proporcionar</small>
            </div>

            <div class="form-group">
              <label for="description">Descripción:</label>
              <textarea id="description" name="description" rows="3" placeholder="Descripción del contacto">${contact?.description || ''}</textarea>
            </div>

            <div class="form-group">
              <label for="notes">Notas:</label>
              <textarea id="notes" name="notes" rows="2" placeholder="Notas adicionales">${contact?.notes || ''}</textarea>
            </div>

            <div class="form-group">
              <label for="image">Imagen (URL):</label>
              <input type="url" id="image" name="image" value="${contact?.image || ''}">
            </div>

            <div class="form-actions">
              <button type="submit" class="btn btn-primary">${item ? 'Actualizar' : 'Crear'}</button>
              <button type="button" class="btn btn-secondary" data-action="cancel">Cancelar</button>
            </div>
          </form>
        `;
      },

      handleSubmit: async (formData: FormData, contact?: Contact): Promise<Contact> => {
        const manager = new ContactManager();
        await manager.initialize();

        const specialtiesStr = formData.get('specialties') as string;
        const specialties = specialtiesStr
          ? specialtiesStr
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s)
          : [];

        const data: Partial<Contact> = {
          name: formData.get('name') as string,
          title: formData.get('title') as string,
          faction: formData.get('faction') as string,
          relationship: formData.get('relationship') as ContactRelationship,
          influence: formData.get('influence') as ContactInfluence,
          location: (formData.get('location') as string) || undefined,
          specialties,
          description: (formData.get('description') as string) || undefined,
          notes: (formData.get('notes') as string) || undefined,
          image: (formData.get('image') as string) || undefined,
        };

        if (contact) {
          return manager.updateItem(contact.id, data);
        } else {
          // Get organization ID from context or current guard
          const organizationId = 'current-org'; // This should come from context
          return manager.createItem({ ...data, organizationId });
        }
      },

      validateForm: (formData: FormData) => {
        return CONTACT_TYPE.validate({
          name: formData.get('name') as string,
          title: formData.get('title') as string,
          faction: formData.get('faction') as string,
        });
      },
    };

    const dialog = new ContactDialog(config, item);
    return dialog.show();
  }
}

// Utility functions
function getRelationshipIcon(relationship: ContactRelationship): string {
  const icons = {
    [ContactRelationship.ALLY]: '💚',
    [ContactRelationship.FRIENDLY]: '💙',
    [ContactRelationship.NEUTRAL]: '⚪',
    [ContactRelationship.SUSPICIOUS]: '🟡',
    [ContactRelationship.HOSTILE]: '❤️',
  };
  return icons[relationship];
}

function getInfluenceIcon(influence: ContactInfluence): string {
  const icons = {
    [ContactInfluence.LOW]: '⭐',
    [ContactInfluence.MODERATE]: '⭐⭐',
    [ContactInfluence.HIGH]: '⭐⭐⭐',
    [ContactInfluence.VERY_HIGH]: '⭐⭐⭐⭐',
  };
  return icons[influence];
}

function getRelationshipName(relationship: ContactRelationship): string {
  const names = {
    [ContactRelationship.ALLY]: 'Aliado',
    [ContactRelationship.FRIENDLY]: 'Amistoso',
    [ContactRelationship.NEUTRAL]: 'Neutral',
    [ContactRelationship.SUSPICIOUS]: 'Desconfiado',
    [ContactRelationship.HOSTILE]: 'Hostil',
  };
  return names[relationship];
}

function getInfluenceName(influence: ContactInfluence): string {
  const names = {
    [ContactInfluence.LOW]: 'Baja',
    [ContactInfluence.MODERATE]: 'Moderada',
    [ContactInfluence.HIGH]: 'Alta',
    [ContactInfluence.VERY_HIGH]: 'Muy Alta',
  };
  return names[influence];
}

function getChatActionText(action: string): string {
  const actions: Record<string, string> = {
    create: 'Contacto Añadido',
    update: 'Contacto Actualizado',
    delete: 'Contacto Eliminado',
  };
  return actions[action] || 'Contacto Modificado';
}
