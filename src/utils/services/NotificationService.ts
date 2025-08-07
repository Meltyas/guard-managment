/**
 * NotificationService
 * Centralized wrapper for Foundry's ui.notifications with graceful degradation.
 * Keeps UI code cleaner and allows future routing (e.g., logging, batching).
 */
export class NotificationService {
  private static get ui(): any | null {
    // Access guarded global
    return (globalThis as any)?.ui?.notifications || null;
  }

  static info(message: string): void {
    if (this.ui?.info) this.ui.info(message);
    else console.log('[INFO]', message);
  }

  static warn(message: string): void {
    if (this.ui?.warn) this.ui.warn(message);
    else console.warn('[WARN]', message);
  }

  static error(message: string): void {
    if (this.ui?.error) this.ui.error(message);
    else console.error('[ERROR]', message);
  }
}
