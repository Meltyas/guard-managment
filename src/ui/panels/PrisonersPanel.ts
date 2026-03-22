/**
 * PrisonersPanel - Renders the prisoners tab (temporary cells) in the organization dialog.
 * History is per-prisoner and displayed as a tooltip.
 */
import type { Prisoner, PrisonerHistoryEntry } from '../../types/entities';
import type { Crime } from '../../types/crimes';
import { OFFENSE_LABELS } from '../../types/crimes';
import { ConfirmService } from '../../utils/services/ConfirmService.js';
import { NotificationService } from '../../utils/services/NotificationService.js';

const STATUS_LABELS: Record<string, string> = {
  imprisoned: 'Preso',
  forced_labor: 'Trabajos Forzados',
  executed: 'Ejecutado',
  released: 'Liberado',
  transferred_to_prison: 'En Prisión',
};

const ACTION_LABELS: Record<string, string> = {
  entered: 'Ingresó',
  released: 'Liberado',
  forced_labor: 'Enviado a trabajos forzados',
  transferred_to_prison: 'Transferido a prisión',
  executed: 'Ejecutado',
  notes_updated: 'Notas actualizadas',
  release_turn_updated: 'Turno de liberación modificado',
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
    const activePrisoners = prisonerManager.getActivePrisoners();

    // Build cells (compact, no history inside)
    const cells = [];
    for (let i = 0; i < cellCount; i++) {
      const prisoner = activePrisoners.find((p: Prisoner) => p.cellIndex === i);
      cells.push({
        index: i,
        displayIndex: i + 1,
        prisoner: prisoner
          ? {
              ...prisoner,
              statusLabel: STATUS_LABELS[prisoner.status] || prisoner.status,
              crimeNames: PrisonersPanel.resolveCrimeNames(prisoner.crimes),
            }
          : null,
      });
    }

    // Build records (fichas) — ALL prisoners with history, sorted by most recently updated
    const allPrisoners = prisonerManager.getAllPrisoners();
    const records = allPrisoners
      .filter((p: Prisoner) => p.history && p.history.length > 0)
      .sort((a: Prisoner, b: Prisoner) => b.updatedAt - a.updatedAt)
      .map((p: Prisoner) => ({
        id: p.id,
        name: p.name,
        img: p.img,
        status: p.status,
        statusLabel: STATUS_LABELS[p.status] || p.status,
        notes: p.notes,
        canReturn: p.status !== 'imprisoned',
        crimeNames: PrisonersPanel.resolveCrimeNames(p.crimes),
        history: PrisonersPanel.enrichHistory(p.history || []),
      }));

    return { cellCount, cells, records };
  }

  static async render(container: HTMLElement) {
    const data = await this.getData();
    const htmlContent = await foundry.applications.handlebars.renderTemplate(
      this.template,
      data
    );
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

    $html.off('click', '.prisoner-release-btn').on('click', '.prisoner-release-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const el = ev.currentTarget as HTMLElement;
      await this.handleAction(el.dataset.prisonerId!, el.dataset.prisonerName!, 'released');
    });

    $html.off('click', '.prisoner-forced-labor-btn').on('click', '.prisoner-forced-labor-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const el = ev.currentTarget as HTMLElement;
      await this.handleAction(el.dataset.prisonerId!, el.dataset.prisonerName!, 'forced_labor');
    });

    $html.off('click', '.prisoner-prison-btn').on('click', '.prisoner-prison-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const el = ev.currentTarget as HTMLElement;
      await this.handleAction(el.dataset.prisonerId!, el.dataset.prisonerName!, 'transferred_to_prison');
    });

    $html.off('click', '.prisoner-execute-btn').on('click', '.prisoner-execute-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const el = ev.currentTarget as HTMLElement;
      await this.handleAction(el.dataset.prisonerId!, el.dataset.prisonerName!, 'executed');
    });

    // Return to cell button (in records section)
    $html.off('click', '.record-return-btn').on('click', '.record-return-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const el = ev.currentTarget as HTMLElement;
      await this.handleReturnToCell(el.dataset.prisonerId!, el.dataset.prisonerName!);
    });
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

          const existing = gm?.prisonerManager?.getPrisonerByCell(cellIndex);
          if (existing) {
            NotificationService.warn(`La celda ${cellIndex + 1} ya está ocupada por ${existing.name}`);
            return;
          }

          const allPrisoners = gm?.prisonerManager?.getActivePrisoners() || [];
          const alreadyPrisoner = allPrisoners.find((p: Prisoner) => p.actorId === actor.id);
          if (alreadyPrisoner) {
            NotificationService.warn(`${actor.name} ya está en la celda ${alreadyPrisoner.cellIndex + 1}`);
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
    action: 'released' | 'forced_labor' | 'executed' | 'transferred_to_prison'
  ): Promise<void> {
    const actionLabels: Record<string, string> = {
      released: 'liberar',
      forced_labor: 'enviar a trabajos forzados',
      executed: 'enviar a ejecutar',
      transferred_to_prison: 'enviar a prisión permanente',
    };

    const html = `
      <div style="margin-bottom: 1rem;">
        <i class="fas fa-exclamation-triangle" style="color: #ff6b6b; margin-right: 0.5rem;"></i>
        <strong>¿Estás seguro?</strong>
      </div>
      <p>¿Deseas ${actionLabels[action]} a "<strong>${prisonerName}</strong>"?</p>
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
        break;
      case 'executed':
        await gm.prisonerManager.executePrisoner(prisonerId);
        NotificationService.info(`${prisonerName} ha sido ejecutado`);
        break;
    }
  }

  // --- Return to Cell ---

  private static async handleReturnToCell(prisonerId: string, prisonerName: string): Promise<void> {
    const gm = (window as any).GuardManagement;
    if (!gm?.prisonerManager) return;

    // Find first empty cell
    const cellCount = gm.prisonerManager.getCellCount();
    let emptyCell = -1;
    for (let i = 0; i < cellCount; i++) {
      if (!gm.prisonerManager.getPrisonerByCell(i)) {
        emptyCell = i;
        break;
      }
    }

    if (emptyCell === -1) {
      NotificationService.warn('No hay celdas vacías disponibles');
      return;
    }

    await gm.prisonerManager.returnToCell(prisonerId, emptyCell);
    NotificationService.info(`${prisonerName} devuelto a celda ${emptyCell + 1}`);
  }

  // --- Config Dialog ---

  private static async showConfigDialog(): Promise<void> {
    const gm = (window as any).GuardManagement;
    const current = gm?.prisonerManager?.getCellCount() || 4;

    const content = `
      <form>
        <div class="form-group">
          <label for="cell-count">Número de celdas:</label>
          <input type="number" id="cell-count" name="cellCount" value="${current}" min="1" max="20" />
        </div>
      </form>
    `;

    const result = await Dialog.prompt({
      title: 'Configurar Celdas Temporales',
      content,
      callback: (html: any) => {
        const input = $(html).find('#cell-count');
        return parseInt(input.val() as string) || current;
      },
    });

    if (result && result !== current) {
      await gm.prisonerManager.setCellCount(result);
      NotificationService.info(`Celdas temporales configuradas a ${result}`);
    }
  }

  // --- Edit Prisoner Dialog ---

  private static async showEditPrisonerDialog(prisonerId: string): Promise<void> {
    const gm = (window as any).GuardManagement;
    const prisoner = gm?.prisonerManager?.getPrisoner(prisonerId);
    if (!prisoner) return;

    const escapedNotes = (prisoner.notes || '').replace(/"/g, '&quot;');
    const notesContent = prisoner.notes || '';

    // Build crime list for assignment
    const allCrimes: Crime[] = gm?.crimeManager?.getAllCrimes() || [];
    const assignedCrimeIds: string[] = Array.isArray(prisoner.crimes) ? prisoner.crimes : [];

    const crimeOptions = allCrimes.map((c) => {
      const checked = assignedCrimeIds.includes(c.id) ? 'checked' : '';
      const label = OFFENSE_LABELS[c.offenseType] || c.offenseType;
      return `
        <label class="prisoner-crime-checkbox" style="display: flex; align-items: center; gap: 0.4rem; padding: 0.15rem 0;">
          <input type="checkbox" class="crime-assign-check" data-crime-id="${c.id}" ${checked} />
          <span class="prisoner-crime-badge offense-${c.offenseType}" style="font-size: 0.7em;">${label}</span>
          <span style="font-size: 0.85em;">${c.name}</span>
        </label>
      `;
    }).join('');

    const crimesSection = allCrimes.length > 0
      ? `
        <div class="form-group" style="margin-top: 0.5rem;">
          <label><i class="fas fa-gavel"></i> Crímenes asignados:</label>
          <div class="prisoner-crimes-list" style="max-height: 150px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.3rem 0.5rem; background: rgba(0,0,0,0.2);">
            ${crimeOptions}
          </div>
        </div>
      `
      : '';

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
          <label for="prisoner-release-turn">Turno de liberación:</label>
          <input type="number" id="prisoner-release-turn" name="releaseTurn"
                 value="${prisoner.releaseTurn ?? ''}" min="0" placeholder="Sin definir" />
        </div>
        ${crimesSection}
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

                const releaseTurnEl = dialogEl.querySelector('#prisoner-release-turn') as HTMLInputElement;
                const releaseTurnVal = releaseTurnEl?.value?.trim();
                const newReleaseTurn = releaseTurnVal ? parseInt(releaseTurnVal) : null;

                if (newNotes !== prisoner.notes) {
                  await gm.prisonerManager.updateNotes(prisonerId, newNotes);
                }
                if (newReleaseTurn !== prisoner.releaseTurn) {
                  await gm.prisonerManager.updateReleaseTurn(prisonerId, newReleaseTurn);
                }

                // Save crime assignments
                const checkboxes = dialogEl.querySelectorAll('.crime-assign-check') as NodeListOf<HTMLInputElement>;
                const newCrimeIds: string[] = [];
                checkboxes.forEach((cb) => {
                  if (cb.checked && cb.dataset.crimeId) {
                    newCrimeIds.push(cb.dataset.crimeId);
                  }
                });
                // Compare and apply changes
                const oldCrimeIds = Array.isArray(prisoner.crimes) ? prisoner.crimes : [];
                const toAdd = newCrimeIds.filter((id) => !oldCrimeIds.includes(id));
                const toRemove = oldCrimeIds.filter((id) => !newCrimeIds.includes(id));
                for (const crimeId of toAdd) {
                  await gm.prisonerManager.assignCrime(prisonerId, crimeId);
                }
                for (const crimeId of toRemove) {
                  await gm.prisonerManager.removeCrime(prisonerId, crimeId);
                }

                NotificationService.info(`Prisionero "${prisoner.name}" actualizado`);
                return 'save';
              },
            },
            { action: 'cancel', icon: 'fas fa-times', label: 'Cancelar' },
          ],
          rejectClose: false,
          modal: false,
        });
      } else {
        new Dialog({
          title: `Editar: ${prisoner.name}`,
          content,
          buttons: {
            save: {
              icon: '<i class="fas fa-save"></i>',
              label: 'Guardar',
              callback: async (html: any) => {
                let newNotes = '';
                const editorContent = $(html).find('.editor-content.ProseMirror')[0];
                if (editorContent) {
                  newNotes = editorContent.innerHTML?.trim() || '';
                }
                if (!newNotes) {
                  const pmElement = $(html).find('prose-mirror')[0];
                  if (pmElement && 'value' in pmElement) {
                    const val = (pmElement as any).value;
                    if (typeof val === 'string') newNotes = val;
                  }
                }

                const releaseTurnVal = $(html).find('#prisoner-release-turn').val() as string;
                const newReleaseTurn = releaseTurnVal ? parseInt(releaseTurnVal) : null;

                if (newNotes !== prisoner.notes) {
                  await gm.prisonerManager.updateNotes(prisonerId, newNotes);
                }
                if (newReleaseTurn !== prisoner.releaseTurn) {
                  await gm.prisonerManager.updateReleaseTurn(prisonerId, newReleaseTurn);
                }

                // Save crime assignments
                const checkboxes = $(html).find('.crime-assign-check');
                const newCrimeIds: string[] = [];
                checkboxes.each(function () {
                  const cb = this as HTMLInputElement;
                  if (cb.checked && cb.dataset.crimeId) {
                    newCrimeIds.push(cb.dataset.crimeId);
                  }
                });
                const oldCrimeIds = Array.isArray(prisoner.crimes) ? prisoner.crimes : [];
                const toAdd = newCrimeIds.filter((id) => !oldCrimeIds.includes(id));
                const toRemove = oldCrimeIds.filter((id) => !newCrimeIds.includes(id));
                for (const crimeId of toAdd) {
                  await gm.prisonerManager.assignCrime(prisonerId, crimeId);
                }
                for (const crimeId of toRemove) {
                  await gm.prisonerManager.removeCrime(prisonerId, crimeId);
                }

                NotificationService.info(`Prisionero "${prisoner.name}" actualizado`);
              },
            },
            cancel: {
              icon: '<i class="fas fa-times"></i>',
              label: 'Cancelar',
            },
          },
          default: 'save',
        }).render(true);
      }
    } catch (error) {
      console.error('PrisonersPanel | Edit dialog error:', error);
    }
  }

  // --- Utility ---

  private static enrichHistory(history: PrisonerHistoryEntry[]) {
    const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp);
    return sorted.map((entry) => {
      // The details field is the main display text; fall back to actionLabel
      const actionLabel = ACTION_LABELS[entry.action] || entry.action;
      const displayText = entry.details || actionLabel;
      return {
        ...entry,
        details: displayText,
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
