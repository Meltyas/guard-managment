import {
  Reputation,
  ReputationFavor,
  FactionRelation,
  REPUTATION_LABELS,
  REPUTATION_TREND_LABELS,
  REPUTATION_TREND_ICONS,
  FACTION_RELATION_LABELS,
} from '../types/entities';

export interface ReputationTemplateOptions {
  showActions?: boolean;
  showSendToChat?: boolean;
  compact?: boolean;
  organizationId?: string;
}

export class ReputationTemplate {
  /**
   * Generate HTML string for a full reputation chat card
   */
  static generateReputationChatHTML(reputationId: string): string {
    const reputation = ReputationTemplate._getReputation(reputationId);
    if (!reputation) return '';

    const levelLabel = REPUTATION_LABELS[reputation.level] || `Nivel ${reputation.level}`;
    const trendLabel = reputation.trend ? REPUTATION_TREND_LABELS[reputation.trend] : null;
    const trendIcon = reputation.trend ? REPUTATION_TREND_ICONS[reputation.trend] : null;
    const hasImage = !!reputation.image;

    const relationsHTML =
      reputation.factionRelations?.length
        ? `<div class="rep-chat-section">
            <strong>Relaciones:</strong>
            <ul class="rep-chat-list">
              ${reputation.factionRelations
                .map(
                  (r) =>
                    `<li><em>${FACTION_RELATION_LABELS[r.relationType] ?? r.relationType}</em> — ${r.factionName}${r.notes ? ` (${r.notes})` : ''}</li>`
                )
                .join('')}
            </ul>
          </div>`
        : '';

    const favorsHTML =
      reputation.favors?.length
        ? `<div class="rep-chat-section">
            <strong>Favores disponibles:</strong>
            <ul class="rep-chat-list">
              ${reputation.favors
                .map(
                  (f) =>
                    `<li><strong>${f.name}</strong>${f.cost ? ` — <em>${f.cost}</em>` : ''}</li>`
                )
                .join('')}
            </ul>
          </div>`
        : '';

    return `
      <div class="daggerheart chat domain-card dh-style">
        ${hasImage ? `<img class="card-img" src="${reputation.image}">` : ''}
        <details class="domain-card-move" open>
          <summary class="domain-card-header">
            <div class="domain-label">
              <h2 class="title">${reputation.name}</h2>
              <ul class="tags">
                <li class="tag">Reputación</li>
                <li class="tag">${levelLabel}</li>
                ${trendIcon ? `<li class="tag">${trendIcon} ${trendLabel}</li>` : ''}
                ${reputation.category ? `<li class="tag">${reputation.category}</li>` : ''}
              </ul>
            </div>
            <i class="fa-solid fa-chevron-down"></i>
          </summary>
          <div class="description">
            ${reputation.description?.trim() ? `<p>${reputation.description.trim()}</p>` : ''}
            ${reputation.contact ? `<p><i class="fas fa-user"></i> <strong>Contacto:</strong> ${reputation.contact}</p>` : ''}
            ${relationsHTML}
            ${favorsHTML}
          </div>
        </details>
      </div>
    `;
  }

  /**
   * Generate HTML for a single favor chat card
   */
  static generateFavorChatHTML(reputationId: string, favorId: string): string {
    const reputation = ReputationTemplate._getReputation(reputationId);
    if (!reputation) return '';

    const favor: ReputationFavor | undefined = reputation.favors?.find((f) => f.id === favorId);
    if (!favor) return '';

    const levelLabel = REPUTATION_LABELS[reputation.level] || `Nivel ${reputation.level}`;
    const hasImage = !!reputation.image;

    return `
      <div class="daggerheart chat domain-card dh-style">
        ${hasImage ? `<img class="card-img" src="${reputation.image}">` : ''}
        <details class="domain-card-move" open>
          <summary class="domain-card-header">
            <div class="domain-label">
              <h2 class="title">${favor.name}</h2>
              <ul class="tags">
                <li class="tag">Favor</li>
                <li class="tag">${reputation.name}</li>
                <li class="tag">${levelLabel}</li>
              </ul>
            </div>
            <i class="fa-solid fa-chevron-down"></i>
          </summary>
          <div class="description">
            ${favor.description?.trim() ? `<p>${favor.description.trim()}</p>` : ''}
            ${favor.cost ? `<p><i class="fas fa-coins"></i> <strong>Coste:</strong> ${favor.cost}</p>` : ''}
          </div>
        </details>
      </div>
    `;
  }

