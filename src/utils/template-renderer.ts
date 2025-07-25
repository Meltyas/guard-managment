/**
 * Template rendering utilities for handling both lit-html and fallback scenarios
 */

import { render, TemplateResult } from 'lit-html';

/**
 * Render a lit-html template to a string for use in dialogs or testing
 * Falls back to innerHTML method for environments where lit-html render doesn't work
 */
export function renderTemplateToString(template: TemplateResult): string {
  try {
    // Try to use lit-html render first
    const div = document.createElement('div');
    render(template, div);
    return div.innerHTML;
  } catch (error) {
    // Fallback for testing environments - extract template strings
    console.warn('lit-html render failed, using fallback method:', error);
    return renderTemplateToStringFallback(template);
  }
}

/**
 * Fallback method to convert TemplateResult to string
 * This is used when lit-html render doesn't work (e.g., in test environments)
 */
function renderTemplateToStringFallback(template: TemplateResult): string {
  // Access the internal structure of TemplateResult
  const result = template as any;

  if (result.strings && result.values) {
    // Combine template strings with values
    let output = '';
    for (let i = 0; i < result.strings.length; i++) {
      output += result.strings[i];
      if (i < result.values.length) {
        const value = result.values[i];
        if (typeof value === 'string') {
          output += value;
        } else if (value && typeof value === 'object') {
          if (value.strings) {
            // Recursive handling for nested templates
            output += renderTemplateToStringFallback(value);
          } else if (Array.isArray(value)) {
            // Handle arrays of templates or values
            output += value
              .map((item) => {
                if (item && typeof item === 'object' && item.strings) {
                  return renderTemplateToStringFallback(item);
                }
                return String(item || '');
              })
              .join('');
          } else {
            output += String(value || '');
          }
        } else {
          output += String(value || '');
        }
      }
    }
    return output;
  }

  // Last resort - return empty string
  return '';
}

/**
 * Safe render for lit-html templates that handles errors gracefully
 */
export function safeRender(
  template: TemplateResult,
  container: HTMLElement | DocumentFragment
): void {
  try {
    render(template, container);
  } catch (error) {
    console.warn('lit-html render failed, falling back to innerHTML:', error);

    // Generate fallback HTML
    const fallbackHTML = renderTemplateToStringFallback(template);

    if (container instanceof HTMLElement) {
      container.innerHTML = fallbackHTML;
    } else if (container && typeof container === 'object' && 'innerHTML' in container) {
      // Handle mock containers in tests
      (container as any).innerHTML = fallbackHTML;
    }
  }
}

// Export lit-html functions for convenience
export { html, render } from 'lit-html';
export type { TemplateResult } from 'lit-html';
