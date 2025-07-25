/**
 * Global dialog focus manager
 * Ensures only one custom dialog can be focused at a time
 */

interface FocusableDialog {
  element: HTMLElement | null;
  onFocus(): void;
  onBlur(): void;
}

class DialogFocusManager {
  private static instance: DialogFocusManager;
  private focusedDialog: FocusableDialog | null = null;
  private registeredDialogs: Set<FocusableDialog> = new Set();

  private constructor() {}

  public static getInstance(): DialogFocusManager {
    if (!DialogFocusManager.instance) {
      DialogFocusManager.instance = new DialogFocusManager();
    }
    return DialogFocusManager.instance;
  }

  /**
   * Register a dialog with the focus manager
   */
  public registerDialog(dialog: FocusableDialog): void {
    this.registeredDialogs.add(dialog);
  }

  /**
   * Unregister a dialog from the focus manager
   */
  public unregisterDialog(dialog: FocusableDialog): void {
    this.registeredDialogs.delete(dialog);
    if (this.focusedDialog === dialog) {
      this.focusedDialog = null;
    }
  }

  /**
   * Set focus to a specific dialog, removing focus from others
   */
  public setFocus(dialog: FocusableDialog): void {
    // If the dialog is already focused, do nothing
    if (this.focusedDialog === dialog) {
      return;
    }

    // Remove focus from currently focused dialog
    if (this.focusedDialog) {
      this.focusedDialog.onBlur();
    }

    // Set focus to the new dialog
    this.focusedDialog = dialog;
    dialog.onFocus();
  }

  /**
   * Remove focus from all dialogs
   */
  public clearFocus(): void {
    if (this.focusedDialog) {
      this.focusedDialog.onBlur();
      this.focusedDialog = null;
    }
  }

  /**
   * Get the currently focused dialog
   */
  public getFocusedDialog(): FocusableDialog | null {
    return this.focusedDialog;
  }
}

export { DialogFocusManager, type FocusableDialog };
