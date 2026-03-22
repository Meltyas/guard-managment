/**
 * GuardModal - Generic draggable, resizable, non-blocking modal system
 * Styled to match Daggerheart's aesthetic. Can be reused across the module.
 *
 * Features:
 *  - Draggable by header
 *  - Resizable via corner handle
 *  - Non-blocking: no overlay, clicking outside does NOT close it
 *  - Multiple modals can coexist (stacking via z-index)
 *  - Escape key closes the topmost modal
 *  - Prevents Foundry hotkeys from firing while inputs are focused
 */

export interface GuardModalOptions {
  /** Modal title displayed in the header */
  title: string;
  /** FontAwesome icon class for the header (e.g. 'fas fa-coins') */
  icon: string;
  /** HTML string for the modal body */
  body: string;
  /** Initial width in px (default 440) */
  width?: number;
  /** Minimum width in px (default 320) */
  minWidth?: number;
  /** Minimum height in px (default 200) */
  minHeight?: number;
  /** Called when the user clicks Save. Return false to prevent close. */
  onSave: (bodyEl: HTMLElement) => Promise<boolean | void>;
  /** Called after the modal DOM is created but before it's shown */
  onRender?: (bodyEl: HTMLElement) => void;
  /** Save button label (default 'Guardar') */
  saveLabel?: string;
  /** Cancel button label (default 'Cancelar') */
  cancelLabel?: string;
  /** Show the save/cancel footer? (default true) */
  showFooter?: boolean;
}

// Track all open modals for stacking
const openModals: GuardModal[] = [];
let baseZIndex = 9000;

export class GuardModal {
  public readonly element: HTMLElement;
  private isDragging = false;
  private isResizing = false;
  private dragOffset = { x: 0, y: 0 };

  // Bound handlers for cleanup
  private readonly boundMouseMove: (e: MouseEvent) => void;
  private readonly boundMouseUp: () => void;
  private readonly boundKeyDown: (e: KeyboardEvent) => void;

  constructor(private opts: GuardModalOptions) {
    this.boundMouseMove = this.handleMouseMove.bind(this);
    this.boundMouseUp = this.handleMouseUp.bind(this);
    this.boundKeyDown = this.handleKeyDown.bind(this);

    this.element = this.buildElement();
    this.attachListeners();
    document.body.appendChild(this.element);

    // Register in stack
    openModals.push(this);
    this.updateZIndex();

    // Center on screen
    this.centerOnScreen();

    // Callback
    const bodyEl = this.element.querySelector('.guard-modal-body') as HTMLElement;
    opts.onRender?.(bodyEl);
  }

  // ---- Static helpers ----

  /** Close all open GuardModals */
  static closeAll(): void {
    [...openModals].forEach((m) => m.close());
  }

  /** Open a GuardModal (convenience wrapper) */
  static open(opts: GuardModalOptions): GuardModal {
    return new GuardModal(opts);
  }

  // ---- Instance methods ----

  public close(): void {
    this.element.remove();
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
    document.removeEventListener('keydown', this.boundKeyDown);

    const idx = openModals.indexOf(this);
    if (idx !== -1) openModals.splice(idx, 1);
  }

  // ---- Internals ----

  private buildElement(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'guard-modal';
    const width = this.opts.width ?? 440;
    el.style.width = `${width}px`;

    const showFooter = this.opts.showFooter !== false;
    const saveLabel = this.opts.saveLabel ?? 'Guardar';
    const cancelLabel = this.opts.cancelLabel ?? 'Cancelar';

    el.innerHTML = `
      <div class="guard-modal-header">
        <i class="${this.opts.icon}"></i>
        <span class="guard-modal-title">${this.opts.title}</span>
        <button class="guard-modal-close" title="Cerrar"><i class="fas fa-times"></i></button>
      </div>
      <div class="guard-modal-body">${this.opts.body}</div>
      ${
        showFooter
          ? `<div class="guard-modal-footer">
              <button class="guard-modal-btn cancel"><i class="fas fa-times"></i> ${cancelLabel}</button>
              <button class="guard-modal-btn save"><i class="fas fa-check"></i> ${saveLabel}</button>
            </div>`
          : ''
      }
      <div class="guard-modal-resize-handle"></div>
    `;

    return el;
  }

