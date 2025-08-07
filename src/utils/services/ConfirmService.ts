/**
 * ConfirmService
 * Uniform confirmation dialog abstraction.
 */
export class ConfirmService {
  /**
   * Show a confirmation dialog. Falls back to window.confirm.
   */
  static async confirm(options: {
    title: string;
    html: string;
    defaultYes?: boolean;
  }): Promise<boolean> {
    try {
      if (typeof Dialog !== 'undefined') {
        return await Dialog.confirm({
          title: options.title,
          content: options.html,
          yes: () => true,
          no: () => false,
          defaultYes: options.defaultYes ?? false,
        });
      }
      return globalThis.confirm?.(stripHtml(options.html)) ?? false;
    } catch {
      return globalThis.confirm?.(stripHtml(options.html)) ?? false;
    }
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}
