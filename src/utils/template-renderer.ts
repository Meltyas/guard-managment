/**
 * Template rendering utilities
 * Refactored to remove lit-html dependency.
 * Now works primarily with HTML strings.
 */

/**
 * Render a template string.
 * Since we moved away from lit-html, this is mostly a pass-through for strings.
 */
export function renderTemplateToString(template: string): string {
  return template;
}

/**
 * Safe render for HTML strings.
 * Sets innerHTML of the container.
 */
export function safeRender(template: string, container: HTMLElement | DocumentFragment): void {
  if (container instanceof HTMLElement) {
    container.innerHTML = template;
  } else if (container && typeof container === 'object' && 'innerHTML' in container) {
    // Handle mock containers in tests
    (container as any).innerHTML = template;
  }
}

// Export types for compatibility if needed, but mapped to string
export type TemplateResult = string;
export const html = (strings: TemplateStringsArray, ...values: any[]) => {
  let result = '';
  strings.forEach((s, i) => {
    result += s + (values[i] ?? '');
  });
  return result;
};
export const render = safeRender;
