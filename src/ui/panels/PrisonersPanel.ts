/**
 * PrisonersPanel - Renders the prisoners tab (temporary cells) in the organization dialog.
 * History is per-prisoner and displayed as a tooltip.
 */
import type { Crime } from '../../types/crimes';
import { OFFENSE_LABELS } from '../../types/crimes';
import type { Prisoner, PrisonerHistoryEntry } from '../../types/entities';
import { ConfirmService } from '../../utils/services/ConfirmService.js';
import { NotificationService } from '../../utils/services/NotificationService.js';

const STATUS_LABELS: Record<string, string> = {
  imprisoned: 'Preso',
  forced_labor: 'Trabajos Forzados',
  death_row: 'Corredor de la Muerte',
  executed: 'Ejecutado',
  released: 'Liberado',
  transferred_to_prison: 'En Prisión',
};

const ACTION_LABELS: Record<string, string> = {
  entered: 'Ingresó',
  released: 'Liberado',
  forced_labor: 'Enviado a trabajos forzados',
  transferred_to_prison: 'Transferido a prisión',
  sent_to_death_row: 'Enviado al corredor de la muerte',
  executed: 'Ejecutado',
  notes_updated: 'Notas actualizadas',
  release_turn_updated: 'Turno de liberación modificado',
  sentence_applied: 'Sentencia aplicada',
  sentence_completed: 'Sentencia cumplida',
};

export class PrisonersPanel {
  static get template() {
    return 'modules/guard-management/templates/panels/prisoners.hbs';
  }

  static async getData() {
    const gm = (window as any).GuardManagement;
    const prisonerManager = gm?.prisonerManager;
    if (!prisonerManager) return { cellCount: 4, cells: [], records: [] };

    const cellCount = prisonerManager.getCellCount();
    const cellCapacity = prisonerManager.getCellCapacity();

    // Build cells (each cell can hold multiple prisoners)
    const cells = [];
    for (let i = 0; i < cellCount; i++) {
      const cellPrisoners = prisonerManager.getPrisonersByCell(i);
      const enrichedPrisoners = cellPrisoners.map((prisoner: Prisoner) => {
        const { name, img } = PrisonersPanel.resolveActorData(prisoner);
        return {
          ...prisoner,
          name,
          img,
          statusLabel: STATUS_LABELS[prisoner.status] || prisoner.status,
          crimeNames: PrisonersPanel.resolveCrimeNames(prisoner.crimes),
          remainingPhases: prisonerManager.getRemainingPhases(prisoner),
          hasSentence: prisoner.sentencePhases > 0 && prisoner.sentenceStartPhase !== null,
        };
      });
      cells.push({
        index: i,
        displayIndex: i + 1,
        prisoners: enrichedPrisoners,
        capacity: cellCapacity,
        isOvercrowded: enrichedPrisoners.length > cellCapacity,
        overcrowdCount: enrichedPrisoners.length,
      });
    }

    // Build records (fichas) — ALL prisoners with history, sorted by most recently updated
    const allPrisoners = prisonerManager.getAllPrisoners();
    const records = allPrisoners
      .filter((p: Prisoner) => p.history && p.history.length > 0)
      .sort((a: Prisoner, b: Prisoner) => b.updatedAt - a.updatedAt)
      .map((p: Prisoner) => {
        const { name, img } = PrisonersPanel.resolveActorData(p);
        return {
          id: p.id,
          name,
          img,
          status: p.status,
          statusLabel: STATUS_LABELS[p.status] || p.status,
          notes: p.notes,
          canReturn: p.status !== 'imprisoned' && p.status !== 'executed',
          canExecute: p.status === 'death_row',
          crimeNames: PrisonersPanel.resolveCrimeNames(p.crimes),
          history: PrisonersPanel.enrichHistory(p.history || []),
          hasSentence: p.sentencePhases > 0 && p.sentenceStartPhase !== null,
          remainingPhases: prisonerManager.getRemainingPhases(p),
          sentencePhases: p.sentencePhases,
          sentenceStartPhase: p.sentenceStartPhase,
        };
      });

    return { cellCount, cells, records };
  }

  static async render(container: HTMLElement) {
    const data = await this.getData();
    const htmlContent = await foundry.applications.handlebars.renderTemplate(this.template, data);
    $(container).html(htmlContent);

    this.setupEventListeners(container);
    this.setupDragAndDrop(container);
  }

  // --- Event Listeners ---

  private static setupEventListeners(container: HTMLElement) {
    const $html = $(container);

    $html.off('click', '.prisoner-config-btn').on('click', '.prisoner-config-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      await this.showConfigDialog();
    });

