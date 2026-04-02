/**
 * DayNightDecoration - Circular decoration behind the FloatingGuardPanel
 * Shows the current day/night phase and allows turn advancement
 */

import '../styles/day-night-decoration.css';
import type { DayNightPhase } from '../types/entities';
import { GuardModal } from './GuardModal.js';

export class DayNightDecoration {
  private element: HTMLElement | null = null;
  private currentRotation: number = 0;
  private phaseAdvancedHandler: ((event: Event) => void) | null = null;
  public isAnimating: boolean = false;

  /**
   * Show the decoration inside the floating panel
   */
  public show(): void {
    // If our element exists but was removed from the DOM (panel was recreated), clean up
    if (this.element && !this.element.isConnected) {
      this.detachEventListeners();
      this.element = null;
    }

    if (this.element) {
      this.element.style.display = 'flex';
      this.updateFromPhaseManager();
      return;
    }

    // Find the floating panel to append to
    const panel = document.getElementById('guard-management-floating-panel');
    if (!panel) return;

    this.createElement(panel);
    this.attachEventListeners();
    this.updateFromPhaseManager();
  }

  /**
   * Hide the decoration
   */
  public hide(): void {
    if (this.element) {
      this.element.style.display = 'none';
    }
  }

  /**
   * Remove from DOM entirely
   */
  public destroy(): void {
    this.detachEventListeners();
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }

  /**
   * Update rotation and labels from PhaseManager state (no animation)
   */
  public updateFromPhaseManager(): void {
    // Skip if an animation is already in progress (onChange would overwrite it)
    if (this.isAnimating) return;

    const gm = (window as any).GuardManagement;
    if (!gm?.phaseManager || !this.element) return;

    const phase = gm.phaseManager.getCurrentPhase();
    const turn = gm.phaseManager.getCurrentTurn();

    // Set rotation without animation
    this.currentRotation = phase === 'day' ? 0 : 180;
    const img = this.element.querySelector('.day-night-image') as HTMLElement;
    if (img) {
      img.style.transition = 'none';
      img.style.transform = `rotate(${this.currentRotation}deg)`;
      // Force reflow then re-enable transition
      void img.offsetHeight;
      img.style.transition = 'transform 3.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
    }

    this.updateLabels(phase, turn);
  }

  private createElement(parent: HTMLElement): void {
    this.element = document.createElement('div');
    this.element.className = 'day-night-decoration';
    if (!(game as any).user?.isGM) {
      this.element.style.cursor = 'default';
    }

    this.element.innerHTML = `
      <div class="day-night-container">
        <img
          class="day-night-image"
          src="modules/guard-management/assets/DayNightPhase.webp"
          alt="Day/Night Phase"
          draggable="false"
        />
        <div class="day-night-center-label">
          <span class="phase-small-label">Fase</span>
          <span class="turn-number">1</span>
        </div>
      </div>
    `;

    // Insert before panel-container (normal flow element)
    const container = parent.querySelector('.panel-container');
    if (container) {
      parent.insertBefore(this.element, container);
    } else {
      parent.insertBefore(this.element, parent.firstChild);
    }
  }

