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
 * Convert our Resource type to Foundry document format
 * Handles both creation and update cases
 */
export function convertResourceToFoundryFormat(
  resource: Partial<Resource>,
  mode: 'create' | 'update' = 'create'
): any {
  const baseData: any = {};

  // Handle name - required for creation, optional for updates
  if (resource.name !== undefined) {
    baseData.name = resource.name;
  } else if (mode === 'create') {
    baseData.name = 'New Resource';
  }

  // Type is only needed for creation
  if (mode === 'create') {
    baseData.type = 'guard-management.guard-resource';
  }

  // Handle image - store in both places for compatibility
  if (resource.image !== undefined) {
    baseData.img = resource.image; // Foundry standard field
    if (!baseData.system) baseData.system = {};
    baseData.system.image = resource.image; // Legacy compatibility
  }

  // Handle system properties
  const systemFields = [
    'description',
    'quantity',
    'organizationId',
    'version',
    'createdAt',
    'updatedAt',
  ];
  systemFields.forEach((field) => {
    if (resource[field as keyof Resource] !== undefined) {
      if (!baseData.system) baseData.system = {};
      baseData.system[field] = resource[field as keyof Resource];
    }
  });

  // Set defaults for creation
  if (mode === 'create') {
    if (!baseData.system) baseData.system = {};
    baseData.system.description = baseData.system.description || '';
    baseData.system.quantity = baseData.system.quantity || 1;
    baseData.system.organizationId = baseData.system.organizationId || '';
    baseData.system.version = baseData.system.version || 1;
    baseData.system.createdAt = baseData.system.createdAt || new Date();
    baseData.system.updatedAt = baseData.system.updatedAt || new Date();
    baseData.img = baseData.img || '';
    baseData.system.image = baseData.system.image || '';
  }

  // For updates, flatten system properties
  if (mode === 'update' && baseData.system) {
    const systemData = baseData.system;
    delete baseData.system;

    Object.keys(systemData).forEach((key) => {
      baseData[`system.${key}`] = systemData[key];
    });
  }

  return baseData;
}

/**
 * Convert our Resource type to Foundry document creation data
 * @deprecated Use convertResourceToFoundryFormat with mode 'create'
 */
export function convertResourceToFoundryData(resource: Partial<Resource>): any {
  return convertResourceToFoundryFormat(resource, 'create');
}

/**
 * Convert our Resource type to Foundry document update data
 * @deprecated Use convertResourceToFoundryFormat with mode 'update'
 */
export function convertResourceToFoundryUpdateData(resource: Partial<Resource>): any {
  return convertResourceToFoundryFormat(resource, 'update');
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
