/**
 * LogDeletion — unified shift+click deletion for ALL activity logs / reports
 * across the module.
 *
 * Every deletable log line in any template carries a `data-log-kind` attribute
 * plus the ids needed to identify the entry. A single shared helper resolves
 * the right manager call from those attributes, so the UX (shift+click) and the
 * deletion logic stay consistent everywhere.
 *
 * Supported kinds:
 *  - "resource"     → resourceManager.deleteLogEntry(resourceId, entryId)
 *  - "reputation"   → reputationManager.deleteReputationLogEntry(reputationId, entryId)
 *  - "phase-report" → phaseEventManager.deleteReportEntry(turn, entryId, scope)
 *  - "finance"      → financeManager.removeLogEntry(timestamp)
 */

export type LogKind = 'resource' | 'reputation' | 'phase-report' | 'finance';

export class LogDeletion {
  /** Selector that matches any deletable log line. */
  static readonly SELECTOR = '[data-log-kind]';

  /** Whether an event is a shift+click that targets a log line. */
  static isShiftDelete(event: Event): HTMLElement | null {
    if (!(event as MouseEvent).shiftKey) return null;
    const target = event.target as HTMLElement | null;
    if (!target) return null;
    return target.closest<HTMLElement>(this.SELECTOR);
  }

  private static async confirm(): Promise<boolean> {
    const DialogV2 = (foundry as any).applications?.api?.DialogV2;
    if (!DialogV2) return false;
    try {
      return await DialogV2.confirm({
        window: { title: 'Eliminar registro' },
        content: '<p>¿Eliminar esta entrada del registro?</p>',
      });
    } catch {
      return false;
    }
  }

  /**
   * Delete the log line described by its data attributes.
   * Returns true if an entry was actually removed.
   */
  static async deleteLine(line: HTMLElement): Promise<boolean> {
    const kind = line.dataset.logKind as LogKind | undefined;
    if (!kind) return false;

    const gm = (window as any).GuardManagement;
    if (!gm) return false;

    switch (kind) {
      case 'resource': {
        const resourceId = line.dataset.resourceId;
        const entryId = line.dataset.entryId;
        if (!resourceId || !entryId) return false;
        if (!(await this.confirm())) return false;
        return !!(await gm.resourceManager?.deleteLogEntry(resourceId, entryId));
      }
      case 'reputation': {
        const reputationId = line.dataset.reputationId;
        const entryId = line.dataset.entryId;
        if (!reputationId || !entryId) return false;
        if (!(await this.confirm())) return false;
        return !!(await gm.reputationManager?.deleteReputationLogEntry(reputationId, entryId));
      }
      case 'phase-report': {
        const turn = parseInt(line.dataset.turn || '0', 10);
        const entryId = line.dataset.entryId;
        const scope = (line.dataset.scope || 'any') as 'player' | 'gm' | 'any';
        if (!turn || !entryId) return false;
        if (!(await this.confirm())) return false;
        return !!(await gm.phaseEventManager?.deleteReportEntry(turn, entryId, scope));
      }
      case 'finance': {
        const timestamp = parseInt(line.dataset.entryTimestamp || '0', 10);
        if (!timestamp) return false;
        if (!(await this.confirm())) return false;
        return !!(await gm.financeManager?.removeLogEntry(timestamp));
      }
      default:
        return false;
    }
  }

  /**
   * Install the global `.shift-held` body toggle once. CSS uses
   * `.shift-held [data-log-kind]:hover` to hint deletion is available.
   */
  private static shiftToggleInstalled = false;
  static installShiftHeldToggle(): void {
    if (this.shiftToggleInstalled) return;
    this.shiftToggleInstalled = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') document.body.classList.add('shift-held');
    });
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') document.body.classList.remove('shift-held');
    });
    window.addEventListener('blur', () => document.body.classList.remove('shift-held'));
  }
}
