/**
 * ResourceTemplate - Unified template for rendering resources
 * This ensures the same HTML/CSS is used everywhere (guil  static generateResourceChatHTML(resourceId: string, organizationName?: string): string {
    let resourceData: Resource | null = null;

    try {
      const gm = (window as any).GuardManagement;
      if (gm?.documentManager) {
        const resource = gm.documentManager.getGuardResources()?.find((r: any) => r.id === resourceId);
        if (resource) {
          resourceData = convertFoundryDocumentToResource(resource);
        }
      }
    } catch (error) {
      console.error('Error getting resource data for chat', resourceId, error);
      return '';
    }tc.)
 */

import { html, TemplateResult } from 'lit-html';
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
   * Render a resource item with consistent styling
   */
  static renderResourceItem(
    resourceId: string,
    options: ResourceTemplateOptions = {}
  ): TemplateResult | null {
    const {
      showActions = false,
      showSendToChat = false,
      compact = false,
      organizationId = '',
    } = options;

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
      } else {
        console.log('❌ DocumentManager not available');
        return null;
      }
    } catch (error) {
      console.error('Error getting resource data for', resourceId, error);
      return null;
    }

    if (!resourceData) {
      return null;
    }

    return html`
      <div class="resource-item ${compact ? 'compact' : ''}" data-resource-id="${resourceId}">
        ${resourceData.image
          ? html`
              <div class="resource-image">
                <img
                  src="${resourceData.image}"
                  alt="${resourceData.name}"
                  onerror="this.style.display='none'"
                />
              </div>
            `
          : ''}
        <div class="resource-info">
          <span class="resource-name">${resourceData.name}</span>
          <span class="resource-quantity">Cantidad: ${resourceData.quantity}</span>
          ${resourceData.description
            ? html`<span class="resource-description">${resourceData.description.trim()}</span>`
            : ''}
        </div>
        ${showActions || showSendToChat
          ? html`
              <div class="resource-actions">
                ${showSendToChat
                  ? html`
                      <button
                        type="button"
                        class="send-to-chat-btn btn-icon"
                        title="Enviar al chat"
                        data-resource-id="${resourceId}"
                        data-resource-name="${resourceData.name}"
                        data-organization-id="${organizationId}"
                      >
                        <i class="fas fa-comment"></i>
                      </button>
                    `
                  : ''}
                ${showActions
                  ? html`
                      <button
                        type="button"
                        class="edit-resource-btn btn-icon"
                        title="Editar recurso"
                        data-resource-id="${resourceId}"
                        data-resource-name="${resourceData.name}"
                      >
                        <i class="fas fa-edit"></i>
                      </button>
                      <button
                        type="button"
                        class="remove-resource-btn btn-icon"
                        title="Remover recurso"
                        data-resource-id="${resourceId}"
                        data-resource-name="${resourceData.name}"
                      >
                        <i class="fas fa-trash"></i>
                      </button>
                    `
                  : ''}
              </div>
            `
          : ''}
      </div>
    `;
  }

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

    // Use exact same structure as the template but as static HTML
    return `
      <div class="guard-resource-chat">
        <div class="resource-item">
          ${
            resourceData.image
              ? `<div class="resource-image">
                  <img src="${resourceData.image}" alt="${resourceData.name}" onerror="this.style.display='none'" />
                </div>`
              : ''
          }
          <div class="resource-info">
            <span class="resource-name">${resourceData.name}</span>
            <span class="resource-quantity">Cantidad: ${resourceData.quantity}</span>
            ${
              resourceData.description
                ? `<span class="resource-description">${resourceData.description.trim()}</span>`
                : ''
            }
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
