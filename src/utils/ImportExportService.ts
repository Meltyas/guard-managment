// @ts-nocheck
/**
 * ImportExportService
 * Handles JSON import/export for all GM Warehouse sections.
 * Data is read/written directly via game.settings — no manager coupling.
 */

export interface WarehouseExport {
  guardManagement: true;
  version: string;
  exportedAt: string;
  section: string;
  data: unknown[];
}

export class ImportExportService {
  private static readonly VERSION = '1.0';

  // ──────────────────────────────────────────────
  // EXPORT
  // ──────────────────────────────────────────────

  /**
   * Read the current items from game.settings and copy the JSON to the clipboard.
   * @param sectionLabel  Human-readable section name shown in the notification.
   * @param settingsKey   The key registered in game.settings for this section.
   */
  static async exportSection(sectionLabel: string, settingsKey: string): Promise<void> {
    const raw = (game as any)?.settings?.get('guard-management', settingsKey);
    const data: unknown[] = Array.isArray(raw) ? raw : raw ? [raw] : [];

    const payload: WarehouseExport = {
      guardManagement: true,
      version: ImportExportService.VERSION,
      exportedAt: new Date().toISOString(),
      section: settingsKey,
      data,
    };

    const json = JSON.stringify(payload, null, 2);

    try {
      await navigator.clipboard.writeText(json);
      (globalThis as any).ui?.notifications?.info(
        `✅ ${data.length} elemento(s) de "${sectionLabel}" copiados al portapapeles.`
      );
    } catch {
      // Fallback: show the JSON in a GuardModal textarea so the user can copy manually
      const { GuardModal } = await import('../ui/GuardModal.js');
      GuardModal.open({
        title: `Exportar ${sectionLabel}`,
        icon: 'fas fa-file-export',
        width: 560,
        showFooter: false,
        body: `
          <div class="guard-modal-form">
            <p style="margin-bottom:0.5rem;font-size:0.85rem;color:#aaa;">
              No se pudo acceder al portapapeles automáticamente. Copia el texto manualmente (Ctrl+A → Ctrl+C):
            </p>
            <textarea
              id="gm-export-json"
              readonly
              style="width:100%;height:280px;font-family:monospace;font-size:0.78rem;resize:vertical;background:#1a1a1a;color:#e0e0e0;border:1px solid #555;border-radius:4px;padding:8px;"
            >${json}</textarea>
          </div>
        `,
        onRender: (bodyEl) => {
          const ta = bodyEl.querySelector('#gm-export-json') as HTMLTextAreaElement;
          ta?.select();
        },
      });
    }
  }

  // ──────────────────────────────────────────────
  // IMPORT
  // ──────────────────────────────────────────────

  /**
   * Open a file picker, parse the JSON, confirm the import mode (merge / replace)
   * and save directly to game.settings.
   *
   * The `onChange` handler registered in settings.ts takes care of reloading the
   * manager's in-memory Map; the caller only needs to pass `onRefresh` to update
   * the open dialog UI.
   *
   * @param sectionLabel  Human-readable section name shown in dialogs.
   * @param settingsKey   The key registered in game.settings for this section.
   * @param onRefresh     Called after a successful import so the open dialog can refresh.
   */
  static async importSection(
    sectionLabel: string,
    settingsKey: string,
    onRefresh: () => Promise<void>
  ): Promise<void> {
    // 1. Show a paste-JSON dialog
    const rawJson = await ImportExportService._askPasteJson(sectionLabel);
    if (!rawJson) return;

    // 2. Parse and validate
    let payload: WarehouseExport;
    try {
      payload = JSON.parse(rawJson) as WarehouseExport;
    } catch {
      (globalThis as any).ui?.notifications?.error(
        '❌ No se pudo leer el JSON. Asegúrate de que sea válido.'
      );
      return;
    }

    if (!payload?.guardManagement) {
      (globalThis as any).ui?.notifications?.error(
        '❌ JSON inválido: no es un export de Guard Management.'
      );
      return;
    }

    if (!Array.isArray(payload.data)) {
      (globalThis as any).ui?.notifications?.error(
        '❌ JSON inválido: el campo "data" debe ser un array.'
      );
      return;
    }

    const count = payload.data.length;

    // Warn if section mismatch but allow import anyway
    if (payload.section && payload.section !== settingsKey) {
      console.warn(
        `[ImportExportService] Section mismatch: file is "${payload.section}", target is "${settingsKey}"`
      );
    }

    // 3. Ask merge or replace
    const mode = await ImportExportService._askImportMode(sectionLabel, count);
    if (!mode) return;

    // 4. Apply import
    if (mode === 'replace') {
      const confirmed = await ImportExportService._confirmReplace(sectionLabel);
      if (!confirmed) return;

      // Write imported data as-is (preserves original IDs — useful for default-state setup)
      await (game as any)?.settings?.set('guard-management', settingsKey, payload.data);

      (globalThis as any).ui?.notifications?.info(
        `✅ ${count} elemento(s) importado(s) en "${sectionLabel}" (reemplazado).`
      );
    } else {
      // Merge: assign new IDs to avoid collisions with existing data
      const existing: unknown[] =
        ((game as any)?.settings?.get('guard-management', settingsKey) as unknown[]) ?? [];

      const imported = payload.data.map((item: any) => ({
        ...item,
        id: foundry.utils.randomID(),
        // Reset version and timestamps on merge
        version: 1,
      }));

      await (game as any)?.settings?.set('guard-management', settingsKey, [
        ...existing,
        ...imported,
      ]);

      (globalThis as any).ui?.notifications?.info(
        `✅ ${count} elemento(s) fusionado(s) en "${sectionLabel}".`
      );
    }

    // 5. Refresh UI
    await onRefresh();
  }

