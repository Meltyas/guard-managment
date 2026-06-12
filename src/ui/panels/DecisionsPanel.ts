/**
 * DecisionsPanel — renders the guard decision tree.
 *
 * Nodes are placed on an infinite canvas using (col, row) grid positions.
 * Connections between nodes are drawn as SVG bezier curves.
 * The GM controls visibility and lock state of each node.
 */

import { ConfirmService } from '../../utils/services/ConfirmService.js';
import { GuardModal } from '../GuardModal.js';
import { renderPanel } from './panel-helpers.js';
import type { GuardDecision, DecisionSection } from '../../managers/DecisionManager.js';

// Grid constants (px)  —  layout: LEFT→RIGHT  (row = depth/X,  col = lane/Y)
const CELL_W = 90;   // horizontal spacing (depth)
const CELL_H = 68;   // vertical spacing (lanes) — compact
const TILE_W = 63;
const TILE_H = 63;
const CANVAS_PAD = 30;

/** Centre of a node in canvas coordinates (left-to-right layout) */
function nodeCentre(d: GuardDecision): { cx: number; cy: number } {
  const x = d.row * CELL_W + CANVAS_PAD;   // row  = horizontal depth
  const y = d.col * CELL_H + CANVAS_PAD;   // col  = vertical lane
  return { cx: x + TILE_W / 2, cy: y + TILE_H / 2 };
}

/** Horizontal cubic-bezier path between two centres */
function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

export class DecisionsPanel {
  static get template() {
    return 'modules/guard-management/templates/panels/decisions.hbs';
  }

  static async getData() {
    const gm = (window as any).GuardManagement;
    const isGM = (game as any)?.user?.isGM ?? false;
    const manager = gm?.decisionManager;

    if (!manager) {
      return { isGM, hasSections: false, sections: [] };
    }

    const allDecisions: GuardDecision[] = manager.getAllDecisions();
    const allSections: DecisionSection[] = manager.getAllSections();

    // Build per-section data
    const sections = allSections.map((sec, idx) => {
      const all = allDecisions.filter((d) => d.section === sec.id);
      const visible = isGM ? all : all.filter((d) => d.visible);

      if (visible.length === 0) {
        return {
          ...sec,
          isFirst: idx === 0,
          hasNodes: false,
          nodes: [],
          edges: [],
          separatorX: [],
          canvasW: 400,
          canvasH: 300,
        };
      }

      const maxRow = Math.max(...visible.map((d) => d.row));
      const maxCol = Math.max(...visible.map((d) => d.col));
      const canvasW = (maxRow + 1) * CELL_W + CANVAS_PAD * 2;
      const canvasH = (maxCol + 1) * CELL_H + CANVAS_PAD * 2;

      const visibleIds = new Set(visible.map((d) => d.id));

      const nodes = visible.map((d) => {
        const isHidden = !d.visible;
        const isLocked = d.visible && d.state === 'locked';
        let cssClass = '';
        if (isHidden) cssClass = 'decision-tile--hidden';
        else if (isLocked) cssClass = 'decision-tile--locked';
        else cssClass = 'decision-tile--unlocked';
        return {
          ...d,
          x: d.row * CELL_W + CANVAS_PAD,
          y: d.col * CELL_H + CANVAS_PAD,
          isHidden,
          isLocked,
          cssClass,
        };
      });

      const edges: { d: string; hidden: boolean }[] = [];
      for (const dec of visible) {
        for (const parentId of dec.parentIds) {
          const parent = all.find((p) => p.id === parentId);
          if (!parent || !visibleIds.has(parentId)) continue;
          const from = nodeCentre(parent);
          const to = nodeCentre(dec);
          const hidden = !parent.visible || !dec.visible;
          edges.push({ d: bezierPath(from.cx, from.cy, to.cx, to.cy), hidden });
        }
      }

      // Convergence separators
      const separatorX: number[] = [];
      const byRow = new Map<number, GuardDecision[]>();
      for (const d of visible) {
        if (!byRow.has(d.row)) byRow.set(d.row, []);
        byRow.get(d.row)!.push(d);
      }
      for (const [row, nodesInRow] of byRow) {
        const isConvergence = nodesInRow.every((d) => {
          const parentCols = d.parentIds
            .map((pid) => all.find((p) => p.id === pid))
            .filter(Boolean)
            .map((p) => p!.col);
          return parentCols.length >= 2 && new Set(parentCols).size >= 2;
        });
        if (isConvergence) {
          separatorX.push(row * CELL_W + CANVAS_PAD - CELL_W * 0.45);
        }
      }

      return { ...sec, isFirst: idx === 0, hasNodes: true, nodes, edges, separatorX, canvasW, canvasH };
    });

    return { isGM, hasSections: sections.length > 0, sections };
  }

