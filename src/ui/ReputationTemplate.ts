import { Reputation, REPUTATION_LABELS } from '../types/entities';

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
      if (gm?.reputationManager) {
        const reputation = gm.reputationManager.getReputation(reputationId);
        if (reputation) {
          reputationData = reputation;
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
    const hasImage = !!reputationData.image;

    return `
      <div class="daggerheart chat domain-card">
        ${hasImage ? `<img class="card-img" src="${reputationData.image}">` : ''}
        <details class="domain-card-move" open>
          <summary class="domain-card-header">
            <div class="domain-label">
              <h2 class="title">${reputationData.name}</h2>
              <ul class="tags">
                <li class="tag">Reputación</li>
                <li class="tag">${levelLabel}</li>
              </ul>
            </div>
            <i class="fa-solid fa-chevron-down"></i>
          </summary>
          <div class="description">
            ${reputationData.description?.trim() ? `<p>${reputationData.description.trim()}</p>` : ''}
          </div>
        </details>
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
        speaker: { scene: null, actor: null, token: null, alias: 'Guard Management' },
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