  /** Send a full reputation card to chat */
  static async sendReputationToChat(reputationId: string, whisperTo?: string[]): Promise<void> {
    const chatHTML = ReputationTemplate.generateReputationChatHTML(reputationId);
    if (!chatHTML) {
      console.error('Failed to generate chat HTML for reputation:', reputationId);
      return;
    }
    await ReputationTemplate._createMessage(chatHTML, whisperTo, { type: 'reputation', reputationId });
  }

  /** Send a single favor card to chat */
  static async sendFavorToChat(
    reputationId: string,
    favorId: string,
    whisperTo?: string[]
  ): Promise<void> {
    const chatHTML = ReputationTemplate.generateFavorChatHTML(reputationId, favorId);
    if (!chatHTML) {
      console.error('Failed to generate chat HTML for favor:', reputationId, favorId);
      return;
    }
    await ReputationTemplate._createMessage(chatHTML, whisperTo, {
      type: 'reputation-favor',
      reputationId,
      favorId,
    });
  }

  /** Generate HTML for a single relation chat card */
  static generateRelationChatHTML(reputationId: string, relationId: string): string {
    const reputation = ReputationTemplate._getReputation(reputationId);
    if (!reputation) return '';

    const relation: FactionRelation | undefined = reputation.factionRelations?.find((r) => r.id === relationId);
    if (!relation) return '';

    const levelLabel = REPUTATION_LABELS[reputation.level] || `Nivel ${reputation.level}`;
    const hasImage = !!reputation.image;
    const relationLabel = FACTION_RELATION_LABELS[relation.relationType as keyof typeof FACTION_RELATION_LABELS] ?? relation.relationType;

    return `
      <div class="daggerheart chat domain-card dh-style">
        ${hasImage ? `<img class="card-img" src="${reputation.image}">` : ''}
        <details class="domain-card-move" open>
          <summary class="domain-card-header">
            <div class="domain-label">
              <h2 class="title">${reputation.name} — ${relation.factionName}</h2>
              <ul class="tags">
                <li class="tag">Relación</li>
                <li class="tag">${relationLabel}</li>
                <li class="tag">${levelLabel}</li>
              </ul>
            </div>
            <i class="fa-solid fa-chevron-down"></i>
          </summary>
          <div class="description">
            ${relation.notes?.trim() ? `<p>${relation.notes.trim()}</p>` : ''}
          </div>
        </details>
      </div>
    `;
  }

  /** Send a single relation card to chat */
  static async sendRelationToChat(
    reputationId: string,
    relationId: string,
    whisperTo?: string[]
  ): Promise<void> {
    const chatHTML = ReputationTemplate.generateRelationChatHTML(reputationId, relationId);
    if (!chatHTML) {
      console.error('Failed to generate chat HTML for relation:', reputationId, relationId);
      return;
    }
    await ReputationTemplate._createMessage(chatHTML, whisperTo, {
      type: 'reputation-relation',
      reputationId,
      relationId,
    });
  }

  private static _getReputation(id: string): Reputation | null {
    try {
      const gm = (window as any).GuardManagement;
      return gm?.reputationManager?.getReputation(id) ?? null;
    } catch {
      return null;
    }
  }

  private static async _createMessage(
    content: string,
    whisperTo: string[] = [],
    flags: Record<string, unknown>
  ): Promise<void> {
    try {
      await (ChatMessage as any).create({
        content,
        speaker: { scene: null, actor: null, token: null, alias: 'Guard Management' },
        whisper: whisperTo,
        flags: { 'guard-management': flags },
      });
    } catch (error) {
      console.error('Error creating chat message:', error);
    }
  }
}
