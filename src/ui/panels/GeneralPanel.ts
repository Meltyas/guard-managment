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
                  .map((m: { name: string; img: string; value: number }) => {
                    let colorClass = 'neutral';
                    let sign = '';
                    if (m.value > 0) {
                      colorClass = 'positive';
                      sign = '+';
                    } else if (m.value < 0) {
                      colorClass = 'negative';
                    }
                    return `<li><span class="mod-val ${colorClass}">${sign}${m.value}</span> <img src="${m.img}" class="tooltip-icon"/> ${m.name}</li>`;
                  })
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

        // Generate tooltip
        let tooltip = `<strong>${mod.name}</strong><br/>`;
        if (mod.system.description) {
          tooltip += `<div style="margin-bottom:5px; font-size:0.9em; font-style:italic;">${mod.system.description}</div>`;
        }

        if (mod.system.statModifications && mod.system.statModifications.length > 0) {
          tooltip +=
            '<div class="tooltip-modifiers" style="margin-top: 5px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 5px;">';
          for (const m of mod.system.statModifications) {
            const val = m.value;
            const valStr = val >= 0 ? `+${val}` : `${val}`;
            let color = '#ffffff'; // Neutral
            if (val > 0)
              color = '#4ae89a'; // Green
            else if (val < 0) color = '#e84a4a'; // Red

            tooltip += `<div style="display: flex; justify-content: space-between; font-size: 0.9em;"><span>${m.statName}:</span> <strong style="color: ${color}">${valStr}</strong></div>`;
          }
          tooltip += '</div>';
        }

        tooltip += '<hr>Left Click: Send to Chat<br/>Right Click: Remove';

        // Create a plain object with all necessary properties explicitly
        // This handles cases where 'mod' is a Foundry Document (where id/name/img are getters)
        return {
          id: mod.id || mod._id,
          name: mod.name,
          img: mod.img || mod.texture?.src || 'icons/svg/item-bag.svg',
          system: mod.system,
          netValue,
          borderClass,
          tooltip,
        };
      })
      .sort((a: any, b: any) => {
        // Sort: Negative first, then Positive, then Neutral
        const typeA = a.netValue < 0 ? 0 : a.netValue > 0 ? 1 : 2;
        const typeB = b.netValue < 0 ? 0 : b.netValue > 0 ? 1 : 2;
        return typeA - typeB;
      });

    // Collect ALL officer skills from every officer in the organization
    const officerSkills: Array<{
      skillName: string;
      skillImage?: string;
      skillHopeCost: number;
      officerName: string;
      officerImg?: string;
      patrolName: string;
    }> = [];

    const allOfficers: any[] = gm?.officerManager?.list?.() || [];

    // Build actorId → patrol name map for officers assigned to patrols
    const patrolNameByActorId = new Map<string, string>();
    const patrols = gm?.guardOrganizationManager?.listOrganizationPatrols?.() || [];
    for (const patrol of patrols) {
      if (patrol.officer?.actorId) {
        patrolNameByActorId.set(patrol.officer.actorId, patrol.name);
      }
    }

    for (const off of allOfficers) {
      if (!off.skills?.length) continue;
      const patrolName = off.actorId
        ? patrolNameByActorId.get(off.actorId) || 'Sin patrulla'
        : 'Sin patrulla';
      for (const skill of off.skills) {
        officerSkills.push({
          skillName: skill.name,
          skillDescription: skill.description || '',
          skillImage: skill.image,
          skillHopeCost: skill.hopeCost ?? 0,
          officerName: off.actorName || off.name || 'Oficial',
          officerImg: off.actorImg,
          patrolName,
        });
      }
    }

    const htmlContent = await foundry.applications.handlebars.renderTemplate(this.template, {
      organization,
      activeModifiers: processedModifiers,
      statsDisplay,
      officerSkills,
    });

    // Use jQuery html() to forcibly replace content
    $(container).html(htmlContent);

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

    // Stat click listener
    $html.off('click', '.stat-box.clickable-stat').on('click', '.stat-box.clickable-stat', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const statKey = ev.currentTarget.dataset.stat;
      if (statKey) {
        gm.guardOrganizationManager.rollStat(statKey);
      }
    });

    // Skill toggle (collapsible — Última Orden style)
    $html.off('click', '.skill-toggle-header').on('click', '.skill-toggle-header', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const header = ev.currentTarget as HTMLElement;
      const body = header.nextElementSibling as HTMLElement | null;
      const chevron = header.querySelector('.skill-toggle-chevron');
      if (body) {
        const isOpen = body.style.display !== 'none';
        body.style.display = isOpen ? 'none' : 'block';
        if (chevron) chevron.classList.toggle('open', !isOpen);
      }
    });

    // Skill to chat button listener
    $html.off('click', '.skill-to-chat-btn').on('click', '.skill-to-chat-btn', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const el = ev.currentTarget;
      this.handleSkillToChat({
        name: el.dataset.skillName || '',
        image: el.dataset.skillImage || '',
        hopeCost: parseInt(el.dataset.skillHopeCost || '0', 10),
        officerName: el.dataset.officerName || '',
      });
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
      speaker: { scene: null, actor: null, token: null, alias: 'Modificador de Guardia' },
      flags: { 'guard-management': { type: 'modifier' } },
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

  static async handleSkillToChat(skill: {
    name: string;
    image?: string;
    hopeCost: number;
    officerName?: string;
  }) {
    const heartIcons =
      skill.hopeCost > 0
        ? Array(skill.hopeCost)
            .fill('<i class="fas fa-diamond" style="color:#e84a4a;font-size:0.8rem;"></i>')
            .join(' ')
        : '<span style="opacity:0.5;font-size:0.8rem;">0</span>';

    const content = `
      <div class="guard-resource-chat">
        ${skill.image ? `<div class="resource-image" style="margin-bottom: 8px;"><img src="${skill.image}" style="max-width: 64px; border: none;" /></div>` : ''}
        <div class="chat-header" style="font-weight: bold; font-size: 1.1em; margin-bottom: 4px;">${skill.name}</div>
        ${skill.officerName ? `<div style="font-size: 0.85em; opacity: 0.75; margin-bottom: 6px;"><i class="fas fa-user"></i> ${skill.officerName}</div>` : ''}
        <div style="display: flex; align-items: center; gap: 6px; font-size: 0.9em;">
          <span style="opacity: 0.8;">Coste de Hope:</span>
          <span>${heartIcons}</span>
        </div>
      </div>
    `;

    await (ChatMessage as any).create({
      content,
      speaker: { scene: null, actor: null, token: null, alias: 'Habilidad de Oficial' },
      flags: { 'guard-management': { type: 'officer-skill' } },
    });
  }
}
