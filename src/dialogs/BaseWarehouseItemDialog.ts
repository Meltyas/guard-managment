/**
 * Base Warehouse Item Dialog
 * Base class for creating dialogs for warehouse items
 */

import { BaseWarehouseItem, WarehouseItemDialogConfig } from '../types/warehouse';
import { DialogFocusManager, type FocusableDialog } from '../utils/dialog-focus-manager';

export abstract class BaseWarehouseItemDialog<T extends BaseWarehouseItem>
  implements FocusableDialog
{
  public element: HTMLElement | null = null;
  protected config: WarehouseItemDialogConfig<T>;
  protected item?: T;
  protected isDragging = false;
  protected dragOffset = { x: 0, y: 0 };
  protected isFocused = false;
  private static zIndexCounter = 1000;

  constructor(config: WarehouseItemDialogConfig<T>, item?: T) {
    this.config = config;
    this.item = item;

    // Bind event handlers
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleFocus = this.handleFocus.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleGlobalClick = this.handleGlobalClick.bind(this);
  }

  /**
   * Show the dialog
   */
  public async show(): Promise<T | null> {
    return new Promise(async (resolve) => {
      try {
        // Render the dialog content
        const content = await this.config.renderContent(this.item);

        // Create the dialog element
        this.createElement(content);

        // Setup event handlers
        this.setupEventHandlers();

        // Register with focus manager
        DialogFocusManager.getInstance().registerDialog(this);

        // Handle form submission
        this.setupFormHandling(resolve);
      } catch (error) {
        console.error('Error showing warehouse item dialog:', error);
        resolve(null);
      }
    });
  }

  /**
   * Hide and cleanup the dialog
   */
  public hide(): void {
    if (this.element) {
      this.cleanupEventHandlers();
      DialogFocusManager.getInstance().unregisterDialog(this);
      this.element.remove();
      this.element = null;
    }
  }

  /**
   * Focus management (FocusableDialog interface)
   */
  public onFocus(): void {
    this.focus();
  }

  public onBlur(): void {
    this.blur();
  }

  /**
   * Focus management
   */
  public focus(): void {
    if (this.element) {
      this.isFocused = true;
      this.element.style.zIndex = (++BaseWarehouseItemDialog.zIndexCounter).toString();

      // Focus first input
      const firstInput = this.element.querySelector('input, select, textarea') as HTMLElement;
      if (firstInput) {
        firstInput.focus();
      }
    }
  }

  public blur(): void {
    this.isFocused = false;
  }

  public isFocusedDialog(): boolean {
    return this.isFocused;
  }

  /**
   * Create the dialog element
   */
  protected createElement(content: string): void {
    const dialogHtml = `
      <div class="warehouse-item-dialog" style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: ${this.config.width || 600}px;
        height: ${this.config.height || 'auto'};
        background: #f0f0e0;
        border: 3px solid #8b4513;
        border-radius: 10px;
        box-shadow: 0 0 20px rgba(0,0,0,0.5);
        z-index: ${++BaseWarehouseItemDialog.zIndexCounter};
        font-family: 'Palatino Linotype', serif;
        max-height: 90vh;
        overflow-y: auto;
        ${this.config.resizable !== false ? 'resize: both;' : ''}
      ">
        <div class="dialog-header" style="
          background: linear-gradient(to bottom, #d4af37, #b8860b);
          color: #2c1810;
          padding: 12px 20px;
          border-radius: 7px 7px 0 0;
          cursor: move;
          font-weight: bold;
          font-size: 16px;
          border-bottom: 2px solid #8b4513;
        ">
          ${this.config.title}
          <button class="close-btn" style="
            float: right;
            background: none;
            border: none;
            color: #2c1810;
            font-size: 18px;
            cursor: pointer;
            font-weight: bold;
          ">×</button>
        </div>
        <div class="dialog-content" style="
          padding: 20px;
          color: #2c1810;
        ">
          ${content}
        </div>
      </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = dialogHtml;
    this.element = wrapper.firstElementChild as HTMLElement;
    document.body.appendChild(this.element);
  }

  /**
   * Setup event handlers
   */
  protected setupEventHandlers(): void {
    if (!this.element) return;

    // Close button
    const closeBtn = this.element.querySelector('.close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Dialog header for dragging
    const header = this.element.querySelector('.dialog-header');
    if (header) {
      header.addEventListener('mousedown', this.handleMouseDown as EventListener);
    }

    // Global event listeners
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('click', this.handleGlobalClick);

    if (this.element) {
      this.element.addEventListener('focus', this.handleFocus, true);
      this.element.addEventListener('blur', this.handleBlur, true);
    }
  }

  /**
   * Setup form handling
   */
  protected setupFormHandling(resolve: (value: T | null) => void): void {
    if (!this.element) return;

    const form = this.element.querySelector('form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        try {
          const formData = new FormData(form);

          // Validate if validator provided
          if (this.config.validateForm) {
            const validation = this.config.validateForm(formData);
            if (!validation.isValid) {
              this.showValidationErrors(validation.errors);
              return;
            }
          }

          // Handle submission
          const result = await this.config.handleSubmit(formData, this.item);
          this.hide();
          resolve(result);
        } catch (error) {
          console.error('Error submitting form:', error);
          this.showError(error instanceof Error ? error.message : 'Unknown error occurred');
        }
      });
    }

    // Cancel button
    const cancelBtn = this.element.querySelector('[data-action="cancel"]');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.hide();
        resolve(null);
      });
    }
  }

  /**
   * Show validation errors
   */
  protected showValidationErrors(errors: { field: string; message: string }[]): void {
    // Remove existing error messages
    this.element?.querySelectorAll('.field-error').forEach((el) => el.remove());

    errors.forEach((error) => {
      const field = this.element?.querySelector(`[name="${error.field}"]`);
      if (field) {
        const errorEl = document.createElement('div');
        errorEl.className = 'field-error';
        errorEl.style.color = '#dc3545';
        errorEl.style.fontSize = '12px';
        errorEl.style.marginTop = '4px';
        errorEl.textContent = error.message;
        field.parentNode?.appendChild(errorEl);
      }
    });
  }

  /**
   * Show general error
   */
  protected showError(message: string): void {
    // Implementation for showing general errors
    console.error('Dialog error:', message);
  }

  /**
   * Cleanup event handlers
   */
  protected cleanupEventHandlers(): void {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('click', this.handleGlobalClick);
  }

  /**
   * Event handlers
   */
  protected handleMouseDown(e: MouseEvent): void {
    if (e.target === this.element?.querySelector('.dialog-header')) {
      this.isDragging = true;
      const rect = this.element!.getBoundingClientRect();
      this.dragOffset.x = e.clientX - rect.left;
      this.dragOffset.y = e.clientY - rect.top;
      this.focus();
    }
  }

  protected handleMouseMove(e: MouseEvent): void {
    if (this.isDragging && this.element) {
      const x = e.clientX - this.dragOffset.x;
      const y = e.clientY - this.dragOffset.y;
      this.element.style.left = `${x}px`;
      this.element.style.top = `${y}px`;
      this.element.style.transform = 'none';
    }
  }

  protected handleMouseUp(): void {
    this.isDragging = false;
  }

  protected handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.isFocused) {
      this.hide();
    }
  }

  protected handleFocus(): void {
    this.focus();
  }

  protected handleBlur(): void {
    // Don't blur immediately, check if focus is moving within dialog
    setTimeout(() => {
      if (this.element && !this.element.contains(document.activeElement)) {
        this.blur();
      }
    }, 0);
  }

  protected handleGlobalClick(e: MouseEvent): void {
    if (this.element && !this.element.contains(e.target as Node)) {
      this.blur();
    }
  }
}
