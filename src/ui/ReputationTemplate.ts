import { html, TemplateResult } from 'lit-html';
import { Reputation, REPUTATION_LABELS } from '../types/entities';
import { convertFoundryDocumentToReputation } from '../utils/resource-converter.js';

export interface ReputationTemplateOptions {
  showActions?: boolean;
  showSendToChat?: boolean;
  compact?: boolean;
  organizationId?: string;
}

/**
 * Template for rendering reputation entries in the CustomInfoDialog
 * Follows the exact same pattern as ResourceTemplate with full feature parity
 */
export class ReputationTemplate {
  /**
   * Render a reputation item with consistent styling and full feature parity with Resources
   */
  static renderReputationItem(
    reputationId: string,
    options: ReputationTemplateOptions = {}
  ): TemplateResult | null {
    const {
      showActions = false,
      showSendToChat = false,
      compact = false,
      organizationId = '',
    } = options;

    let reputationData: Reputation | null = null;

    try {
      const gm = (window as any).GuardManagement;
      if (gm?.documentManager) {
        const reputation = gm.documentManager
          .getGuardReputations()
          ?.find((r: any) => r.id === reputationId);
        if (reputation) {
          // Convert Foundry document to our Reputation type for consistent image handling
          reputationData = convertFoundryDocumentToReputation(reputation);
        }
      } else {
        console.log('❌ DocumentManager not available for reputation');
        return null;
      }
    } catch (error) {
      console.error('Error getting reputation data for', reputationId, error);
      return null;
    }

    if (!reputationData) {
      return null;
    }

    const levelLabel = REPUTATION_LABELS[reputationData.level] || `Level ${reputationData.level}`;

    return html`
      <div
        class="reputation-item resource-item ${compact ? 'compact' : ''}"
        data-reputation-id="${reputationId}"
        draggable="true"
      >
        ${reputationData.image
          ? html`
              <div class="resource-image">
                <img
                  src="${reputationData.image}"
                  alt="${reputationData.name}"
                  onerror="this.style.display='none'"
                />
              </div>
            `
          : ''}
        <div class="resource-info">
          <span class="resource-name">${reputationData.name}</span>
          <span class="resource-quantity">Nivel: ${levelLabel}</span>
          ${reputationData.description
            ? html`<span class="resource-description">${reputationData.description.trim()}</span>`
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
                        data-reputation-id="${reputationId}"
                        data-reputation-name="${reputationData.name}"
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
                        class="edit-reputation-btn btn-icon"
                        title="Editar reputación"
                        data-reputation-id="${reputationId}"
                        data-reputation-name="${reputationData.name}"
                      >
                        <i class="fas fa-edit"></i>
                      </button>
                      <button
                        type="button"
                        class="remove-reputation-btn btn-icon"
                        title="Remover reputación"
                        data-reputation-id="${reputationId}"
                        data-reputation-name="${reputationData.name}"
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
   * Generate HTML template for displaying reputation entries
   */
  static generateReputationSection(reputations: Reputation[], organizationId: string): any {
    return html`
      <div class="reputation-section">
        <div class="resource-header">
          <h3>Reputation</h3>
          <button
            type="button"
            class="add-reputation-btn resource-add-btn"
            data-organization-id="${organizationId}"
            title="Add new reputation entry"
          >
            <i class="fas fa-plus"></i>
          </button>
        </div>
        <div class="reputation-list resource-list">
          ${reputations.length === 0
            ? html`<div class="no-items">No reputation entries</div>`
            : reputations.map((reputation) => this.generateReputationItem(reputation))}
        </div>
      </div>
    `;
  }

  /**
   * Generate HTML template for a single reputation item (legacy method for backward compatibility)
   */
  static generateReputationItem(reputation: Reputation): any {
    const levelLabel = REPUTATION_LABELS[reputation.level] || `Level ${reputation.level}`;

    return html`
      <div
        class="reputation-item resource-item"
        data-reputation-id="${reputation.id}"
        draggable="true"
      >
        <div class="resource-info">
          <div class="resource-name-row">
            <strong class="resource-name">${reputation.name}</strong>
            <span class="reputation-level resource-quantity">${levelLabel}</span>
          </div>
          <div class="resource-description">${reputation.description}</div>
        </div>
        <div class="resource-actions">
          <button
            type="button"
            class="edit-reputation-btn resource-edit-btn"
            data-reputation-id="${reputation.id}"
            title="Edit reputation"
          >
            <i class="fas fa-edit"></i>
          </button>
          <button
            type="button"
            class="delete-reputation-btn resource-delete-btn"
            data-reputation-id="${reputation.id}"
            title="Delete reputation"
          >
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Generate HTML string for chat messages
   */
  static generateReputationChatHTML(reputationId: string): string {
    let reputationData: Reputation | null = null;

    try {
      const gm = (window as any).GuardManagement;
      if (gm?.documentManager) {
        const reputation = gm.documentManager
          .getGuardReputations()
          ?.find((r: any) => r.id === reputationId);
        if (reputation) {
          // Convert Foundry document to our Reputation type for consistent image handling
          reputationData = convertFoundryDocumentToReputation(reputation);
        }
      }
    } catch (error) {
      console.error('Error getting reputation data for chat', reputationId, error);
      return '';
    }

    if (!reputationData) {
      return '';
    }

    const levelLabel = REPUTATION_LABELS[reputationData.level] || `Level ${reputationData.level}`;

    // Use exact same structure as the template but as static HTML
    return `
      <div class="guard-reputation-chat">
        <div class="reputation-item">
          ${
            reputationData.image
              ? `<div class="reputation-image">
                  <img src="${reputationData.image}" alt="${reputationData.name}" onerror="this.style.display='none'" />
                </div>`
              : ''
          }
          <div class="reputation-info">
            <span class="reputation-name">${reputationData.name}</span>
            <span class="reputation-level">Nivel: ${levelLabel}</span>
            ${
              reputationData.description
                ? `<span class="reputation-description">${reputationData.description.trim()}</span>`
                : ''
            }
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Send a reputation to chat
   */
  static async sendReputationToChat(reputationId: string, whisperTo?: string[]): Promise<void> {
    const chatHTML = ReputationTemplate.generateReputationChatHTML(reputationId);

    if (!chatHTML) {
      console.error('Failed to generate chat HTML for reputation:', reputationId);
      return;
    }

    try {
      await (ChatMessage as any).create({
        content: chatHTML,
        whisper: whisperTo || [],
        flags: {
          'guard-management': {
            type: 'reputation',
            reputationId,
          },
        },
      });
    } catch (error) {
      console.error('Error sending reputation to chat:', error);
    }
  }
}
