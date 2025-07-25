/**
 * Custom Info Dialog - Movable and resizable HTML dialog without using Foundry's Dialog system
 */

import { html, TemplateResult } from 'lit-html';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import type { GuardOrganization } from '../types/entities';
import { renderTemplateToString, safeRender } from '../utils/template-renderer.js';

export class CustomInfoDialog {
  private element: HTMLElement | null = null;
  private isDragging = false;
  private isResizing = false;
  private dragOffset = { x: 0, y: 0 };
  private onEditCallback?: () => void;
  private onCloseCallback?: () => void;

  constructor() {
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  /**
   * Show the custom info dialog
   */
  public show(
    title: string,
    content: string,
    options: {
      onEdit?: () => void;
      onClose?: () => void;
      width?: number;
      height?: number;
      x?: number;
      y?: number;
    } = {}
  ): void {
    this.onEditCallback = options.onEdit;
    this.onCloseCallback = options.onClose;

    // Create the dialog element
    this.element = this.createElement(title, content, options);

    // Add to document
    document.body.appendChild(this.element);

    // Add event listeners
    this.addEventListeners();

    // Focus the dialog
    this.element.focus();

    // Center on screen if no position specified
    if (!options.x && !options.y) {
      this.centerOnScreen();
    }
  }

  /**
   * Update the content of the dialog
   */
  public updateContent(content: string): void {
    if (!this.element) return;

    const contentArea = this.element.querySelector('.custom-dialog-content');
    if (contentArea) {
      const contentTemplate = this.renderDialogContent(content);
      safeRender(contentTemplate, contentArea.parentElement as HTMLElement);
    }
  }

  /**
   * Update the title of the dialog
   */
  public updateTitle(title: string): void {
    if (!this.element) return;

    const titleElement = this.element.querySelector('.custom-dialog-title-text');
    if (titleElement) {
      titleElement.textContent = title;
    }
  }

  /**
   * Close the dialog
   */
  public close(): void {
    if (this.element) {
      this.removeEventListeners();
      this.element.remove();
      this.element = null;

      if (this.onCloseCallback) {
        this.onCloseCallback();
      }
    }
  }

  /**
   * Check if dialog is open
   */
  public isOpen(): boolean {
    return this.element !== null && document.body.contains(this.element);
  }

  /**
   * Create the dialog HTML element
   */
  private createElement(
    title: string,
    content: string,
    options: { width?: number; height?: number; x?: number; y?: number }
  ): HTMLElement {
    const dialog = document.createElement('div');
    dialog.className = 'custom-info-dialog';

    // Set initial size and position
    const width = options.width || 500;
    const height = options.height || 400;
    const x = options.x || (window.innerWidth - width) / 2;
    const y = options.y || (window.innerHeight - height) / 2;

    // Only set position and size, all other styles come from CSS
    dialog.style.left = `${x}px`;
    dialog.style.top = `${y}px`;
    dialog.style.width = `${width}px`;
    dialog.style.height = `${height}px`;

    dialog.tabIndex = -1; // Make focusable for keyboard events

    dialog.innerHTML = '';

    // Render using lit-html templates
    const dialogTemplate = this.renderDialogTemplate(title, content);
    safeRender(dialogTemplate, dialog);

    // Load external CSS styles
    this.loadExternalStyles();

    return dialog;
  }

  /**
   * Add event listeners
   */
  private addEventListeners(): void {
    if (!this.element) return;

    const header = this.element.querySelector('.custom-dialog-header') as HTMLElement;
    const editBtn = this.element.querySelector('.custom-dialog-edit') as HTMLElement;
    const closeBtn = this.element.querySelector('.custom-dialog-close') as HTMLElement;
    const resizeHandle = this.element.querySelector('.custom-dialog-resize-handle') as HTMLElement;

    // Dragging
    header.addEventListener('mousedown', this.handleMouseDown);

    // Resizing
    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.isResizing = true;
      document.addEventListener('mousemove', this.handleMouseMove);
      document.addEventListener('mouseup', this.handleMouseUp);
    });

