import type { GuardStats, PatrolEffectInstance } from '../../types/entities';
import { classifyLastOrderAge } from '../../utils/patrol-helpers.js';

export class PatrolsPanel {
  static get template() {
    return 'modules/guard-management/templates/panels/patrols.hbs';
  }

  static async getData(mode: 'patrol' | 'auxiliary' = 'patrol') {
    const gm = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    const patrols = orgMgr
      ? mode === 'auxiliary'
        ? orgMgr.listOrganizationAuxiliaries?.() || []
        : orgMgr.listOrganizationPatrols()
      : [];

    // Build actorId → officer skill map for quick lookup
    const officerSkillByActorId = new Map<string, any>();
    const allOfficers: any[] = gm?.officerManager?.list?.() || [];
    for (const officer of allOfficers) {
      if (officer.skill?.name && officer.actorId) {
        officerSkillByActorId.set(officer.actorId, officer.skill);
      }
    }

    // Enrich patrols
    const enrichedPatrols = patrols.map((p: any) => {
      const lastOrder = p.lastOrder;
      const ageClass = lastOrder
        ? classifyLastOrderAge({ issuedAt: lastOrder.issuedAt })
        : 'normal';
      const bd = this.computePatrolStatBreakdown(p);

      // Format stats breakdown for template
      const statsBreakdown: Record<string, any> = {};
      Object.entries(p.derivedStats || p.baseStats || {}).forEach(([k, v]) => {
        const b = (bd as any)[k] || { base: 0, effects: 0, effectList: [], org: 0, total: v };
        statsBreakdown[k] = { ...b, total: v as number };
      });

      // Prepare slots
      const soldierSlotsCount = p.soldierSlots || 5;
      const slots = [];
      for (let i = 0; i < soldierSlotsCount; i++) {
        if (i < p.soldiers.length) {
          slots.push({ type: 'soldier', data: p.soldiers[i] });
        } else {
          slots.push({ type: 'empty' });
        }
      }

      return {
        ...p,
        ageClass,
        statsBreakdown,
        slots,
        officerSkill: p.officer?.actorId ? (officerSkillByActorId.get(p.officer.actorId) ?? null) : null,
        // Ensure lastOrder text is safe
        lastOrder: lastOrder
          ? {
              ...lastOrder,
              text:
                lastOrder.text &&
                typeof lastOrder.text === 'string' &&
                lastOrder.text.includes('[object ')
                  ? '— (error de datos)'
                  : lastOrder.text,
            }
          : null,
      };
    });

    return { patrols: enrichedPatrols };
  }

  static async render(container: HTMLElement, mode: 'patrol' | 'auxiliary' = 'patrol') {
    const data = await this.getData(mode);
    const htmlContent = await foundry.applications.handlebars.renderTemplate(this.template, data);
    
    // Use jQuery html() to forcibly replace content
    $(container).html(htmlContent);
    this.activateListeners(container);
  }

