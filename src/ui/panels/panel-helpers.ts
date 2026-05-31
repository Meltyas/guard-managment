/**
 * panel-helpers — shared utilities for the entity panels in src/ui/panels/.
 *
 * These consolidate logic that was previously copy-pasted across multiple
 * panels (formatTimeAgo, the entity-row expand/collapse, the search filter…).
 * Each helper is behaviour-preserving: callers can pass options to reproduce
 * their previous exact wording/markup.
 *
 * Part of the BasePanel refactor (improvement #2). New panels should use these
 * instead of re-implementing the same patterns.
 */

/** Shorthand accessor for the global module instance. */
export function gm(): any {
  return (window as any).GuardManagement;
}

// ── Time formatting ───────────────────────────────────────────────────────────

export interface TimeAgoOptions {
  /** Label shown when the entry is less than a minute old. */
  now?: string;
  /** Suffix appended after the minute count (e.g. 'm' → "hace 5m", ' min' → "hace 5 min"). */
  minSuffix?: string;
}

/**
 * Format a timestamp as a relative "time ago" string in Spanish.
 *
 * Replaces the per-panel `formatTimeAgo` copies. Defaults match the
 * Prisoners/Finances wording ("justo ahora" / "hace Xm"); pass options to
 * reproduce other variants:
 *  - Resources: `{ now: 'ahora mismo', minSuffix: ' min' }`
 *  - Gangs/Poi: `{ now: 'ahora', minSuffix: 'm' }`
 */
