import { AddOrEditReputationDialog } from '../../dialogs/AddOrEditReputationDialog.js';
import type { GuardOrganization } from '../../types/entities';
import {
  REPUTATION_LABELS,
  REPUTATION_TREND_LABELS,
  REPUTATION_TREND_ICONS,
  REPUTATION_CATEGORY_LABELS,
  REPUTATION_CATEGORY_ICONS,
  REPUTATION_CATEGORY_DEFAULT_ORDER,
  ReputationLevel,
} from '../../types/entities.js';
import { ConfirmService } from '../../utils/services/ConfirmService.js';
import { NotificationService } from '../../utils/services/NotificationService.js';
import { ReputationTemplate } from '../ReputationTemplate.js';

/** Lee/guarda el orden de categorías de reputación en settings */
function getCategoryOrder(): string[] {
  try {
    const stored = (game as any)?.settings?.get('guard-management', 'reputationCategoryOrder') as string[] | null;
    if (Array.isArray(stored) && stored.length > 0) {
      // Asegurarse de que todas las categorías estén incluidas
      const all = [...REPUTATION_CATEGORY_DEFAULT_ORDER] as string[];
      const merged = [...stored];
      for (const cat of all) if (!merged.includes(cat)) merged.push(cat);
      return merged;
    }
  } catch (_) {}
  return [...REPUTATION_CATEGORY_DEFAULT_ORDER] as string[];
}

async function saveCategoryOrder(order: string[]): Promise<void> {
  await (game as any)?.settings?.set('guard-management', 'reputationCategoryOrder', order);
}

export class ReputationPanel {
  static get template() {
    return 'modules/guard-management/templates/panels/reputation.hbs';
  }

  static async getData(organization: GuardOrganization) {
    const gm = (window as any).GuardManagement;
    const isGM = !!(game as any)?.user?.isGM;
    const reputation: any[] = [];
    if (organization.reputation && organization.reputation.length > 0) {
      const allReputation = gm.reputationManager?.getAllReputations() || [];
      for (const id of organization.reputation) {
        const r = allReputation.find((res: any) => res.id === id);
        if (r) {
          const level = r.level;
          let statusClass = 'neutral';
          if (level <= 2) statusClass = 'negative';
          else if (level >= 5) statusClass = 'positive';

          reputation.push({
            ...r,
            value: REPUTATION_LABELS[level as ReputationLevel] || 'Desconocido',
            statusClass,
            trendLabel: r.trend ? REPUTATION_TREND_LABELS[r.trend] : '',
            trendIcon:  r.trend ? REPUTATION_TREND_ICONS[r.trend]  : '',
            categoryLabel: r.category ? REPUTATION_CATEGORY_LABELS[r.category] : '',
            changelogEntries: (r.changelog ?? []).map((entry: any) => ({
              ...entry,
              dateLabel: new Date(entry.timestamp).toLocaleString('es-ES', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              }),
            })),
          });
        }
      }
    }

    // Sort within each group: visible first, then by level desc
    reputation.sort((a, b) => {
      const aH = a.hidden !== false ? 1 : 0;
      const bH = b.hidden !== false ? 1 : 0;
      if (aH !== bH) return aH - bH;
      return b.level - a.level;
    });

    // Group by category in stored order
    const categoryOrder = getCategoryOrder();
    const groups = categoryOrder
      .map((catKey, idx) => {
        const items = reputation.filter((r) => (r.category || '') === catKey);
        if (items.length === 0) return null;
        return {
          key: catKey,
          label: catKey ? (REPUTATION_CATEGORY_LABELS[catKey as keyof typeof REPUTATION_CATEGORY_LABELS] || catKey) : 'Sin categoría',
          icon:  catKey ? (REPUTATION_CATEGORY_ICONS[catKey as keyof typeof REPUTATION_CATEGORY_ICONS] || 'fas fa-circle') : 'fas fa-question',
          items,
          isFirst: false, // se rellena abajo
          isLast: false,
        };
      })
      .filter(Boolean) as any[];

