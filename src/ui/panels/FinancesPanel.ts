/**
 * Finances Panel - Manages the Finanzas tab UI
 * Static class following the same pattern as GangsPanel / BuildingsPanel.
 */
import type { FinanceRefType, FinanceReference } from '../../types/finances';
import { REF_TYPE_ICONS, REF_TYPE_LABELS } from '../../types/finances';
import { GuardModal } from '../GuardModal.js';

export class FinancesPanel {
  static get template() {
    return 'modules/guard-management/templates/panels/finances.hbs';
  }

  // ========================
  // Reference helpers
  // ========================

  /** Rich reference option with metadata for card display */
  private static getReferenceOptions(): Record<
    FinanceRefType,
    { id: string; name: string; img?: string; subtitle?: string }[]
  > {
    const gm = (window as any).GuardManagement;
    const result: Record<
      FinanceRefType,
      { id: string; name: string; img?: string; subtitle?: string }[]
    > = {
      patrol: [],
      auxiliary: [],
      building: [],
      prisoner: [],
    };

    // Patrols
    try {
      const patrolMgr = gm?.guardOrganizationManager?.getPatrolManager?.();
      const patrols = patrolMgr?.getAll?.() || patrolMgr?.list?.() || [];
      for (const p of patrols) {
        const officerName = p.officer?.name;
        const soldierCount = p.soldiers?.length || 0;
        const subtitle = officerName
          ? `${officerName} · ${soldierCount} soldados`
          : `${soldierCount} soldados`;
        result.patrol.push({
          id: p.id,
          name: p.name,
          img: p.officer?.img,
          subtitle,
        });
      }
    } catch {
      /* ignore */
    }

    // Auxiliaries
    try {
      const auxMgr = gm?.guardOrganizationManager?.getAuxiliaryManager?.();
      const auxiliaries = auxMgr?.getAll?.() || auxMgr?.list?.() || [];
      for (const a of auxiliaries) {
        const officerName = a.officer?.name;
        const memberCount = a.soldiers?.length || 0;
        const subtitle = officerName
          ? `${officerName} · ${memberCount} miembros`
          : `${memberCount} miembros`;
        result.auxiliary.push({
          id: a.id,
          name: a.name,
          img: a.officer?.img,
          subtitle,
        });
      }
    } catch {
      /* ignore */
    }

    // Buildings
    try {
      const buildings = gm?.buildingManager?.getAllBuildings?.() || [];
      for (const b of buildings) {
        const tags = (b.tags || []).join(', ');
        result.building.push({
          id: b.id,
          name: b.name,
          img: b.img,
          subtitle: tags || b.description?.slice(0, 40) || '',
        });
      }
    } catch {
      /* ignore */
    }

    // Prisoners
    try {
      const prisoners = gm?.prisonerManager?.getAllPrisoners?.() || [];
      const statusLabels: Record<string, string> = {
        imprisoned: 'Encarcelado',
        forced_labor: 'Trabajos forzados',
        executed: 'Ejecutado',
        released: 'Liberado',
        transferred_to_prison: 'Trasladado',
        death_row: 'Pena de muerte',
      };
      for (const p of prisoners) {
        result.prisoner.push({
          id: p.id,
          name: p.name,
          img: p.img,
          subtitle: statusLabels[p.status] || p.status,
        });
      }
    } catch {
      /* ignore */
    }

    return result;
  }

