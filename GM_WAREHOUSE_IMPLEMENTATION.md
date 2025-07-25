# GM Warehouse Implementation

## Overview

Following the TDD approach, this implementation creates a GM-only warehouse dialog with a tab system for template storage as requested. The warehouse allows GMs to manage templates for Resources, Reputation, Patrol Effects, and Guard Modifiers.

## Components Created

### 1. GMWarehouseDialog (`src/dialogs/GMWarehouseDialog.ts`)

A custom dialog specifically for GM users that provides:

- **Permission Control**: Only accessible to GM users
- **Tab System**: Four tabs for different template types
  - Resources Templates
  - Reputation Templates
  - Patrol Effects Templates
  - Guard Modifiers Templates
- **DialogV2 Integration**: Uses Foundry VTT V13's DialogV2 with fallback to standard Dialog
- **Future-Ready**: Template management buttons are in place for future functionality

**Key Features:**

- Permission check in constructor
- Tab switching with JavaScript
- Empty state messages with appropriate icons
- Responsive design

### 2. GM Warehouse Button (in `src/ui/FloatingGuardPanel.ts`)

Added to the FloatingGuardPanel:

- **GM-Only Visibility**: Button only shows for GM users
- **CSS Classes**: Uses `.gm-only` and `.visible` classes for proper show/hide
- **Action Handler**: Integrates with existing button system
- **Icon**: Uses warehouse icon (`fas fa-warehouse`)

### 3. Styling (`src/styles/gm-warehouse.css`)

Comprehensive CSS styling including:

- **Modern Design**: Gradient backgrounds and smooth transitions
- **Tab Navigation**: Active states and hover effects
- **Content Areas**: Styled template lists with empty states
- **Responsive**: Mobile-friendly tab behavior
- **Icon Integration**: Per-tab appropriate emojis

### 4. Test Coverage (`src/tests/dialogs/GMWarehouseDialog.test.ts`)

Complete TDD test suite covering:

- **Dialog Creation**: GM permission checks
- **Content Generation**: Tab structure and content
- **Show Method**: DialogV2 integration and fallbacks
- **Static Methods**: Error handling
- **Tab System**: Content verification

Plus additional tests in `FloatingGuardPanel.test.ts` for button integration.

## Technical Implementation

### Permission System

```typescript
constructor() {
  if (!game?.user?.isGM) {
    throw new Error('Only GM can access the warehouse');
  }
}
```

### Tab System

The tab system uses a combination of:

1. **CSS Classes**: `.active` for visible tabs and content
2. **Data Attributes**: `data-tab` for identification
3. **JavaScript**: Event delegation for tab switching
4. **Animation**: CSS transitions for smooth switching

### Dialog Integration

Uses the established pattern from existing dialogs:

```typescript
const DialogV2Class = (foundry as any)?.applications?.api?.DialogV2;
const result = await DialogV2Class.wait({
  window: { title, resizable: true },
  content,
  buttons: [...]
});
```

## Future Enhancements

The current implementation provides the foundation for:

1. **Template CRUD**: Add/Edit/Delete functionality for each template type
2. **Template Application**: Drag & drop to apply templates to organizations
3. **Template Import/Export**: Save/load template sets
4. **Template Categories**: Organize templates by type or theme

## Usage

For GMs:

1. **Access**: Click "GM Warehouse" button in the floating panel
2. **Navigate**: Use tabs to switch between template types
3. **Manage**: Add buttons are ready for future template creation

For Players:

- The warehouse button is automatically hidden from non-GM users

## Testing

Run tests with:

```bash
npm test -- src/tests/dialogs/GMWarehouseDialog.test.ts
npm test -- src/tests/FloatingGuardPanel.test.ts
```

All tests pass and maintain the TDD approach used throughout the project.

## Integration

The implementation follows the project's established patterns:

- **Manager Pattern**: Ready for GMWarehouseManager integration
- **Event System**: Prepared for custom events
- **Styling**: Consistent with existing Guard Management theme
- **Error Handling**: Graceful fallbacks and user feedback
- **Type Safety**: Full TypeScript integration

This provides a solid foundation for the GM Warehouse system while maintaining the project's architecture and testing standards.
