/**
 * ResourceTemplate - Unified template for rendering resources
 */

import type { Resource } from '../types/entities.js';

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
      if (gm?.resourceManager) {
        const resource = gm.resourceManager
          .getAllResources()
          ?.find((r: any) => r.id === resourceId);
        if (resource) {
          resourceData = resource; // Ya no necesita conversión
        }
      }
    } catch (error) {
      console.error('Error getting resource data for chat', resourceId, error);
      return '';
    }

    if (!resourceData) {
      return '';
    }

    // Daggerheart 2.0 domain-card structure — renders correctly inside .message-content
    return `
      <div class="daggerheart chat domain-card dh-style">
        <img class="card-img" src="${resourceData.image || 'icons/commodities/metal/ingot-stack-silver.webp'}">
        <details class="domain-card-move" open>
          <summary class="domain-card-header">
            <div class="domain-label">
              <h2 class="title">${resourceData.name}</h2>
              <ul class="tags">
                <li class="tag">Recurso</li>
                <li class="tag">Cantidad: ${resourceData.quantity}</li>
              </ul>
            </div>
            <i class="fa-solid fa-chevron-down"></i>
          </summary>
          <div class="description">
            ${resourceData.description ? `<p>${resourceData.description.trim()}</p>` : ''}
          </div>
        </details>
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