    // Buttons
    editBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.onEditCallback) {
        this.onEditCallback();
      }
    });

    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    });

    // Keyboard
    this.element.addEventListener('keydown', this.handleKeyDown);

    // Global mouse events for dragging/resizing
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
  }

  /**
   * Handle mouse down for dragging
   */
  private handleMouseDown(e: MouseEvent): void {
    if (!this.element) return;

    // Only drag from header, not from buttons
    const target = e.target as HTMLElement;
    if (target.closest('.custom-dialog-btn')) return;

    e.preventDefault();
    this.isDragging = true;

    const rect = this.element.getBoundingClientRect();
    this.dragOffset.x = e.clientX - rect.left;
    this.dragOffset.y = e.clientY - rect.top;

    this.element.style.cursor = 'grabbing';
  }

  /**
   * Handle mouse move for dragging and resizing
   */
  private handleMouseMove(e: MouseEvent): void {
    if (!this.element) return;

    if (this.isDragging) {
      const newX = e.clientX - this.dragOffset.x;
      const newY = e.clientY - this.dragOffset.y;

      // Keep within screen bounds
      const maxX = window.innerWidth - this.element.offsetWidth;
      const maxY = window.innerHeight - this.element.offsetHeight;

      this.element.style.left = Math.max(0, Math.min(maxX, newX)) + 'px';
      this.element.style.top = Math.max(0, Math.min(maxY, newY)) + 'px';
    }

    if (this.isResizing) {
      const rect = this.element.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      const newHeight = e.clientY - rect.top;

      this.element.style.width = Math.max(300, newWidth) + 'px';
      this.element.style.height = Math.max(200, newHeight) + 'px';
    }
  }

  /**
   * Handle mouse up
   */
  private handleMouseUp(): void {
    if (this.element) {
      this.element.style.cursor = '';
    }
    this.isDragging = false;
    this.isResizing = false;
  }

  /**
   * Handle keyboard events
   */
  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.close();
    }
  }

  /**
   * Center dialog on screen
   */
  private centerOnScreen(): void {
    if (!this.element) return;

    const rect = this.element.getBoundingClientRect();
    const x = (window.innerWidth - rect.width) / 2;
    const y = (window.innerHeight - rect.height) / 2;

    this.element.style.left = Math.max(0, x) + 'px';
    this.element.style.top = Math.max(0, y) + 'px';
  }

  /**
   * Load external CSS styles for the custom dialog
   */
  private loadExternalStyles(): void {
    const styleId = 'custom-info-dialog-styles';

    // Check if styles already exist
    if (document.getElementById(styleId)) return;

    // Create link element for external CSS
    const link = document.createElement('link');
    link.id = styleId;
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = 'modules/guard-management/styles/custom-info-dialog.css';

    document.head.appendChild(link);
  }

  /**
   * Generate organization info content (same as GuardDialogManager)
   */
  public static generateOrganizationInfoContent(organization: GuardOrganization): string {
    const template = html`
      <div class="organization-info">
        <div class="info-section">
          <h3><i class="fas fa-shield-alt"></i> Información General</h3>
          <div class="info-grid">
            <div class="info-item">
              <label>Nombre:</label>
              <span>${organization.name}</span>
            </div>
            <div class="info-item">
              <label>Subtítulo:</label>
              <span>${organization.subtitle || 'Sin subtítulo'}</span>
            </div>
          </div>
        </div>

        <div class="info-section">
          <h3><i class="fas fa-chart-bar"></i> Estadísticas Base</h3>
          <div class="stats-display">
            <div class="stat-box">
              <div class="stat-value">${organization.baseStats.robustismo}</div>
              <div class="stat-label">Robustismo</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${organization.baseStats.analitica}</div>
              <div class="stat-label">Analítica</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${organization.baseStats.subterfugio}</div>
              <div class="stat-label">Subterfugio</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${organization.baseStats.elocuencia}</div>
              <div class="stat-label">Elocuencia</div>
            </div>
          </div>
        </div>

        <div class="info-section">
          <h3><i class="fas fa-users"></i> Patrullas</h3>
          <div class="patrol-count">
            <span class="count">${organization.patrols?.length || 0}</span>
            <span class="label">patrullas activas</span>
          </div>
        </div>

        <div class="info-section">
          <h3><i class="fas fa-coins"></i> Recursos</h3>
          <div class="resource-count">
            <span class="count">${organization.resources?.length || 0}</span>
            <span class="label">recursos gestionados</span>
          </div>
        </div>

        <div class="info-section">
          <h3><i class="fas fa-handshake"></i> Reputación</h3>
          <div class="reputation-count">
            <span class="count">${organization.reputation?.length || 0}</span>
            <span class="label">relaciones con facciones</span>
          </div>
        </div>
      </div>
    `;

    // Convert template to string for dialog usage
    return renderTemplateToString(template);
  }

  /**
   * Render dialog template
   */
  private renderDialogTemplate(title: string, content: string): TemplateResult {
    return html`
      ${this.renderDialogHeader(title)} ${this.renderDialogContent(content)}
      ${this.renderDialogResizeHandle()}
    `;
  }

  /**
   * Render dialog header
   */
  private renderDialogHeader(title: string): TemplateResult {
    return html`
      <div class="custom-dialog-header">
        <div class="custom-dialog-title">
          <i class="fas fa-info-circle"></i>
          <span class="custom-dialog-title-text">${title}</span>
        </div>
        <div class="custom-dialog-controls">
          <button class="custom-dialog-btn custom-dialog-edit" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="custom-dialog-btn custom-dialog-close" title="Cerrar">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render dialog content
   */
  private renderDialogContent(content: string): TemplateResult {
    return html` <div class="custom-dialog-content">${unsafeHTML(content)}</div> `;
  }

  /**
   * Render dialog resize handle
   */
  private renderDialogResizeHandle(): TemplateResult {
    return html` <div class="custom-dialog-resize-handle"></div> `;
  }
}
