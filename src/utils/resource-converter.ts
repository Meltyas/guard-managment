/**
 * Resource Converter Utility
 * Provides consistent conversion between Foundry documents and our Resource type
 */

import { Resource } from '../types/entities.js';

/**
 * Convert a Foundry document to our Resource type
 * This ensures consistent data extraction across all dialogs and components
 */
export function convertFoundryDocumentToResource(document: any): Resource {
  if (!document || document.type !== 'guard-management.guard-resource') {
    throw new Error('Invalid document type for resource conversion');
  }

  return {
    id: document.id,
    name: document.name || '',
    description: document.system?.description || '',
    quantity: document.system?.quantity || 0,
    // Priority: resource.img (Foundry standard) > system.image (legacy) > empty string
    image: document.img || document.system?.image || '',
    organizationId: document.system?.organizationId || '',
    version: document.system?.version || 1,
    createdAt: document.system?.createdAt || new Date(),
    updatedAt: document.system?.updatedAt || new Date(),
  };
}

/**
 * Convert our Resource type to Foundry document creation data
 * Ensures data is stored in both img and system.image for compatibility
 */
export function convertResourceToFoundryData(resource: Partial<Resource>): any {
  const foundryData: any = {
    name: resource.name || 'New Resource',
    type: 'guard-management.guard-resource',
    img: resource.image || '', // Foundry standard field
    system: {
      description: resource.description || '',
      quantity: resource.quantity || 1,
      image: resource.image || '', // Also store in system for compatibility
      organizationId: resource.organizationId || '',
      version: resource.version || 1,
      createdAt: resource.createdAt || new Date(),
      updatedAt: resource.updatedAt || new Date(),
    },
  };

  return foundryData;
}

/**
 * Convert our Resource type to Foundry document update data
 * Ensures updates are applied to both img and system.image
 */
export function convertResourceToFoundryUpdateData(resource: Partial<Resource>): any {
  const updateData: any = {};

  if (resource.name !== undefined) {
    updateData.name = resource.name;
  }

  if (resource.description !== undefined) {
    updateData['system.description'] = resource.description;
  }

  if (resource.quantity !== undefined) {
    updateData['system.quantity'] = resource.quantity;
  }

  if (resource.image !== undefined) {
    updateData.img = resource.image; // Foundry standard field
    updateData['system.image'] = resource.image; // Also update system field
  }

  if (resource.organizationId !== undefined) {
    updateData['system.organizationId'] = resource.organizationId;
  }

  if (resource.version !== undefined) {
    updateData['system.version'] = resource.version;
  }

  if (resource.updatedAt !== undefined) {
    updateData['system.updatedAt'] = resource.updatedAt;
  }

  return updateData;
}

/**
 * Validate that a Foundry document is a valid guard resource
 */
export function isValidGuardResource(document: any): boolean {
  return (
    document && document.type === 'guard-management.guard-resource' && document.id && document.name
  );
}

/**
 * Get a list of resources from Foundry documents with consistent conversion
 */
export function convertFoundryDocumentsToResources(documents: any[]): Resource[] {
  return documents.filter(isValidGuardResource).map(convertFoundryDocumentToResource);
}