  /** Build the radio-button + card-list reference picker HTML */
  private static buildReferencePickerHTML(currentRef?: FinanceReference): string {
    const allOptions = FinancesPanel.getReferenceOptions();
    const types: { key: FinanceRefType; label: string; icon: string }[] = [
      { key: 'patrol', label: REF_TYPE_LABELS.patrol, icon: REF_TYPE_ICONS.patrol },
      { key: 'auxiliary', label: REF_TYPE_LABELS.auxiliary, icon: REF_TYPE_ICONS.auxiliary },
      { key: 'building', label: REF_TYPE_LABELS.building, icon: REF_TYPE_ICONS.building },
      { key: 'prisoner', label: REF_TYPE_LABELS.prisoner, icon: REF_TYPE_ICONS.prisoner },
    ];

    const activeType = currentRef?.type || '';

    // Radio buttons row
    let radiosHTML = `<div class="ref-picker-radios">
      <label class="ref-picker-radio">
        <input type="radio" name="fm-ref-type" value="" ${!activeType ? 'checked' : ''} />
        <span class="ref-radio-label"><i class="fas fa-ban"></i> Ninguna</span>
      </label>`;
    for (const t of types) {
      const count = allOptions[t.key].length;
      const disabled = count === 0;
      radiosHTML += `
      <label class="ref-picker-radio ${disabled ? 'disabled' : ''}">
        <input type="radio" name="fm-ref-type" value="${t.key}" ${activeType === t.key ? 'checked' : ''} ${disabled ? 'disabled' : ''} />
        <span class="ref-radio-label"><i class="${t.icon}"></i> ${t.label} <span class="ref-count">(${count})</span></span>
      </label>`;
    }
    radiosHTML += `</div>`;

    // Card lists (one per type, hidden by default)
    let listsHTML = '';
    for (const t of types) {
      const items = allOptions[t.key];
      const visible = activeType === t.key;
      let cardsHTML = '';
      if (items.length === 0) {
        cardsHTML = `<div class="ref-empty">No hay ${t.label.toLowerCase()}s disponibles</div>`;
      } else {
        for (const item of items) {
          const selected = currentRef?.type === t.key && currentRef.id === item.id;
          const imgHTML = item.img
            ? `<img src="${item.img}" alt="${item.name}" />`
            : `<i class="${t.icon}"></i>`;
          cardsHTML += `
          <div class="ref-card ${selected ? 'selected' : ''}" data-ref-type="${t.key}" data-ref-id="${item.id}" data-ref-name="${item.name}">
            <div class="ref-card-img">${imgHTML}</div>
            <div class="ref-card-info">
              <span class="ref-card-name">${item.name}</span>
              ${item.subtitle ? `<span class="ref-card-subtitle">${item.subtitle}</span>` : ''}
            </div>
            <div class="ref-card-check"><i class="fas fa-check-circle"></i></div>
          </div>`;
        }
      }
      listsHTML += `<div class="ref-card-list" data-ref-list="${t.key}" style="display:${visible ? '' : 'none'}">${cardsHTML}</div>`;
    }

    return `<div class="ref-picker">${radiosHTML}${listsHTML}</div>`;
  }

