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
