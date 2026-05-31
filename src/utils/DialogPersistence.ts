/**
 * DialogPersistence
 *
 * Centralized helper to remember which long-lived dialogs/modals were open
 * before a page reload (F5) and re-open them automatically on startup.
 *
 * Pattern:
 *  - A dialog calls `DialogPersistence.markOpen(KEY)` in its `show()`.
 *  - A dialog calls `DialogPersistence.markClosed(KEY)` in its `close()`.
 *  - Each dialog registers a re-open factory via `DialogPersistence.register(KEY, fn)`.
 *  - On the Foundry `ready` hook, `DialogPersistence.restoreAll()` re-opens every
 *    dialog whose flag is still set.
 *
 * Open-state is stored in `localStorage` (per-browser, per-client) so each user's
 * open windows are restored independently. Keys are the FULL localStorage keys so
 * previously-stored flags remain backward-compatible. Long-lived windows store a
 * simple boolean; editor dialogs (create/edit) store a small JSON payload with the
 * ids + mode needed to reconstruct the open call (the entity is re-fetched live
 * from its manager on restore, so no in-progress form data is persisted).
 *
 * NOTE: Transient, await-bound confirmation dialogs (DialogV2.confirm,
 * ConfirmService, LogDeletion…) and one-shot result dialogs (GuardRollDialog,
 * OrderResourceDialog) are intentionally NOT persisted — the code that awaits
 * their result no longer exists after a reload, so re-opening them would be
 * meaningless. GM-warehouse template editors (effects/modifiers) are also skipped
 * because the warehouse holds those templates in memory only.
 */

/** Stable keys for every persistable dialog. Values are the literal localStorage keys. */
export const DIALOG_KEYS = {
  /** Organization info dialog (CustomInfoDialog). */
  orgInfo: 'guard-management.infoDialog.open',
  /** GM warehouse dialog (GMWarehouseDialog). */
  gmWarehouse: 'guard-management-warehouse-open',
  /** Officer warehouse dialog (OfficerWarehouseDialog). */
  officerWarehouse: 'guard-management.officerWarehouse.open',
  /** Building activator modal (BuildingActivatorModal). */
  buildingActivator: 'guard-management.buildingActivator.open',

  // ── Editor dialogs (store a JSON state payload with the ids needed to re-open) ──
  /** Officer create/edit dialog (AddOrEditOfficerDialog). */
  officerEditor: 'guard-management.editor.officer.open',
  /** Resource create/edit dialog (AddOrEditResourceDialog). */
  resourceEditor: 'guard-management.editor.resource.open',
  /** Reputation create/edit dialog (AddOrEditReputationDialog). */
  reputationEditor: 'guard-management.editor.reputation.open',
  /** Patrol/auxiliary create/edit dialog (AddOrEditPatrolDialog). */
  patrolEditor: 'guard-management.editor.patrol.open',
  /** Organization edit dialog (GuardOrganizationDialog). */
  organizationEditor: 'guard-management.editor.organization.open',
} as const;

export type DialogKey = (typeof DIALOG_KEYS)[keyof typeof DIALOG_KEYS];

/** A re-open factory. Receives the persisted state payload (undefined for boolean-only flags). */
type ReopenFn = (state?: any) => void | Promise<void>;

interface PersistEntry {
  reopen: ReopenFn;
  gmOnly: boolean;
}

export class DialogPersistence {
  private static readonly registry = new Map<string, PersistEntry>();

  /**
   * Register a dialog's re-open factory. The factory is invoked on startup if the
   * dialog's open flag is set.
   *
   * @param key     One of DIALOG_KEYS (or any unique localStorage key).
   * @param reopen  Function that re-opens the dialog.
   * @param opts.gmOnly  If true, the dialog is only restored for GM users.
   */
  static register(key: string, reopen: ReopenFn, opts: { gmOnly?: boolean } = {}): void {
    this.registry.set(key, { reopen, gmOnly: opts.gmOnly ?? false });
  }

  /** Flag a dialog as open so it is restored after the next reload.
   *
   * @param key    One of DIALOG_KEYS.
   * @param state  Optional context (ids, mode…) needed to reconstruct the dialog
   *               on restore. Stored as JSON. Omit for boolean-only windows.
   */
  static markOpen(key: string, state?: unknown): void {
    try {
      const value = state === undefined ? 'true' : JSON.stringify({ __s: state });
      window.localStorage.setItem(key, value);
    } catch {
      /* localStorage may be unavailable */
    }
  }

  /** Clear a dialog's open flag so it is NOT restored after the next reload. */
  static markClosed(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* localStorage may be unavailable */
    }
  }

  /** Whether a dialog is currently flagged as open. */
  static isMarkedOpen(key: string): boolean {
    try {
      return window.localStorage.getItem(key) != null;
    } catch {
      return false;
    }
  }

  /** Read the persisted state payload for a dialog (undefined for boolean-only flags). */
  static getState<T = any>(key: string): T | undefined {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw == null || raw === 'true') return undefined;
      const parsed = JSON.parse(raw);
      return parsed?.__s as T;
    } catch {
      return undefined;
    }
  }

  /**
   * Re-open every registered dialog whose open flag is still set.
   * Call once from the Foundry `ready` hook after the module is initialized.
   */
  static async restoreAll(): Promise<void> {
    const isGM = !!(game as any)?.user?.isGM;
    for (const [key, entry] of this.registry.entries()) {
      if (!this.isMarkedOpen(key)) continue;
      if (entry.gmOnly && !isGM) continue;
      try {
        await entry.reopen(this.getState(key));
      } catch (err) {
        console.warn(`Guard Management | Failed to restore dialog "${key}":`, err);
      }
    }
  }
}
