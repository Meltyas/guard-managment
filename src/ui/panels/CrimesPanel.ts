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
      sentenceText: sentenceManager.formatSentence(c.offenseType),
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
    const htmlContent = await foundry.applications.handlebars.renderTemplate(
      this.template,
      data
    );
    $(container).html(htmlContent);
    this.setupEventListeners(container);
  }

  // --- Event Listeners ---

  private static setupEventListeners(container: HTMLElement) {
    const $html = $(container);

    // Search
    $html.off('input', '.crimes-search-input').on('input', '.crimes-search-input', (ev) => {
      const query = (ev.currentTarget as HTMLInputElement).value;
      this.filterCrimes(container, query, this.getSelectedFilter(container));
    });

    // Filter
    $html.off('change', '.crimes-filter-select').on('change', '.crimes-filter-select', (ev) => {
      const filter = (ev.currentTarget as HTMLSelectElement).value;
      const query = (container.querySelector('.crimes-search-input') as HTMLInputElement)?.value || '';
      this.filterCrimes(container, query, filter);
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

    // Delete crime
    $html.off('click', '.crime-delete-btn').on('click', '.crime-delete-btn', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const el = ev.currentTarget as HTMLElement;
      const crimeId = el.dataset.crimeId!;
      const crimeName = el.dataset.crimeName!;
      await this.handleDeleteCrime(crimeId, crimeName);
    });
  }

  // --- Filtering ---

  private static getSelectedFilter(container: HTMLElement): string {
    return (container.querySelector('.crimes-filter-select') as HTMLSelectElement)?.value || 'all';
  }

  private static filterCrimes(container: HTMLElement, query: string, filter: string) {
    const cards = container.querySelectorAll('.crime-card') as NodeListOf<HTMLElement>;
    const q = query.trim().toLowerCase();

    cards.forEach((card) => {
      const name = card.querySelector('.crime-name')?.textContent?.toLowerCase() || '';
      const crimeId = card.dataset.crimeId || '';
      const gm = (window as any).GuardManagement;
      const crime = gm?.crimeManager?.getCrime(crimeId);
      const type = crime?.offenseType || '';

      const matchesQuery = !q || name.includes(q);
      const matchesFilter = filter === 'all' || type === filter;

      card.style.display = matchesQuery && matchesFilter ? '' : 'none';
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
      </div>
    `;

    try {
      const DialogV2Class = (foundry as any).applications?.api?.DialogV2;
      if (DialogV2Class) {
        await DialogV2Class.wait({
          window: { title: 'Añadir Crimen', resizable: false },
          content,
          buttons: [
            {
              action: 'save',
              icon: 'fas fa-save',
              label: 'Guardar',
              callback: async (_event: any, _button: any, dialog: any) => {
                const dialogEl = dialog?.element || dialog;
                if (!dialogEl) return;
                const name = (dialogEl.querySelector('#crime-name') as HTMLInputElement)?.value?.trim();
                const offenseType = (dialogEl.querySelector('#crime-type') as HTMLSelectElement)?.value as OffenseType;
                if (!name) {
                  NotificationService.warn('El nombre del crimen es obligatorio');
                  return;
                }
                const gm = (window as any).GuardManagement;
                const result = await gm.crimeManager.createCrime(name, offenseType);
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
      </div>
    `;

    try {
      const DialogV2Class = (foundry as any).applications?.api?.DialogV2;
      if (DialogV2Class) {
        await DialogV2Class.wait({
          window: { title: `Editar: ${crime.name}`, resizable: false },
          content,
          buttons: [
            {
              action: 'save',
              icon: 'fas fa-save',
              label: 'Guardar',
              callback: async (_event: any, _button: any, dialog: any) => {
                const dialogEl = dialog?.element || dialog;
                if (!dialogEl) return;
                const name = (dialogEl.querySelector('#crime-name') as HTMLInputElement)?.value?.trim();
                const offenseType = (dialogEl.querySelector('#crime-type') as HTMLSelectElement)?.value as OffenseType;
                if (!name) {
                  NotificationService.warn('El nombre del crimen es obligatorio');
                  return;
                }
                const result = await gm.crimeManager.updateCrime(crimeId, { name, offenseType });
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
        <div class="import-example">
          <label><i class="fas fa-info-circle"></i> Formato esperado:</label>
          <pre class="import-example-text">[Asesinato, Capital]
[Robo con Violencia, Mayor]
[Hurto, Menor]
[Alteración del Orden, Leve]
[Comercio Ilegal, Multa]</pre>
        </div>
        <div class="form-group" style="margin-top: 0.5rem;">
          <label for="import-text">Pega el texto aquí:</label>
          <textarea id="import-text" name="importText" rows="10" style="width: 100%; font-family: monospace; font-size: 0.85em;" placeholder="[NombreCrimen, TipoOfensa]&#10;[NombreCrimen2, TipoOfensa]"></textarea>
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
                const text = (dialogEl.querySelector('#import-text') as HTMLTextAreaElement)?.value || '';
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
                    (gm?.crimeManager?.getAllCrimes() || []).map((c: Crime) => c.name.trim().toLowerCase())
                  );
                  const newNames = new Set<string>();
                  let duplicates = 0;
                  for (const entry of parsed) {
                    const norm = entry.name.trim().toLowerCase();
                    if (existingNames.has(norm) || newNames.has(norm)) {
                      duplicates++;
                    } else {
                      newNames.add(norm);
                    }
                  }
                  const toImport = parsed.length - duplicates;
                  preview.style.display = '';
                  previewText.textContent = `Se importarán ${toImport} crimen(es)${duplicates > 0 ? ` (${duplicates} duplicado(s) descartado(s))` : ''}`;
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
   * Format: [CrimeName, OffenseType]
   */
  private static parseBulkText(text: string): { name: string; offenseType: OffenseType }[] {
    const results: { name: string; offenseType: OffenseType }[] = [];
    const regex = /\[(.+?),\s*(.+?)\]/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const name = match[1].trim();
      const typeInput = match[2].trim().toLowerCase();
      const offenseType = OFFENSE_TYPE_FROM_SPANISH[typeInput];
      if (name && offenseType) {
        results.push({ name, offenseType });
      }
    }

    return results;
  }

  /**
   * Process and save bulk imported crimes
   */
  private static async processBulkImport(text: string): Promise<void> {
    const entries = this.parseBulkText(text);
    if (entries.length === 0) {
      NotificationService.warn('No se encontraron crímenes válidos en el texto');
      return;
    }

    const gm = (window as any).GuardManagement;
    const result = await gm.crimeManager.bulkCreateCrimes(entries);

    if (result.created > 0) {
      let msg = `${result.created} crimen(es) importado(s)`;
      if (result.skipped > 0) {
        msg += `, ${result.skipped} duplicado(s) descartado(s)`;
      }
      NotificationService.info(msg);
    } else {
      NotificationService.warn('Todos los crímenes ya existían (0 importados)');
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
      const turnsSelect = entry.turns === 'permanent' ? 'permanent' : entry.turns === 'execution' ? 'execution' : 'numeric';

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
                const input = el.querySelector(`.sentence-turns-input[data-type="${type}"]`) as HTMLInputElement;
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

  private static async saveSentenceConfig(dialogEl: HTMLElement, currencyLabels: any[]): Promise<void> {
    const gm = (window as any).GuardManagement;
    const sentenceManager = gm?.sentenceConfigManager;
    if (!sentenceManager) return;

    const newConfig: any = {};

    for (const type of OFFENSE_TYPES) {
      const modeSelect = dialogEl.querySelector(`.sentence-turns-mode[data-type="${type}"]`) as HTMLSelectElement;
      const turnsInput = dialogEl.querySelector(`.sentence-turns-input[data-type="${type}"]`) as HTMLInputElement;

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
        const input = dialogEl.querySelector(`.sentence-fine-input[data-type="${type}"][data-currency="${cl.key}"]`) as HTMLInputElement;
        fine[cl.key] = parseInt(input?.value || '0', 10) || 0;
      }

      newConfig[type] = { turns, fine };
    }

    await sentenceManager.updateConfig(newConfig);
    NotificationService.info('Configuración de sentencias actualizada');
  }
}
