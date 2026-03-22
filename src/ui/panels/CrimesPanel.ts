/**
 * CrimesPanel - Renders the crimes catalog tab in the organization dialog.
 * Includes search, filter, CRUD, bulk import, and sentence configuration.
 */

import type { Crime, OffenseType } from '../../types/crimes';
import { OFFENSE_LABELS, OFFENSE_TYPES, OFFENSE_TYPE_FROM_SPANISH } from '../../types/crimes';
import { ConfirmService } from '../../utils/services/ConfirmService.js';
import { NotificationService } from '../../utils/services/NotificationService.js';

export class CrimesPanel {
  static get template() {
    return 'modules/guard-management/templates/panels/crimes.hbs';
  }

  static async getData() {
    const gm = (window as any).GuardManagement;
    const crimeManager = gm?.crimeManager;
    const sentenceManager = gm?.sentenceConfigManager;
    if (!crimeManager || !sentenceManager) {
      return { crimes: [], crimeCount: 0, singleCrime: false, sentenceSummary: [] };
    }

    const allCrimes = crimeManager.getAllCrimes();

    const crimes = allCrimes.map((c: Crime) => ({
      ...c,
      offenseLabel: OFFENSE_LABELS[c.offenseType] || c.offenseType,
      sentenceText: c.customSentence || sentenceManager.formatSentence(c.offenseType),
    }));

    // Build sentence summary
    const sentenceSummary = OFFENSE_TYPES.map((type) => ({
      type,
      typeLabel: OFFENSE_LABELS[type],
      text: sentenceManager.formatSentence(type).replace(`${OFFENSE_LABELS[type]}: `, ''),
    }));

    return {
      crimes,
      crimeCount: crimes.length,
      singleCrime: crimes.length === 1,
      sentenceSummary,
    };
  }

  static async render(container: HTMLElement) {
    const data = await this.getData();
    const htmlContent = await foundry.applications.handlebars.renderTemplate(this.template, data);
    $(container).html(htmlContent);
    this.setupEventListeners(container);
  }

  // --- Event Listeners ---

  private static setupEventListeners(container: HTMLElement) {
    const $html = $(container);

    // Search - isolate keyboard events while typing
    $html.off('input', '.crimes-search-input').on('input', '.crimes-search-input', (ev) => {
      const query = (ev.currentTarget as HTMLInputElement).value;
      this.filterCrimes(container, query, this.getActiveFilters(container));
    });
    $html.off('keydown', '.crimes-search-input').on('keydown', '.crimes-search-input', (ev) => {
      ev.stopPropagation();
    });
    $html.off('keyup', '.crimes-search-input').on('keyup', '.crimes-search-input', (ev) => {
      ev.stopPropagation();
    });

    // Filter toggles (multi-select: each toggle is independent)
    $html.off('click', '.crimes-toggle').on('click', '.crimes-toggle', (ev) => {
      ev.preventDefault();
      const btn = ev.currentTarget as HTMLElement;
      const filter = btn.dataset.filter || 'all';

      if (filter === 'all') {
        // "Todos" clears all other toggles and activates itself
        container.querySelectorAll('.crimes-toggle').forEach((el) => el.classList.remove('active'));
        btn.classList.add('active');
      } else {
        // Toggle this filter on/off
        btn.classList.toggle('active');
        // Remove "Todos" active state
        container.querySelector('.crimes-toggle[data-filter="all"]')?.classList.remove('active');
        // If no toggle is active, reactivate "Todos"
        const anyActive = container.querySelector('.crimes-toggle.active:not([data-filter="all"])');
        if (!anyActive) {
          container.querySelector('.crimes-toggle[data-filter="all"]')?.classList.add('active');
        }
      }

      const query =
        (container.querySelector('.crimes-search-input') as HTMLInputElement)?.value || '';
      this.filterCrimes(container, query, this.getActiveFilters(container));
    });

    // Add crime
    $html.off('click', '.crimes-add-btn').on('click', '.crimes-add-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      await this.showAddCrimeDialog();
    });

