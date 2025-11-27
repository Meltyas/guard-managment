/**
 * ResourceTemplate - Unified template for rendering resources
 */

import type { Resource } from '../types/entities.js';
import { convertFoundryDocumentToResource } from '../utils/resource-converter.js';

export interface ResourceTemplateOptions {
  showActions?: boolean;
  showSendToChat?: boolean;
  compact?: boolean;
  organizationId?: string;
}

/**
 * Unified Resource Template Class
 * Provides consistent rendering for resources across all UI components
 */
export class ResourceTemplate {
  /**
   * Generate HTML string for chat messages
   */
  static generateResourceChatHTML(resourceId: string): string {
    let resourceData: Resource | null = null;

    try {
      const gm = (window as any).GuardManagement;
      if (gm?.documentManager) {
        const resource = gm.documentManager
          .getGuardResources()
          ?.find((r: any) => r.id === resourceId);
        if (resource) {
          resourceData = convertFoundryDocumentToResource(resource);
        }
      }
    } catch (error) {
      console.error('Error getting resource data for chat', resourceId, error);
      return '';
    }

    if (!resourceData) {
      return '';
    }

    // Use Daggerheart structure but with our resource content
    return `
      <div class="message-content">
        <div class="daggerheart chat domain-card">
          <img class="card-img" src="${resourceData.image || 'icons/commodities/metal/ingot-stack-silver.webp'}">
          <details class="domain-card-move" open>
            <summary class="domain-card-header">
              <div class="domain-label">
                <h2 class="title">${resourceData.name}</h2>
              </div>
              <i class="fa-solid fa-chevron-down"></i>
            </summary>
            <div class="description">
              ${resourceData.description ? `<p>${resourceData.description.trim()}</p>` : ''}
            </div>
          </details>
          <footer class="ability-card-footer">
            <ul class="tags">
              <li class="tag">Recurso</li>
              <li class="tag">Cantidad: ${resourceData.quantity}</li>
            </ul>
          </footer>
        </div>
      </div>
    `;
  }

  /**
   * Send a resource to chat
   */
  static async sendResourceToChat(resourceId: string, whisperTo?: string[]): Promise<void> {
    const chatHTML = ResourceTemplate.generateResourceChatHTML(resourceId);

    if (!chatHTML) {
      console.error('Failed to generate chat HTML for resource:', resourceId);
      return;
    }

    try {
      await (ChatMessage as any).create({
        content: chatHTML,
        whisper: whisperTo || [],
        flags: {
          'guard-management': {
            type: 'resource',
            resourceId,
          },
        },
      });
    } catch (error) {
      console.error('Error sending resource to chat:', error);
    }
  }
}