    // Mark first/last for up/down button visibility
    groups.forEach((g, i) => {
      g.isFirst = i === 0;
      g.isLast = i === groups.length - 1;
    });

    return {
      organizationId: organization.id,
      isGM,
      groups,
    };
  }

  static async render(container: HTMLElement, organization: GuardOrganization) {
    const data = await this.getData(organization);
    const htmlContent = await foundry.applications.handlebars.renderTemplate(this.template, data);
    $(container).html(htmlContent);

    // ── Reorder category groups ───────────────────────────────────────────
    container.querySelectorAll<HTMLElement>('.rep-category-up-btn, .rep-category-down-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const catKey = btn.dataset.categoryKey ?? '';
        const dir = btn.classList.contains('rep-category-up-btn') ? -1 : 1;
        const order = getCategoryOrder();
        const idx = order.indexOf(catKey);
        if (idx < 0) return;
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= order.length) return;
        [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
        await saveCategoryOrder(order);
        await ReputationPanel.render(container, organization);
      });
    });

    // ── Collapse/expand category ──────────────────────────────────────────
    container.querySelectorAll<HTMLElement>('.rep-category-header').forEach((header) => {
      header.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.rep-category-actions')) return;
        const section = header.closest('.rep-category-section') as HTMLElement;
        section?.classList.toggle('rep-category-section--collapsed');
      });
    });

    // ── Toggle visibility (ojo) ───────────────────────────────────────────
    container.querySelectorAll<HTMLElement>('.toggle-hidden-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const reputationId = btn.dataset.reputationId;
        if (!reputationId) return;
        const gm = (window as any).GuardManagement;
        if (!gm?.reputationManager) return;
        const rep = gm.reputationManager.getReputation(reputationId);
        if (!rep) return;
        const newHidden = rep.hidden === false;
        await gm.reputationManager.updateReputation(reputationId, { hidden: newHidden });
        const allOrgs = gm.guardOrganizationManager?.getAllOrganizations?.() ?? [];
        const org = allOrgs.find((o: any) => o.id === rep.organizationId);
        if (org) await ReputationPanel.render(container, org);
      });
    });

    // ── Delete changelog entry (GM only) ─────────────────────────────────
    container.querySelectorAll<HTMLElement>('.rep-log-delete-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const reputationId = btn.dataset.reputationId;
        const entryId = btn.dataset.entryId;
        if (!reputationId || !entryId) return;
        const gm = (window as any).GuardManagement;
        if (!gm?.reputationManager) return;
        await gm.reputationManager.deleteReputationLogEntry(reputationId, entryId);
        const allOrgs = gm.guardOrganizationManager?.getAllOrganizations?.() ?? [];
        const rep = gm.reputationManager.getReputation(reputationId);
        const org = allOrgs.find((o: any) => o.id === rep?.organizationId);
        if (org) await ReputationPanel.render(container, org);
      });
    });

    // ── Send favor / relation to chat ─────────────────────────────────────
    container.querySelectorAll<HTMLElement>('.rep-sub-chat-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const reputationId = btn.dataset.reputationId;
        if (!reputationId) return;
        const favorId = btn.dataset.favorId;
        const relationId = btn.dataset.relationId;
        try {
          if (favorId) {
            await ReputationTemplate.sendFavorToChat(reputationId, favorId);
            NotificationService.info('Favor enviado al chat');
          } else if (relationId) {
            await ReputationTemplate.sendRelationToChat(reputationId, relationId);
            NotificationService.info('Relación enviada al chat');
          }
        } catch (err) {
          console.error('Error sending to chat:', err);
          NotificationService.error('Error al enviar al chat');
        }
      });
    });

    // ── Toggle changelog visibility ───────────────────────────────────────
    container.querySelectorAll<HTMLElement>('.rep-changelog-toggle').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const log = btn.closest('.entity-row__detail')?.querySelector('.rep-changelog-list') as HTMLElement | null;
        if (!log) return;
        const isHidden = log.hidden;
        log.hidden = !isHidden;
        btn.querySelector('i')?.classList.toggle('fa-chevron-down', isHidden);
        btn.querySelector('i')?.classList.toggle('fa-chevron-up', !isHidden);
      });
    });

    // ── Expand/collapse individual row ────────────────────────────────────
    container.querySelectorAll<HTMLElement>('.entity-row__summary').forEach((summary) => {
      summary.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.entity-row__actions')) return;
        e.stopPropagation();
        const row = summary.closest('.entity-row') as HTMLElement;
        const detail = row.querySelector('.entity-row__detail') as HTMLElement;
        const toggle = row.querySelector('.entity-row__toggle') as HTMLElement;
        const isOpen = !detail.hidden;
        detail.hidden = isOpen;
        toggle?.setAttribute('aria-expanded', String(!isOpen));
        row.classList.toggle('entity-row--open', !isOpen);
      });
    });

    // ── Search filter ─────────────────────────────────────────────────────
    const searchInput = container.querySelector<HTMLInputElement>('.entity-list-search__input');
    searchInput?.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      container.querySelectorAll<HTMLElement>('.entity-row').forEach((row) => {
        const name = row.querySelector('.entity-row__name')?.textContent?.toLowerCase() ?? '';
        row.classList.toggle('entity-row--hidden', !!query && !name.includes(query));
      });
      // Hide empty category sections
      container.querySelectorAll<HTMLElement>('.rep-category-section').forEach((section) => {
        const hasVisible = Array.from(section.querySelectorAll('.entity-row')).some(
          (r) => !(r as HTMLElement).classList.contains('entity-row--hidden')
        );
        (section as HTMLElement).style.display = hasVisible ? '' : 'none';
      });
    });
  }

  /**
   * Handle adding a new reputation entry
   */
  public static async handleAddReputation(
    organizationId: string,
    refreshCallback: () => Promise<void>
  ): Promise<void> {
    console.log('➕ Add reputation request for organization:', organizationId);

    try {
      await AddOrEditReputationDialog.showCreateDialog(organizationId);

      console.log('✅ Add reputation dialog closed, waiting for automatic assignment...');

      // Wait a short time for the automatic reputation assignment to complete
      setTimeout(async () => {
        console.log('🔄 Refreshing content after reputation creation...');
        await refreshCallback();
      }, 200);
    } catch (error) {
      console.error('❌ Error showing add reputation dialog:', error);
      NotificationService.error('Error al abrir el diálogo de reputación');
    }
  }

  /**
   * Handle editing a reputation entry
   */
  public static async handleEditReputation(
    reputationId: string,
    refreshCallback: () => Promise<void>
  ): Promise<void> {
    console.log('✏️ Edit reputation request:', reputationId);

    try {
      // Get the reputation data first to have the old name for notifications
      const gm = (window as any).GuardManagement;
      if (!gm?.reputationManager) {
        console.error('ReputationManager not available');
        return;
      }

      const reputations = gm.reputationManager.getAllReputations() || [];
      const oldReputation = reputations.find((r: any) => r.id === reputationId);
      const oldName = oldReputation?.name || 'Reputación Desconocida';

      await AddOrEditReputationDialog.showEditDialog(reputationId);

      console.log('✅ Edit reputation dialog closed, refreshing content');
      await refreshCallback();

      // Get updated reputation data for notification and event
      const updatedReputations = gm.reputationManager.getAllReputations() || [];
      const updatedReputation = updatedReputations.find((r: any) => r.id === reputationId);
      const newName = updatedReputation?.name || oldName;

      if (oldName !== newName) {
        NotificationService.info(`Reputación actualizada: "${oldName}" → "${newName}"`);
      }

      // Dispatch event for other dialogs to update
      const event = new CustomEvent('guard-reputation-updated', {
        detail: {
          reputationId: reputationId,
          oldName: oldName,
          newName: newName,
        },
      });
      document.dispatchEvent(event);
    } catch (error) {
      console.error('❌ Error showing edit reputation dialog:', error);
      NotificationService.error('Error al editar la reputación');
    }
  }

  /**
   * Handle removing a reputation from the organization
   */
  public static async handleRemoveReputation(
    reputationId: string,
    reputationName: string,
    organization: GuardOrganization,
    refreshCallback: () => Promise<void>
  ): Promise<void> {
    console.log('🗑️ Remove reputation request:', reputationName, reputationId);

    const html = `
          <div style="margin-bottom: 1rem;">
            <i class="fas fa-exclamation-triangle" style="color: #ff6b6b; margin-right: 0.5rem;"></i>
            <strong>¿Estás seguro?</strong>
          </div>
          <p>¿Deseas remover la reputación "<strong>${reputationName}</strong>" de esta organización?</p>
          <p><small>Esta acción se puede deshacer asignando la reputación nuevamente.</small></p>
        `;

    const confirmed = await ConfirmService.confirm({ title: 'Confirmar Remoción', html });

    if (!confirmed) {
      console.log('❌ Reputation removal cancelled by user');
      return;
    }

    const gm = (window as any).GuardManagement;

    if (!gm?.guardOrganizationManager) {
      console.error('❌ GuardOrganizationManager not available');
      return;
    }

    try {
      // Check if reputation is assigned
      if (!organization.reputation || !organization.reputation.includes(reputationId)) {
        console.log('ℹ️ Reputation not assigned - nothing to remove');
        NotificationService.warn(
          `La reputación "${reputationName}" no está asignada a esta organización`
        );
        return;
      }

      // Create a NEW array without the reputation
      const newReputation = organization.reputation.filter((id: string) => id !== reputationId);

      // Create updated organization object
      const updatedOrganization = {
        ...organization,
        reputation: newReputation,
        updatedAt: new Date(),
        version: (organization.version || 0) + 1,
      };

      // Update organization
      await gm.guardOrganizationManager.updateOrganization(updatedOrganization);

      console.log('✅ Reputation removed successfully');
      NotificationService.info(`Reputación "${reputationName}" removida de la organización`);

      await refreshCallback();
    } catch (error) {
      console.error('❌ Error removing reputation:', error);
      NotificationService.error('Error al remover la reputación de la organización');
    }
  }

  /**
   * Handle sending a reputation to chat
   */
  public static async handleSendReputationToChat(reputationId: string): Promise<void> {
    console.log('💬 Send reputation to chat request:', reputationId);

    try {
      await ReputationTemplate.sendReputationToChat(reputationId);
      console.log('✅ Reputation sent to chat successfully');
      NotificationService.info('Reputación enviada al chat');
    } catch (error) {
      console.error('❌ Error sending reputation to chat:', error);
      NotificationService.error('Error al enviar reputación al chat');
    }
  }

  /**
   * Assign a reputation to the organization
   */
  public static async assignReputationToOrganization(
    reputationData: any,
    organization: GuardOrganization,
    refreshCallback: () => Promise<void>
  ): Promise<void> {
    console.log('🤝 Assigning reputation:', reputationData.name);

    const gm = (window as any).GuardManagement;

    if (!gm?.guardOrganizationManager) {
      console.error('❌ GuardOrganizationManager not available');
      return;
    }

    try {
      // Initialize reputation array if it doesn't exist
      const currentReputation = organization.reputation || [];

      // Check if reputation is already assigned
      if (currentReputation.includes(reputationData.id)) {
        console.log('ℹ️ Reputation already assigned - skipping');
        NotificationService.warn(
          `La reputación "${reputationData.name}" ya está asignada a esta organización`
        );
        return;
      }

      // Create a NEW array with the new reputation
      const newReputation = [...currentReputation, reputationData.id];

      // Create updated organization object
      const updatedOrganization = {
        ...organization,
        reputation: newReputation,
        updatedAt: new Date(),
        version: (organization.version || 0) + 1,
      };

      // Update organization
      await gm.guardOrganizationManager.updateOrganization(updatedOrganization);

      console.log('✅ Reputation assigned successfully');
      NotificationService.info(`Reputación "${reputationData.name}" asignada a la organización`);

      await refreshCallback();
    } catch (error) {
      console.error('❌ Error assigning reputation:', error);
      NotificationService.error('Error al asignar la reputación');
      throw error;
    }
  }
}