  private attachListeners(): void {
    const header = this.element.querySelector('.guard-modal-header') as HTMLElement;
    const resizeHandle = this.element.querySelector('.guard-modal-resize-handle') as HTMLElement;

    // Drag via header
    header.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.guard-modal-close')) return;
      e.preventDefault();
      this.isDragging = true;
      const rect = this.element.getBoundingClientRect();
      this.dragOffset.x = e.clientX - rect.left;
      this.dragOffset.y = e.clientY - rect.top;
      this.element.style.cursor = 'grabbing';
      this.bringToFront();
    });

    // Resize via handle
    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.isResizing = true;
      this.bringToFront();
    });

    // Close button
    this.element.querySelector('.guard-modal-close')?.addEventListener('click', () => this.close());

    // Cancel button
    this.element.querySelector('.guard-modal-btn.cancel')?.addEventListener('click', () => this.close());

    // Save button
    this.element.querySelector('.guard-modal-btn.save')?.addEventListener('click', async () => {
      const bodyEl = this.element.querySelector('.guard-modal-body') as HTMLElement;
      const result = await this.opts.onSave(bodyEl);
      if (result !== false) this.close();
    });

    // Stop propagation on inputs to prevent Foundry hotkeys (delegation for dynamic content)
    this.element.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement;
      if (t.matches('input, textarea, select')) e.stopPropagation();
    });
    this.element.addEventListener('keyup', (e) => {
      const t = e.target as HTMLElement;
      if (t.matches('input, textarea, select')) e.stopPropagation();
    });

    // Click anywhere on modal brings it to front
    this.element.addEventListener('mousedown', () => this.bringToFront());

    // Global listeners
    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
    document.addEventListener('keydown', this.boundKeyDown);
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.isDragging) {
      const newX = e.clientX - this.dragOffset.x;
      const newY = e.clientY - this.dragOffset.y;
      const maxX = window.innerWidth - this.element.offsetWidth;
      const maxY = window.innerHeight - this.element.offsetHeight;
      this.element.style.left = `${Math.max(0, Math.min(maxX, newX))}px`;
      this.element.style.top = `${Math.max(0, Math.min(maxY, newY))}px`;
    }

    if (this.isResizing) {
      const rect = this.element.getBoundingClientRect();
      const minW = this.opts.minWidth ?? 320;
      const minH = this.opts.minHeight ?? 200;
      this.element.style.width = `${Math.max(minW, e.clientX - rect.left)}px`;
      this.element.style.height = `${Math.max(minH, e.clientY - rect.top)}px`;
    }
  }

  private handleMouseUp(): void {
    if (this.isDragging || this.isResizing) {
      this.element.style.cursor = '';
    }
    this.isDragging = false;
    this.isResizing = false;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && openModals.length > 0) {
      // Close the topmost modal
      const top = openModals[openModals.length - 1];
      if (top === this) {
        this.close();
      }
    }
  }

  private centerOnScreen(): void {
    const rect = this.element.getBoundingClientRect();
    const x = (window.innerWidth - rect.width) / 2;
    const y = (window.innerHeight - rect.height) / 2;
    this.element.style.left = `${Math.max(0, x)}px`;
    this.element.style.top = `${Math.max(0, y)}px`;
  }

  private bringToFront(): void {
    const idx = openModals.indexOf(this);
    if (idx !== -1 && idx !== openModals.length - 1) {
      openModals.splice(idx, 1);
      openModals.push(this);
    }
    this.updateZIndex();
  }

  private updateZIndex(): void {
    openModals.forEach((m, i) => {
      m.element.style.zIndex = `${baseZIndex + i}`;
    });
  }
}