  private attachEventListeners(): void {
    if (!this.element) return;

    // Click opens turn advancement dialog (GM only)
    this.element.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!(game as any).user?.isGM) return;
      this.showTurnAdvanceDialog();
    });

    // Listen for phase advancement to trigger rotation animation
    this.phaseAdvancedHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      this.animateRotation(detail.phase, detail.turn, detail.previousTurn);
    };
    window.addEventListener('guard-phase-advanced', this.phaseAdvancedHandler);
  }

  private detachEventListeners(): void {
    if (this.phaseAdvancedHandler) {
      window.removeEventListener('guard-phase-advanced', this.phaseAdvancedHandler);
      this.phaseAdvancedHandler = null;
    }
  }

  /**
   * Animate rotation based on turn difference.
   * Each phase = 180°. Forward = clockwise, backward = counter-clockwise.
   */
  private animateRotation(newPhase: DayNightPhase, newTurn: number, previousTurn: number): void {
    if (!this.element) return;

    const img = this.element.querySelector('.day-night-image') as HTMLElement;
    if (!img) return;

    this.isAnimating = true;

    // Each turn difference = 180° rotation. Direction based on forward/backward.
    const turnDiff = newTurn - previousTurn;

    // Play sound: forward or reverse depending on direction
    const soundFile =
      turnDiff > 0
        ? 'modules/guard-management/sound/nextday.wav'
        : 'modules/guard-management/sound/nextdayreverse.wav';
    foundry.audio.AudioHelper.play(
      {
        src: soundFile,
        volume: 0.5,
        autoplay: true,
        loop: false,
      },
      false
    );

    this.currentRotation += turnDiff * 180;
    img.style.transform = `rotate(${this.currentRotation}deg)`;

    // Fade out labels, swap text, fade back in
    const labelContainer = this.element.querySelector('.day-night-center-label') as HTMLElement;
    if (labelContainer) {
      labelContainer.style.transition = 'opacity 0.4s ease';
      labelContainer.style.opacity = '0';
      setTimeout(() => {
        this.updateLabels(newPhase, newTurn);
        labelContainer.style.opacity = '1';
      }, 400);
    }

    // Clear animation flag after animation completes (match CSS transition duration)
    setTimeout(() => {
      this.isAnimating = false;
    }, 3500);
  }

  private updateLabels(_phase: DayNightPhase, turn: number): void {
    if (!this.element) return;

    const turnNumber = this.element.querySelector('.turn-number') as HTMLElement;
    if (turnNumber) {
      turnNumber.textContent = `${turn}`;
    }
  }

  /**
   * Show dialog with options: advance, go back, or go to specific turn
   */
  private async showTurnAdvanceDialog(): Promise<void> {
    const gm = (window as any).GuardManagement;
    if (!gm?.phaseManager) return;

    const { PhaseManager } = await import('../managers/PhaseManager');
    const currentTurn = gm.phaseManager.getCurrentTurn();
    const currentPhaseLabel = currentTurn % 2 === 1 ? 'Día' : 'Noche';
    const nextTurn = currentTurn + 1;
    const nextPhaseLabel = nextTurn % 2 === 1 ? 'Día' : 'Noche';

    const body = `
      <div class="guard-modal-form" style="text-align: center;">
        <div class="guard-modal-row" style="align-items: center;">
          <label><i class="fas fa-clock"></i> Fase actual</label>
          <strong style="font-size: 1.1em;">${currentTurn} (${currentPhaseLabel})</strong>
        </div>
        <div class="guard-modal-row" style="align-items: center;">
          <label><i class="fas fa-crosshairs"></i> Ir a fase</label>
          <div style="display: flex; align-items: center; gap: 8px; justify-content: center;">
            <input type="number" id="gm-target-turn" min="1" value="${nextTurn}" style="width: 60px; text-align: center;" />
            <span id="gm-target-phase" style="font-size: 13px; color: #f3c267;">(${nextPhaseLabel})</span>
          </div>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <button type="button" class="guard-modal-btn save phase-btn" data-action="back" ${currentTurn <= 1 ? 'disabled' : ''} style="flex: 1;">
            <i class="fas fa-backward"></i> Retroceder
          </button>
          <button type="button" class="guard-modal-btn save phase-btn" data-action="advance" style="flex: 1;">
            <i class="fas fa-forward"></i> Avanzar
          </button>
          <button type="button" class="guard-modal-btn save phase-btn" data-action="goto" style="flex: 1;">
            <i class="fas fa-crosshairs"></i> Ir a fase
          </button>
        </div>
      </div>
    `;

    GuardModal.open({
      title: 'Gestión de Fase',
      icon: 'fas fa-sun',
      body,
      showFooter: false,
      onSave: async () => {},
      onRender: (bodyEl) => {
        const input = bodyEl.querySelector('#gm-target-turn') as HTMLInputElement;
        const phaseSpan = bodyEl.querySelector('#gm-target-phase') as HTMLElement;
        if (input && phaseSpan) {
          input.addEventListener('input', () => {
            const val = parseInt(input.value) || 1;
            const label = PhaseManager.phaseForTurn(val) === 'day' ? 'Día' : 'Noche';
            phaseSpan.textContent = `(${label})`;
          });
        }

        bodyEl.querySelectorAll('.phase-btn').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const action = (btn as HTMLElement).dataset.action;
            if (action === 'advance') {
              await gm.phaseManager.advanceTurn();
            } else if (action === 'back') {
              await gm.phaseManager.goBackTurn();
            } else if (action === 'goto') {
              const targetTurn = parseInt(input?.value) || currentTurn;
              if (targetTurn !== currentTurn) {
                await gm.phaseManager.goToTurn(targetTurn);
              }
            }
            const modal = btn.closest('.guard-modal');
            if (modal) modal.remove();
          });
        });
      },
    });
  }
}
