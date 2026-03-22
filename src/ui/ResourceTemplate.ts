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

    const MODULE_PATH = 'modules/guard-management';
    const hasImage = !!resourceData.image;
    const image = resourceData.image || '';
    const noImageClass = hasImage ? '' : ' dh-card--no-image';

    return `
      <div class="dh-card-chat-wrapper">
        <div class="dh-card dh-card--resource${noImageClass}">
          <div class="dh-card-inner">
            <div class="dh-card-header">
              ${hasImage ? `
              <div class="dh-card-header-image">
                <img alt="${resourceData.name}" src="${image}" />
              </div>
              <img class="dh-card-divider" src="${MODULE_PATH}/assets/card/card-type-middle-deco.png" />
              ` : ''}
              <div class="dh-card-type">recurso</div>
              <div class="dh-card-quantity-badge">×${resourceData.quantity}</div>
            </div>
            <div class="dh-card-body">
              <div class="dh-card-title-block">
                <div class="dh-card-title-wrapper">
                  <h1 class="dh-card-title">${resourceData.name}</h1>
                </div>
                ${
                  resourceData.description
                    ? `
                <div class="dh-card-subtitle">
                  <p>${resourceData.description.trim()}</p>
                </div>
                `
                    : ''
                }
              </div>
              <div class="dh-card-content">
                <p><strong>Cantidad:</strong> ${resourceData.quantity}</p>
              </div>
            </div>
          </div>
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
        speaker: { scene: null, actor: null, token: null, alias: 'Guard Management' },
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
