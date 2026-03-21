import type { GuardStats, PatrolEffectInstance } from '../../types/entities';
import { classifyLastOrderAge } from '../../utils/patrol-helpers.js';

export type PanelUnitType = 'patrol' | 'auxiliary';

export class PatrolsPanel {
  static get template() {
    return 'modules/guard-management/templates/panels/patrols.hbs';
  }

  static async getData(unitType: PanelUnitType = 'patrol') {
    const gm = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    const patrols = unitType === 'auxiliary'
      ? (orgMgr ? orgMgr.listOrganizationAuxiliaries() : [])
      : (orgMgr ? orgMgr.listOrganizationPatrols() : []);
    const isGM = (globalThis as any).game?.user?.isGM ?? false;

    // Build actorId → officer map for quick lookup (name + skills)
    const officerByActorId = new Map<string, any>();
    const officerManager = unitType === 'auxiliary' ? gm?.civilianManager : gm?.officerManager;
    const allOfficers: any[] = officerManager?.list?.() || [];
    for (const officer of allOfficers) {
      if (officer.actorId) {
        officerByActorId.set(officer.actorId, officer);
      }
    }

    // Enrich patrols
    const enrichedPatrols = patrols.map((p: any) => {
      const lastOrder = p.lastOrder;
      const ageClass = lastOrder
        ? classifyLastOrderAge({ issuedAt: lastOrder.issuedAt })
        : 'normal';
      // Resolve officer record from officerManager to get name + skills
      const officerRecord = p.officer?.actorId ? officerByActorId.get(p.officer.actorId) : null;

      // Compute stat breakdown (including officer stats if assigned)
      const bd = this.computePatrolStatBreakdown(p, officerRecord);

      // Format stats breakdown for template
      const statsBreakdown: Record<string, any> = {};
      Object.keys(p.baseStats || {}).forEach((k) => {
        const b = (bd as any)[k];
        if (b) statsBreakdown[k] = b;
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

      // Build officer stats display for template
      const officerStats = officerRecord?.stats || {};
      const officerStatsEntries = Object.entries(officerStats).filter(
        ([, v]) => (v as number) !== 0
      );
      const officerStatsDisplay = officerStatsEntries.map(([key, value]) => ({
        key,
        value: (value as number) > 0 ? `+${value}` : `${value}`,
        cssClass:
          (value as number) > 0 ? 'stat-positive' : (value as number) < 0 ? 'stat-negative' : '',
      }));

      // Format last order date
      let lastOrderDate: string | null = null;
      if (lastOrder?.issuedAt) {
        const d = new Date(lastOrder.issuedAt);
        lastOrderDate = d.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      }

      return {
        ...p,
        ageClass,
        statsBreakdown,
        slots,
        isGM,
        officerName: officerRecord?.name || p.officer?.name || null,
        officerId: officerRecord?.id || null,
        officerImgDisplay: officerRecord?.actorImg || p.officer?.img || null,
        officerSkills: officerRecord?.skills?.length ? officerRecord.skills : [],
        officerPros: officerRecord?.pros || [],
        officerCons: officerRecord?.cons || [],
        officerStatsDisplay,
        hasOfficerStats: officerStatsDisplay.length > 0,
        hasMembers: !!(p.officer?.actorId || (p.soldiers && p.soldiers.length > 0)),
        currentHope: p.currentHope ?? 0,
        maxHope: p.maxHope ?? 0,
        hopePips:
          (p.maxHope ?? 0) > 0
            ? Array.from({ length: p.maxHope ?? 0 }, (_, i) => ({
                filled: i < (p.currentHope ?? 0),
                index: i + 1,
              }))
            : [],
        lastOrderDate,
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

    return { patrols: enrichedPatrols, isGM, unitType };
  }

  static async render(container: HTMLElement, unitType: PanelUnitType = 'patrol') {
    const data = await this.getData(unitType);
    const htmlContent = await foundry.applications.handlebars.renderTemplate(this.template, data);

    // Use jQuery html() to forcibly replace content
    $(container).html(htmlContent);
    // Store unitType on container for handler access
    container.dataset.unitType = unitType;
    this.activateListeners(container, unitType);
  }

  static activateListeners(container: HTMLElement, unitType: PanelUnitType = 'patrol') {
    const $html = $(container);

    // Defensive: strip GM-only controls for non-GM users
    const userIsGM = (globalThis as any).game?.user?.isGM ?? false;
    if (!userIsGM) {
      $html.find('[data-action="edit-officer"]').remove();
      $html.find('[data-action="edit"]').remove();
      $html.find('[data-action="delete"]').remove();
      $html.find('[data-action="edit-last-order"]').remove();
      $html.find('[data-action="create-patrol"]').remove();
    }

    // Shift-key tracking: show unassign buttons over avatars when Shift is held
    const prevHandlers = (container as any)._guardShiftHandlers;
    if (prevHandlers) {
      document.removeEventListener('keydown', prevHandlers.down);
      document.removeEventListener('keyup', prevHandlers.up);
      window.removeEventListener('blur', prevHandlers.blur);
    }
    const patrolPanel =
      (container.querySelector('[data-patrols-panel]') as HTMLElement | null) ?? container;
    const handlerDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') patrolPanel.classList.add('shift-held');
    };
    const handlerUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') patrolPanel.classList.remove('shift-held');
    };
    const handlerBlur = () => patrolPanel.classList.remove('shift-held');
    document.addEventListener('keydown', handlerDown);
    document.addEventListener('keyup', handlerUp);
    window.addEventListener('blur', handlerBlur);
    (container as any)._guardShiftHandlers = {
      down: handlerDown,
      up: handlerUp,
      blur: handlerBlur,
    };

    // Drag & Drop
    this.setupPatrolZonesDnD(container, () => this.refresh(container), unitType);
    this.setupPatrolCardDnD(container, () => this.refresh(container), unitType);

    // Actions
    $html.find('[data-action="create-patrol"]').on('click', (ev) => {
      ev.preventDefault();
      this.handleCreatePatrol(() => this.refresh(container), unitType);
    });
    $html.find('[data-action="edit"]').on('click', (ev) => {
      ev.preventDefault();
      const id = ev.currentTarget.dataset.patrolId;
      if (id) this.handleEditPatrol(id, () => this.refresh(container), unitType);
    });
    $html.find('[data-action="delete"]').on('click', (ev) => {
      ev.preventDefault();
      const id = ev.currentTarget.dataset.patrolId;
      if (id) this.handleDeletePatrol(id, () => this.refresh(container), unitType);
    });
    $html.find('[data-action="call-patrol"]').on('click', (ev) => {
      ev.preventDefault();
      const id = ev.currentTarget.dataset.patrolId;
      if (id) this.handleCallPatrol(id, unitType);
    });
    $html.find('[data-action="to-chat"]').on('click', (ev) => {
      ev.preventDefault();
      const id = ev.currentTarget.dataset.patrolId;
      if (id) this.handleSendPatrolToChat(id, unitType);
    });
    $html.find('[data-action="edit-last-order"]').on('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = ev.currentTarget.dataset.patrolId;
      if (id) this.handleEditLastOrder(id, () => this.refresh(container), unitType);
    });
    // Toggle last-order body visibility
    $html.find('.last-order-header').on('click', (ev) => {
      const header = ev.currentTarget as HTMLElement;
      const body = header.nextElementSibling as HTMLElement | null;
      if (!body) return;
      const isHidden = body.style.display === 'none' || body.style.display === '';
      body.style.display = isHidden ? 'block' : 'none';
      header.querySelector('.last-order-chevron')?.classList.toggle('open', isHidden);
    });
    $html.find('[data-action="open-sheet"]').on('click', (ev) => {
      ev.preventDefault();
      const id = ev.currentTarget.dataset.actorId;
      if (id) this.handleOpenActorSheet(id);
    });
    $html.find('.skill-toggle-header').on('click', (ev) => {
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
    $html.find('.skill-to-chat-btn').on('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const el = ev.currentTarget;
      const skill = {
        name: el.dataset.skillName || '',
        image: el.dataset.skillImage || '',
        hopeCost: parseInt(el.dataset.skillHopeCost || '0', 10),
        officerName: el.dataset.officerName || '',
      };
      this.handleSkillToChat(skill);
    });
    $html.find('[data-action="edit-officer"]').on('click', (ev) => {
      ev.preventDefault();
      const officerId = ev.currentTarget.dataset.officerId;
      if (officerId) this.handleEditOfficer(officerId, () => this.refresh(container), unitType);
    });
    $html.find('[data-action="unassign-officer"]').on('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const patrolId = ev.currentTarget.dataset.patrolId;
      if (patrolId) this.handleUnassignOfficer(patrolId, () => this.refresh(container), unitType);
    });
    $html.find('[data-action="unassign-soldier"]').on('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const patrolId = ev.currentTarget.dataset.patrolId;
      const actorId = ev.currentTarget.dataset.actorId;
      if (patrolId && actorId)
        this.handleUnassignSoldier(patrolId, actorId, () => this.refresh(container), unitType);
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
        const pMgr = unitType === 'auxiliary'
          ? orgMgr?.getAuxiliaryManager?.()
          : orgMgr?.getPatrolManager?.();
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
      if (patrolId && effectId) this.handleEffectClick(patrolId, effectId, unitType);
    });

    $html.find('.effect-item').on('contextmenu', (ev) => {
      ev.preventDefault();
      const target = ev.currentTarget;
      const patrolId = target.dataset.patrolId;
      const effectId = target.dataset.effectId;
      if (patrolId && effectId)
        this.handleRemoveEffect(patrolId, effectId, () => this.refresh(container), unitType);
    });

    // Hope pip counter
    $html.find('[data-action="hope-pip"]').on('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const el = ev.currentTarget;
      const patrolId = el.dataset.patrolId;
      const index = parseInt(el.dataset.value || '0', 10);
      if (patrolId && index) this.handleHopePip(patrolId, index, () => this.refresh(container), unitType);
    });

    // Officer traits: toggle section + send to chat
    $html.find('.patrol-traits-header').on('click', (ev) => {
      const header = ev.currentTarget as HTMLElement;
      const body = header.nextElementSibling as HTMLElement | null;
      if (!body) return;
      const isHidden = body.style.display === 'none' || body.style.display === '';
      body.style.display = isHidden ? 'block' : 'none';
      header.querySelector('.patrol-traits-chevron')?.classList.toggle('open', isHidden);
    });

    // Officer section toggle (hidden by default)
    $html.find('.officer-section-header').on('click', (ev) => {
      const header = ev.currentTarget as HTMLElement;
      const body = header.nextElementSibling as HTMLElement | null;
      if (!body) return;
      const isHidden = body.style.display === 'none' || body.style.display === '';
      body.style.display = isHidden ? 'block' : 'none';
      header.querySelector('.officer-section-chevron')?.classList.toggle('open', isHidden);
    });
    $html.find('[data-action="trait-to-chat"]').on('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const el = ev.currentTarget as HTMLElement;
      this.handleTraitToChat({
        title: el.dataset.traitTitle || '',
        description: el.dataset.traitDescription || '',
        type: (el.dataset.traitType as 'pro' | 'con') || 'pro',
        officerName: el.dataset.officerName || '',
      });
    });
  }

  static async refresh(container: HTMLElement) {
    const unitType = (container.dataset.unitType as PanelUnitType) || 'patrol';
    await this.render(container, unitType);
  }

  /**
   * Get the right patrol/auxiliary manager based on unitType stored on container
   */
  private static getManagerForContainer(container: HTMLElement) {
    const unitType = (container.dataset.unitType as PanelUnitType) || 'patrol';
    const gm = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    return unitType === 'auxiliary'
      ? orgMgr?.getAuxiliaryManager?.()
      : orgMgr?.getPatrolManager?.();
  }

  private static computePatrolStatBreakdown(patrol: any, officerRecord?: any) {
    try {
      // Get Organization Modifiers (item-level modifiers with name + value)
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

      // Get full org contribution (org baseStats + modifiers) — always live, not stale
      const orgStats: Record<string, number> =
        (orgMgr?.calculateEffectiveOrgStats?.() as any) || {};

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

      // Officer stats contribution
      const officerStats: Record<string, number> = officerRecord?.stats || {};

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
          officer: number;
          officerName: string;
          officerImg: string;
          total: number;
          totalClass: string;
        }
      > = {};

      for (const key of Object.keys(patrol.baseStats || {})) {
        const base = patrol.baseStats?.[key] ?? 0;
        const effects = effectTotals[key] || 0;
        const effectList = effectDetails[key] || [];

        const orgContrib = orgStats[key] ?? 0; // full live org contribution (base + mods)
        const orgMods = orgModTotals[key] || 0;
        const orgBase = orgContrib - orgMods;
        const orgModList = orgModDetails[key] || [];

        const officerContrib = officerStats[key] || 0;

        const total = base + orgContrib + effects + officerContrib;

        // Color class: green = only positive, red = only negative, yellow = mixed
        const allModValues: number[] = [
          ...orgModList.map((m: any) => m.value),
          ...effectList.map((e: any) => e.value),
        ];
        if (orgBase !== 0) allModValues.push(orgBase);
        if (officerContrib !== 0) allModValues.push(officerContrib);
        const hasPos = allModValues.some((v) => v > 0);
        const hasNeg = allModValues.some((v) => v < 0);
        const totalClass =
          hasPos && hasNeg
            ? 'stat-mixed'
            : hasPos
              ? 'stat-positive'
              : hasNeg
                ? 'stat-negative'
                : '';

        breakdown[key] = {
          base,
          effects,
          effectList,
          org: orgContrib,
          orgBase,
          orgMods,
          orgModList,
          officer: officerContrib,
          officerName: officerRecord?.actorName || officerRecord?.name || '',
          officerImg: officerRecord?.actorImg || '',
          total,
          totalClass,
        };
      }
      return breakdown;
    } catch {
      return {};
    }
  }

  /** Resolve the patrol/auxiliary manager lazily (safe for use inside event handlers) */
  private static getPatrolMgr(unitType: PanelUnitType) {
    const gm: any = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    return unitType === 'auxiliary'
      ? orgMgr?.getAuxiliaryManager?.()
      : orgMgr?.getPatrolManager?.();
  }

  /** Attach drag & drop to officer and soldier zones */
  private static setupPatrolZonesDnD(container: HTMLElement, refreshCallback: () => void, unitType: PanelUnitType = 'patrol') {
    const zones = Array.from(
      container.querySelectorAll(
        '.patrol-card .officer-section-toggle[data-drop], .patrol-card .soldiers-zone[data-drop]'
      )
    ) as HTMLElement[];

    if (!zones.length) return;

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
        const actorId = data.officerData.actorId;
        const actor = g.actors?.get?.(actorId) ||
          g.actors?.contents?.find?.((a: any) => a.id === actorId);
        if (actor) return actor;
        if (typeof (globalThis as any).fromUuid === 'function') {
          try {
            const doc = await (globalThis as any).fromUuid(actorId.startsWith('Actor.') ? actorId : `Actor.${actorId}`);
            if (doc?.documentName === 'Actor') return doc;
          } catch {}
        }
      }

      // Handle Civilian drag from OfficerWarehouseDialog (auxiliaries)
      if (data.type === 'Civilian' && data.civilianData?.actorId) {
        const actorId = data.civilianData.actorId;
        const actor = g.actors?.get?.(actorId) ||
          g.actors?.contents?.find?.((a: any) => a.id === actorId);
        if (actor) return actor;
        if (typeof (globalThis as any).fromUuid === 'function') {
          try {
            const doc = await (globalThis as any).fromUuid(actorId.startsWith('Actor.') ? actorId : `Actor.${actorId}`);
            if (doc?.documentName === 'Actor') return doc;
          } catch {}
        }
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
        if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
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
        ev.stopPropagation();
        zone.classList.remove('dnd-hover');
        card?.classList.remove('dnd-active');

        // Resolve manager lazily at drop time
        const pMgr = this.getPatrolMgr(unitType);
        if (!pMgr) {
          console.warn('PatrolsPanel | drop: manager not available', { unitType });
          return;
        }

        // Officer slots only accept drags from the Officer Warehouse
        if (mode === 'officer') {
          const strings = pullAllDataStrings(ev);
          const isOfficerDrag = strings.some((raw) => {
            const d = parseCandidate(raw);
            return d?.type === 'Officer' || d?.type === 'Civilian';
          });
          if (!isOfficerDrag) {
            const warehouseLabel = unitType === 'auxiliary' ? 'Personal (Auxiliares)' : 'Personal (Oficiales)';
            return ui?.notifications?.warn?.(
              `Solo se pueden asignar desde ${warehouseLabel}`
            );
          }
        }

        // Soldier slots reject drags from the Officer Warehouse (officers/civilians are leaders, not soldiers)
        if (mode === 'soldier') {
          const strings = pullAllDataStrings(ev);
          const isWarehouseDrag = strings.some((raw) => {
            const d = parseCandidate(raw);
            return d?.type === 'Officer' || d?.type === 'Civilian';
          });
          if (isWarehouseDrag) {
            const leaderLabel = unitType === 'auxiliary' ? 'un Líder Auxiliar' : 'un Oficial';
            const slotLabel = unitType === 'auxiliary' ? 'Subalterno' : 'Soldado';
            return ui?.notifications?.warn?.(
              `No puedes asignar ${leaderLabel} como ${slotLabel}. Arrástralo al slot de líder.`
            );
          }
        }

        const actor = await obtainActor(ev);
        if (!actor) {
          const rawStrings = pullAllDataStrings(ev);
          console.warn('PatrolsPanel | Actor no resuelto desde drag data', {
            types: Array.from(ev.dataTransfer?.types || []),
            rawData: rawStrings,
            parsed: rawStrings.map(s => parseCandidate(s)),
          });
          return ui?.notifications?.warn?.('Actor no encontrado');
        }
        try {
          const patrol = pMgr.getPatrol(pid);
          if (!patrol) return;
          if (mode === 'officer') {
            if (patrol.officer && patrol.officer.actorId !== actor.id) {
              const confirmed = await Dialog.confirm({
                title: 'Reemplazar Oficial',
                content: `<p>¿Reemplazar a <strong>${patrol.officer.name}</strong> con <strong>${actor.name}</strong>?</p>`,
              });
              if (!confirmed) return;
            }
            pMgr.assignOfficer(pid, {
              actorId: actor.id,
              name: actor.name,
              img: actor.img,
              isLinked: actor.isOwner ?? true,
            });
            ui?.notifications?.info?.(`${unitType === 'auxiliary' ? 'Auxiliar' : 'Oficial'} asignado: ${actor.name}`);
          } else {
            const soldierLabel = unitType === 'auxiliary' ? 'Subalterno' : 'Soldado';
            const isDuplicate = (patrol.soldiers as any[]).some((s: any) => s.actorId === actor.id);
            if (isDuplicate) {
              const confirmed = await Dialog.confirm({
                title: `${soldierLabel} duplicado`,
                content: `<p><strong>${actor.name}</strong> ya está en ${unitType === 'auxiliary' ? 'este auxiliar' : 'esta patrulla'}. ¿Añadir igualmente?</p>`,
              });
              if (!confirmed) return;
            }
            pMgr.addSoldier(pid, {
              actorId: actor.id,
              name: actor.name,
              img: actor.img,
              referenceType: 'linked',
              addedAt: Date.now(),
            });
            ui?.notifications?.info?.(`${soldierLabel} añadido: ${actor.name}`);
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
  private static setupPatrolCardDnD(container: HTMLElement, refreshCallback: () => void, unitType: PanelUnitType = 'patrol') {
    const cards = Array.from(container.querySelectorAll('.patrol-card')) as HTMLElement[];
    if (!cards.length) return;

    const isEffectDrag = (ev: DragEvent) => {
      if (!ev.dataTransfer) return false;
      const types = Array.from(ev.dataTransfer.types);
      return types.includes('text/plain');
    };

    cards.forEach((card) => {
      const pid = card.dataset.patrolId;
      if (!pid) return;

      card.addEventListener('dragenter', (ev) => {
        if (!isEffectDrag(ev)) return;
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

          // Handle Officer/Civilian drops anywhere on card → assign as officer
          if (data.type === 'Officer' || data.type === 'Civilian') {
            const pMgr = this.getPatrolMgr(unitType);
            if (!pMgr) return;

            const g: any = (globalThis as any).game;
            const actorId = data.type === 'Officer'
              ? data.officerData?.actorId
              : data.civilianData?.actorId;
            if (!actorId) return;

            const actor = g?.actors?.get?.(actorId) ||
              g?.actors?.contents?.find?.((a: any) => a.id === actorId);
            if (!actor) {
              ui?.notifications?.warn?.('Actor no encontrado');
              return;
            }

            const patrol = pMgr.getPatrol(pid);
            if (!patrol) return;

            if (patrol.officer && patrol.officer.actorId !== actor.id) {
              const confirmed = await Dialog.confirm({
                title: 'Reemplazar Oficial',
                content: `<p>¿Reemplazar a <strong>${patrol.officer.name}</strong> con <strong>${actor.name}</strong>?</p>`,
              });
              if (!confirmed) return;
            }
            pMgr.assignOfficer(pid, {
              actorId: actor.id,
              name: actor.name,
              img: actor.img,
              isLinked: actor.isOwner ?? true,
            });
            ui?.notifications?.info?.(`${unitType === 'auxiliary' ? 'Auxiliar' : 'Oficial'} asignado: ${actor.name}`);
            refreshCallback();
            return;
          }

          if (data.type !== 'patrol-effect' || !data.effectData) return;

          // Resolve manager lazily at drop time
          const pMgr = this.getPatrolMgr(unitType);
          if (!pMgr) return;

          const effectData = data.effectData;

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

  public static async handleCreatePatrol(refreshCallback: () => void, unitType: PanelUnitType = 'patrol') {
    const gm = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    if (!orgMgr) return;
    const org = orgMgr.getOrganization();
    if (!org) return;
    const label = unitType === 'auxiliary' ? 'Auxiliar' : 'Patrulla';
    const created = unitType === 'auxiliary'
      ? await orgMgr.openCreateAuxiliaryDialog()
      : await orgMgr.openCreatePatrolDialog();
    if (created) {
      ui?.notifications?.info(`${label} creada`);
      refreshCallback();
    }
  }

  public static async handleEditPatrol(patrolId: string, refreshCallback: () => void, unitType: PanelUnitType = 'patrol') {
    const gm = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    if (!orgMgr) return;
    const label = unitType === 'auxiliary' ? 'Auxiliar' : 'Patrulla';
    const updated = unitType === 'auxiliary'
      ? await orgMgr.openEditAuxiliaryDialog(patrolId)
      : await orgMgr.openEditPatrolDialog(patrolId);
    if (updated) {
      ui?.notifications?.info(`${label} actualizada`);
      refreshCallback();
    }
  }

  public static async handleDeletePatrol(patrolId: string, refreshCallback: () => void, unitType: PanelUnitType = 'patrol') {
    const label = unitType === 'auxiliary' ? 'Auxiliar' : 'Patrulla';
    const confirm = await Dialog.confirm({
      title: `Eliminar ${label}`,
      content: `<p>¿Seguro que deseas eliminar esta ${label.toLowerCase()}?</p>`,
    });
    if (!confirm) return;
    const gm = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    if (!orgMgr) return;
    const org = orgMgr.getOrganization();
    if (!org) return;
    const pMgr = unitType === 'auxiliary'
      ? orgMgr.getAuxiliaryManager()
      : orgMgr.getPatrolManager();
    if (unitType === 'auxiliary') {
      orgMgr.removeAuxiliary(patrolId);
    } else {
      orgMgr.removePatrol(patrolId);
    }
    await pMgr.deletePatrol(patrolId);
    ui?.notifications?.warn(`${label} eliminada`);
    refreshCallback();
  }

  public static async handleSendPatrolToChat(patrolId: string, unitType: PanelUnitType = 'patrol') {
    const gm = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    if (!orgMgr) return;
    const pMgr = unitType === 'auxiliary'
      ? orgMgr.getAuxiliaryManager()
      : orgMgr.getPatrolManager();
    const patrol = pMgr.getPatrol(patrolId);
    if (!patrol) return;

    // Look up officer record for stats
    const officerManager = unitType === 'auxiliary' ? gm?.civilianManager : gm?.officerManager;
    const allOfficers: any[] = officerManager?.list?.() || [];
    const officerRecord = patrol.officer?.actorId
      ? allOfficers.find((o: any) => o.actorId === patrol.officer.actorId)
      : null;

    const breakdown = this.computePatrolStatBreakdown(patrol, officerRecord);

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
      <div class="guard-resource-chat">
        <div class="chat-header" style="display: flex; align-items: center; gap: 10px;">
            ${patrol.officer?.img ? `<img src="${patrol.officer.img}" style="width: 32px; height: 32px; border: none; object-fit: cover;" />` : ''}
            <div>
                <div style="font-weight: bold; font-size: 1.2em;">${patrol.name}</div>
                ${patrol.subtitle ? `<div style="font-size: 0.9em; opacity: 0.8;">${patrol.subtitle}</div>` : ''}
            </div>
        </div>

        <div class="resource-description" style="text-align: left; margin: 10px 0; padding: 10px; background: rgba(0,0,0,0.1); border-radius: 4px;">
            <div style="margin-bottom: 8px;">
                <strong>Oficial:</strong> ${patrol.officer?.name || 'Sin asignar'}
            </div>
            <div style="margin-bottom: 8px;">
                <strong>Soldados:</strong> ${soldierCount} / ${maxSoldiers}
            </div>
            ${
              patrol.lastOrder
                ? `
            <div style="margin-bottom: 8px; padding: 5px; background: rgba(255,255,255,0.1); border-radius: 4px;">
                <strong>Última Orden:</strong><br/>
                <em style="font-size: 0.95em;">${patrol.lastOrder.text}</em>
            </div>
            `
                : ''
            }

            <div style="margin-top: 10px;">
                <strong>Estadísticas:</strong>
                <div style="margin-top: 4px; padding-left: 5px;">
                    ${statsHtml}
                </div>
            </div>

            ${effectsHtml}
        </div>
      </div>
    `;

    await (ChatMessage as any).create({
      content: content,
      speaker: { scene: null, actor: null, token: null, alias: unitType === 'auxiliary' ? 'Informe de Auxiliar' : 'Informe de Patrulla' },
      flags: { 'guard-management': { type: 'patrol-report' } },
    });
  }

  public static async handleEditLastOrder(patrolId: string, refreshCallback: () => void, unitType: PanelUnitType = 'patrol') {
    const gm = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    if (!orgMgr) return;
    const pMgr = unitType === 'auxiliary'
      ? orgMgr.getAuxiliaryManager()
      : orgMgr.getPatrolManager();
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
                const officerImg = patrol.officer?.img
                  ? `<div class="resource-image" style="margin-bottom: 8px;"><img src="${patrol.officer.img}" /></div>`
                  : '';

                const content = `
                  <div class="guard-resource-chat">
                    ${officerImg}
                    <div class="chat-header">Nueva Orden: ${patrol.name}</div>
                    <div class="resource-description" style="text-align: left; margin: 10px 0; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 4px;">
                      ${text}
                    </div>
                  </div>
                `;

                await (ChatMessage as any).create({
                  content: content,
                  speaker: {
                    scene: null,
                    actor: null,
                    token: null,
                    alias: 'Comandante de la Guardia',
                  },
                  flags: { 'guard-management': { type: 'last-order' } },
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

  public static async handleSkillToChat(skill: {
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

  public static async handleEditOfficer(officerId: string, refreshCallback: () => void, unitType: PanelUnitType = 'patrol') {
    const gm = (window as any).GuardManagement;
    const officerManager = unitType === 'auxiliary' ? gm?.civilianManager : gm?.officerManager;
    if (!officerManager) return;
    const officer = officerManager.get(officerId);
    if (!officer) return;

    const { OfficerFormApplication } = await import('../../dialogs/OfficerFormApplication.js');
    const personnelType = unitType === 'auxiliary' ? 'civilian' : 'officer';
    const app = new OfficerFormApplication('edit', officer.organizationId || '', officer, personnelType);
    const result = await app.show();
    if (result) {
      refreshCallback();
    }
  }

  public static async handleUnassignOfficer(patrolId: string, refreshCallback: () => void, unitType: PanelUnitType = 'patrol') {
    const gm = (window as any).GuardManagement;
    const pMgr = unitType === 'auxiliary'
      ? gm?.guardOrganizationManager?.getAuxiliaryManager?.()
      : gm?.guardOrganizationManager?.getPatrolManager?.();
    if (!pMgr) return;
    await pMgr.updatePatrol(patrolId, { officer: null });
    refreshCallback();
  }

  public static async handleUnassignSoldier(
    patrolId: string,
    actorId: string,
    refreshCallback: () => void,
    unitType: PanelUnitType = 'patrol'
  ) {
    const gm = (window as any).GuardManagement;
    const pMgr = unitType === 'auxiliary'
      ? gm?.guardOrganizationManager?.getAuxiliaryManager?.()
      : gm?.guardOrganizationManager?.getPatrolManager?.();
    if (!pMgr) return;
    const patrol = pMgr.getPatrol(patrolId);
    if (!patrol) return;
    // Remove first matching soldier
    const idx = patrol.soldiers.findIndex((s: any) => s.actorId === actorId);
    if (idx === -1) return;
    const updatedSoldiers = [...patrol.soldiers.slice(0, idx), ...patrol.soldiers.slice(idx + 1)];
    await pMgr.updatePatrol(patrolId, { soldiers: updatedSoldiers });
    refreshCallback();
  }

  public static async handleEffectClick(patrolId: string, effectId: string, unitType: PanelUnitType = 'patrol') {
    const gm = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    if (!orgMgr) return;
    const pMgr = unitType === 'auxiliary'
      ? orgMgr.getAuxiliaryManager()
      : orgMgr.getPatrolManager();
    const patrol = pMgr.getPatrol(patrolId);
    if (!patrol) return;
    const effect = patrol.patrolEffects.find((e: any) => e.id === effectId);
    if (!effect) return;

    // Construct chat message content
    const content = `
      <div class="guard-resource-chat">
        <div class="resource-image" style="margin-bottom: 8px;">
            <img src="${effect.img || 'icons/svg/aura.svg'}" style="max-width: 64px; border: none;" />
        </div>
        <div class="chat-header" style="font-weight: bold; font-size: 1.2em; margin-bottom: 5px;">${effect.label}</div>
        <div class="resource-description" style="text-align: left; margin: 10px 0; padding: 10px; background: rgba(0,0,0,0.1); border-radius: 4px;">
          ${effect.description || 'Sin descripción'}
        </div>
        <div class="stat-modifiers">
            ${Object.entries(effect.modifiers || {})
              .map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`)
              .join('')}
        </div>
      </div>
    `;

    await (ChatMessage as any).create({
      content: content,
      speaker: { scene: null, actor: null, token: null, alias: 'Efecto de Patrulla' },
      flags: { 'guard-management': { type: 'patrol-effect' } },
    });
  }

  public static async handleRemoveEffect(
    patrolId: string,
    effectId: string,
    refreshCallback: () => void,
    unitType: PanelUnitType = 'patrol'
  ) {
    const gm = (window as any).GuardManagement;
    const orgMgr = gm?.guardOrganizationManager;
    if (!orgMgr) return;
    const pMgr = unitType === 'auxiliary'
      ? orgMgr.getAuxiliaryManager()
      : orgMgr.getPatrolManager();

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

  public static async handleHopePip(patrolId: string, index: number, refreshCallback: () => void, unitType: PanelUnitType = 'patrol') {
    const gm = (window as any).GuardManagement;
    const pMgr = unitType === 'auxiliary'
      ? gm?.guardOrganizationManager?.getAuxiliaryManager?.()
      : gm?.guardOrganizationManager?.getPatrolManager?.();
    if (!pMgr) return;
    const patrol = pMgr.getPatrol(patrolId);
    if (!patrol) return;
    const current = patrol.currentHope ?? 0;
    const max = patrol.maxHope ?? 0;
    // Click filled pip → decrease to index-1; click empty pip → fill up to index
    const newHope = current >= index ? index - 1 : Math.min(index, max);
    if (newHope === current) return;
    await pMgr.updatePatrol(patrolId, { currentHope: newHope });
    refreshCallback();
  }

  public static async handleTraitToChat(trait: {
    title: string;
    description: string;
    type: 'pro' | 'con';
    officerName: string;
  }) {
    const icon =
      trait.type === 'pro'
        ? '<i class="fas fa-plus-circle" style="color:#9acd32"></i>'
        : '<i class="fas fa-minus-circle" style="color:#ff6b6b"></i>';
    const content = `
      <div class="guard-resource-chat">
        <div class="chat-header">${icon} ${trait.title}</div>
        ${trait.officerName ? `<div style="font-size:0.85em;opacity:0.75;"><i class="fas fa-user"></i> ${trait.officerName}</div>` : ''}
        <div class="resource-description">${trait.description || ''}</div>
      </div>
    `;
    await (ChatMessage as any).create({
      content,
      speaker: { scene: null, actor: null, token: null, alias: 'Rasgo de Oficial' },
      flags: { 'guard-management': { type: 'officer-trait' } },
    });
  }

  /**
   * Handle the "Call Patrol" button: enter pick-location mode,
   * then place tokens of all members in circular formation.
   */
  public static async handleCallPatrol(patrolId: string, unitType: PanelUnitType = 'patrol'): Promise<void> {
    const g: any = (globalThis as any).game;
    const cv: any = (globalThis as any).canvas;

    if (!cv?.scene) {
      ui?.notifications?.warn?.('No hay escena activa. Abre una escena primero.');
      return;
    }

    const pMgr = this.getPatrolMgr(unitType);
    if (!pMgr) return;
    const patrol = pMgr.getPatrol(patrolId);
    if (!patrol) return;

    // Collect all member actorIds
    const members: Array<{ actorId: string; name: string; isOfficer: boolean }> = [];

    if (patrol.officer?.actorId) {
      members.push({
        actorId: patrol.officer.actorId,
        name: patrol.officer.name || 'Officer',
        isOfficer: true,
      });
    }

    for (const soldier of (patrol.soldiers || [])) {
      if (soldier.actorId) {
        members.push({
          actorId: soldier.actorId,
          name: soldier.name || 'Soldier',
          isOfficer: false,
        });
      }
    }

    if (members.length === 0) {
      const label = unitType === 'auxiliary' ? 'auxiliar' : 'patrulla';
      ui?.notifications?.warn?.(`Esta ${label} no tiene miembros para colocar`);
      return;
    }

    const label = unitType === 'auxiliary' ? 'auxiliar' : 'patrulla';
    ui?.notifications?.info?.(`Haz clic en el canvas para colocar la ${label}. Clic derecho o Escape para cancelar.`);

    try {
      const position = await PatrolsPanel.pickCanvasLocation();
      if (!position) {
        ui?.notifications?.info?.('Colocación de tokens cancelada');
        return;
      }

      const gridSize = cv.grid?.size || 100;
      const tokenPositions = PatrolsPanel.calculateFormationPositions(
        position.x,
        position.y,
        members,
        gridSize
      );

      // Create token documents
      const tokenDataArray: any[] = [];
      const skipped: string[] = [];

      for (const tp of tokenPositions) {
        const actor = g.actors?.get?.(tp.actorId);
        if (!actor) {
          skipped.push(tp.name);
          continue;
        }

        // Use getTokenDocument to resolve wildcard token images
        const tokenDoc = await actor.getTokenDocument?.({ x: tp.x, y: tp.y });
        if (tokenDoc) {
          tokenDataArray.push(tokenDoc.toObject());
        } else {
          // Fallback for actors without getTokenDocument
          const protoData = actor.prototypeToken?.toObject?.() || actor.prototypeToken || {};
          tokenDataArray.push({
            ...protoData,
            name: protoData.name || actor.name,
            actorId: actor.id,
            x: tp.x,
            y: tp.y,
          });
        }
      }

      if (tokenDataArray.length === 0) {
        ui?.notifications?.error?.('No se encontraron actores para colocar');
        return;
      }

      await cv.scene.createEmbeddedDocuments('Token', tokenDataArray);

      if (skipped.length > 0) {
        ui?.notifications?.warn?.(
          `${tokenDataArray.length} tokens colocados. Actores no encontrados: ${skipped.join(', ')}`
        );
      } else {
        ui?.notifications?.info?.(`${tokenDataArray.length} tokens colocados exitosamente`);
      }
    } catch (err) {
      console.error('GuardManagement | Error placing patrol tokens:', err);
      ui?.notifications?.error?.('Error al colocar tokens');
    }
  }

  /**
   * Enter crosshair pick mode on the canvas.
   * Resolves with {x, y} when left-clicked, or null if cancelled (right-click / Escape).
   */
  private static pickCanvasLocation(): Promise<{ x: number; y: number } | null> {
    return new Promise((resolve) => {
      const cv: any = (globalThis as any).canvas;
      if (!cv?.stage) {
        resolve(null);
        return;
      }

      const canvasElement = document.getElementById('board');
      const originalCursor = canvasElement?.style.cursor || '';
      if (canvasElement) canvasElement.style.cursor = 'crosshair';

      let resolved = false;

      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        if (canvasElement) canvasElement.style.cursor = originalCursor;
        cv.stage.off('pointerdown', onPointerDown);
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('contextmenu', onContextMenu);
      };

      const onPointerDown = (event: any) => {
        if (event.data?.button !== 0) return;

        const point = event.data.getLocalPosition(cv.stage);

        // Snap to grid center
        const CONST_GRID = (globalThis as any).CONST;
        const snapped = cv.grid?.getSnappedPoint?.(
          { x: point.x, y: point.y },
          { mode: CONST_GRID?.GRID_SNAPPING_MODES?.CENTER ?? 2 }
        ) || cv.grid?.getSnappedPosition?.(point.x, point.y, 1)
          || { x: point.x, y: point.y };

        cleanup();
        resolve(snapped);
      };

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          cleanup();
          resolve(null);
        }
      };

      const onContextMenu = (event: MouseEvent) => {
        event.preventDefault();
        cleanup();
        resolve(null);
      };

      cv.stage.on('pointerdown', onPointerDown);
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('contextmenu', onContextMenu, { once: true });
    });
  }

  /**
   * Calculate positions for a circular formation.
   * Officer at center, soldiers distributed on a circle.
   */
  private static calculateFormationPositions(
    centerX: number,
    centerY: number,
    members: Array<{ actorId: string; name: string; isOfficer: boolean }>,
    gridSize: number
  ): Array<{ actorId: string; name: string; x: number; y: number }> {
    const result: Array<{ actorId: string; name: string; x: number; y: number }> = [];

    const officer = members.find(m => m.isOfficer);
    const soldiers = members.filter(m => !m.isOfficer);

    // Officer at center
    if (officer) {
      result.push({
        actorId: officer.actorId,
        name: officer.name,
        x: centerX,
        y: centerY,
      });
    }

    // Soldiers on a circle (tight formation)
    if (soldiers.length > 0) {
      const baseRadius = gridSize * 1.0;
      const minArcLength = gridSize * 0.85;
      const minRadiusForCount = (soldiers.length * minArcLength) / (2 * Math.PI);
      const radius = Math.max(baseRadius, minRadiusForCount);

      for (let i = 0; i < soldiers.length; i++) {
        const angle = (2 * Math.PI * i) / soldiers.length - Math.PI / 2;
        result.push({
          actorId: soldiers[i].actorId,
          name: soldiers[i].name,
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        });
      }
    }

    return result;
  }
}