    $html.off('click', '.prisoner-edit-btn').on('click', '.prisoner-edit-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const prisonerId = (ev.currentTarget as HTMLElement).dataset.prisonerId;
      if (prisonerId) await this.showEditPrisonerDialog(prisonerId);
    });

    // Assign crimes button (in cells and records)
    $html.off('click', '.prisoner-crimes-btn').on('click', '.prisoner-crimes-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const prisonerId = (ev.currentTarget as HTMLElement).dataset.prisonerId;
      if (prisonerId) await this.showAssignCrimesDialog(prisonerId);
    });

    $html.off('click', '.prisoner-release-btn').on('click', '.prisoner-release-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const el = ev.currentTarget as HTMLElement;
      await this.handleAction(el.dataset.prisonerId!, el.dataset.prisonerName!, 'released');
    });

    $html
      .off('click', '.prisoner-forced-labor-btn')
      .on('click', '.prisoner-forced-labor-btn', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const el = ev.currentTarget as HTMLElement;
        await this.handleAction(el.dataset.prisonerId!, el.dataset.prisonerName!, 'forced_labor');
      });

    $html.off('click', '.prisoner-prison-btn').on('click', '.prisoner-prison-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const el = ev.currentTarget as HTMLElement;
      await this.handleAction(
        el.dataset.prisonerId!,
        el.dataset.prisonerName!,
        'transferred_to_prison'
      );
    });

    $html.off('click', '.prisoner-execute-btn').on('click', '.prisoner-execute-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const el = ev.currentTarget as HTMLElement;
      await this.handleAction(el.dataset.prisonerId!, el.dataset.prisonerName!, 'death_row');
    });

    // Return to cell button (in records section)
    $html.off('click', '.record-return-btn').on('click', '.record-return-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const el = ev.currentTarget as HTMLElement;
      await this.handleReturnToCell(el.dataset.prisonerId!, el.dataset.prisonerName!);
    });

    // Execute button (in records section, for death_row prisoners)
    $html.off('click', '.record-execute-btn').on('click', '.record-execute-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const el = ev.currentTarget as HTMLElement;
      await this.handleExecuteFromRecord(el.dataset.prisonerId!, el.dataset.prisonerName!);
    });

    // Send record to chat
    $html.off('click', '.record-chat-btn').on('click', '.record-chat-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const el = ev.currentTarget as HTMLElement;
      await this.sendRecordToChat(el.dataset.prisonerId!);
    });

    // Search and filter for records
    $html.off('input', '.prisoner-search-input').on('input', '.prisoner-search-input', () => {
      this.filterRecords(container);
    });
    $html.off('click', '.prisoner-filter-btn').on('click', '.prisoner-filter-btn', (ev) => {
      const btn = ev.currentTarget as HTMLElement;
      btn.classList.toggle('active');
      this.filterRecords(container);
    });

    // Shift+click to delete history entries
    $html.off('click', '.record-entry').on('click', '.record-entry', async (ev) => {
      if (!ev.shiftKey) return;
      ev.preventDefault();
      ev.stopPropagation();
      const entryEl = ev.currentTarget as HTMLElement;
      const recordEl = entryEl.closest('.prisoner-record') as HTMLElement;
      if (!recordEl) return;
      const prisonerId = recordEl.dataset.prisonerId;
      const timestamp = parseInt(entryEl.dataset.entryTimestamp || '0', 10);
      if (!prisonerId || !timestamp) return;

      const gm = (window as any).GuardManagement;
      const confirmed = await (foundry.applications.api as any).DialogV2.confirm({
        window: { title: 'Eliminar registro' },
        content: `<p>¿Eliminar esta entrada del historial?</p><p style="opacity:0.7;font-size:0.85em">${entryEl.textContent?.trim()}</p>`,
        yes: { label: 'Eliminar', icon: 'fas fa-trash' },
        no: { label: 'Cancelar' },
      });
      if (!confirmed) return;

      const deleted = await gm?.prisonerManager?.removeHistoryEntry(prisonerId, timestamp);
      if (deleted) {
        await PrisonersPanel.render(container);
      }
    });

    // Shift+hover visual feedback for deletable history entries
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Shift') container.classList.add('shift-held');
    };
    const onKeyUp = (ev: KeyboardEvent) => {
      if (ev.key === 'Shift') container.classList.remove('shift-held');
    };
    // Clean up previous listeners to avoid duplicates
    (container as any)._shiftKeyDown && document.removeEventListener('keydown', (container as any)._shiftKeyDown);
    (container as any)._shiftKeyUp && document.removeEventListener('keyup', (container as any)._shiftKeyUp);
    (container as any)._shiftKeyDown = onKeyDown;
    (container as any)._shiftKeyUp = onKeyUp;
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
  }

  // --- Drag and Drop ---

  private static setupDragAndDrop(container: HTMLElement) {
    const cells = Array.from(
      container.querySelectorAll('.prison-cell[data-drop="prisoner"]')
    ) as HTMLElement[];

    cells.forEach((cell) => {
      const cellIndex = parseInt(cell.dataset.cellIndex || '0', 10);

      cell.addEventListener('dragenter', (ev) => {
        ev.preventDefault();
        cell.classList.add('dnd-hover');
      });

      cell.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
        cell.classList.add('dnd-hover');
      });

      cell.addEventListener('dragleave', () => {
        cell.classList.remove('dnd-hover');
      });

      cell.addEventListener('drop', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        cell.classList.remove('dnd-hover');

        try {
          const raw = ev.dataTransfer?.getData('text/plain') || '';
          let data: any;
          try {
            data = JSON.parse(raw);
          } catch {
            return;
          }

          let actor: any = null;
          const g = (globalThis as any).game;

          if (data.type === 'Actor' && data.uuid) {
            actor = await (globalThis as any).fromUuid(data.uuid);
          } else if (data.type === 'Actor' && data.id) {
            actor = g?.actors?.get?.(data.id);
          }

          if (!actor && data.tokenId && data.sceneId) {
            const scene = g?.scenes?.get?.(data.sceneId);
            const token = scene?.tokens?.get?.(data.tokenId);
            if (token?.actor) actor = token.actor;
          }

          if (!actor) {
            NotificationService.warn('No se pudo resolver el actor');
            return;
          }

          const gm = (window as any).GuardManagement;

          // Check if cell exceeds capacity — ask for confirmation
          const cellPrisoners = gm?.prisonerManager?.getPrisonersByCell(cellIndex) || [];
          const capacity = gm?.prisonerManager?.getCellCapacity() ?? 1;
          if (cellPrisoners.length >= capacity) {
            const confirmOvercrowd = await ConfirmService.confirm({
              title: 'Celda llena',
              html: `
                <div style="margin-bottom: 1rem;">
                  <i class="fas fa-exclamation-triangle" style="color: #f3a261; margin-right: 0.5rem;"></i>
                  <strong>La celda ${cellIndex + 1} está llena (${cellPrisoners.length}/${capacity})</strong>
                </div>
                <p>¿Deseas hacinar a <strong>${actor.name}</strong> en esta celda?</p>
                <p style="font-size: 0.85em; color: #ccc;">El hacinamiento provocará tiradas de Hope/Fear cada fase.</p>
              `,
            });
            if (!confirmOvercrowd) return;
          }

          const allPrisoners = gm?.prisonerManager?.getActivePrisoners() || [];
          const alreadyPrisoner = allPrisoners.find((p: Prisoner) => p.actorId === actor.id);
          if (alreadyPrisoner) {
            NotificationService.warn(
              `${actor.name} ya está en la celda ${alreadyPrisoner.cellIndex + 1}`
            );
            return;
          }

          await gm.prisonerManager.addPrisoner({
            actorId: actor.id,
            tokenId: data.tokenId,
            name: actor.name,
            img: actor.img || actor.prototypeToken?.texture?.src,
            cellIndex,
          });

          NotificationService.info(`${actor.name} encarcelado en celda ${cellIndex + 1}`);
        } catch (error) {
          console.error('PrisonersPanel | Drop error:', error);
          NotificationService.error('Error al encarcelar al prisionero');
        }
      });
    });
  }

  // --- Action Handling ---

  private static async handleAction(
    prisonerId: string,
    prisonerName: string,
    action: 'released' | 'forced_labor' | 'death_row' | 'transferred_to_prison'
  ): Promise<void> {
    const actionLabels: Record<string, string> = {
      released: 'liberar',
      forced_labor: 'enviar a trabajos forzados',
      death_row: 'enviar al corredor de la muerte',
      transferred_to_prison: 'enviar a prisión permanente',
    };

    const costWarning = action === 'transferred_to_prison'
      ? `<p style="margin-top: 0.5rem; padding: 6px 8px; background: rgba(243,194,103,0.15); border-left: 3px solid #f3c267; border-radius: 3px; font-size: 0.85em; color: #f3c267;">
           <i class="fas fa-coins" style="margin-right: 4px;"></i>
           <strong>Atención:</strong> El traslado a prisión permanente tiene un coste que debe ser presupuestado. Consulta con el GM.
         </p>`
      : '';

    const html = `
      <div style="margin-bottom: 1rem;">
        <i class="fas fa-exclamation-triangle" style="color: #ff6b6b; margin-right: 0.5rem;"></i>
        <strong>¿Estás seguro?</strong>
      </div>
      <p>¿Deseas ${actionLabels[action]} a "<strong>${prisonerName}</strong>"?</p>
      ${costWarning}
    `;

    const confirmed = await ConfirmService.confirm({
      title: 'Confirmar Acción',
      html,
    });
    if (!confirmed) return;

    const gm = (window as any).GuardManagement;
    if (!gm?.prisonerManager) return;

    switch (action) {
      case 'released':
        await gm.prisonerManager.releasePrisoner(prisonerId);
        NotificationService.info(`${prisonerName} ha sido liberado`);
        break;
      case 'forced_labor':
        await gm.prisonerManager.sendToForcedLabor(prisonerId);
        NotificationService.info(`${prisonerName} ha sido enviado a trabajos forzados`);
        break;
      case 'transferred_to_prison':
        await gm.prisonerManager.transferToPrison(prisonerId);
        NotificationService.info(`${prisonerName} ha sido transferido a prisión permanente`);
        // Notify GM about transfer cost
        try {
          const g = game as any;
          const gmUserIds: string[] = g?.users?.filter((u: any) => u.isGM)?.map((u: any) => u.id) || [];
          await (ChatMessage as any).create({
            content: `
              <div style="border-left:3px solid #f3c267;padding-left:8px;">
                <p style="margin:0 0 6px 0;">
                  <i class="fas fa-dungeon" style="color:#f3c267;"></i>
                  <strong>Traslado a Prisión Permanente</strong>
                </p>
                <p style="margin:0 0 4px 0;">
                  <strong>${prisonerName}</strong> ha sido enviado a prisión permanente.
                </p>
                <p style="margin:0;padding:4px 6px;background:rgba(243,194,103,0.15);border-radius:3px;font-size:0.9em;color:#f3c267;">
                  <i class="fas fa-coins"></i> <strong>Presupuestar coste de traslado.</strong> Hay que gestionar el gasto asociado al envío.
                </p>
              </div>
            `,
            speaker: { scene: null, actor: null, token: null, alias: 'Guard Management' },
            whisper: gmUserIds,
            flags: { 'guard-management': { type: 'transfer-cost' } },
          });
        } catch (err) {
          console.error('PrisonersPanel | Transfer chat error:', err);
        }
        break;
      case 'death_row':
        await gm.prisonerManager.sendToDeathRow(prisonerId);
        NotificationService.info(`${prisonerName} ha sido enviado al corredor de la muerte`);
        break;
    }

    // Refresh prisoners panel to reflect changes
    gm.guardDialogManager?.customInfoDialog?.refreshPrisonersPanel?.();
  }

  // --- Return to Cell ---

  private static async handleReturnToCell(prisonerId: string, prisonerName: string): Promise<void> {
    const gm = (window as any).GuardManagement;
    if (!gm?.prisonerManager) return;

    // Find first cell under capacity
    const cellCount = gm.prisonerManager.getCellCount();
    const capacity = gm.prisonerManager.getCellCapacity();
    let availableCell = -1;
    for (let i = 0; i < cellCount; i++) {
      const occupants = gm.prisonerManager.getPrisonersByCell(i);
      if (occupants.length < capacity) {
        availableCell = i;
        break;
      }
    }

    if (availableCell === -1) {
      NotificationService.warn('No hay celdas con espacio disponible');
      return;
    }

    await gm.prisonerManager.returnToCell(prisonerId, availableCell);
    NotificationService.info(`${prisonerName} devuelto a celda ${availableCell + 1}`);

    // Refresh prisoners panel to reflect changes
    gm.guardDialogManager?.customInfoDialog?.refreshPrisonersPanel?.();
  }

  // --- Execute from Record (death_row -> executed) ---

  private static async handleExecuteFromRecord(prisonerId: string, prisonerName: string): Promise<void> {
    const confirmed = await ConfirmService.confirm({
      title: 'Confirmar Ejecución',
      html: `
        <div style="margin-bottom: 1rem;">
          <i class="fas fa-skull-crossbones" style="color: #ff6b6b; margin-right: 0.5rem;"></i>
          <strong>¿Estás seguro?</strong>
        </div>
        <p>¿Deseas ejecutar a "<strong>${prisonerName}</strong>"? Esta acción es irreversible.</p>
      `,
    });
    if (!confirmed) return;

    const gm = (window as any).GuardManagement;
    if (!gm?.prisonerManager) return;

    await gm.prisonerManager.executePrisoner(prisonerId);
    NotificationService.info(`${prisonerName} ha sido ejecutado`);

    // Refresh prisoners panel to reflect changes
    gm.guardDialogManager?.customInfoDialog?.refreshPrisonersPanel?.();
  }

  // --- Send Record to Chat ---

  private static async sendRecordToChat(prisonerId: string): Promise<void> {
    const gm = (window as any).GuardManagement;
    const prisoner = gm?.prisonerManager?.getPrisoner(prisonerId);
    if (!prisoner) return;

    const { name, img } = PrisonersPanel.resolveActorData(prisoner);
    const statusLabel = STATUS_LABELS[prisoner.status] || prisoner.status;
    const crimeNames = PrisonersPanel.resolveCrimeNames(prisoner.crimes);

    const history = [...(prisoner.history || [])].sort((a, b) => b.timestamp - a.timestamp);
    const maxShown = 5;
    const shown = history.slice(0, maxShown);
    const remaining = history.length - maxShown;

    const historyLines = shown.map((h) => {
      const label = h.details || ACTION_LABELS[h.action] || h.action;
      const date = new Date(h.timestamp).toLocaleString();
      return `<li><strong>${label}</strong> <small style="opacity:0.7">— ${h.performedBy}, ${date}</small></li>`;
    }).join('');

    const remainingText = remaining > 0
      ? `<p style="opacity:0.6;font-size:0.85em;margin-top:4px;">...y ${remaining} registro${remaining > 1 ? 's' : ''} más.</p>`
      : '';

    const crimesHtml = crimeNames.length > 0
      ? `<p><strong>Crímenes:</strong> ${crimeNames.map(c => c.name).join(', ')}</p>`
      : '';

    const imgHtml = img ? `<img src="${img}" width="50" height="50" style="float:left;margin-right:8px;border-radius:4px;" />` : '';

    const content = `
      <div style="border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:8px;background:rgba(0,0,0,0.1);">
        ${imgHtml}
        <h3 style="margin:0 0 4px 0;">${name}</h3>
        <p style="margin:0 0 6px 0;"><strong>Estado:</strong> ${statusLabel}</p>
        ${crimesHtml}
        <hr style="border-color:rgba(255,255,255,0.1);margin:6px 0;">
        <strong>Últimas actualizaciones:</strong>
        <ul style="margin:4px 0;padding-left:18px;font-size:0.9em;">${historyLines}</ul>
        ${remainingText}
      </div>
    `;

    await (ChatMessage as any).create({ content, speaker: { alias: 'Registro de Prisioneros' } });
    NotificationService.info(`Registro de "${name}" enviado al chat`);
  }

  // --- Search/Filter Records ---

  private static filterRecords(container: HTMLElement): void {
    const searchInput = container.querySelector('.prisoner-search-input') as HTMLInputElement;
    const searchTerm = (searchInput?.value || '').toLowerCase().trim();

    const activeFilters: string[] = [];
    container.querySelectorAll('.prisoner-filter-btn.active').forEach((btn) => {
      const status = (btn as HTMLElement).dataset.filterStatus;
      if (status) activeFilters.push(status);
    });

    container.querySelectorAll('.prisoner-record').forEach((record) => {
      const el = record as HTMLElement;
      const name = (el.querySelector('.record-name')?.textContent || '').toLowerCase();
      const status = el.dataset.prisonerStatus || '';

      const matchesSearch = !searchTerm || name.includes(searchTerm);
      const matchesFilter = activeFilters.length === 0 || activeFilters.includes(status);

      el.style.display = matchesSearch && matchesFilter ? '' : 'none';
    });
  }

  // --- Config Dialog ---

  private static async showConfigDialog(): Promise<void> {
    const gm = (window as any).GuardManagement;
    const currentCount = gm?.prisonerManager?.getCellCount() || 4;
    const currentCapacity = gm?.prisonerManager?.getCellCapacity() || 1;

    const content = `
      <form>
        <div class="form-group">
          <label for="cell-count">Número de celdas:</label>
          <input type="number" id="cell-count" name="cellCount" value="${currentCount}" min="1" max="20" />
        </div>
        <div class="form-group">
          <label for="cell-capacity">Capacidad por celda:</label>
          <input type="number" id="cell-capacity" name="cellCapacity" value="${currentCapacity}" min="1" max="10" />
          <p style="font-size: 0.8em; color: #999; margin-top: 4px;">Prisioneros de más causarán hacinamiento (tiradas Hope/Fear cada fase).</p>
        </div>
      </form>
    `;

    const result = await Dialog.prompt({
      title: 'Configurar Celdas Temporales',
      content,
      callback: (html: any) => {
        const countInput = $(html).find('#cell-count');
        const capacityInput = $(html).find('#cell-capacity');
        return {
          count: parseInt(countInput.val() as string) || currentCount,
          capacity: parseInt(capacityInput.val() as string) || currentCapacity,
        };
      },
    });

    if (result) {
      if (result.count !== currentCount) {
        await gm.prisonerManager.setCellCount(result.count);
      }
      if (result.capacity !== currentCapacity) {
        await gm.prisonerManager.setCellCapacity(result.capacity);
      }
      if (result.count !== currentCount || result.capacity !== currentCapacity) {
        NotificationService.info(`Celdas: ${result.count}, Capacidad: ${result.capacity}`);
      }
    }
  }

  // --- Edit Prisoner Dialog ---

  private static async showEditPrisonerDialog(prisonerId: string): Promise<void> {
    const gm = (window as any).GuardManagement;
    const prisoner = gm?.prisonerManager?.getPrisoner(prisonerId);
    if (!prisoner) return;

    const escapedNotes = (prisoner.notes || '').replace(/"/g, '&quot;');
    const notesContent = prisoner.notes || '';

    // Show current assigned crimes as badges (read-only, use the crimes modal to edit)
    const crimeNames = PrisonersPanel.resolveCrimeNames(prisoner.crimes);
    const crimeBadges = crimeNames.length > 0
      ? crimeNames.map((c) => `<span class="prisoner-crime-badge offense-${c.offenseType}">${c.name}</span>`).join(' ')
      : '<span style="color: #888; font-size: 0.8em;">Sin crímenes asignados</span>';

    // Sentence info
    const prisonerManager = gm?.prisonerManager;
    const remaining = prisonerManager?.getRemainingPhases(prisoner) ?? 0;
    const hasSentence = prisoner.sentencePhases > 0 && prisoner.sentenceStartPhase !== null;
    const sentenceInfo = hasSentence
      ? `${remaining} fases restantes (${prisoner.sentencePhases} total, desde fase ${prisoner.sentenceStartPhase})`
      : 'Sin sentencia';

    const content = `
      <div class="guard-dialog prisoner-edit-dialog" style="padding: 0.5rem;">
        <div class="form-group form-group-notes">
          <label>Notas:</label>
          <div class="prisoner-editor-wrapper">
            <prose-mirror name="notes" value="${escapedNotes}">
              ${notesContent}
            </prose-mirror>
          </div>
        </div>
        <div class="form-group form-group-inline" style="margin-top: 0.5rem;">
          <label><i class="fas fa-hourglass-half"></i> Sentencia:</label>
          <span style="font-size: 0.85em; color: ${remaining <= 0 && hasSentence ? '#ff4444' : '#d0d0c0'};">
            ${sentenceInfo}
          </span>
        </div>
        <div class="form-group" style="margin-top: 0.5rem;">
          <label><i class="fas fa-gavel"></i> Crímenes asignados:</label>
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; padding: 0.3rem 0;">
            ${crimeBadges}
            <button type="button" class="crimes-btn prisoner-open-crimes-modal" style="margin-left: auto;" title="Gestionar crímenes">
              <i class="fas fa-gavel"></i> Gestionar
            </button>
          </div>
        </div>
      </div>
    `;

    try {
      const DialogV2Class = (foundry as any).applications?.api?.DialogV2;
      if (DialogV2Class) {
        await DialogV2Class.wait({
          window: { title: `Editar: ${prisoner.name}`, resizable: true },
          content,
          buttons: [
            {
              action: 'save',
              icon: 'fas fa-save',
              label: 'Guardar',
              callback: async (_event: any, _button: any, dialog: any) => {
                const dialogEl = dialog?.element || dialog;
                if (!dialogEl) return;

                // Read notes from ProseMirror
                let newNotes = '';
                const editorContent = dialogEl.querySelector('.editor-content.ProseMirror');
                if (editorContent) {
                  newNotes = editorContent.innerHTML?.trim() || '';
                }
                if (!newNotes) {
                  const pmElement = dialogEl.querySelector('prose-mirror');
                  if (pmElement && 'value' in pmElement) {
                    const val = (pmElement as any).value;
                    if (typeof val === 'string') newNotes = val;
                  }
                }
                if (!newNotes) {
                  const form = dialogEl.querySelector('form');
                  if (form) {
                    const fd = new FormData(form);
                    newNotes = (fd.get('notes') as string) || '';
                  }
                }

                if (newNotes !== prisoner.notes) {
                  await gm.prisonerManager.updateNotes(prisonerId, newNotes);
                }

                NotificationService.info(`Prisionero "${prisoner.name}" actualizado`);
                return 'save';
              },
            },
            { action: 'cancel', icon: 'fas fa-times', label: 'Cancelar' },
          ],
          rejectClose: false,
          modal: false,
          render: (_event: any, html: any) => {
            const el = html instanceof HTMLElement ? html : html?.element;
            if (!el) return;
            const openBtn = el.querySelector('.prisoner-open-crimes-modal');
            if (openBtn) {
              openBtn.addEventListener('click', async (ev) => {
                ev.preventDefault();
                await this.showAssignCrimesDialog(prisonerId);
                // Refresh sentence display after assign dialog closes
                const updated = gm?.prisonerManager?.getPrisoner(prisonerId);
                if (updated) {
                  const remain = gm.prisonerManager.getRemainingPhases(updated);
                  const hasSent = updated.sentencePhases > 0 && updated.sentenceStartPhase !== null;
                  const info = hasSent
                    ? `${remain} fases restantes (${updated.sentencePhases} total, desde fase ${updated.sentenceStartPhase})`
                    : 'Sin sentencia';
                  const sentenceSpan = el.querySelector('.form-group-inline span');
                  if (sentenceSpan) {
                    sentenceSpan.textContent = info;
                    (sentenceSpan as HTMLElement).style.color = remain <= 0 && hasSent ? '#ff4444' : '#d0d0c0';
                  }
                  // Refresh crime badges
                  const badgesContainer = el.querySelector('.form-group:last-child > div');
                  if (badgesContainer) {
                    const newCrimeNames = PrisonersPanel.resolveCrimeNames(updated.crimes);
                    const manageBtn = badgesContainer.querySelector('.prisoner-open-crimes-modal');
                    const badgesHtml = newCrimeNames.length > 0
                      ? newCrimeNames.map((c) => `<span class="prisoner-crime-badge offense-${c.offenseType}">${c.name}</span>`).join(' ')
                      : '<span style="color: #888; font-size: 0.8em;">Sin crímenes asignados</span>';
                    // Remove old badges, keep button
                    const children = Array.from(badgesContainer.childNodes);
                    children.forEach((child) => { if (child !== manageBtn) child.remove(); });
                    manageBtn?.insertAdjacentHTML('beforebegin', badgesHtml + ' ');
                  }
                }
              });
            }
          },
        });
      }
    } catch (error) {
      console.error('PrisonersPanel | Edit dialog error:', error);
    }
  }

  // --- Assign Crimes Modal ---

  private static async showAssignCrimesDialog(prisonerId: string): Promise<void> {
    const gm = (window as any).GuardManagement;
    const prisoner = gm?.prisonerManager?.getPrisoner(prisonerId);
    if (!prisoner) return;

    const allCrimes: Crime[] = gm?.crimeManager?.getAllCrimes() || [];
    const sentenceManager = gm?.sentenceConfigManager;
    const prisonerManager = gm?.prisonerManager;
    const assignedIds = new Set(Array.isArray(prisoner.crimes) ? prisoner.crimes : []);

    if (allCrimes.length === 0) {
      NotificationService.warn('No hay crímenes en el catálogo. Crea algunos primero en la pestaña de Crímenes.');
      return;
    }

    // Build crime rows for the table
    const crimeRows = allCrimes.map((c: Crime) => {
      const checked = assignedIds.has(c.id) ? 'checked' : '';
      const label = OFFENSE_LABELS[c.offenseType] || c.offenseType;
      const sentence = c.customSentence || (sentenceManager?.formatSentence(c.offenseType) || '');
      return `
        <tr class="assign-crime-row" data-crime-id="${c.id}" data-offense-type="${c.offenseType}">
          <td class="assign-col-check">
            <input type="checkbox" class="assign-crime-check" data-crime-id="${c.id}" ${checked} />
          </td>
          <td class="assign-col-name">${c.name}</td>
          <td class="assign-col-type"><span class="crime-type-badge offense-${c.offenseType}">${label}</span></td>
          <td class="assign-col-sentence"><span class="crime-sentence-text">${sentence}</span></td>
        </tr>
      `;
    }).join('');

    // Current sentence info
    const currentRemaining = prisonerManager?.getRemainingPhases(prisoner) ?? 0;
    const hasCurrent = prisoner.sentencePhases > 0 && prisoner.sentenceStartPhase !== null;
    const currentSentenceHtml = hasCurrent
      ? `<div class="assign-current-sentence">
           <span class="assign-current-label">Sentencia actual:</span>
           <span class="assign-current-value" style="color: ${currentRemaining <= 0 ? '#ff4444' : '#f3c267'};">
             ${currentRemaining} fases restantes
           </span>
           <span class="assign-current-detail">(${prisoner.sentencePhases} total, desde fase ${prisoner.sentenceStartPhase})</span>
         </div>`
      : '';

    const content = `
      <div class="guard-dialog assign-crimes-dialog">
        <div class="assign-crimes-layout">
          <div class="assign-crimes-left">
            <div class="assign-crimes-search-bar">
              <i class="fas fa-search" style="color: #888; font-size: 0.7em;"></i>
              <input type="text" class="assign-crimes-search" placeholder="Buscar crimen..." />
            </div>
            <div class="assign-crimes-filter-toggles">
              <button class="crimes-toggle active" data-filter="all">Todos</button>
              <button class="crimes-toggle offense-capital" data-filter="capital">Capital</button>
              <button class="crimes-toggle offense-major" data-filter="major">Mayor</button>
              <button class="crimes-toggle offense-minor" data-filter="minor">Menor</button>
              <button class="crimes-toggle offense-light" data-filter="light">Leve</button>
              <button class="crimes-toggle offense-fine" data-filter="fine">Multa</button>
            </div>
            <div class="assign-crimes-table-wrap">
              <table class="assign-crimes-table">
                <thead>
                  <tr>
                    <th class="assign-col-check"></th>
                    <th class="assign-col-name">Crimen</th>
                    <th class="assign-col-type">Tipo</th>
                    <th class="assign-col-sentence">Sentencia</th>
                  </tr>
                </thead>
                <tbody>${crimeRows}</tbody>
              </table>
            </div>
          </div>
          <div class="assign-crimes-right">
            <div class="assign-summary-header">
              <i class="fas fa-clipboard-list"></i> Resumen
            </div>
            ${currentSentenceHtml}
            <div class="assign-summary-crimes"></div>
            <div class="assign-summary-calculation">
              <div class="assign-calc-label">Fases sugeridas:</div>
              <div class="assign-calc-value">0</div>
              <div class="assign-calc-detail"></div>
            </div>
            <div class="assign-phases-editor">
              <label for="assign-phases-input">Fases a aplicar:</label>
              <input type="number" id="assign-phases-input" min="0" value="0" />
              <span class="assign-phases-hint">Modifica para ajustar la sentencia</span>
            </div>
          </div>
        </div>
      </div>
    `;

    try {
      const DialogV2Class = (foundry as any).applications?.api?.DialogV2;
      if (!DialogV2Class) return;

      await DialogV2Class.wait({
        window: { title: `Crímenes: ${prisoner.name}`, resizable: true },
        position: { width: 680 },
        content,
        buttons: [
          {
            action: 'apply',
            icon: 'fas fa-check',
            label: 'Aplicar',
            callback: async (_event: any, _button: any, dialog: any) => {
              const dialogEl = dialog?.element || dialog;
              if (!dialogEl) return;

              // Gather selected crime IDs
              const checkboxes = dialogEl.querySelectorAll('.assign-crime-check') as NodeListOf<HTMLInputElement>;
              const newCrimeIds: string[] = [];
              checkboxes.forEach((cb) => {
                if (cb.checked && cb.dataset.crimeId) newCrimeIds.push(cb.dataset.crimeId);
              });

              // Diff and apply
              const oldCrimeIds = Array.isArray(prisoner.crimes) ? prisoner.crimes : [];
              const toAdd = newCrimeIds.filter((id) => !oldCrimeIds.includes(id));
              const toRemove = oldCrimeIds.filter((id) => !newCrimeIds.includes(id));
              for (const crimeId of toAdd) await gm.prisonerManager.assignCrime(prisonerId, crimeId);
              for (const crimeId of toRemove) await gm.prisonerManager.removeCrime(prisonerId, crimeId);

              // Apply phases if set
              const phasesInput = dialogEl.querySelector('#assign-phases-input') as HTMLInputElement;
              const phases = parseInt(phasesInput?.value || '0', 10);
              if (phases > 0) {
                await gm.prisonerManager.applySentence(prisonerId, phases);
              }

              const changes: string[] = [];
              if (toAdd.length > 0) changes.push(`${toAdd.length} añadido(s)`);
              if (toRemove.length > 0) changes.push(`${toRemove.length} eliminado(s)`);
              if (phases > 0) changes.push(`+${phases} fases`);
              if (changes.length > 0) {
                NotificationService.info(`${prisoner.name}: ${changes.join(', ')}`);
              }
            },
          },
          { action: 'cancel', icon: 'fas fa-times', label: 'Cancelar' },
        ],
        rejectClose: false,
        modal: false,
        render: (_event: any, html: any) => {
          const el = html instanceof HTMLElement ? html : html?.element;
          if (!el) return;
          this.setupAssignCrimesListeners(el, allCrimes, sentenceManager);
        },
      });
    } catch (error) {
      console.error('PrisonersPanel | Assign crimes dialog error:', error);
    }
  }

  /**
   * Setup interactive listeners for the assign crimes dialog
   */
  private static setupAssignCrimesListeners(el: HTMLElement, allCrimes: Crime[], sentenceManager: any): void {
    const updateSummary = () => {
      const checkboxes = el.querySelectorAll('.assign-crime-check') as NodeListOf<HTMLInputElement>;
      const selectedIds = new Set<string>();
      checkboxes.forEach((cb) => {
        if (cb.checked && cb.dataset.crimeId) selectedIds.add(cb.dataset.crimeId);
      });

      const selectedCrimes = allCrimes.filter((c) => selectedIds.has(c.id));

      // Build summary badges
      const summaryEl = el.querySelector('.assign-summary-crimes') as HTMLElement;
      if (summaryEl) {
        if (selectedCrimes.length === 0) {
          summaryEl.innerHTML = '<span style="color: #888; font-size: 0.8em;">Ningún crimen seleccionado</span>';
        } else {
          summaryEl.innerHTML = selectedCrimes.map((c) =>
            `<span class="prisoner-crime-badge offense-${c.offenseType}">${c.name}</span>`
          ).join(' ');
        }
      }

      // Calculate suggested phases from sentence config
      let totalTurns = 0;
      let hasExecution = false;
      let hasPermanent = false;
      const details: string[] = [];

      for (const c of selectedCrimes) {
        if (sentenceManager) {
          const entry = sentenceManager.getForType(c.offenseType);
          if (entry.turns === 'execution') {
            hasExecution = true;
            details.push(`${c.name}: Ejecución`);
          } else if (entry.turns === 'permanent') {
            hasPermanent = true;
            details.push(`${c.name}: Permanente`);
          } else if (typeof entry.turns === 'number' && entry.turns > 0) {
            totalTurns += entry.turns;
            details.push(`${c.name}: ${entry.turns} fases`);
          }
        }
      }

      const calcValue = el.querySelector('.assign-calc-value') as HTMLElement;
      const calcDetail = el.querySelector('.assign-calc-detail') as HTMLElement;
      const phasesInput = el.querySelector('#assign-phases-input') as HTMLInputElement;

      if (calcValue) {
        if (hasExecution) {
          calcValue.textContent = 'Ejecución';
          calcValue.style.color = '#e84a4a';
        } else if (hasPermanent) {
          calcValue.textContent = 'Permanente';
          calcValue.style.color = '#f3a261';
        } else {
          calcValue.textContent = `${totalTurns}`;
          calcValue.style.color = totalTurns > 0 ? '#f3c267' : '#888';
        }
      }

      if (calcDetail) {
        calcDetail.innerHTML = details.map((d) => `<div>${d}</div>`).join('');
      }

      // Update suggested phases input
      if (phasesInput && !hasExecution && !hasPermanent) {
        phasesInput.value = String(totalTurns);
      }
    };

    // Checkbox change
    el.querySelectorAll('.assign-crime-check').forEach((cb) => {
      cb.addEventListener('change', updateSummary);
    });

    // Click on row toggles checkbox
    el.querySelectorAll('.assign-crime-row').forEach((row) => {
      row.addEventListener('click', (ev) => {
        const target = ev.target as HTMLElement;
        if (target.tagName === 'INPUT') return; // don't double-toggle
        const cb = row.querySelector('.assign-crime-check') as HTMLInputElement;
        if (cb) {
          cb.checked = !cb.checked;
          updateSummary();
        }
      });
    });

    // Combined filter function (search + offense type toggles)
    const filterRows = () => {
      const searchInput = el.querySelector('.assign-crimes-search') as HTMLInputElement;
      const q = (searchInput?.value || '').trim().toLowerCase();

      // Get active type filters
      const activeToggles = el.querySelectorAll('.assign-crimes-filter-toggles .crimes-toggle.active');
      const activeFilters = new Set<string>();
      activeToggles.forEach((btn) => {
        const f = (btn as HTMLElement).dataset.filter;
        if (f) activeFilters.add(f);
      });
      const showAll = activeFilters.has('all') || activeFilters.size === 0;

      el.querySelectorAll('.assign-crime-row').forEach((row) => {
        const rowEl = row as HTMLElement;
        const name = rowEl.querySelector('.assign-col-name')?.textContent?.toLowerCase() || '';
        const offenseType = rowEl.dataset.offenseType || '';
        const matchesSearch = !q || name.includes(q);
        const matchesType = showAll || activeFilters.has(offenseType);
        rowEl.style.display = matchesSearch && matchesType ? '' : 'none';
      });
    };

    // Search
    const searchInput = el.querySelector('.assign-crimes-search') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', filterRows);
      searchInput.addEventListener('keydown', (ev) => ev.stopPropagation());
      searchInput.addEventListener('keyup', (ev) => ev.stopPropagation());
    }

    // Offense type toggle filters
    const toggleContainer = el.querySelector('.assign-crimes-filter-toggles');
    if (toggleContainer) {
      toggleContainer.querySelectorAll('.crimes-toggle').forEach((btn) => {
        btn.addEventListener('click', (ev) => {
          ev.preventDefault();
          const filter = (btn as HTMLElement).dataset.filter;
          if (filter === 'all') {
            // "Todos" clears other toggles
            toggleContainer.querySelectorAll('.crimes-toggle').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
          } else {
            // Toggle individual filter
            const todosBtn = toggleContainer.querySelector('[data-filter="all"]');
            todosBtn?.classList.remove('active');
            btn.classList.toggle('active');
            // If none active, reactivate "Todos"
            const anyActive = toggleContainer.querySelector('.crimes-toggle.active');
            if (!anyActive) todosBtn?.classList.add('active');
          }
          filterRows();
        });
      });
    }

    // Initial summary
    updateSummary();
  }

  // --- Utility ---

  private static enrichHistory(history: PrisonerHistoryEntry[]) {
    const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp);
    return sorted.map((entry) => {
      const actionLabel = ACTION_LABELS[entry.action] || entry.action;
      const displayText = entry.details || actionLabel;
      const phaseTag = entry.phase != null ? ` [Fase ${entry.phase}]` : '';
      return {
        ...entry,
        details: displayText + phaseTag,
        actionLabel,
        timeAgo: PrisonersPanel.formatTimeAgo(entry.timestamp),
      };
    });
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

  /**
   * Resolve current Actor name/img for a prisoner.
   * Uses the live Actor data if available, falls back to stored values.
   */
  private static resolveActorData(prisoner: Prisoner): { name: string; img: string | undefined } {
    try {
      const actor = (game as any).actors?.get(prisoner.actorId);
      if (actor) {
        return {
          name: actor.name || prisoner.name,
          img: actor.img || actor.prototypeToken?.texture?.src || prisoner.img,
        };
      }
    } catch {
      // Actor lookup failed, use stored data
    }
    return {
      name: prisoner.name + (!(game as any).actors?.get(prisoner.actorId) ? ' [borrado]' : ''),
      img: prisoner.img,
    };
  }

  /**
   * Resolve crime IDs to crime name+type objects for display
   */
  private static resolveCrimeNames(crimeIds: string[]): { name: string; offenseType: string }[] {
    if (!Array.isArray(crimeIds) || crimeIds.length === 0) return [];
    const gm = (window as any).GuardManagement;
    const crimeManager = gm?.crimeManager;
    if (!crimeManager) return [];

    return crimeIds
      .map((id) => {
        const crime: Crime | null = crimeManager.getCrime(id);
        if (!crime) return null;
        return { name: crime.name, offenseType: crime.offenseType };
      })
      .filter(Boolean) as { name: string; offenseType: string }[];
  }
}