export function formatTimeAgo(timestamp: number, opts: TimeAgoOptions = {}): string {
  const { now = 'justo ahora', minSuffix = 'm' } = opts;
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return now;
  if (mins < 60) return `hace ${mins}${minSuffix}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

// ── Entity-row interactions ───────────────────────────────────────────────────

/**
 * Wire expand/collapse on `.entity-row__summary` elements. Clicking anywhere in
 * the summary (except the action buttons) toggles the row's detail section.
 *
 * Shared by ResourcesPanel and ReputationPanel (previously byte-identical copies).
 */
export function setupExpandCollapse(container: HTMLElement): void {
  container.querySelectorAll<HTMLElement>('.entity-row__summary').forEach((summary) => {
    summary.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.entity-row__actions')) return;
      e.stopPropagation();
      const row = summary.closest('.entity-row') as HTMLElement;
      const detail = row.querySelector('.entity-row__detail') as HTMLElement;
      const toggle = row.querySelector('.entity-row__toggle') as HTMLElement;
      const isOpen = !detail.hidden;
      detail.hidden = isOpen;
      toggle?.setAttribute('aria-expanded', String(!isOpen));
      row.classList.toggle('entity-row--open', !isOpen);
    });
  });
}

export interface EntitySearchOptions {
  /**
   * Optional callback run after every filter pass — used e.g. by ReputationPanel
   * to hide category sections that have no visible rows.
   */
  afterFilter?: (container: HTMLElement) => void;
}

/**
 * Wire the `.entity-list-search__input` search box to filter `.entity-row`
 * elements by their `.entity-row__name` text, toggling `.entity-row--hidden`.
 *
 * Shared by ResourcesPanel and ReputationPanel.
 */
export function setupEntitySearch(container: HTMLElement, opts: EntitySearchOptions = {}): void {
  const searchInput = container.querySelector<HTMLInputElement>('.entity-list-search__input');
  searchInput?.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    container.querySelectorAll<HTMLElement>('.entity-row').forEach((row) => {
      const name = row.querySelector('.entity-row__name')?.textContent?.toLowerCase() ?? '';
      row.classList.toggle('entity-row--hidden', !!query && !name.includes(query));
    });
    opts.afterFilter?.(container);
  });
}

// ── Collapsible activity-log toggle ───────────────────────────────────────────

export interface LogToggleOptions {
  /** Selector for the clickable toggle buttons. */
  toggleSelector: string;
  /** Selector for the collapsible list element. */
  listSelector: string;
  /**
   * Ancestor selector to scope the list lookup from each toggle button. The list
   * is searched inside `btn.closest(sectionSelector)`. If omitted, the whole
   * container is searched (only safe with a single log per panel).
   */
  sectionSelector?: string;
  /** Chevron element selector whose `openClass` is toggled when the list is open. */
  chevronSelector?: string;
  /** Class toggled on the chevron element while the list is open. */
  openClass?: string;
  /**
   * If true, swap Font Awesome `fa-chevron-down` / `fa-chevron-up` on the
   * toggle button's `<i>` instead of toggling a chevron class.
   */
  iconSwap?: boolean;
}

/**
 * Wire collapse/expand on an activity-log / changelog section. Clicking the
 * toggle button shows/hides the list and updates the chevron indicator.
 *
 * Supports both the canonical resource-log markup (section + chevron class) and
 * the reputation changelog markup (detail-scoped list + icon swap).
 */
export function setupLogToggle(container: HTMLElement, opts: LogToggleOptions): void {
  container.querySelectorAll<HTMLElement>(opts.toggleSelector).forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const scope: ParentNode = opts.sectionSelector
        ? (btn.closest(opts.sectionSelector) ?? container)
        : container;
      const list = scope.querySelector<HTMLElement>(opts.listSelector);
      if (!list) return;
      list.hidden = !list.hidden;
      const isOpen = !list.hidden;
      if (opts.iconSwap) {
        const icon = btn.querySelector('i');
        icon?.classList.toggle('fa-chevron-down', isOpen);
        icon?.classList.toggle('fa-chevron-up', !isOpen);
      } else if (opts.chevronSelector && opts.openClass) {
        btn.querySelector(opts.chevronSelector)?.classList.toggle(opts.openClass, isOpen);
      }
    });
  });
}

// ── Multi-select filter toggles ───────────────────────────────────────────────

export interface FilterTogglesOptions {
  /** Selector matching all filter toggle buttons. */
  buttonSelector: string;
  /** Full data attribute holding each button's filter value (e.g. 'data-filter', 'data-filter-status'). */
  dataAttr: string;
  /** Value representing the "Todos/all" reset button. Default 'all'. */
  allValue?: string;
  /** Called after the active set changes, to re-run the panel's filtering. */
  onChange: () => void;
}

/**
 * Wire a group of multi-select filter toggle buttons where one button is an
 * "all/Todos" reset. Selecting "all" clears the others; selecting any other
 * button clears "all"; and if nothing is selected, "all" re-activates.
 *
 * Replaces the near-identical copies in CrimesPanel, GangsPanel and BuildingsPanel.
 */
export function setupFilterToggles(container: HTMLElement, opts: FilterTogglesOptions): void {
  const { buttonSelector, dataAttr, allValue = 'all', onChange } = opts;
  const allSelector = `${buttonSelector}[${dataAttr}="${allValue}"]`;
  const activeOthersSelector = `${buttonSelector}.active:not([${dataAttr}="${allValue}"])`;

  container.querySelectorAll<HTMLElement>(buttonSelector).forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      const value = btn.getAttribute(dataAttr) ?? allValue;
      if (value === allValue) {
        // "Todos" clears all other toggles and activates itself
        container.querySelectorAll(buttonSelector).forEach((el) => el.classList.remove('active'));
        btn.classList.add('active');
      } else {
        // Toggle this filter on/off, clearing "Todos"
        container.querySelector(allSelector)?.classList.remove('active');
        btn.classList.toggle('active');
        // If no specific filter remains active, reactivate "Todos"
        if (!container.querySelector(activeOthersSelector)) {
          container.querySelector(allSelector)?.classList.add('active');
        }
      }
      onChange();
    });
  });
}

const IMG_PREVIEW_STYLE =
  'max-width: 80px; max-height: 80px; border-radius: 6px; border: 1px solid #555;';

/**
 * Wires a standard image FilePicker + text input into a dialog body.
 * Handles the picker click (opens Foundry FilePicker) and the input `change`
 * event, keeping the preview thumbnail and a caller-side value in sync.
 *
 * @param opts.pickerEl   The element that opens the picker on click.
 * @param opts.inputEl    The text input holding the image path.
 * @param opts.previewEl  Optional container for the preview thumbnail.
 * @param opts.onSelect   Called with the chosen path (e.g. to update a closure var).
 * @param opts.previewOnInput  If true, refresh the preview on manual input edits.
 */
export function setupImagePicker(opts: {
  pickerEl: Element | null;
  inputEl: HTMLInputElement | null;
  previewEl: HTMLElement | null;
  onSelect: (path: string) => void;
  previewOnInput?: boolean;
}): void {
  const { pickerEl, inputEl, previewEl, onSelect, previewOnInput = false } = opts;

  const renderPreview = (path: string) => {
    if (previewEl && path) {
      previewEl.innerHTML = `<img src="${path}" style="${IMG_PREVIEW_STYLE}" />`;
    }
  };

  pickerEl?.addEventListener('click', () => {
    new (globalThis as any).FilePicker({
      type: 'image',
      current: inputEl?.value || '',
      callback: (path: string) => {
        if (inputEl) inputEl.value = path;
        onSelect(path);
        renderPreview(path);
      },
    }).render(true);
  });

  inputEl?.addEventListener('change', () => {
    onSelect(inputEl.value);
    if (previewOnInput) renderPreview(inputEl.value);
  });
}

/**
 * Shared render pipeline for the (static) entity panels — the template-method
 * extracted out of every `Panel.render()`:
 *   getData → renderTemplate → inject into the container → wire listeners.
 *
 * Centralises the boilerplate (and the try/catch error logging) so each panel
 * only declares its template, its data source and its post-mount wiring.
 *
 * @param container  The tab-panel element to render into.
 * @param opts.template   Handlebars template path.
 * @param opts.getData    Produces the template context (sync or async).
 * @param opts.onMounted  Optional post-render wiring (event listeners, DnD…).
 * @param opts.panelName  Label used in the error log.
 */
export async function renderPanel(
  container: HTMLElement,
  opts: {
    template: string;
    getData: () => unknown | Promise<unknown>;
    onMounted?: (container: HTMLElement) => void | Promise<void>;
    panelName?: string;
  }
): Promise<void> {
  try {
    const data = await opts.getData();
    const html = await (foundry as any).applications.handlebars.renderTemplate(
      opts.template,
      data
    );
    ($ as any)(container).html(html);
    await opts.onMounted?.(container);
  } catch (error) {
    console.error(`${opts.panelName ?? 'Panel'} | Error rendering:`, error);
  }
}
