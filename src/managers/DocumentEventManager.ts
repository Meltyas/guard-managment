/**
 * Document Event Manager - Handles document-based synchronization events
 * Replaces socket-based SyncManager since Foundry handles document sync automatically
 */

import { DocumentBasedManager } from './DocumentBasedManager.js';

export interface DocumentEventHandlers {
  onOrganizationUpdated?: (organization: any, data: any, userId: string) => void;
  onPatrolUpdated?: (patrol: any, data: any, userId: string) => void;
  onResourceUpdated?: (resource: any, data: any, userId: string) => void;
  onReputationUpdated?: (reputation: any, data: any, userId: string) => void;
  onDocumentCreated?: (document: any, userId: string) => void;
  onDocumentDeleted?: (document: any, userId: string) => void;
}

export class DocumentEventManager {
  private handlers: DocumentEventHandlers = {};
  private initialized = false;

  constructor(_documentManager: DocumentBasedManager) {
    // DocumentManager reference not needed currently but kept for future use
  }

  /**
   * Initialize the event manager
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('DocumentEventManager | Initializing...');

    // Set up event listeners for document changes
    this.setupEventListeners();

    this.initialized = true;
    console.log('DocumentEventManager | Initialized successfully');
  }

  /**
   * Register event handlers
   */
  public registerHandlers(handlers: DocumentEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * Setup event listeners for custom document events
   */
  private setupEventListeners(): void {
    // Listen for document updates
    window.addEventListener('guard-document-updated', (event: Event) => {
      this.handleDocumentUpdate((event as CustomEvent).detail);
    });

    // Listen for document creation
    window.addEventListener('guard-document-created', (event: Event) => {
      this.handleDocumentCreate((event as CustomEvent).detail);
    });

    // Listen for document deletion
    window.addEventListener('guard-document-deleted', (event: Event) => {
      this.handleDocumentDelete((event as CustomEvent).detail);
    });
  }

  /**
   * Handle document update events
   */
  private handleDocumentUpdate(detail: any): void {
    const { document, data, userId, type } = detail;

    console.log(`DocumentEventManager | Document updated: ${document.name} (${type}) by ${userId}`);

    // Route to specific handlers based on document type
    switch (type) {
      case 'guard-management.guard-organization':
        this.handlers.onOrganizationUpdated?.(document, data, userId);
        break;
      case 'guard-management.patrol':
        this.handlers.onPatrolUpdated?.(document, data, userId);
        break;
      case 'guard-management.resource':
        this.handlers.onResourceUpdated?.(document, data, userId);
        break;
      case 'guard-management.reputation':
        this.handlers.onReputationUpdated?.(document, data, userId);
        break;
    }

    // Trigger UI updates if needed
    this.triggerUIRefresh(type, document.id);
  }

  /**
   * Handle document creation events
   */
  private handleDocumentCreate(detail: any): void {
    const { document, userId, type } = detail;

    console.log(`DocumentEventManager | Document created: ${document.name} (${type}) by ${userId}`);

    this.handlers.onDocumentCreated?.(document, userId);
    this.triggerUIRefresh(type, document.id);
  }

  /**
   * Handle document deletion events
   */
  private handleDocumentDelete(detail: any): void {
    const { document, userId, type } = detail;

    console.log(`DocumentEventManager | Document deleted: ${document.name} (${type}) by ${userId}`);

    this.handlers.onDocumentDeleted?.(document, userId);
    this.triggerUIRefresh(type, document.id);
  }

  /**
   * Trigger UI refresh for specific document types
   */
  private triggerUIRefresh(documentType: string, documentId: string): void {
    // Emit a general UI refresh event
    const refreshEvent = new CustomEvent('guard-ui-refresh', {
      detail: {
        documentType,
        documentId,
        timestamp: Date.now(),
      },
    });
    window.dispatchEvent(refreshEvent);
  }

  /**
   * Validate document changes (optional business logic)
   */
  public validateDocumentChange(_document: any, changes: any): boolean {
    // Add validation logic here if needed
    // For example, check if stat values are within valid ranges
    if (changes.system?.baseStats) {
      const stats = changes.system.baseStats;
      for (const [stat, value] of Object.entries(stats)) {
        if (typeof value === 'number' && (value < -99 || value > 99)) {
          console.warn(`DocumentEventManager | Invalid stat value for ${stat}: ${value}`);
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get current user permissions for a document
   */
  public getUserPermissions(document: any): {
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
  } {
    const user = game?.user;
    if (!user) {
      return { canView: false, canEdit: false, canDelete: false };
    }

    // GM has full permissions
    if ((user as any).isGM) {
      return { canView: true, canEdit: true, canDelete: true };
    }

    // Check document permissions
    const canView = document.visible !== false; // Default visible unless explicitly hidden
    const canEdit = document.isOwner || document.permission >= 3; // OWNER level
    const canDelete = document.isOwner || ((user as any).isGM && document.permission >= 2); // LIMITED + GM

    return { canView, canEdit, canDelete };
  }

  /**
   * Cleanup when module is disabled
   */
  public cleanup(): void {
    console.log('DocumentEventManager | Cleaning up...');

    // Remove event listeners
    window.removeEventListener('guard-document-updated', this.handleDocumentUpdate);
    window.removeEventListener('guard-document-created', this.handleDocumentCreate);
    window.removeEventListener('guard-document-deleted', this.handleDocumentDelete);

    this.handlers = {};
    this.initialized = false;
  }
}
