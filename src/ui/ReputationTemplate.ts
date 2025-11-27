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

    // Use Daggerheart structure but with our reputation content
    return `
      <div class="message-content">
        <div class="daggerheart chat domain-card">
          <img class="card-img" src="${reputationData.image || 'icons/skills/social/diplomacy-handshake-yellow.webp'}">
          <details class="domain-card-move" open>
            <summary class="domain-card-header">
              <div class="domain-label">
                <h2 class="title">${reputationData.name}</h2>
              </div>
              <i class="fa-solid fa-chevron-down"></i>
            </summary>
            <div class="description">
              ${reputationData.description ? `<p>${reputationData.description.trim()}</p>` : ''}
            </div>
          </details>
          <footer class="ability-card-footer">
            <ul class="tags">
              <li class="tag">Reputación</li>
              <li class="tag">Nivel: ${levelLabel}</li>
            </ul>
          </footer>
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
