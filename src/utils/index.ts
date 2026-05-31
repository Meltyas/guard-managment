/**
 * Utility exports for Guard Management Module
 */

export { ResourceEventHandler } from './ResourceEventHandler.js';
export type { ResourceEventContext } from './ResourceEventHandler.js';

export { DOMEventSetup } from './DOMEventSetup.js';

export { ResourceErrorHandler } from './ResourceErrorHandler.js';

export {
  convertFoundryDocumentToReputation,
  convertFoundryDocumentToResource,
  convertFoundryDocumentsToReputations,
  convertFoundryDocumentsToResources,
  convertResourceToFoundryData,
  convertResourceToFoundryFormat,
  convertResourceToFoundryUpdateData,
  isValidGuardReputation,
  isValidGuardResource,
} from './resource-converter.js';

export { renderTemplateToString, safeRender } from './template-renderer.js';

export { GuardManagementHelpers } from './console-helpers.js';

/**
 * Recursively decode literal \uXXXX escape sequences in all string values of
 * an object/array/string.  This corrects data that was stored with unicode
 * characters serialised as escape sequences (e.g. "Coraz\u00f3n" stored
 * literally as backslash-u-0-0-f-3).
 */
export function decodeUnicodeEscapes<T>(value: T): T {
  if (typeof value === 'string') {
    // Fast path: skip strings without the \uXXXX pattern
    if (value.indexOf('\\u') === -1) return value;
    return value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    ) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => decodeUnicodeEscapes(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = decodeUnicodeEscapes(v);
    }
    return result as T;
  }
  return value;
}