  static async render(container: HTMLElement) {
    DecisionsPanel._hidePortalTooltip();
    await renderPanel(container, {
      template: DecisionsPanel.template,
      getData: () => DecisionsPanel.getData(),
      onMounted: (c) => DecisionsPanel.setupEventListeners(c),
      panelName: 'DecisionsPanel',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event listeners
  // ─────────────────────────────────────────────────────────────────────────

  private static setupEventListeners(container: HTMLElement) {
    const $html = $(container);

    // ── Section tab switching ─────────────────────────────────────────────
    $html.off('click', '.decisions-section-tab').on('click', '.decisions-section-tab', function () {
      const sectionId = (this as HTMLElement).dataset.sectionId ?? '';
      $html.find('.decisions-section-tab').removeClass('active');
      $(this).addClass('active');
      $html.find('.decision-section-canvas').removeClass('active');
      $html.find(`.decision-section-canvas[data-section-id="${sectionId}"]`).addClass('active');
    });

    // ── Add section (GM) ─────────────────────────────────────────────────
    $html.off('click', '.decisions-add-section-btn').on('click', '.decisions-add-section-btn', () => {
      DecisionsPanel.openSectionDialog(container, null);
    });

    // ── Edit section (GM) ─────────────────────────────────────────────────
    $html.off('click', '.decisions-edit-section-btn').on('click', '.decisions-edit-section-btn', function (ev) {
      ev.stopPropagation();
      const id = (ev.currentTarget as HTMLElement).dataset.sectionId ?? '';
      DecisionsPanel.openSectionDialog(container, id);
    });

    // ── Delete section (GM) ───────────────────────────────────────────────
    $html
      .off('click', '.decisions-delete-section-btn')
      .on('click', '.decisions-delete-section-btn', async function (ev) {
        ev.stopPropagation();
        const id = (ev.currentTarget as HTMLElement).dataset.sectionId ?? '';
        const confirmed = await ConfirmService.confirm({
          title: '¿Eliminar sección?',
          html: '<p>Los nodos de esta sección se moverán a la sección siguiente disponible.</p>',
        });
        if (!confirmed) return;
        const manager = (window as any).GuardManagement?.decisionManager;
        await manager?.deleteSection(id);
        await DecisionsPanel.render(container);
      });

    // ── Add node ──────────────────────────────────────────────────────────
    $html.off('click', '.decisions-add-btn').on('click', '.decisions-add-btn', function () {
      const sectionId = (this as HTMLElement).dataset.sectionId ?? '';
      DecisionsPanel.openEditDialog(container, null, sectionId);
    });

    // ── Tooltip: open on click, close on outside click ───────────────────
    $html
      .off('click', '.decision-tile')
      .on('click', '.decision-tile', function (ev) {
        const target = ev.currentTarget as HTMLElement;
        const wasOpen = target.classList.contains('decision-tile--open');
        // Close any open tile
        container.querySelectorAll('.decision-tile--open').forEach((t) => {
          t.classList.remove('decision-tile--open');
        });
        DecisionsPanel._hidePortalTooltip();
        if (!wasOpen) {
          target.classList.add('decision-tile--open');
          DecisionsPanel._showPortalTooltip(target, container);
        }
        ev.stopPropagation();
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tooltip portal (appended to document.body to escape CSS transforms)
  // ─────────────────────────────────────────────────────────────────────────

  private static _getOrCreatePortal(): HTMLElement {
    let el = document.getElementById('decision-tooltip-portal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'decision-tooltip-portal';
      el.className = 'decision-tile__tooltip';
      el.style.display = 'none';
      document.body.appendChild(el);
    }
    return el;
  }

  static _showPortalTooltip(tile: HTMLElement, container: HTMLElement) {
    const name = tile.dataset.tooltipName ?? '';
    const desc = tile.dataset.tooltipDesc ?? '';
    const locked = tile.dataset.tooltipLocked === 'true';
    const id = tile.dataset.decisionId ?? '';
    const isGM = (game as any)?.user?.isGM ?? false;
    const mgr = (window as any).GuardManagement?.decisionManager;
    const dec = id ? mgr?.getDecision(id) : null;

    const portal = DecisionsPanel._getOrCreatePortal();

    const gmButtons = isGM && dec ? `
      <div class="decision-tooltip__actions">
        <button type="button" class="dtt-toggle-vis-btn" data-decision-id="${id}"
          title="${dec.visible ? 'Ocultar a jugadores' : 'Mostrar a jugadores'}">
          <i class="fas ${dec.visible ? 'fa-eye' : 'fa-eye-slash'}"></i>
          <span>${dec.visible ? 'Ocultar' : 'Mostrar'}</span>
        </button>
        <button type="button" class="dtt-toggle-state-btn" data-decision-id="${id}"
          title="${locked ? 'Desbloquear' : 'Bloquear'}">
          <i class="fas ${locked ? 'fa-unlock' : 'fa-lock'}"></i>
          <span>${locked ? 'Desbloquear' : 'Bloquear'}</span>
        </button>
        <button type="button" class="dtt-edit-btn" data-decision-id="${id}" title="Editar">
          <i class="fas fa-edit"></i><span>Editar</span>
        </button>
        <button type="button" class="dtt-delete-btn" data-decision-id="${id}" title="Eliminar">
          <i class="fas fa-trash"></i><span>Eliminar</span>
        </button>
      </div>
    ` : '';

    portal.innerHTML = `
      <div class="decision-tile__tooltip-name">${name}</div>
      ${locked ? '<div class="decision-tile__tooltip-locked"><i class="fas fa-lock"></i> Pendiente de desbloqueo</div>' : ''}
      ${desc ? `<div class="decision-tile__tooltip-body">${desc}</div>` : ''}
      ${gmButtons}
    `;

    // Wire GM button actions on the portal
    if (isGM && dec) {
      portal.querySelector('.dtt-toggle-vis-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await mgr.updateDecision(id, { visible: !dec.visible });
        tile.classList.remove('decision-tile--open');
        DecisionsPanel._hidePortalTooltip();
        await DecisionsPanel.render(container);
      });
      portal.querySelector('.dtt-toggle-state-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const newState = dec.state === 'locked' ? 'unlocked' : 'locked';
        await mgr.updateDecision(id, { state: newState });
        tile.classList.remove('decision-tile--open');
        DecisionsPanel._hidePortalTooltip();
        await DecisionsPanel.render(container);
      });
      portal.querySelector('.dtt-edit-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        tile.classList.remove('decision-tile--open');
        DecisionsPanel._hidePortalTooltip();
        DecisionsPanel.openEditDialog(container, id, '');
      });
      portal.querySelector('.dtt-delete-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        tile.classList.remove('decision-tile--open');
        DecisionsPanel._hidePortalTooltip();
        const confirmed = await ConfirmService.confirm({
          title: '¿Eliminar nodo?',
          html: '<p>Se eliminarán también las conexiones que apunten a este nodo.</p>',
        });
        if (!confirmed) return;
        await mgr.deleteDecision(id);
        await DecisionsPanel.render(container);
      });
    }

    // Position portal
    portal.style.visibility = 'hidden';
    portal.style.display = 'block';

    const tRect = tile.getBoundingClientRect();
    const ttW = portal.offsetWidth || 220;
    const ttH = portal.offsetHeight || 100;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const GAP = 10;

    let left = tRect.right + GAP + ttW <= vw
      ? tRect.right + GAP
      : tRect.left - GAP - ttW;
    let top = tRect.top + tRect.height / 2 - ttH / 2;
    top = Math.max(GAP, Math.min(top, vh - ttH - GAP));

    portal.style.left = `${left}px`;
    portal.style.top = `${top}px`;
    portal.style.visibility = '';

    // Outside-click handler (one-shot)
    const onOutside = (e: MouseEvent) => {
      if (!portal.contains(e.target as Node) && e.target !== tile && !(tile as HTMLElement).contains(e.target as Node)) {
        container.querySelectorAll('.decision-tile--open').forEach((t) => t.classList.remove('decision-tile--open'));
        DecisionsPanel._hidePortalTooltip();
        document.removeEventListener('click', onOutside, true);
      }
    };
    // Defer so the current click doesn't immediately close it
    setTimeout(() => document.addEventListener('click', onOutside, true), 0);
  }

  static _hidePortalTooltip() {
    const el = document.getElementById('decision-tooltip-portal');
    if (el) el.style.display = 'none';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Section dialog
  // ─────────────────────────────────────────────────────────────────────────

  private static openSectionDialog(container: HTMLElement, id: string | null) {
    const manager = (window as any).GuardManagement?.decisionManager;
    const existing: DecisionSection | null = id ? manager?.getSection(id) : null;

    const title = existing ? `Editar sección: ${existing.name}` : 'Nueva Sección';
    const nameValue = existing?.name ?? '';

    const body = `
      <div class="gm-modal-form">
        <div class="form-group">
          <label>Nombre de la sección</label>
          <input type="text" class="section-name-input" value="${nameValue}"
            placeholder="Ej: Decisiones Internas..." />
        </div>
      </div>
    `;

    GuardModal.open({
      title,
      icon: 'fas fa-folder',
      body,
      saveLabel: 'Guardar',
      width: 360,
      onSave: async (bodyEl) => {
        const name =
          (bodyEl.querySelector('.section-name-input') as HTMLInputElement)?.value?.trim() ||
          'Sección';
        if (existing) {
          await manager.updateSection(id!, { name });
        } else {
          await manager.createSection({ name });
        }
        await DecisionsPanel.render(container);
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Node edit dialog
  // ─────────────────────────────────────────────────────────────────────────

  private static openEditDialog(container: HTMLElement, id: string | null, defaultSectionId: string) {
    const manager = (window as any).GuardManagement?.decisionManager;
    const existing: GuardDecision | null = id ? manager?.getDecision(id) : null;
    const allDecisions: GuardDecision[] = manager?.getAllDecisions() ?? [];
    const allSections: DecisionSection[] = manager?.getAllSections() ?? [];

    const title = existing ? `Editar: ${existing.name}` : 'Nuevo Nodo';
    const imgValue = existing?.img ?? 'icons/svg/d20-grey.svg';
    const nameValue = existing?.name ?? '';
    const descValue = existing?.description ?? '';
    const colValue = existing?.col ?? 0;
    const rowValue = existing?.row ?? 0;
    const stateValue = existing?.state ?? 'locked';
    const visibleValue = existing?.visible ?? false;
    const parentIds: string[] = existing?.parentIds ?? [];
    const currentSection = existing?.section ?? defaultSectionId ?? allSections[0]?.id ?? '';

    const sectionOptions = allSections
      .map(
        (s) =>
          `<option value="${s.id}" ${currentSection === s.id ? 'selected' : ''}>${s.name}</option>`
      )
      .join('');

    const parentOptions = allDecisions
      .filter((d) => d.id !== id)
      .map(
        (d) =>
          `<option value="${d.id}" ${parentIds.includes(d.id) ? 'selected' : ''}>${d.name} (col:${d.col} row:${d.row})</option>`
      )
      .join('');

    const body = `
      <div class="gm-modal-form">
        <div class="form-group">
          <label>Imagen</label>
          <div class="image-picker-row">
            <img class="decision-img-preview" src="${imgValue}" alt="preview"
              style="width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid rgba(243,194,103,.4);cursor:pointer;"
              title="Click para cambiar imagen" />
            <input type="text" class="decision-img-input" value="${imgValue}" placeholder="Ruta de imagen..." />
          </div>
        </div>
        <div class="form-group">
          <label>Nombre</label>
          <input type="text" class="decision-name-input" value="${nameValue}" placeholder="Nombre del nodo..." />
        </div>
        <div class="form-group">
          <label>Sección</label>
          <select class="decision-section-input">${sectionOptions}</select>
        </div>
        <div class="form-row" style="display:flex;gap:12px;">
          <div class="form-group" style="flex:1;">
            <label>Columna</label>
            <input type="number" class="decision-col-input" value="${colValue}" min="0" max="20" />
          </div>
          <div class="form-group" style="flex:1;">
            <label>Fila</label>
            <input type="number" class="decision-row-input" value="${rowValue}" min="0" max="20" />
          </div>
        </div>
        <div class="form-row" style="display:flex;gap:12px;">
          <div class="form-group" style="flex:1;">
            <label>Estado</label>
            <select class="decision-state-input">
              <option value="locked" ${stateValue === 'locked' ? 'selected' : ''}>🔒 Bloqueado</option>
              <option value="unlocked" ${stateValue === 'unlocked' ? 'selected' : ''}>✅ Desbloqueado</option>
            </select>
          </div>
          <div class="form-group" style="flex:1;display:flex;align-items:center;gap:8px;padding-top:20px;">
            <input type="checkbox" class="decision-visible-input" id="dec-visible" ${visibleValue ? 'checked' : ''} style="width:auto;" />
            <label for="dec-visible" style="margin:0;">Visible para jugadores</label>
          </div>
        </div>
        ${
          parentOptions
            ? `<div class="form-group">
          <label>Conectar desde (padres)</label>
          <select class="decision-parents-input" multiple style="height:90px;">
            ${parentOptions}
          </select>
          <small style="color:rgba(239,230,216,.5);">Ctrl+click para selección múltiple</small>
        </div>`
            : ''
        }
        <div class="form-group">
          <label>Descripción (HTML)</label>
          <textarea class="decision-desc-input" rows="6"
            style="width:100%;resize:vertical;font-family:monospace;font-size:0.85rem;"
            placeholder="Descripción en HTML...">${descValue}</textarea>
        </div>
      </div>
    `;

    GuardModal.open({
      title,
      icon: 'fas fa-project-diagram',
      body,
      saveLabel: 'Guardar',
      width: 500,
      onRender: (bodyEl) => {
        const imgEl = bodyEl.querySelector('.decision-img-preview') as HTMLImageElement | null;
        const inputEl = bodyEl.querySelector('.decision-img-input') as HTMLInputElement | null;
        imgEl?.addEventListener('click', () => {
          new (globalThis as any).FilePicker({
            type: 'image',
            current: imgEl.src,
            callback: (path: string) => {
              imgEl.src = path;
              if (inputEl) inputEl.value = path;
            },
          }).render(true);
        });
        inputEl?.addEventListener('input', () => {
          if (imgEl) imgEl.src = inputEl.value;
        });
      },
      onSave: async (bodyEl) => {
        const name =
          (bodyEl.querySelector('.decision-name-input') as HTMLInputElement)?.value?.trim() || 'Nodo';
        const img =
          (bodyEl.querySelector('.decision-img-input') as HTMLInputElement)?.value?.trim() ||
          'icons/svg/d20-grey.svg';
        const section =
          (bodyEl.querySelector('.decision-section-input') as HTMLSelectElement)?.value ?? currentSection;
        const col =
          parseInt((bodyEl.querySelector('.decision-col-input') as HTMLInputElement)?.value ?? '0', 10) || 0;
        const row =
          parseInt((bodyEl.querySelector('.decision-row-input') as HTMLInputElement)?.value ?? '0', 10) || 0;
        const state = ((bodyEl.querySelector('.decision-state-input') as HTMLSelectElement)?.value ??
          'locked') as 'locked' | 'unlocked';
        const visible =
          (bodyEl.querySelector('.decision-visible-input') as HTMLInputElement)?.checked ?? false;
        const parentsEl = bodyEl.querySelector('.decision-parents-input') as HTMLSelectElement | null;
        const selectedParentIds = parentsEl
          ? Array.from(parentsEl.selectedOptions).map((o) => o.value)
          : [];
        const description =
          (bodyEl.querySelector('.decision-desc-input') as HTMLTextAreaElement)?.value ?? '';

        if (existing) {
          await manager.updateDecision(id!, { name, img, section, col, row, state, visible, parentIds: selectedParentIds, description });
        } else {
          await manager.createDecision({ name, img, section, col, row, state, visible, parentIds: selectedParentIds, description });
        }
        await DecisionsPanel.render(container);
      },
    });
  }

}