  // ──────────────────────────────────────────────
  // PRIVATE HELPERS
  // ──────────────────────────────────────────────

  /**
   * Show a DialogV2 with a textarea where the user pastes the exported JSON.
   * Returns the raw string, or null if the user cancelled.
   */
  private static async _askPasteJson(sectionLabel: string): Promise<string | null> {
    try {
      const { GuardModal } = await import('../ui/GuardModal.js');

      const result = await GuardModal.openAsync<string>({
        title: `Importar ${sectionLabel}`,
        icon: 'fas fa-file-import',
        width: 560,
        saveLabel: 'Importar',
        body: `
          <div class="guard-modal-form">
            <p style="margin-bottom:0.5rem;font-size:0.85rem;color:#aaa;">
              Pega el JSON exportado en el campo de abajo y pulsa <strong>Importar</strong>.
            </p>
            <textarea
              id="gm-import-json"
              placeholder='{"guardManagement": true, "data": [...]}'
              style="width:100%;height:280px;font-family:monospace;font-size:0.78rem;resize:vertical;background:#1a1a1a;color:#e0e0e0;border:1px solid #555;border-radius:4px;padding:8px;"
            ></textarea>
          </div>
        `,
        onRender: (bodyEl) => {
          const ta = bodyEl.querySelector('#gm-import-json') as HTMLTextAreaElement;
          ta?.focus();
        },
        onSave: async (bodyEl) => {
          const textarea = bodyEl.querySelector('#gm-import-json') as HTMLTextAreaElement;
          const value = textarea?.value?.trim() ?? '';
          if (!value) return false;
          return value;
        },
      });

      return result && result.length > 0 ? result : null;
    } catch {
      return null;
    }
  }

  /** Show a DialogV2 asking for merge / replace / cancel. Returns 'merge' | 'replace' | null. */
  private static async _askImportMode(
    sectionLabel: string,
    count: number
  ): Promise<'merge' | 'replace' | null> {
    try {
      const { GuardModal } = await import('../ui/GuardModal.js');

      return await new Promise<'merge' | 'replace' | null>((resolve) => {
        let choice: 'merge' | 'replace' | null = null;

        const modal = GuardModal.open({
          title: `Importar ${sectionLabel}`,
          icon: 'fas fa-file-import',
          width: 520,
          showFooter: false,
          body: `
            <div class="guard-modal-form">
              <p>Se encontraron <strong>${count}</strong> elemento(s) en el archivo.</p>
              <p>¿Cómo deseas importar?</p>
              <ul style="margin: 0.5rem 0 1rem 1.5rem; line-height: 1.8;">
                <li><strong>Fusionar</strong>: Añade los elementos importados con nuevos IDs, conservando los existentes.</li>
                <li><strong>Reemplazar</strong>: Elimina todos los elementos actuales y los sustituye por los del archivo (IDs originales conservados).</li>
              </ul>
              <div class="guard-modal-footer" style="border-top:none;padding-top:0;">
                <button type="button" class="guard-modal-btn" data-choice="cancel"><i class="fas fa-times"></i> Cancelar</button>
                <button type="button" class="guard-modal-btn" data-choice="merge"><i class="fas fa-code-merge"></i> Fusionar</button>
                <button type="button" class="guard-modal-btn save" data-choice="replace"><i class="fas fa-sync-alt"></i> Reemplazar</button>
              </div>
            </div>
          `,
          onSave: async () => {},
          onRender: (bodyEl) => {
            bodyEl.querySelectorAll('[data-choice]').forEach((btn) => {
              btn.addEventListener('click', () => {
                const c = (btn as HTMLElement).dataset.choice;
                choice = c === 'merge' || c === 'replace' ? c : null;
                modal.close();
              });
            });
          },
          onClose: () => resolve(choice),
        });
      });
    } catch {
      return null;
    }
  }

  /** Confirm a destructive replace operation. */
  private static async _confirmReplace(sectionLabel: string): Promise<boolean> {
    try {
      const DialogV2 = foundry.applications.api.DialogV2;
      if (!DialogV2) return false;

      const result = await DialogV2.confirm({
        window: { title: 'Confirmar Reemplazo' },
        content: `
          <div style="margin-bottom: 0.75rem;">
            <i class="fas fa-exclamation-triangle" style="color: #ff6b6b; margin-right: 0.5rem;"></i>
            <strong>¿Estás seguro?</strong>
          </div>
          <p>Esto eliminará <strong>todos</strong> los elementos actuales de la sección <em>${sectionLabel}</em> y los sustituirá por los del archivo importado.</p>
          <p><strong style="color: #ff6b6b;">Esta acción no se puede deshacer.</strong></p>
        `,
        yes: { label: 'Reemplazar', icon: 'fas fa-sync-alt' },
        no: { label: 'Cancelar', icon: 'fas fa-times' },
        rejectClose: false,
      });

      return !!result;
    } catch {
      return false;
    }
  }
}