  static activateListeners(container: HTMLElement) {
    const $html = $(container);

    // Drag & Drop
    this.setupPatrolZonesDnD(container, () => this.refresh(container));
    this.setupPatrolCardDnD(container, () => this.refresh(container));

    // Actions
    $html.find('[data-action="create-patrol"]').on('click', (ev) => {
      ev.preventDefault();
      this.handleCreatePatrol(() => this.refresh(container));
    });
    $html.find('[data-action="edit"]').on('click', (ev) => {
      ev.preventDefault();
      const id = ev.currentTarget.dataset.patrolId;
      if (id) this.handleEditPatrol(id, () => this.refresh(container));
    });
    $html.find('[data-action="delete"]').on('click', (ev) => {
      ev.preventDefault();
      const id = ev.currentTarget.dataset.patrolId;
      if (id) this.handleDeletePatrol(id, () => this.refresh(container));
    });
    $html.find('[data-action="to-chat"]').on('click', (ev) => {
      ev.preventDefault();
      const id = ev.currentTarget.dataset.patrolId;
      if (id) this.handleSendPatrolToChat(id);
    });
    $html.find('[data-action="edit-last-order"]').on('click', (ev) => {
      ev.preventDefault();
      // Handle click on the line or the icon
      const target = ev.currentTarget;
      const id = target.dataset.patrolId;
      if (id) this.handleEditLastOrder(id, () => this.refresh(container));
    });
    $html.find('[data-action="open-sheet"]').on('click', (ev) => {
      ev.preventDefault();
      const id = ev.currentTarget.dataset.actorId;
      if (id) this.handleOpenActorSheet(id);
    });

    // Stat interactions
    $html.find('.stat.clickable-stat').on('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const target = ev.currentTarget;
      const card = target.closest('.patrol-card') as HTMLElement;
      const patrolId = card?.dataset.patrolId;
      const statKey = target.dataset.stat;

      if (patrolId && statKey) {
        const gm = (window as any).GuardManagement;
        const orgMgr = gm?.guardOrganizationManager;
        const pMgr = orgMgr?.getPatrolManager();
        if (pMgr) {
          pMgr.rollStat(patrolId, statKey);
        }
      }
    });

    // Effect interactions
    $html.find('.effect-item, .stat').on('mouseenter', (ev) => {
      const target = ev.currentTarget;
      const game = (globalThis as any).game;
      if (game?.tooltip) {
        game.tooltip.activate(target);
      }
    });

    $html.find('.effect-item').on('click', (ev) => {
      ev.preventDefault();
      const target = ev.currentTarget;
      const patrolId = target.dataset.patrolId;
      const effectId = target.dataset.effectId;
      if (patrolId && effectId) this.handleEffectClick(patrolId, effectId);
    });