  /** Wire up radio/card click events inside the reference picker */
  private static setupRefPickerEvents(container: HTMLElement): void {
    // Radio change → show/hide card lists
    container.querySelectorAll<HTMLInputElement>('input[name="fm-ref-type"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        container
          .querySelectorAll<HTMLElement>('.ref-card-list')
          .forEach((el) => (el.style.display = 'none'));
        // Clear selection when switching type
        container
          .querySelectorAll('.ref-card.selected')
          .forEach((el) => el.classList.remove('selected'));
        if (radio.value) {
          const list = container.querySelector<HTMLElement>(
            `.ref-card-list[data-ref-list="${radio.value}"]`
          );
          if (list) list.style.display = '';
        }
      });
    });

    // Card click → select
    container.querySelectorAll<HTMLElement>('.ref-card').forEach((card) => {
      card.addEventListener('click', () => {
        const list = card.closest('.ref-card-list');
        list?.querySelectorAll('.ref-card.selected').forEach((el) => el.classList.remove('selected'));
        card.classList.add('selected');
      });
    });
  }

  /** Read the currently selected reference from the picker */
  private static readRefPickerValue(container: HTMLElement): FinanceReference | undefined {
    const selected = container.querySelector<HTMLElement>('.ref-card.selected');
    if (!selected) return undefined;
    const type = selected.dataset.refType as FinanceRefType;
    const id = selected.dataset.refId || '';
    const name = selected.dataset.refName || '';
    if (!type || !id) return undefined;
    return { type, id, name };
  }

  private static enrichEntry(entry: any): any {
    const enriched: any = { ...entry };

    // Reference info + entity image
    if (entry.reference) {
      enriched.referenceLabel = entry.reference.name;
      enriched.referenceIcon = REF_TYPE_ICONS[entry.reference.type as FinanceRefType] || 'fas fa-link';
      enriched.referenceTypeName = REF_TYPE_LABELS[entry.reference.type as FinanceRefType] || 'Referencia';
      enriched.referenceImg = FinancesPanel.getEntityImage(entry.reference.type, entry.reference.id);
    }

    // Time ago
    enriched.timeAgo = FinancesPanel.formatTimeAgo(entry.createdAt);

    // Current phase
    const gm = (window as any).GuardManagement;
    const turn = gm?.phaseManager?.getCurrentTurn?.();
    if (turn != null) enriched.currentPhase = turn;

    return enriched;
  }

  /** Resolve the image for a referenced entity */
  private static getEntityImage(type: FinanceRefType, id: string): string | undefined {
    const gm = (window as any).GuardManagement;
    try {
      if (type === 'patrol') {
        const mgr = gm?.guardOrganizationManager?.getPatrolManager?.();
        const p = (mgr?.getAll?.() || mgr?.list?.() || []).find((e: any) => e.id === id);
        return p?.officer?.img;
      }
      if (type === 'auxiliary') {
        const mgr = gm?.guardOrganizationManager?.getAuxiliaryManager?.();
        const a = (mgr?.getAll?.() || mgr?.list?.() || []).find((e: any) => e.id === id);
        return a?.officer?.img;
      }
      if (type === 'building') {
        const b = (gm?.buildingManager?.getAllBuildings?.() || []).find((e: any) => e.id === id);
        return b?.img;
      }
      if (type === 'prisoner') {
        const p = (gm?.prisonerManager?.getAllPrisoners?.() || []).find((e: any) => e.id === id);
        return p?.img;
      }
    } catch { /* ignore */ }
    return undefined;
  }

  private static formatTimeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'justo ahora';
    if (mins < 60) return `hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `hace ${days}d`;
  }

  // ========================
  // getData / render
  // ========================

  static async getData() {
    const gm = (window as any).GuardManagement;
    if (!gm?.financeManager) {
      return {
        totalBudget: 0,
        totalBudgetFormatted: '0',
        totalBudgetSign: 'positive',
        expectedNextTurn: 0,
        expectedNextTurnFormatted: '0',
        expectedSign: 'positive',
        recurringNet: 0,
        recurringNetFormatted: '+0',
        recurringNetSign: 'positive',
        recurringIncome: [],
        extraordinaryIncome: [],
        illegalIncome: [],
        recurringExpenses: [],
        specificExpenses: [],
        illegalExpenses: [],
        recurringIncomeTotal: 0,
        extraordinaryIncomeTotal: 0,
        illegalIncomeTotal: 0,
        recurringExpenseTotal: 0,
        specificExpenseTotal: 0,
        illegalExpenseTotal: 0,
        showIllegalSection: false,
        showIllegalBlock: false,
        isGM: false,
        log: [],
      };
    }

    const fm = gm.financeManager;
    const isGM = !!(game as any)?.user?.isGM;
    const totalBudget = fm.getTotalBudget();
    const expectedNextTurn = fm.getExpectedNextTurn();
    const recurringNet = fm.getRecurringNet();
    const showIllegalSection = fm.isIllegalSectionVisible();

    const allEntries = fm.getAllBudgetEntries();
    const recurringIncome = allEntries
      .filter((e: any) => e.type === 'recurring' && !e.illegal)
      .map(FinancesPanel.enrichEntry);
    const extraordinaryIncome = allEntries
      .filter((e: any) => e.type === 'extraordinary' && !e.illegal)
      .map(FinancesPanel.enrichEntry);
    const illegalIncome = allEntries
      .filter((e: any) => e.illegal)
      .map((e: any) => ({
        ...FinancesPanel.enrichEntry(e),
        typeLabel: e.type === 'recurring' ? 'Recurrente' : 'Extraordinario',
      }));

    const allExpenses = fm.getAllExpenses();
    const recurringExpenses = allExpenses
      .filter((e: any) => e.type === 'recurring' && !e.illegal)
      .map(FinancesPanel.enrichEntry);
    const specificExpenses = allExpenses
      .filter((e: any) => e.type === 'specific' && !e.illegal)
      .map(FinancesPanel.enrichEntry);
    const illegalExpenses = allExpenses
      .filter((e: any) => e.illegal)
      .map((e: any) => ({
        ...FinancesPanel.enrichEntry(e),
        typeLabel: e.type === 'recurring' ? 'Recurrente' : 'Específico',
      }));

    const sum = (arr: any[]) => arr.reduce((s: number, e: any) => s + e.amount, 0);
    const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

    const log = fm.getLog()
      .filter((entry: any) => {
        // Hide illegal-related logs from non-GM when illegal section is hidden
        if (entry.action === 'illegal_toggled' && !isGM) return false;
        return true;
      })
      .map((entry: any) => ({
        ...entry,
        timeAgo: FinancesPanel.formatTimeAgo(entry.timestamp),
      }));

    return {
      totalBudget,
      totalBudgetFormatted: totalBudget.toString(),
      totalBudgetSign: totalBudget < 0 ? 'negative' : 'positive',
      expectedNextTurn,
      expectedNextTurnFormatted: expectedNextTurn.toString(),
      expectedSign: recurringNet < 0 ? 'negative' : recurringNet > 0 ? 'positive' : '',
      recurringNet,
      recurringNetFormatted: signed(recurringNet),
      recurringNetSign: recurringNet < 0 ? 'negative' : 'positive',
      recurringIncome,
      extraordinaryIncome,
      illegalIncome,
      recurringExpenses,
      specificExpenses,
      illegalExpenses,
      recurringIncomeTotal: `+${sum(recurringIncome)}`,
      extraordinaryIncomeTotal: `+${sum(extraordinaryIncome)}`,
      illegalIncomeTotal: `+${sum(illegalIncome)}`,
      recurringExpenseTotal: `-${sum(recurringExpenses)}`,
      specificExpenseTotal: `-${sum(specificExpenses)}`,
      illegalExpenseTotal: `-${sum(illegalExpenses)}`,
      showIllegalSection,
      showIllegalBlock: isGM || showIllegalSection,
      isGM,
      log,
    };
  }

  static async render(container: HTMLElement): Promise<void> {
    try {
      const data = await FinancesPanel.getData();
      const html = await foundry.applications.handlebars.renderTemplate(
        FinancesPanel.template,
        data
      );
      $(container).html(html);
      FinancesPanel.setupEventListeners(container);
    } catch (error) {
      console.error('FinancesPanel | Error rendering:', error);
    }
  }

  // ========================
  // Event listeners
  // ========================

  private static setupEventListeners(container: HTMLElement): void {
    // Collapsible sections
    container.querySelectorAll('[data-action="toggle-section"]').forEach((header) => {
      header.addEventListener('click', (ev) => {
        if ((ev.target as HTMLElement).closest('button')) return;
        const body = header.nextElementSibling as HTMLElement;
        if (!body) return;
        const isOpen = body.style.display !== 'none';
        body.style.display = isOpen ? 'none' : '';
        header.querySelector('.finances-chevron')?.classList.toggle('open', !isOpen);
      });
    });

    container
      .querySelector('.finances-add-income-btn')
      ?.addEventListener('click', () => FinancesPanel.showFinanceModal('income'));
    container
      .querySelector('.finances-add-expense-btn')
      ?.addEventListener('click', () => FinancesPanel.showFinanceModal('expense'));

    container.querySelectorAll('.finances-edit-income').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.entryId;
        if (id) FinancesPanel.showFinanceModal('income', id);
      });
    });
    container.querySelectorAll('.finances-delete-income').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.entryId;
        if (id) FinancesPanel.handleDelete('income', id);
      });
    });
    container.querySelectorAll('.finances-edit-expense').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.entryId;
        if (id) FinancesPanel.showFinanceModal('expense', id);
      });
    });
    container.querySelectorAll('.finances-delete-expense').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.entryId;
        if (id) FinancesPanel.handleDelete('expense', id);
      });
    });

    container.querySelector('.finances-toggle-illegal-btn')?.addEventListener('click', async () => {
      const gm = (window as any).GuardManagement;
      if (gm?.financeManager) await gm.financeManager.toggleIllegalVisibility();
    });

    container
      .querySelector('.finances-edit-total-btn')
      ?.addEventListener('click', () => FinancesPanel.showEditTotalModal());

    // Toggleable entry rows
    container.querySelectorAll('[data-action="toggle-entry"]').forEach((header) => {
      header.addEventListener('click', (ev) => {
        if ((ev.target as HTMLElement).closest('button')) return;
        const detail = header.nextElementSibling as HTMLElement;
        if (!detail) return;
        const isOpen = detail.style.display !== 'none';
        detail.style.display = isOpen ? 'none' : '';
        header.querySelector('.finances-entry-chevron')?.classList.toggle('open', !isOpen);
      });
    });

    // Shift+click to delete log entries
    container.querySelectorAll('.finances-log-entry').forEach((entry) => {
      entry.addEventListener('click', async (ev) => {
        if (!(ev as MouseEvent).shiftKey) return;
        const timestamp = parseInt((entry as HTMLElement).dataset.entryTimestamp || '0', 10);
        if (!timestamp) return;
        const DialogV2 = (foundry as any).applications?.api?.DialogV2;
        if (!DialogV2) return;
        const confirmed = await DialogV2.confirm({
          window: { title: 'Eliminar registro' },
          content: '<p>¿Eliminar esta entrada del registro?</p>',
        });
        if (!confirmed) return;
        const gm = (window as any).GuardManagement;
        const deleted = await gm?.financeManager?.removeLogEntry(timestamp);
        if (deleted) await FinancesPanel.render(container);
      });
    });

    // Shift-held visual class for log entries
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') container.classList.add('shift-held');
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') container.classList.remove('shift-held');
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
  }

  // ========================
  // Modal helper (uses GuardModal)
  // ========================

  private static showFinanceModal(mode: 'income' | 'expense', editId?: string): void {
    const gm = (window as any).GuardManagement;
    if (!gm?.financeManager) return;

    const isGM = !!(game as any)?.user?.isGM;
    const showIllegal = isGM || gm.financeManager.isIllegalSectionVisible();
    const isIncome = mode === 'income';

    // Existing entry for edit
    let existing: any = null;
    if (editId) {
      existing = isIncome
        ? gm.financeManager.getAllBudgetEntries().find((e: any) => e.id === editId)
        : gm.financeManager.getAllExpenses().find((e: any) => e.id === editId);
      if (!existing) return;
    }

    const title = editId
      ? `Editar: ${existing.name}`
      : isIncome
        ? 'Nueva Entrada de Presupuesto'
        : 'Nuevo Gasto';
    const icon = isIncome ? 'fas fa-arrow-down' : 'fas fa-arrow-up';

    const typeOptions = isIncome
      ? `<option value="recurring" ${existing?.type === 'recurring' || !existing ? 'selected' : ''}>Recurrente</option>
         <option value="extraordinary" ${existing?.type === 'extraordinary' ? 'selected' : ''}>Extraordinario</option>`
      : `<option value="recurring" ${existing?.type === 'recurring' || !existing ? 'selected' : ''}>Recurrente</option>
         <option value="specific" ${existing?.type === 'specific' ? 'selected' : ''}>Específico</option>`;

    const illegalSection = showIllegal
      ? `
      <div class="finance-form-row">
        <label class="finance-checkbox-label">
          <input type="checkbox" id="fm-illegal" ${existing?.illegal ? 'checked' : ''} />
          <span class="finance-checkbox-custom"></span>
          <span><i class="fas fa-mask"></i> ${isIncome ? 'Entrada ilegal' : 'Gasto ilegal'}</span>
        </label>
      </div>`
      : '';

    const refPickerHTML = FinancesPanel.buildReferencePickerHTML(existing?.reference);

    const body = `
      <div class="finance-form">
        <div class="finance-form-row">
          <label for="fm-name"><i class="fas fa-tag"></i> Nombre</label>
          <input type="text" id="fm-name" placeholder="${isIncome ? 'Ej: Impuestos del mercado...' : 'Ej: Salario de guardias...'}" value="${existing?.name || ''}" />
        </div>
        <div class="finance-form-row">
          <label for="fm-desc"><i class="fas fa-align-left"></i> Descripción</label>
          <textarea id="fm-desc" rows="2" placeholder="Descripción opcional...">${existing?.description || ''}</textarea>
        </div>
        <div class="finance-form-split">
          <div class="finance-form-row">
            <label for="fm-amount"><i class="fas fa-coins"></i> Cantidad</label>
            <input type="number" id="fm-amount" min="0" step="1" value="${existing?.amount || 0}" />
          </div>
          <div class="finance-form-row">
            <label for="fm-type"><i class="fas fa-layer-group"></i> Tipo</label>
            <select id="fm-type">${typeOptions}</select>
          </div>
        </div>
        ${illegalSection}
        <div class="finance-form-row">
          <label><i class="fas fa-link"></i> Referencia</label>
          ${refPickerHTML}
        </div>
      </div>
    `;

    GuardModal.open({
      title,
      icon,
      body,
      onRender: (bodyEl) => {
        FinancesPanel.setupRefPickerEvents(bodyEl);
        // Auto-focus name
        (bodyEl.querySelector('#fm-name') as HTMLInputElement)?.focus();
      },
      onSave: async (bodyEl) => {
        const name = (bodyEl.querySelector('#fm-name') as HTMLInputElement)?.value?.trim();
        if (!name) {
          (ui as any).notifications?.warn('El nombre es requerido');
          return false;
        }

        const amount =
          parseFloat((bodyEl.querySelector('#fm-amount') as HTMLInputElement)?.value) || 0;
        const type = (bodyEl.querySelector('#fm-type') as HTMLSelectElement)?.value;
        const illegalEl = bodyEl.querySelector('#fm-illegal') as HTMLInputElement | null;
        const illegal = illegalEl?.checked || false;
        const description =
          (bodyEl.querySelector('#fm-desc') as HTMLTextAreaElement)?.value?.trim() || '';

        const reference = FinancesPanel.readRefPickerValue(bodyEl);

        if (isIncome) {
          if (editId) {
            await gm.financeManager.updateBudgetEntry(editId, {
              name,
              description,
              amount,
              type,
              illegal,
              reference,
            });
            (ui as any).notifications?.info(`Entrada "${name}" actualizada`);
          } else {
            await gm.financeManager.addBudgetEntry({
              name,
              description,
              amount,
              type,
              illegal,
              processed: false,
              reference,
            });
            (ui as any).notifications?.info(`Entrada "${name}" agregada`);
          }
        } else {
          if (editId) {
            await gm.financeManager.updateExpense(editId, {
              name,
              description,
              amount,
              type,
              illegal,
              reference,
            });
            (ui as any).notifications?.info(`Gasto "${name}" actualizado`);
          } else {
            await gm.financeManager.addExpense({
              name,
              description,
              amount,
              type,
              illegal,
              processed: false,
              reference,
            });
            (ui as any).notifications?.info(`Gasto "${name}" agregado`);
          }
        }
      },
    });
  }

  // ========================
  // Edit total modal
  // ========================

  private static showEditTotalModal(): void {
    const gm = (window as any).GuardManagement;
    if (!gm?.financeManager) return;
    const current = gm.financeManager.getTotalBudget();

    GuardModal.open({
      title: 'Ajustar Presupuesto Total',
      icon: 'fas fa-edit',
      body: `
        <div class="finance-form">
          <div class="finance-form-row">
            <label for="fm-total"><i class="fas fa-coins"></i> Presupuesto Total</label>
            <input type="number" id="fm-total" step="1" value="${current}" />
          </div>
          <p class="finance-form-hint"><i class="fas fa-exclamation-triangle"></i> Esto sobrescribe el total actual.</p>
        </div>
      `,
      onRender: (bodyEl) => {
        (bodyEl.querySelector('#fm-total') as HTMLInputElement)?.focus();
      },
      onSave: async (bodyEl) => {
        const amount =
          parseFloat((bodyEl.querySelector('#fm-total') as HTMLInputElement)?.value) || 0;
        await gm.financeManager.setTotalBudget(amount);
        (ui as any).notifications?.info(`Presupuesto total ajustado a ${amount}`);
      },
    });
  }

  // ========================
  // Delete confirmation
  // ========================

  private static async handleDelete(mode: 'income' | 'expense', id: string): Promise<void> {
    const gm = (window as any).GuardManagement;
    if (!gm?.financeManager) return;

    const isIncome = mode === 'income';
    const entry = isIncome
      ? gm.financeManager.getAllBudgetEntries().find((e: any) => e.id === id)
      : gm.financeManager.getAllExpenses().find((e: any) => e.id === id);
    if (!entry) return;

    const DialogV2 = (foundry as any).applications?.api?.DialogV2;
    if (!DialogV2) return;

    const confirmed = await DialogV2.confirm({
      window: { title: `Eliminar ${isIncome ? 'Entrada' : 'Gasto'}` },
      content: `<p>¿Eliminar <strong>${entry.name}</strong>?</p>`,
    });
    if (!confirmed) return;

    if (isIncome) {
      await gm.financeManager.removeBudgetEntry(id);
    } else {
      await gm.financeManager.removeExpense(id);
    }
    (ui as any).notifications?.info(`"${entry.name}" eliminado`);
  }
}
