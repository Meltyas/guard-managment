/**
 * Logging utilities for Guard Management
 */

export class LoggingUtils {
  private static prefix = 'Guard Management';

  /**
   * Log an info message
   */
  public static info(message: string, ...args: any[]): void {
    console.log(`${this.prefix} | INFO: ${message}`, ...args);
  }

  /**
   * Log a warning message
   */
  public static warn(message: string, ...args: any[]): void {
    console.warn(`${this.prefix} | WARN: ${message}`, ...args);
  }

  /**
   * Log an error message
   */
  public static error(message: string, error?: any, ...args: any[]): void {
    console.error(`${this.prefix} | ERROR: ${message}`, error, ...args);
    if (error && error.stack) {
      console.error(error.stack);
    }
  }

  /**
   * Log a debug message (only if debug mode is enabled)
   */
  public static debug(message: string, ...args: any[]): void {
    if (this.isDebugEnabled()) {
      console.debug(`${this.prefix} | DEBUG: ${message}`, ...args);
    }
  }

  /**
   * Check if debug mode is enabled
   */
  private static isDebugEnabled(): boolean {
    try {
      return game?.settings?.get('guard-management', 'debugMode') === true;
    } catch {
      return false;
    }
  }

  /**
   * Log with custom prefix
   */
  public static log(
    level: 'info' | 'warn' | 'error' | 'debug',
    prefix: string,
    message: string,
    ...args: any[]
  ): void {
    const fullMessage = `${this.prefix} | ${prefix} | ${message}`;

    switch (level) {
      case 'info':
        console.log(fullMessage, ...args);
        break;
      case 'warn':
        console.warn(fullMessage, ...args);
        break;
      case 'error':
        console.error(fullMessage, ...args);
        break;
      case 'debug':
        if (this.isDebugEnabled()) {
          console.debug(fullMessage, ...args);
        }
        break;
    }
  }
}
