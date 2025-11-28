import type { GuardOrganization } from '../../types/entities';

export class GeneralPanel {
  static get template() {
    return 'modules/guard-management/templates/panels/general.hbs';
  }

  static async render(
    container: HTMLElement,
    organization: GuardOrganization,
    onRefresh?: () => void
  ) {
    const gm = (window as any).GuardManagement;
    const activeModifiers = gm?.guardOrganizationManager?.getActiveModifiers() || [];
    const breakdown = gm?.guardOrganizationManager?.getStatsBreakdown();

    const statLabels: Record<string, string> = {
      robustismo: 'Robustismo',
      analitica: 'Analítica',
      subterfugio: 'Subterfugio',
      elocuencia: 'Elocuencia',
    };

    const statsDisplay = breakdown
      ? Object.keys(breakdown.base).map((key) => {
          const k = key as keyof import('../../types/entities').GuardStats;
          const base = breakdown.base[k];
          const total = breakdown.total[k];
          const mods = breakdown.modifiers[k];

          let cssClass = '';
          if (total > base) cssClass = 'positive';
          else if (total < base) cssClass = 'negative';

          const tooltip =
            mods.length > 0
              ? '<ul class="stat-tooltip-list">' +
                mods
                  .map(
                    (m: { name: string; img: string; value: number }) =>
                      `<li><span class="mod-val ${m.value > 0 ? 'positive' : 'negative'}">${m.value > 0 ? '+' : ''}${m.value}</span> <img src="${m.img}" class="tooltip-icon"/> ${m.name}</li>`
                  )
                  .join('') +
                '</ul>'
              : '';

          return {
            key: k,
            label: statLabels[k] || k,
            base,
            total,
            showTotal: total !== base,
            cssClass,
            tooltip,
          };
        })
      : [];

    // Process and sort modifiers
    const processedModifiers = activeModifiers
      .map((mod: any) => {
        const netValue =
          mod.system?.statModifications?.reduce((acc: number, curr: any) => acc + curr.value, 0) ||
          0;
        let borderClass = 'neutral-border';
        if (netValue > 0) borderClass = 'positive-border';
        else if (netValue < 0) borderClass = 'negative-border';

        // Create a plain object with all necessary properties explicitly
        // This handles cases where 'mod' is a Foundry Document (where id/name/img are getters)
        return {
          id: mod.id || mod._id,
          name: mod.name,
          img: mod.img || mod.texture?.src || 'icons/svg/item-bag.svg',
          system: mod.system,
          netValue,
          borderClass,
        };
      })
      .sort((a: any, b: any) => {
        // Sort: Negative first, then Positive, then Neutral
        const typeA = a.netValue < 0 ? 0 : a.netValue > 0 ? 1 : 2;
        const typeB = b.netValue < 0 ? 0 : b.netValue > 0 ? 1 : 2;
        return typeA - typeB;
      });

    const htmlContent = await renderTemplate(this.template, {
      organization,
      activeModifiers: processedModifiers,
      statsDisplay,
    });
    container.innerHTML = htmlContent;

    // Activate listeners using jQuery for consistency
    const $html = $(container);

    // Use event delegation to ensure listeners work even if DOM updates
    $html.off('click', '.modifier-compact').on('click', '.modifier-compact', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = ev.currentTarget.dataset.id;
      console.log('Guard Management | Modifier clicked:', id);
      if (id) this.handleModifierClick(id);
    });

    $html.off('contextmenu', '.modifier-compact').on('contextmenu', '.modifier-compact', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = ev.currentTarget.dataset.id;
      console.log('Guard Management | Modifier right-clicked:', id);
      if (id) this.handleRemoveModifier(id, onRefresh);
    });
  }

  static async handleModifierClick(modifierId: string) {
    const gm = (window as any).GuardManagement;
    if (!gm?.documentManager) {
      console.warn('Guard Management | DocumentManager not found');
      return;
    }

    const modifier = gm.documentManager.getGuardModifiers().find((m: any) => m.id === modifierId);
    if (!modifier) {
      console.warn('Guard Management | Modifier not found:', modifierId);
      return;
    }

    // Construct chat message content matching Patrol Effects style
    const content = `
      <div class="guard-resource-chat">
        <div class="resource-image" style="margin-bottom: 8px;">
            <img src="${modifier.img}" style="max-width: 64px; border: none;" />
        </div>
        <div class="chat-header" style="font-weight: bold; font-size: 1.2em; margin-bottom: 5px;">${modifier.name}</div>
        <div class="resource-description" style="text-align: left; margin: 10px 0; padding: 10px; background: rgba(0,0,0,0.1); border-radius: 4px;">
          ${modifier.system.description || 'Sin descripción'}
        </div>
        <div class="stat-modifiers">
            ${(modifier.system.statModifications || [])
              .map(
                (m: any) =>
                  `<div><strong>${m.statName}:</strong> ${m.value > 0 ? '+' : ''}${m.value}</div>`
              )
              .join('')}
        </div>
      </div>
    `;

    await (ChatMessage as any).create({
      content,
      speaker: (ChatMessage as any).getSpeaker({ alias: 'Modificador de Guardia' }),
    });
  }

  static async handleRemoveModifier(modifierId: string, onRefresh?: () => void) {
    const gm = (window as any).GuardManagement;
    if (!gm?.guardOrganizationManager || !gm?.documentManager) {
      console.warn('Guard Management | Managers not found');
      return;
    }

    const modifier = gm.documentManager.getGuardModifiers().find((m: any) => m.id === modifierId);
    const modifierName = modifier?.name || 'Modificador';

    const confirm = await Dialog.confirm({
      title: 'Eliminar Modificador',
      content: `<p>¿Seguro que deseas eliminar el modificador "<strong>${modifierName}</strong>" de la organización?</p>`,
    });

    if (!confirm) return;

    await gm.guardOrganizationManager.removeModifier(modifierId);
    if (onRefresh) onRefresh();
  }
}