    // Import crimes
    $html.off('click', '.crimes-import-btn').on('click', '.crimes-import-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      await this.showBulkImportDialog();
    });

    // Export crimes
    $html.off('click', '.crimes-export-btn').on('click', '.crimes-export-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      await this.showExportDialog();
    });

    // Sentence config
    $html.off('click', '.crimes-sentence-btn').on('click', '.crimes-sentence-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      await this.showSentenceConfigDialog();
    });

    // Edit crime
    $html.off('click', '.crime-edit-btn').on('click', '.crime-edit-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const crimeId = (ev.currentTarget as HTMLElement).dataset.crimeId;
      if (crimeId) await this.showEditCrimeDialog(crimeId);
    });

    // Send crime to chat
    $html.off('click', '.crime-chat-btn').on('click', '.crime-chat-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const crimeId = (ev.currentTarget as HTMLElement).dataset.crimeId;
      if (crimeId) await this.sendCrimeToChat(crimeId);
    });

    // Delete crime
    $html.off('click', '.crime-delete-btn').on('click', '.crime-delete-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const el = ev.currentTarget as HTMLElement;
      const crimeId = el.dataset.crimeId!;
      const crimeName = el.dataset.crimeName!;
      await this.handleDeleteCrime(crimeId, crimeName);
    });

    // Click on crime row (clickable cells) to view detail
    $html.off('click', '.crime-row-clickable').on('click', '.crime-row-clickable', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const row = (ev.currentTarget as HTMLElement).closest('.crime-row') as HTMLElement;
      const crimeId = row?.dataset.crimeId;
      if (crimeId) await this.showCrimeDetailDialog(crimeId);
    });
  }

  // --- Filtering ---

  private static getActiveFilters(container: HTMLElement): Set<string> {
    const activeToggles = container.querySelectorAll(
      '.crimes-toggle.active'
    ) as NodeListOf<HTMLElement>;
    const filters = new Set<string>();
    activeToggles.forEach((el) => {
      const f = el.dataset.filter;
      if (f) filters.add(f);
    });
    return filters;
  }

  private static filterCrimes(container: HTMLElement, query: string, filters: Set<string>) {
    const rows = container.querySelectorAll('.crime-row') as NodeListOf<HTMLElement>;
    const q = query.trim().toLowerCase();
    const showAll = filters.has('all') || filters.size === 0;

    rows.forEach((row) => {
      const name = row.querySelector('.crime-name')?.textContent?.toLowerCase() || '';
      const type = row.dataset.offenseType || '';

      const matchesQuery = !q || name.includes(q);
      const matchesFilter = showAll || filters.has(type);

      row.style.display = matchesQuery && matchesFilter ? '' : 'none';
    });
  }

  // --- Add / Edit Crime Dialog ---

  private static async showAddCrimeDialog(): Promise<void> {
    const offenseOptions = OFFENSE_TYPES.map(
      (t) => `<option value="${t}">${OFFENSE_LABELS[t]}</option>`
    ).join('');

    const content = `
      <div class="guard-dialog" style="padding: 0.5rem;">
        <div class="form-group">
          <label for="crime-name">Nombre del crimen:</label>
          <input type="text" id="crime-name" name="name" placeholder="Ej: Asesinato" autofocus />
        </div>
        <div class="form-group" style="margin-top: 0.5rem;">
          <label for="crime-type">Tipo de ofensa:</label>
          <select id="crime-type" name="offenseType">${offenseOptions}</select>
        </div>
        <div class="form-group" style="margin-top: 0.5rem;">
          <label for="crime-sentence">Sentencia personalizada: <span style="color: #888; font-size: 0.8em;">(vacío = usar tipo por defecto)</span></label>
          <input type="text" id="crime-sentence" name="customSentence" placeholder="Ej: 5 turnos + 2 Handfuls" />
        </div>
        <div class="form-group" style="margin-top: 0.5rem;">
          <label>Descripción:</label>
          <div class="crime-editor-wrapper">
            <prose-mirror name="description" value="">
            </prose-mirror>
          </div>
        </div>
      </div>
    `;

    try {
      const DialogV2Class = (foundry as any).applications?.api?.DialogV2;
      if (DialogV2Class) {
        await DialogV2Class.wait({
          window: { title: 'Añadir Crimen', resizable: true },
          content,
          buttons: [
            {
              action: 'save',
              icon: 'fas fa-save',
              label: 'Guardar',
              callback: async (_event: any, _button: any, dialog: any) => {
                const dialogEl = dialog?.element || dialog;
                if (!dialogEl) return;
                const name = (
                  dialogEl.querySelector('#crime-name') as HTMLInputElement
                )?.value?.trim();
                const offenseType = (dialogEl.querySelector('#crime-type') as HTMLSelectElement)
                  ?.value as OffenseType;
                const customSentence =
                  (dialogEl.querySelector('#crime-sentence') as HTMLInputElement)?.value?.trim() ||
                  '';
                if (!name) {
                  NotificationService.warn('El nombre del crimen es obligatorio');
                  return;
                }
                const description = this.readProseMirrorContent(dialogEl);
                const gm = (window as any).GuardManagement;
                const result = await gm.crimeManager.createCrime(
                  name,
                  offenseType,
                  description,
                  customSentence
                );
                if (!result) {
                  NotificationService.warn(`Ya existe un crimen con el nombre "${name}"`);
                  return;
                }
                NotificationService.info(`Crimen "${name}" creado`);
              },
            },
            { action: 'cancel', icon: 'fas fa-times', label: 'Cancelar' },
          ],
          rejectClose: false,
          modal: false,
        });
      }
    } catch (error) {
      console.error('CrimesPanel | Add crime dialog error:', error);
    }
  }

  private static async showEditCrimeDialog(crimeId: string): Promise<void> {
    const gm = (window as any).GuardManagement;
    const crime = gm?.crimeManager?.getCrime(crimeId);
    if (!crime) return;

    const offenseOptions = OFFENSE_TYPES.map(
      (t) =>
        `<option value="${t}" ${t === crime.offenseType ? 'selected' : ''}>${OFFENSE_LABELS[t]}</option>`
    ).join('');

    const escapedDesc = (crime.description || '').replace(/"/g, '&quot;');
    const descContent = crime.description || '';
    const escapedSentence = (crime.customSentence || '').replace(/"/g, '&quot;');

    const content = `
      <div class="guard-dialog" style="padding: 0.5rem;">
        <div class="form-group">
          <label for="crime-name">Nombre del crimen:</label>
          <input type="text" id="crime-name" name="name" value="${crime.name}" />
        </div>
        <div class="form-group" style="margin-top: 0.5rem;">
          <label for="crime-type">Tipo de ofensa:</label>
          <select id="crime-type" name="offenseType">${offenseOptions}</select>
        </div>
        <div class="form-group" style="margin-top: 0.5rem;">
          <label for="crime-sentence">Sentencia personalizada: <span style="color: #888; font-size: 0.8em;">(vacío = usar tipo por defecto)</span></label>
          <input type="text" id="crime-sentence" name="customSentence" value="${escapedSentence}" placeholder="Ej: 5 turnos + 2 Handfuls" />
        </div>
        <div class="form-group" style="margin-top: 0.5rem;">
          <label>Descripción:</label>
          <div class="crime-editor-wrapper">
            <prose-mirror name="description" value="${escapedDesc}">
              ${descContent}
            </prose-mirror>
          </div>
        </div>
      </div>
    `;

    try {
      const DialogV2Class = (foundry as any).applications?.api?.DialogV2;
      if (DialogV2Class) {
        await DialogV2Class.wait({
          window: { title: `Editar: ${crime.name}`, resizable: true },
          content,
          buttons: [
            {
              action: 'save',
              icon: 'fas fa-save',
              label: 'Guardar',
              callback: async (_event: any, _button: any, dialog: any) => {
                const dialogEl = dialog?.element || dialog;
                if (!dialogEl) return;
                const name = (
                  dialogEl.querySelector('#crime-name') as HTMLInputElement
                )?.value?.trim();
                const offenseType = (dialogEl.querySelector('#crime-type') as HTMLSelectElement)
                  ?.value as OffenseType;
                const customSentence =
                  (dialogEl.querySelector('#crime-sentence') as HTMLInputElement)?.value?.trim() ||
                  '';
                if (!name) {
                  NotificationService.warn('El nombre del crimen es obligatorio');
                  return;
                }
                const description = this.readProseMirrorContent(dialogEl);
                const result = await gm.crimeManager.updateCrime(crimeId, {
                  name,
                  offenseType,
                  description,
                  customSentence,
                });
                if (!result) {
                  NotificationService.warn(`Ya existe un crimen con el nombre "${name}"`);
                  return;
                }
                NotificationService.info(`Crimen "${name}" actualizado`);
              },
            },
            { action: 'cancel', icon: 'fas fa-times', label: 'Cancelar' },
          ],
          rejectClose: false,
          modal: false,
        });
      }
    } catch (error) {
      console.error('CrimesPanel | Edit crime dialog error:', error);
    }
  }

  // --- Delete Crime ---

  private static async handleDeleteCrime(crimeId: string, crimeName: string): Promise<void> {
    const html = `
      <div style="margin-bottom: 1rem;">
        <i class="fas fa-exclamation-triangle" style="color: #ff6b6b; margin-right: 0.5rem;"></i>
        <strong>¿Estás seguro?</strong>
      </div>
      <p>¿Deseas eliminar el crimen "<strong>${crimeName}</strong>"?</p>
    `;

    const confirmed = await ConfirmService.confirm({
      title: 'Eliminar Crimen',
      html,
    });
    if (!confirmed) return;

    const gm = (window as any).GuardManagement;
    await gm.crimeManager.deleteCrime(crimeId);
    NotificationService.info(`Crimen "${crimeName}" eliminado`);
  }

  // --- Bulk Import Dialog ---

  private static async showBulkImportDialog(): Promise<void> {
    const content = `
      <div class="guard-dialog crimes-import-dialog" style="padding: 0.5rem;">
        <div class="import-example" style="display: block !important;">
          <label style="display: block !important;"><i class="fas fa-info-circle"></i> Formato esperado:</label>
          <div class="import-example-text" style="display: block !important; white-space: pre-line; font-family: monospace; font-size: 0.8em; color: #bbb; margin: 0.3rem 0 0 0;">[Asesinato, Capital, Matar intencionalmente, Ejecución]
[Robo con Violencia, Mayor, Robar con fuerza, 6 turnos + 3 Handfuls]
[Hurto, Menor, Robar sin violencia]
[Alteración del Orden, Leve]
[Comercio Ilegal, Multa]</div>
          <div style="margin-top: 0.3rem; font-size: 0.75em; color: #888; font-style: italic;">Descripción y sentencia son opcionales. Si un crimen ya existe, se actualizará.</div>
        </div>
        <div class="form-group" style="margin-top: 0.5rem;">
          <label for="import-text">Pega el texto aquí:</label>
          <textarea id="import-text" name="importText" rows="10" style="width: 100%; font-family: monospace; font-size: 0.85em;" placeholder="[NombreCrimen, TipoOfensa]&#10;[NombreCrimen, TipoOfensa, Descripción]&#10;[NombreCrimen, TipoOfensa, Descripción, Sentencia]"></textarea>
        </div>
        <div id="import-preview" class="import-preview" style="margin-top: 0.5rem; display: none;">
          <span class="import-preview-text"></span>
        </div>
      </div>
    `;

    try {
      const DialogV2Class = (foundry as any).applications?.api?.DialogV2;
      if (DialogV2Class) {
        await DialogV2Class.wait({
          window: { title: 'Importar Crímenes', resizable: true },
          content,
          buttons: [
            {
              action: 'import',
              icon: 'fas fa-file-import',
              label: 'Importar',
              callback: async (_event: any, _button: any, dialog: any) => {
                const dialogEl = dialog?.element || dialog;
                if (!dialogEl) return;
                const text =
                  (dialogEl.querySelector('#import-text') as HTMLTextAreaElement)?.value || '';
                await this.processBulkImport(text);
              },
            },
            { action: 'cancel', icon: 'fas fa-times', label: 'Cancelar' },
          ],
          rejectClose: false,
          modal: false,
          render: (_event: any, html: any) => {
            const el = html instanceof HTMLElement ? html : html?.element;
            if (!el) return;
            const textarea = el.querySelector('#import-text') as HTMLTextAreaElement;
            const preview = el.querySelector('#import-preview') as HTMLElement;
            const previewText = el.querySelector('.import-preview-text') as HTMLElement;
            if (textarea && preview && previewText) {
              textarea.addEventListener('input', () => {
                const parsed = this.parseBulkText(textarea.value);
                if (parsed.length > 0) {
                  const gm = (window as any).GuardManagement;
                  const existingNames = new Set(
                    (gm?.crimeManager?.getAllCrimes() || []).map((c: Crime) =>
                      c.name.trim().toLowerCase()
                    )
                  );
                  const seenNames = new Set<string>();
                  let newCount = 0;
                  let updateCount = 0;
                  for (const entry of parsed) {
                    const norm = entry.name.trim().toLowerCase();
                    if (seenNames.has(norm)) continue;
                    seenNames.add(norm);
                    if (existingNames.has(norm)) {
                      updateCount++;
                    } else {
                      newCount++;
                    }
                  }
                  preview.style.display = '';
                  const parts: string[] = [];
                  if (newCount > 0) parts.push(`${newCount} nuevo(s)`);
                  if (updateCount > 0) parts.push(`${updateCount} a actualizar`);
                  previewText.textContent = `Se procesarán ${parsed.length} crimen(es): ${parts.join(', ')}`;
                } else {
                  preview.style.display = 'none';
                }
              });
            }
          },
        });
      }
    } catch (error) {
      console.error('CrimesPanel | Bulk import dialog error:', error);
    }
  }

  /**
   * Parse bulk text into crime entries
   * Format: [Name, Type] or [Name, Type, Desc] or [Name, Type, Desc, Sentence]
   */
  private static parseBulkText(
    text: string
  ): { name: string; offenseType: OffenseType; description: string; customSentence: string }[] {
    const results: {
      name: string;
      offenseType: OffenseType;
      description: string;
      customSentence: string;
    }[] = [];
    const regex = /\[(.+?),\s*(.+?)(?:,\s*(.+?))?(?:,\s*(.+?))?\]/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const name = match[1].trim();
      const typeInput = match[2].trim().toLowerCase();
      const description = match[3]?.trim() || '';
      const customSentence = match[4]?.trim() || '';
      const offenseType = OFFENSE_TYPE_FROM_SPANISH[typeInput];
      if (name && offenseType) {
        results.push({ name, offenseType, description, customSentence });
      }
    }

    return results;
  }

  /**
   * Process and save bulk imported crimes (creates new or updates existing)
   */
  private static async processBulkImport(text: string): Promise<void> {
    const entries = this.parseBulkText(text);
    if (entries.length === 0) {
      NotificationService.warn('No se encontraron crímenes válidos en el texto');
      return;
    }

    const gm = (window as any).GuardManagement;
    const result = await gm.crimeManager.bulkUpsertCrimes(entries);

    const parts: string[] = [];
    if (result.created > 0) parts.push(`${result.created} creado(s)`);
    if (result.updated > 0) parts.push(`${result.updated} actualizado(s)`);

    if (parts.length > 0) {
      NotificationService.info(`Importación: ${parts.join(', ')}`);
    } else {
      NotificationService.warn('No se procesó ningún crimen');
    }
  }

  // --- Export Dialog ---

  private static async showExportDialog(): Promise<void> {
    const gm = (window as any).GuardManagement;
    const crimes = (gm?.crimeManager?.getAllCrimes() as Crime[]) || [];

    if (crimes.length === 0) {
      NotificationService.warn('No hay crímenes para exportar');
      return;
    }

    // Build export text in parser format
    const lines = crimes.map((c: Crime) => {
      const typeLabel = OFFENSE_LABELS[c.offenseType] || c.offenseType;
      const parts = [c.name, typeLabel];
      // Include description and sentence if they exist
      // If sentence exists but no description, still include empty description slot
      if (c.description || c.customSentence) {
        const plainDesc = c.description ? c.description.replace(/<[^>]*>/g, '').trim() : '';
        parts.push(plainDesc);
      }
      if (c.customSentence) {
        parts.push(c.customSentence);
      }
      return `[${parts.join(', ')}]`;
    });

    const exportText = lines.join('\n');

    const content = `
      <div class="guard-dialog" style="padding: 0.5rem;">
        <div style="margin-bottom: 0.5rem; font-size: 0.8em; color: #888;">
          ${crimes.length} crimen(es) exportados en formato compatible con el importador.
          Puedes copiar, modificar y reimportar.
        </div>
        <textarea id="export-text" rows="15" style="width: 100%; font-family: monospace; font-size: 0.8em;" readonly>${exportText}</textarea>
      </div>
    `;

    try {
      const DialogV2Class = (foundry as any).applications?.api?.DialogV2;
      if (DialogV2Class) {
        await DialogV2Class.wait({
          window: { title: 'Exportar Crímenes', resizable: true },
          content,
          buttons: [
            {
              action: 'copy',
              icon: 'fas fa-copy',
              label: 'Copiar',
              callback: async (_event: any, _button: any, dialog: any) => {
                const dialogEl = dialog?.element || dialog;
                const textarea = dialogEl?.querySelector('#export-text') as HTMLTextAreaElement;
                if (textarea) {
                  try {
                    if (navigator.clipboard?.writeText) {
                      await navigator.clipboard.writeText(textarea.value);
                    } else {
                      // Fallback for non-HTTPS contexts
                      textarea.select();
                      document.execCommand('copy');
                    }
                    NotificationService.info('Crímenes copiados al portapapeles');
                  } catch {
                    textarea.select();
                    document.execCommand('copy');
                    NotificationService.info('Crímenes copiados al portapapeles');
                  }
                }
              },
            },
            { action: 'close', icon: 'fas fa-times', label: 'Cerrar' },
          ],
          rejectClose: false,
          modal: false,
          render: (_event: any, html: any) => {
            const el = html instanceof HTMLElement ? html : html?.element;
            if (!el) return;
            const textarea = el.querySelector('#export-text') as HTMLTextAreaElement;
            if (textarea) {
              textarea.addEventListener('click', () => textarea.select());
            }
          },
        });
      }
    } catch (error) {
      console.error('CrimesPanel | Export dialog error:', error);
    }
  }

  // --- Sentence Config Dialog ---

  private static async showSentenceConfigDialog(): Promise<void> {
    const gm = (window as any).GuardManagement;
    const sentenceManager = gm?.sentenceConfigManager;
    if (!sentenceManager) return;

    const config = sentenceManager.getConfig();
    const currencyLabels = sentenceManager.getCurrencyLabels();

    // Build currency header cells
    const currencyHeaders = currencyLabels
      .filter((c: any) => c.enabled)
      .map((c: any) => `<th><i class="${c.icon}"></i> ${c.label}</th>`)
      .join('');

    // Build rows
    const rows = OFFENSE_TYPES.map((type) => {
      const entry = config[type];
      const turnsValue = typeof entry.turns === 'number' ? entry.turns : '';
      const turnsSelect =
        entry.turns === 'permanent'
          ? 'permanent'
          : entry.turns === 'execution'
            ? 'execution'
            : 'numeric';

      const currencyCells = currencyLabels
        .filter((c: any) => c.enabled)
        .map(
          (c: any) =>
            `<td><input type="number" class="sentence-fine-input" data-type="${type}" data-currency="${c.key}" value="${(entry.fine as any)[c.key] || 0}" min="0" step="1" /></td>`
        )
        .join('');

      return `
        <tr>
          <td><span class="sentence-type-badge offense-${type}">${OFFENSE_LABELS[type]}</span></td>
          <td>
            <select class="sentence-turns-mode" data-type="${type}">
              <option value="numeric" ${turnsSelect === 'numeric' ? 'selected' : ''}>Turnos</option>
              <option value="permanent" ${turnsSelect === 'permanent' ? 'selected' : ''}>Permanente</option>
              <option value="execution" ${turnsSelect === 'execution' ? 'selected' : ''}>Ejecución</option>
            </select>
            <input type="number" class="sentence-turns-input" data-type="${type}" value="${turnsValue}" min="0" step="1"
              style="${turnsSelect !== 'numeric' ? 'display:none;' : ''}" />
          </td>
          ${currencyCells}
        </tr>
      `;
    }).join('');

    const content = `
      <div class="guard-dialog sentence-config-dialog" style="padding: 0.5rem;">
        <table class="sentence-config-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Sentencia</th>
              ${currencyHeaders}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    try {
      const DialogV2Class = (foundry as any).applications?.api?.DialogV2;
      if (DialogV2Class) {
        await DialogV2Class.wait({
          window: { title: 'Configurar Sentencias', resizable: true },
          content,
          buttons: [
            {
              action: 'save',
              icon: 'fas fa-save',
              label: 'Guardar',
              callback: async (_event: any, _button: any, dialog: any) => {
                const dialogEl = dialog?.element || dialog;
                if (!dialogEl) return;
                await this.saveSentenceConfig(dialogEl, currencyLabels);
              },
            },
            { action: 'cancel', icon: 'fas fa-times', label: 'Cancelar' },
          ],
          rejectClose: false,
          modal: false,
          render: (_event: any, html: any) => {
            const el = html instanceof HTMLElement ? html : html?.element;
            if (!el) return;
            // Toggle turns input visibility based on mode select
            el.querySelectorAll('.sentence-turns-mode').forEach((select: any) => {
              select.addEventListener('change', () => {
                const type = select.dataset.type;
                const input = el.querySelector(
                  `.sentence-turns-input[data-type="${type}"]`
                ) as HTMLInputElement;
                if (input) {
                  input.style.display = select.value === 'numeric' ? '' : 'none';
                }
              });
            });
          },
        });
      }
    } catch (error) {
      console.error('CrimesPanel | Sentence config dialog error:', error);
    }
  }

  private static async saveSentenceConfig(
    dialogEl: HTMLElement,
    currencyLabels: any[]
  ): Promise<void> {
    const gm = (window as any).GuardManagement;
    const sentenceManager = gm?.sentenceConfigManager;
    if (!sentenceManager) return;

    const newConfig: any = {};

    for (const type of OFFENSE_TYPES) {
      const modeSelect = dialogEl.querySelector(
        `.sentence-turns-mode[data-type="${type}"]`
      ) as HTMLSelectElement;
      const turnsInput = dialogEl.querySelector(
        `.sentence-turns-input[data-type="${type}"]`
      ) as HTMLInputElement;

      let turns: number | 'permanent' | 'execution';
      if (modeSelect?.value === 'permanent') {
        turns = 'permanent';
      } else if (modeSelect?.value === 'execution') {
        turns = 'execution';
      } else {
        turns = parseInt(turnsInput?.value || '0', 10) || 0;
      }

      const fine: any = { coins: 0, handfuls: 0, bags: 0, chests: 0 };
      for (const cl of currencyLabels.filter((c: any) => c.enabled)) {
        const input = dialogEl.querySelector(
          `.sentence-fine-input[data-type="${type}"][data-currency="${cl.key}"]`
        ) as HTMLInputElement;
        fine[cl.key] = parseInt(input?.value || '0', 10) || 0;
      }

      newConfig[type] = { turns, fine };
    }

    await sentenceManager.updateConfig(newConfig);
    NotificationService.info('Configuración de sentencias actualizada');
  }

  // --- Crime Detail View ---

  private static async showCrimeDetailDialog(crimeId: string): Promise<void> {
    const gm = (window as any).GuardManagement;
    const crime = gm?.crimeManager?.getCrime(crimeId);
    if (!crime) return;

    const sentenceManager = gm?.sentenceConfigManager;
    const defaultSentence = sentenceManager?.formatSentence(crime.offenseType) || '';
    const sentenceText = crime.customSentence || defaultSentence;
    const isCustom = !!crime.customSentence;
    const offenseLabel = OFFENSE_LABELS[crime.offenseType] || crime.offenseType;
    const descriptionHtml = crime.description || '<em style="color: #888;">Sin descripción</em>';

    const content = `
      <div class="guard-dialog crime-detail-dialog" style="padding: 0.75rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
          <span class="crime-type-badge offense-${crime.offenseType}" style="font-size: 0.85em;">${offenseLabel}</span>
          <span style="color: #999; font-size: 0.85em;">${sentenceText}${isCustom ? ' <i class="fas fa-pen" style="font-size: 0.7em; color: #f3c267;" title="Sentencia personalizada"></i>' : ''}</span>
        </div>
        <div class="crime-detail-description" style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 0.6rem 0.8rem; color: #ddd; font-size: 0.9em; line-height: 1.5; max-height: 300px; overflow-y: auto;">
          ${descriptionHtml}
        </div>
      </div>
    `;

    try {
      const DialogV2Class = (foundry as any).applications?.api?.DialogV2;
      if (DialogV2Class) {
        await DialogV2Class.wait({
          window: { title: crime.name, resizable: true },
          content,
          buttons: [
            {
              action: 'edit',
              icon: 'fas fa-edit',
              label: 'Editar',
              callback: async () => {
                // Open edit dialog after this one closes
                setTimeout(() => this.showEditCrimeDialog(crimeId), 100);
              },
            },
            { action: 'close', icon: 'fas fa-times', label: 'Cerrar' },
          ],
          rejectClose: false,
          modal: false,
        });
      }
    } catch (error) {
      console.error('CrimesPanel | Crime detail dialog error:', error);
    }
  }

  // --- ProseMirror Helper ---

  private static readProseMirrorContent(dialogEl: HTMLElement): string {
    // Try editor-content first (rendered ProseMirror)
    const editorContent = dialogEl.querySelector('.editor-content.ProseMirror');
    if (editorContent) {
      const html = editorContent.innerHTML?.trim();
      if (html) return html;
    }
    // Try prose-mirror element value
    const pmElement = dialogEl.querySelector('prose-mirror[name="description"]');
    if (pmElement && 'value' in pmElement) {
      const val = (pmElement as any).value;
      if (typeof val === 'string') return val;
    }
    // Fallback to form data
    const form = dialogEl.querySelector('form');
    if (form) {
      const fd = new FormData(form);
      return (fd.get('description') as string) || '';
    }
    return '';
  }

  // --- Send to Chat ---

  private static async sendCrimeToChat(crimeId: string): Promise<void> {
    const gm = (window as any).GuardManagement;
    const crime = gm?.crimeManager?.getAllCrimes()?.find((c: Crime) => c.id === crimeId);
    if (!crime) return;

    const offenseLabel = OFFENSE_LABELS[crime.offenseType] || crime.offenseType;
    const sentenceText =
      crime.customSentence || gm?.sentenceConfigManager?.formatSentence(crime.offenseType) || '';

    const chatHTML = `
      <div class="message-content">
        <div class="daggerheart chat domain-card">
          <details class="domain-card-move" open>
            <summary class="domain-card-header">
              <div class="domain-label">
                <h2 class="title">${crime.name}</h2>
              </div>
              <i class="fa-solid fa-chevron-down"></i>
            </summary>
            <div class="description">
              ${crime.description ? `<p>${crime.description.trim()}</p>` : '<p><em>Sin descripción</em></p>'}
            </div>
          </details>
          <footer class="ability-card-footer">
            <ul class="tags">
              <li class="tag">${offenseLabel}</li>
              <li class="tag">${sentenceText}</li>
            </ul>
          </footer>
        </div>
      </div>
    `;

    try {
      await (ChatMessage as any).create({
        content: chatHTML,
        speaker: { scene: null, actor: null, token: null, alias: 'Guard Management' },
        flags: { 'guard-management': { type: 'crime', crimeId } },
      });
    } catch (error) {
      console.error('CrimesPanel | Error sending crime to chat:', error);
      NotificationService.error('Error al enviar crimen al chat');
    }
  }
}
