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
    const image = reputationData.image || '';
    const MODULE_PATH = 'modules/guard-management';
    const noImageClass = hasImage ? '' : ' dh-card--no-image';

    return `
      <div class="dh-card-chat-wrapper">
        <div class="dh-card dh-card--reputation${noImageClass}">
          <div class="dh-card-inner">
            <div class="dh-card-header">
              ${hasImage ? `
              <div class="dh-card-header-image">
                <img alt="${reputationData.name}" src="${image}" />
              </div>
              <img class="dh-card-divider" src="${MODULE_PATH}/assets/card/card-type-middle-deco.png" />
              ` : ''}
              <div class="dh-card-type">reputación</div>
              <div class="dh-card-quantity-badge dh-card-quantity-badge--level-${reputationData.level}">${levelLabel}</div>
            </div>
            <div class="dh-card-body">
              <div class="dh-card-title-block">
                <div class="dh-card-title-wrapper">
                  <h1 class="dh-card-title">${reputationData.name}</h1>
                </div>
                ${
                  reputationData.description?.trim()
                    ? `
                <div class="dh-card-subtitle">
                  <p>${reputationData.description.trim()}</p>
                </div>
                `
                    : ''
                }
              </div>
              <div class="dh-card-content">
                <p><strong>Nivel:</strong> ${levelLabel}</p>
              </div>
            </div>
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
