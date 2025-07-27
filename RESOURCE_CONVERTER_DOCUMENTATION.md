# Resource Data Unification

## Overview

To solve the problem of inconsistent data extraction between different dialogs and components, we've created a unified resource conversion system.

## The Problem

Previously, different parts of the code were extracting resource data differently:

- **CustomInfoDialog**: Used `resource.img || resource.system?.image`
- **GMWarehouseDialog**: Used `resource.system?.image`
- **DocumentBasedManager**: Saved to both `img` and `system.image`

This led to inconsistencies where images would show in one dialog but not another.

## The Solution

### Resource Converter Utility (`src/utils/resource-converter.ts`)

A centralized utility that provides consistent conversion functions:

#### Main Functions:

1. **`convertFoundryDocumentToResource(document)`**
   - Converts Foundry documents to our Resource type
   - Priority: `resource.img` → `system.image` → empty string
   - Used by all dialogs when reading resource data

2. **`convertResourceToFoundryUpdateData(resource)`**
   - Converts our Resource type to Foundry update format
   - Ensures updates are applied to both `img` and `system.image`
   - Used by DocumentBasedManager for updates

3. **`convertResourceToFoundryData(resource)`**
   - Converts our Resource type to Foundry creation format
   - For future use in creation functions

#### Helper Functions:

- **`isValidGuardResource(document)`**: Validates documents
- **`convertFoundryDocumentsToResources(documents)`**: Bulk conversion

## Implementation

### Updated Components:

1. **CustomInfoDialog** (`src/ui/CustomInfoDialog.ts`)

   ```typescript
   // Before:
   const resourceData = {
     image: resource.system?.image || '',
     // ... manual conversion
   };

   // After:
   const resourceData = convertFoundryDocumentToResource(resource);
   ```

2. **GMWarehouseDialog** (`src/dialogs/GMWarehouseDialog.ts`)

   ```typescript
   // Before (in renderResourceTemplate):
   const imageUrl = resource.system?.image || resource.img || '';
   <div class="template-quantity">Cantidad: ${resource.quantity}</div>

   // After:
   const resourceData = convertFoundryDocumentToResource(resource);
   <div class="template-quantity">Cantidad: ${resourceData.quantity}</div>
   ```

3. **GuardOrganizationDialog** (`src/dialogs/GuardOrganizationDialog.ts`)

   ```typescript
   // Before (in renderResourceItem):
   resourceData = {
     description: resource.system?.description || resource.description,
     quantity: resource.system?.quantity || resource.quantity,
   };

   // After:
   resourceData = convertFoundryDocumentToResource(resource);
   ```

4. **DocumentBasedManager** (`src/managers/DocumentBasedManager.ts`)

   ```typescript
   // Before:
   const updateData: any = {};
   if (data.image !== undefined) {
     updateData['system.image'] = data.image;
     updateData.img = data.image;
   }
   // ... manual mapping

   // After:
   const updateData = convertResourceToFoundryUpdateData(data);
   ```

## Benefits

1. **Consistency**: All components now extract data the same way
2. **Maintainability**: Single place to update data conversion logic
3. **Error Prevention**: No more forgetting to check both `img` and `system.image`
4. **Future-Proof**: Easy to extend for new fields or requirements

## Usage Guidelines

### When Reading Resource Data:

```typescript
import { convertFoundryDocumentToResource } from '../utils/resource-converter.js';

const resourceData = convertFoundryDocumentToResource(foundryDocument);
```

### When Rendering Resource Information:

```typescript
// In template rendering functions
private renderResourceTemplate(resource: any): TemplateResult {
  const resourceData = convertFoundryDocumentToResource(resource);
  return html`
    <div class="resource-name">${resourceData.name}</div>
    <div class="resource-quantity">Cantidad: ${resourceData.quantity}</div>
    <div class="resource-description">${resourceData.description}</div>
    ${resourceData.image ? html`<img src="${resourceData.image}" />` : ''}
  `;
}
```

### When Creating Drag Data:

```typescript
// For drag and drop operations
const resourceData = convertFoundryDocumentToResource(resource);
const dragData = {
  type: 'guard-resource',
  resourceId: resourceData.id,
  resourceData: resourceData,
};
```

### When Updating Resources:

```typescript
import { convertResourceToFoundryUpdateData } from '../utils/resource-converter.js';

const updateData = convertResourceToFoundryUpdateData(resourceChanges);
await resource.update(updateData);
```

### When Creating Resources:

```typescript
import { convertResourceToFoundryData } from '../utils/resource-converter.js';

const foundryData = convertResourceToFoundryData(resourceData);
await Item.create(foundryData);
```

## Data Priority

The conversion functions follow this priority for image fields:

1. **`resource.img`** (Foundry's standard image field)
2. **`resource.system.image`** (Our legacy field)
3. **Empty string** (fallback)

This ensures maximum compatibility with both Foundry standards and our existing data.
