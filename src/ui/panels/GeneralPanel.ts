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
      agility: 'Agilidad',
      strength: 'Fuerza',
      finesse: 'Destreza',
      instinct: 'Instinto',
      presence: 'Presencia',
      knowledge: 'Conocimiento',
      // Legacy fallbacks (pre-migration)
      robustismo: 'Robustismo',
      analitica: 'Analítica',
      subterfugio: 'Subterfugio',
      elocuencia: 'Elocuencia',
    };

    const statImages: Record<string, string> = {
      agility: 'modules/guard-management/assets/stats/agilidad.webp',
      strength: 'modules/guard-management/assets/stats/fuerza.webp',
      finesse: 'modules/guard-management/assets/stats/finesa.webp',
      instinct: 'modules/guard-management/assets/stats/instinto.webp',
      presence: 'modules/guard-management/assets/stats/presencia.webp',
      knowledge: 'modules/guard-management/assets/stats/conocimiento.webp',
    };

    const statsDisplay = breakdown
      ? Object.keys(breakdown.base).map((key) => {
          const k = key as keyof import('../../types/entities').GuardStats;
          const base = breakdown.base[k];
          const total = breakdown.total[k];
          const mods = breakdown.modifiers[k] ?? [];

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

          const orgMod = mods.reduce((sum: number, m: any) => sum + (m.value || 0), 0);

          return {
            key: k,
            label: statLabels[k] || k,
            img: statImages[k] ?? '',
            base,
            total,
            showTotal: total !== base,
            cssClass,
            // Shape expected by patrolStatTooltip helper
            orgStatData: {
              base,
              org: orgMod,
              effects: 0,
              orgModList: mods.map((m: any) => ({ name: m.name, img: m.img, value: m.value })),
              effectList: [],
              total,
            },
          };
        })
      : [];

    // Process and sort modifiers
    const processedModifiers = activeModifiers
      .map((mod: any) => {
        const netValue =
          mod.statModifications?.reduce((acc: number, curr: any) => acc + curr.value, 0) || 0;
        let borderClass = 'neutral-border';
        if (netValue > 0) borderClass = 'positive-border';
        else if (netValue < 0) borderClass = 'negative-border';

        // Generate tooltip
        let tooltip = `<strong>${mod.name}</strong><br/>`;
        if (mod.description) {
          tooltip += `<div style="margin-bottom:5px; font-size:0.9em; font-style:italic;">${mod.description}</div>`;
        }

        if (mod.statModifications && mod.statModifications.length > 0) {
          tooltip +=
            '<div class="tooltip-modifiers" style="margin-top: 5px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 5px;">';
          for (const m of mod.statModifications) {
            const val = m.value;
            const valStr = val >= 0 ? `+${val}` : `${val}`;
            let color = '#ffffff'; // Neutral
            if (val > 0)
              color = '#4ae89a'; // Green
            else if (val < 0) color = '#e84a4a'; // Red

            const statIcon = statImages[m.statName] || '';
            const iconHtml = statIcon
              ? `<img src="${statIcon}" style="width:24px;height:24px;object-fit:cover;border-radius:2px;flex-shrink:0;" />`
              : '';
            const statLabel = statLabels[m.statName] || m.statName;
            tooltip += `<div style="display: flex; justify-content: space-between; font-size: 0.9em; align-items: center; gap: 8px;">${iconHtml}<span style="flex:1;">${statLabel}:</span> <strong style="color: ${color}">${valStr}</strong></div>`;
          }
          tooltip += '</div>';
        }

        tooltip += '<hr>Click: Send to Chat<br/>Shift+Click: Remove';

        return {
          id: mod.id,
          name: mod.name,
          img: mod.image || 'icons/svg/item-bag.svg',
          statModifications: mod.statModifications || [],
          description: mod.description || '',
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

    // Collect officer skills from patrols
    const officerSkills: Array<{
      skillName: string;
      skillImage?: string;
      officerName: string;
      officerImg?: string;
      patrolName: string;
    }> = [];

    const allOfficers: any[] = gm?.officerManager?.list?.() || [];
    const officerByActorId = new Map<string, any>(
      allOfficers.filter((o: any) => o.skill?.name).map((o: any) => [o.actorId, o])
    );

    const patrols = gm?.guardOrganizationManager?.listOrganizationPatrols?.() || [];
    for (const patrol of patrols) {
      if (patrol.officer?.actorId) {
        const off = officerByActorId.get(patrol.officer.actorId);
        if (off?.skill?.name) {
          officerSkills.push({
            skillName: off.skill.name,
            skillImage: off.skill.image,
            officerName: off.actorName || patrol.officer.name,
            officerImg: off.actorImg || patrol.officer.img,
            patrolName: patrol.name,
          });
        }
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

    // Shift-held state for removal mode
    let _shiftHeld = false;
    const _onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        _shiftHeld = true;
        container.classList.add('shift-held');
      }
    };
    const _onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        _shiftHeld = false;
        container.classList.remove('shift-held');
      }
    };
    document.addEventListener('keydown', _onKeyDown);
    document.addEventListener('keyup', _onKeyUp);
    const _observer = new MutationObserver(() => {
      if (!document.contains(container)) {
        document.removeEventListener('keydown', _onKeyDown);
        document.removeEventListener('keyup', _onKeyUp);
        _observer.disconnect();
      }
    });
    _observer.observe(document.body, { childList: true, subtree: true });

    // Use event delegation to ensure listeners work even if DOM updates
    $html.off('click', '.modifier-compact').on('click', '.modifier-compact', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = ev.currentTarget.dataset.id;
      if (_shiftHeld) {
        if (id) this.handleRemoveModifier(id, onRefresh);
      } else {
        if (id) this.handleModifierClick(id);
      }
    });

    $html.off('contextmenu', '.modifier-compact').on('contextmenu', '.modifier-compact', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    });

    // Stat click listener
    $html.off('click', '.stat-chip.clickable-stat').on('click', '.stat-chip.clickable-stat', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const statKey = ev.currentTarget.dataset.stat;
      if (statKey) {
        gm.guardOrganizationManager.rollStat(statKey);
      }
    });
  }

  static async handleModifierClick(modifierId: string) {
    const gm = (window as any).GuardManagement;
    if (!gm?.modifierManager) {
      console.warn('Guard Management | ModifierManager not found');
      return;
    }

    const modifier = gm.modifierManager.getModifier(modifierId);
    if (!modifier) {
      console.warn('Guard Management | Modifier not found:', modifierId);
      return;
    }

    const content = `
      <div class="daggerheart chat domain-card dh-style">
        <img class="card-img" src="${modifier.image || 'icons/svg/shield.svg'}">
        <details class="domain-card-move" open>
          <summary class="domain-card-header">
            <div class="domain-label">
              <h2 class="title">${modifier.name}</h2>
              <ul class="tags">
                <li class="tag">Modificador de Guardia</li>
                ${(modifier.statModifications || [])
                  .map(
                    (m: any) =>
                      `<li class="tag">${m.statName}: ${m.value > 0 ? '+' : ''}${m.value}</li>`
                  )
                  .join('')}
              </ul>
            </div>
            <i class="fa-solid fa-chevron-down"></i>
          </summary>
          <div class="description">
            <p>${modifier.description || 'Sin descripción'}</p>
          </div>
        </details>
      </div>
    `;

    await (ChatMessage as any).create({
      content,
      speaker: (ChatMessage as any).getSpeaker({ alias: 'Modificador de Guardia' }),
    });
  }

  static async handleRemoveModifier(modifierId: string, onRefresh?: () => void) {
    const gm = (window as any).GuardManagement;
    if (!gm?.guardOrganizationManager || !gm?.modifierManager) {
      console.warn('Guard Management | Managers not found');
      return;
    }

    const modifier = gm.modifierManager.getModifier(modifierId);
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