    $html.find('.effect-item').on('contextmenu', (ev) => {
      ev.preventDefault();
      const target = ev.currentTarget;
      const patrolId = target.dataset.patrolId;
      const effectId = target.dataset.effectId;
      if (patrolId && effectId)
        this.handleRemoveEffect(patrolId, effectId, () => this.refresh(container));
    });
  }

  static async refresh(container: HTMLElement) {
    await this.render(container);
  }

  private static computePatrolStatBreakdown(patrol: any) {
    try {
      const derived = patrol.derivedStats || patrol.baseStats || {};

      // Get Organization Modifiers
      const gm = (window as any).GuardManagement;
      const orgMgr = gm?.guardOrganizationManager;
      const activeModifiers = orgMgr?.getActiveModifiers() || [];

      const orgModTotals: Record<string, number> = {};
      const orgModDetails: Record<string, Array<{ name: string; img: string; value: number }>> = {};

      for (const mod of activeModifiers) {
        if (mod.system?.statModifications) {
          for (const statMod of mod.system.statModifications) {
            const k = statMod.statName;
            const v = statMod.value;
            orgModTotals[k] = (orgModTotals[k] || 0) + v;

            if (!orgModDetails[k]) orgModDetails[k] = [];
            orgModDetails[k].push({
              name: mod.name,
              img: mod.img,
              value: v,
            });
          }
        }
      }

      const effectTotals: Record<string, number> = {};
      const effectDetails: Record<string, Array<{ name: string; img: string; value: number }>> = {};

      for (const eff of patrol.patrolEffects || []) {
        for (const [k, v] of Object.entries(eff.modifiers || {})) {
          const val = (v as number) || 0;
          effectTotals[k] = (effectTotals[k] || 0) + val;

          if (!effectDetails[k]) effectDetails[k] = [];
          effectDetails[k].push({
            name: eff.label || 'Unknown',
            img: eff.img,
            value: val,
          });
        }
      }

      const breakdown: Record<
        string,
        {
          base: number;
          effects: number;
          effectList: any[];
          org: number;
          orgBase: number;
          orgMods: number;
          orgModList: any[];
          total: number;
        }
      > = {};
      for (const key of Object.keys(derived)) {
        const base = patrol.baseStats?.[key] ?? 0;
        const effects = effectTotals[key] || 0;
        const effectList = effectDetails[key] || [];
        const total = derived[key] ?? 0; // preserve negatives

        const orgTotal = total - base - effects;
        const orgMods = orgModTotals[key] || 0;
        const orgBase = orgTotal - orgMods;
        const orgModList = orgModDetails[key] || [];

        breakdown[key] = {
          base,
          effects,
          effectList,
          org: orgTotal,
          orgBase,
          orgMods,
          orgModList,
          total,
        };
      }
      return breakdown;
    } catch {
      return {};
    }
  }

  /** Attach drag & drop to officer and soldier zones */
  private static setupPatrolZonesDnD(container: HTMLElement, refreshCallback: () => void) {
    const gm: any = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    const pMgr = orgMgr?.getPatrolManager?.();
    if (!pMgr) return;
    const zones = Array.from(
      container.querySelectorAll(
        '.patrol-card .officer-slot[data-drop], .patrol-card .soldiers-zone[data-drop]'
      )
    ) as HTMLElement[];

    const isActorDrag = (ev: DragEvent) => {
      const types = Array.from(ev.dataTransfer?.types || []);
      if (!types.length) return false;
      if (types.includes('text/plain')) return true;
      if (types.includes('text/uuid')) return true;
      if (types.includes('text/x-foundry-entity')) return true;
      if (types.some((t) => t.includes('application/json'))) return true;
      return false;
    };

    const pullAllDataStrings = (ev: DragEvent): string[] => {
      const out: string[] = [];
      if (!ev.dataTransfer) return out;
      const tryGet = (t: string) => {
        try {
          const v = ev.dataTransfer!.getData(t);
          if (v) out.push(v);
        } catch {}
      };
      tryGet('text/plain');
      tryGet('text/uuid');
      tryGet('text/x-foundry-entity');
      for (const t of ev.dataTransfer.types || []) {
        if (t.startsWith('application/json')) tryGet(t);
      }
      return out.filter(Boolean);
    };

    const parseCandidate = (raw: string): any | null => {
      if (!raw) return null;
      const trimmed = raw.trim();
      if (!trimmed.startsWith('{')) {
        if (/^Actor\.[A-Za-z0-9]{5,}$/.test(trimmed)) return { uuid: trimmed };
      }
      try {
        return JSON.parse(trimmed);
      } catch {
        return null;
      }
    };

    const resolveActor = async (data: any): Promise<any | null> => {
      const g: any = (globalThis as any).game;
      if (!g) return null;

      // Handle Officer drag from OfficerWarehouseDialog
      if (data.type === 'Officer' && data.officerData?.actorId) {
        const actor = g.actors?.get?.(data.officerData.actorId);
        if (actor) return actor;
      }

      const directId = data.id || data.actorId || data._id;
      if (directId) {
        const byId =
          g.actors?.get?.(directId) || g.actors?.contents?.find?.((a: any) => a.id === directId);
        if (byId) return byId;
      }
      const uuid =
        data.uuid ||
        data.documentId ||
        (typeof data === 'string' && data.startsWith('Actor.') ? data : null);
      if (uuid && typeof (globalThis as any).fromUuid === 'function') {
        try {
          const doc = await (globalThis as any).fromUuid(uuid);
          if (doc?.documentName === 'Actor') return doc;
        } catch {}
      }
      if (data.name && g.actors) {
        const byName = g.actors.find?.((a: any) => a.name === data.name);
        if (byName) return byName;
      }
      return null;
    };

    const obtainActor = async (ev: DragEvent) => {
      for (const raw of pullAllDataStrings(ev)) {
        const data = parseCandidate(raw) || raw;
        const actor = await resolveActor(data);
        if (actor) return actor;
      }
      return null;
    };

    zones.forEach((zone) => {
      if ((zone as any)._gmDnD) return;
      (zone as any)._gmDnD = true;
      const mode: 'officer' | 'soldier' =
        (zone.dataset.drop as any) === 'officer' ? 'officer' : 'soldier';
      const card = zone.closest('.patrol-card') as HTMLElement | null;
      const pid = card?.dataset.patrolId || '';
      if (!pid) return;
      zone.addEventListener('dragenter', (ev) => {
        if (!isActorDrag(ev)) return;
        ev.preventDefault();
        zone.classList.add('dnd-hover');
        card?.classList.add('dnd-active');
      });
      zone.addEventListener('dragover', (ev) => {
        if (!isActorDrag(ev)) return;
        ev.preventDefault();
        ev.dataTransfer!.dropEffect = 'copy';
        zone.classList.add('dnd-hover');
        card?.classList.add('dnd-active');
      });
      zone.addEventListener('dragleave', () => {
        zone.classList.remove('dnd-hover');
        card?.classList.remove('dnd-active');
      });
      zone.addEventListener('drop', async (ev) => {
        if (!isActorDrag(ev)) return;
        ev.preventDefault();
        zone.classList.remove('dnd-hover');
        card?.classList.remove('dnd-active');
        const actor = await obtainActor(ev);
        if (!actor) {
          console.warn('PatrolsPanel | Actor no resuelto desde drag data', ev.dataTransfer?.types);
          return ui?.notifications?.warn?.('Actor no encontrado');
        }
        try {
          const patrol = pMgr.getPatrol(pid);
          if (!patrol) return;
          if (mode === 'officer') {
            pMgr.assignOfficer(pid, {
              actorId: actor.id,
              name: actor.name,
              img: actor.img,
              isLinked: actor.isOwner ?? true,
            });
            ui?.notifications?.info?.(`Oficial asignado: ${actor.name}`);
          } else {
            pMgr.addSoldier(pid, {
              actorId: actor.id,
              name: actor.name,
              img: actor.img,
              referenceType: 'linked',
              addedAt: Date.now(),
            });
            ui?.notifications?.info?.(`Soldado añadido: ${actor.name}`);
          }
          refreshCallback();
        } catch (e) {
          console.warn('PatrolsPanel | drop error', e);
          ui?.notifications?.error?.('Error al asignar actor');
        }
      });
    });
  }

  /** Attach drag & drop to patrol cards for effects */
  private static setupPatrolCardDnD(container: HTMLElement, refreshCallback: () => void) {
    const gm: any = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    const pMgr = orgMgr?.getPatrolManager?.();
    if (!pMgr) return;

    const cards = Array.from(container.querySelectorAll('.patrol-card')) as HTMLElement[];

    const isEffectDrag = (ev: DragEvent) => {
      if (!ev.dataTransfer) return false;
      const types = Array.from(ev.dataTransfer.types);
      // Check for our custom type or generic text
      return types.includes('text/plain');
    };

    cards.forEach((card) => {
      const pid = card.dataset.patrolId;
      if (!pid) return;

      card.addEventListener('dragenter', (ev) => {
        if (!isEffectDrag(ev)) return;
        // Check if it's a patrol effect
        // We can't check content here easily without reading data, which is only available on drop
        // But we can check if we are dragging a patrol effect by checking a global flag or just allowing it
        // For now, we'll allow it and validate on drop
        ev.preventDefault();
        card.classList.add('dnd-active-effect');
      });

      card.addEventListener('dragover', (ev) => {
        if (!isEffectDrag(ev)) return;
        ev.preventDefault();
        if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
        card.classList.add('dnd-active-effect');
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('dnd-active-effect');
      });

      card.addEventListener('drop', async (ev) => {
        ev.preventDefault();
        card.classList.remove('dnd-active-effect');

        if (!ev.dataTransfer) return;
        const dataStr = ev.dataTransfer.getData('text/plain');
        if (!dataStr) return;

        try {
          const data = JSON.parse(dataStr);
          if (data.type !== 'patrol-effect' || !data.effectData) return;

          const effectData = data.effectData;

          // Convert stat modifications to modifiers object
          const modifiers: Partial<GuardStats> = {};
          if (Array.isArray(effectData.statModifications)) {
            effectData.statModifications.forEach((mod: any) => {
              if (mod.statName && typeof mod.value === 'number') {
                modifiers[mod.statName as keyof GuardStats] = mod.value;
              }
            });
          }

          const effectInstance: PatrolEffectInstance = {
            id: (globalThis as any).foundry.utils.randomID(),
            sourceType: 'manual',
            label: effectData.name,
            img: effectData.image,
            description: effectData.description,
            modifiers: modifiers,
          };

          pMgr.addEffect(pid, effectInstance);

          if ((globalThis as any).ui?.notifications) {
            (globalThis as any).ui.notifications.info(
              `Efecto "${effectData.name}" aplicado a la patrulla`
            );
          }

          refreshCallback();
        } catch (e) {
          // Not a JSON or not our data, ignore
        }
      });
    });
  }

  public static async handleCreatePatrol(refreshCallback: () => void) {
    const gm = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    if (!orgMgr) return;
    const org = orgMgr.getOrganization();
    if (!org) return;
    const created = await orgMgr.openCreatePatrolDialog();
    if (created) {
      ui?.notifications?.info('Patrulla creada');
      refreshCallback();
    }
  }

  public static async handleEditPatrol(patrolId: string, refreshCallback: () => void) {
    const gm = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    if (!orgMgr) return;
    const updated = await orgMgr.openEditPatrolDialog(patrolId);
    if (updated) {
      ui?.notifications?.info('Patrulla actualizada');
      refreshCallback();
    }
  }

  public static async handleDeletePatrol(patrolId: string, refreshCallback: () => void) {
    const confirm = await Dialog.confirm({
      title: 'Eliminar Patrulla',
      content: `<p>¿Seguro que deseas eliminar esta patrulla?</p>`,
    });
    if (!confirm) return;
    const gm = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    if (!orgMgr) return;
    const org = orgMgr.getOrganization();
    if (!org) return;
    orgMgr.removePatrol(patrolId);
    const pMgr = orgMgr.getPatrolManager();
    await pMgr.deletePatrol(patrolId);
    ui?.notifications?.warn('Patrulla eliminada');
    refreshCallback();
  }

  public static async handleSendPatrolToChat(patrolId: string) {
    const gm = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    if (!orgMgr) return;
    const pMgr = orgMgr.getPatrolManager();
    const patrol = pMgr.getPatrol(patrolId);
    if (!patrol) return;

    const breakdown = this.computePatrolStatBreakdown(patrol);

    // Format stats for display
    const statsHtml = Object.entries(breakdown)
      .map(([key, val]: [string, any]) => {
        const total = val.total;
        const base = val.base;
        const effects = val.effects;
        const org = val.org;

        let details = `Base: ${base}`;
        if (effects !== 0) details += `, Efectos: ${effects > 0 ? '+' : ''}${effects}`;
        if (org !== 0) details += `, Org: ${org > 0 ? '+' : ''}${org}`;

        return `
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                <span style="text-transform: capitalize;">${key}:</span>
                <span title="${details}"><strong>${total}</strong></span>
            </div>
        `;
      })
      .join('');

    // Format soldiers
    const soldierCount = patrol.soldiers.length;
    const maxSoldiers = patrol.soldierSlots || 5;

    // Format effects
    let effectsHtml = '';
    if (patrol.patrolEffects && patrol.patrolEffects.length > 0) {
      effectsHtml = `
            <div style="margin-top: 10px; border-top: 1px solid rgba(0,0,0,0.1); padding-top: 5px;">
                <strong>Efectos Activos:</strong>
                <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
                    ${patrol.patrolEffects
                      .map(
                        (eff: any) => `
                        <div style="display: flex; align-items: center; gap: 4px; background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; font-size: 0.9em;">
                            ${eff.img ? `<img src="${eff.img}" style="width: 16px; height: 16px; border: none;" />` : ''}
                            <span>${eff.label}</span>
                        </div>
                    `
                      )
                      .join('')}
                </div>
            </div>
        `;
    }

    const content = `
      <div class="daggerheart chat domain-card dh-style">
        ${patrol.officer?.img ? `<img class="card-img" src="${patrol.officer.img}">` : ''}
        <details class="domain-card-move" open>
          <summary class="domain-card-header">
            <div class="domain-label">
              <h2 class="title">${patrol.name}</h2>
              <ul class="tags">
                <li class="tag">Patrulla</li>
                ${patrol.subtitle ? `<li class="tag">${patrol.subtitle}</li>` : ''}
                <li class="tag">Soldados: ${soldierCount}/${maxSoldiers}</li>
                <li class="tag">Oficial: ${patrol.officer?.name || 'Sin asignar'}</li>
              </ul>
            </div>
            <i class="fa-solid fa-chevron-down"></i>
          </summary>
          <div class="description">
            ${patrol.lastOrder ? `<p><strong>Última Orden:</strong> <em>${patrol.lastOrder.text}</em></p>` : ''}
            <p><strong>Estadísticas:</strong></p>
            ${statsHtml}
            ${effectsHtml}
          </div>
        </details>
      </div>
    `;

    await (ChatMessage as any).create({
      content: content,
      speaker: (ChatMessage as any).getSpeaker({ alias: 'Informe de Patrulla' }),
    });
  }

  public static async handleEditLastOrder(patrolId: string, refreshCallback: () => void) {
    const gm = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    if (!orgMgr) return;
    const pMgr = orgMgr.getPatrolManager();
    const patrol = pMgr.getPatrol(patrolId);
    if (!patrol) return;

    let current = patrol.lastOrder?.text || '';
    if (current.includes('[object Object]')) current = '';

    // Escape for attribute value
    const escapedCurrent = current.replace(/"/g, '&quot;');

    const result = await (foundry as any).applications.api.DialogV2.wait({
      window: { title: 'Editar Última Orden', resizable: true },
      content: `
        <form class='last-order-edit'>
          <div class="form-group" style="display: flex; flex-direction: column;">
            <label style="margin-bottom: 5px; font-weight: bold;">Orden</label>
            <div style="width: 100%;">
              <prose-mirror name="order" value="${escapedCurrent}">
                ${current}
              </prose-mirror>
            </div>
          </div>
          <div class="form-group" style="margin-top: 10px;">
            <label class="checkbox">
              <input type="checkbox" name="notifyChat" checked>
              Notificar al chat
            </label>
          </div>
          <p class='hint'>Actualiza la última orden de la patrulla.</p>
        </form>`,
      buttons: [
        {
          action: 'save',
          label: 'Guardar',
          icon: 'fas fa-save',
          default: true,
          callback: async (_ev: any, btn: any, dlg: any) => {
            const form = btn?.form || dlg?.window?.content?.querySelector('form.last-order-edit');
            if (!form) return 'cancel';

            let text = '';

            // Strategy 1: InnerHTML of the contenteditable div (Most reliable for ProseMirror)
            const editorContent = form.querySelector('.editor-content.ProseMirror');
            if (editorContent) {
              text = editorContent.innerHTML;
            }

            // Strategy 2: Value of custom element
            if (!text) {
              const pmElement = form.querySelector('prose-mirror');
              if (pmElement && 'value' in pmElement) {
                const val = (pmElement as any).value;
                if (typeof val === 'string' && !val.includes('[object Object]')) {
                  text = val;
                }
              }
            }

            // Strategy 3: FormData
            if (!text) {
              const fd = new FormData(form);
              const fdText = fd.get('order') as string;
              if (fdText && !fdText.includes('[object Object]')) {
                text = fdText;
              }
            }

            // Final check
            if (text.includes('[object ')) {
              text = '';
            }

            // Ensure we have a string
            text = text || '';

            await pMgr.updateLastOrder(patrolId, text.trim());
            const updated = pMgr.getPatrol(patrolId);
            if (updated) {
              orgMgr.upsertPatrolSnapshot(updated);

              // Handle chat notification
              const notifyChat = form.querySelector('input[name="notifyChat"]')?.checked;
              if (notifyChat && text.trim()) {
                const content = `
                  <div class="daggerheart chat domain-card dh-style">
                    ${patrol.officer?.img ? `<img class="card-img" src="${patrol.officer.img}">` : ''}
                    <details class="domain-card-move" open>
                      <summary class="domain-card-header">
                        <div class="domain-label">
                          <h2 class="title">${patrol.name}</h2>
                          <ul class="tags">
                            <li class="tag">Nueva Orden</li>
                          </ul>
                        </div>
                        <i class="fa-solid fa-chevron-down"></i>
                      </summary>
                      <div class="description">
                        <p>${text}</p>
                      </div>
                    </details>
                  </div>
                `;

                await (ChatMessage as any).create({
                  content: content,
                  speaker: (ChatMessage as any).getSpeaker({ alias: 'Comandante de la Guardia' }),
                });
              }
            }
            return 'save';
          },
        },
        { action: 'cancel', label: 'Cancelar', icon: 'fas fa-times', callback: () => 'cancel' },
      ],
    });
    if (result === 'save') {
      ui?.notifications?.info('Orden actualizada');
      refreshCallback();
    }
  }

  public static async handleOpenActorSheet(actorId: string): Promise<void> {
    const actor = (globalThis as any).game.actors.get(actorId);
    if (actor) {
      actor.sheet.render(true);
    } else {
      const tokenActor = (globalThis as any).canvas.tokens.placeables.find(
        (t: any) => t.actor?.id === actorId
      )?.actor;
      if (tokenActor) {
        tokenActor.sheet.render(true);
      } else {
        ui.notifications?.warn(`Actor ${actorId} no encontrado`);
      }
    }
  }

  public static async handleEffectClick(patrolId: string, effectId: string) {
    const gm = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    if (!orgMgr) return;
    const pMgr = orgMgr.getPatrolManager();
    const patrol = pMgr.getPatrol(patrolId);
    if (!patrol) return;
    const effect = patrol.patrolEffects.find((e: any) => e.id === effectId);
    if (!effect) return;

    const content = `
      <div class="daggerheart chat domain-card dh-style">
        <img class="card-img" src="${effect.img || 'icons/svg/aura.svg'}">
        <details class="domain-card-move" open>
          <summary class="domain-card-header">
            <div class="domain-label">
              <h2 class="title">${effect.label}</h2>
              <ul class="tags">
                <li class="tag">Efecto de Patrulla</li>
                ${Object.entries(effect.modifiers || {})
                  .map(([k, v]) => `<li class="tag">${k}: ${v}</li>`)
                  .join('')}
              </ul>
            </div>
            <i class="fa-solid fa-chevron-down"></i>
          </summary>
          <div class="description">
            <p>${effect.description || 'Sin descripción'}</p>
          </div>
        </details>
      </div>
    `;

    await (ChatMessage as any).create({
      content: content,
      speaker: (ChatMessage as any).getSpeaker({ alias: 'Efecto de Patrulla' }),
    });
  }

  public static async handleRemoveEffect(
    patrolId: string,
    effectId: string,
    refreshCallback: () => void
  ) {
    const gm = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    if (!orgMgr) return;
    const pMgr = orgMgr.getPatrolManager();

    const patrol = pMgr.getPatrol(patrolId);
    if (!patrol) return;
    const effect = patrol.patrolEffects.find((e: any) => e.id === effectId);
    const effectName = effect?.label || 'Efecto';

    const confirm = await Dialog.confirm({
      title: 'Eliminar Efecto',
      content: `<p>¿Seguro que deseas eliminar el efecto "<strong>${effectName}</strong>" de la patrulla?</p>`,
    });

    if (!confirm) return;

    pMgr.removeEffect(patrolId, effectId);
    ui?.notifications?.info('Efecto eliminado');
    refreshCallback();
  }
}
