# Fix for AddOrEditResourceDialog Loading Issue

## Problem

The `AddOrEditResourceDialog` was not available when accessed through the global `GuardManagement.dialogs` scope, causing errors:

- "AddOrEditResourceDialog not available in GuardManagement.dialogs"
- This was happening because the dialog was loaded asynchronously but the code accessing it didn't wait for the loading to complete

## Root Cause

The dialog was being imported asynchronously in `main.ts` using dynamic imports to avoid circular dependencies, but the accessing code was trying to use it immediately without waiting for the async import to complete.

## Solution

Added proper waiting mechanism and error handling:

### 1. Enhanced main.ts (GuardManagementModule class)

- **Added `areDialogsLoaded()` method**: Returns true if dialogs are loaded
- **Added `waitForDialogs()` method**: Waits for dialogs to be loaded with timeout
- **Improved error handling**: Now throws errors if dialog loading fails instead of silently continuing

### 2. Updated GMWarehouseDialog.ts

- **Enhanced `handleAddResource()` method**: Now waits for dialogs to be loaded before trying to access them
- **Enhanced `handleEditTemplate()` method**: Same waiting mechanism for edit operations
- **Better error messages**: More descriptive error handling

### 3. Updated ResourceEventHandler.ts

- **Enhanced `getAddOrEditResourceDialog()` function**: Now waits for dialogs to be loaded before trying to access them
- **Consistent error handling**: Same pattern as other files

## Code Changes

### New Methods in GuardManagementModule

```typescript
/**
 * Check if dialogs are loaded and ready
 */
public areDialogsLoaded(): boolean {
  return !!this.dialogs.AddOrEditResourceDialog;
}

/**
 * Wait for dialogs to be loaded
 */
public async waitForDialogs(timeout = 5000): Promise<void> {
  const startTime = Date.now();
  while (!this.areDialogsLoaded() && (Date.now() - startTime) < timeout) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!this.areDialogsLoaded()) {
    throw new Error('Dialogs failed to load within timeout period');
  }
}
```

### Updated Access Pattern

```typescript
// Old pattern (could fail)
const gmModule = (window as any).GuardManagement;
if (!gmModule?.dialogs?.AddOrEditResourceDialog) {
  throw new Error('AddOrEditResourceDialog not available');
}

// New pattern (waits for loading)
const gmModule = (window as any).GuardManagement;
if (!gmModule) {
  throw new Error('GuardManagement module not available');
}

// Wait for dialogs to be loaded if they aren't ready yet
if (!gmModule.areDialogsLoaded()) {
  console.log('🔄 Waiting for dialogs to load...');
  await gmModule.waitForDialogs();
}

if (!gmModule.dialogs?.AddOrEditResourceDialog) {
  throw new Error('AddOrEditResourceDialog not available in GuardManagement.dialogs');
}
```

## Files Modified

1. `src/main.ts` - Added dialog loading check and wait methods
2. `src/dialogs/GMWarehouseDialog.ts` - Updated both add and edit resource handlers
3. `src/utils/ResourceEventHandler.ts` - Updated dialog access function

## Testing

- Project builds successfully without errors
- The async loading mechanism is now properly handled
- Error messages are more descriptive for debugging

## Usage

To test if the fix works, run `test-dialog-loading.js` in the browser console after the module loads. This will verify that the dialog loading mechanism is working correctly.

## Benefits

1. **Eliminates race conditions**: No more errors due to dialog not being loaded yet
2. **Better error handling**: Clear error messages when things go wrong
3. **Maintains async loading**: Still avoids circular dependencies
4. **Graceful degradation**: Falls back to waiting if dialogs aren't ready immediately
5. **Consistent pattern**: Same approach used everywhere for accessing dialogs
