import { PatrolEffectInstance } from '../types/entities';

export class TooltipGenerator {
  /**
   * Generates HTML content for a Patrol Effect tooltip
   * @param effect The patrol effect instance
   * @returns HTML string
   */
  static generatePatrolEffectTooltip(effect: PatrolEffectInstance): string {
    const img = effect.img || 'icons/svg/aura.svg';
    const description = effect.description || 'Sin descripción';

    let modifiersHtml = '';
    if (effect.modifiers && Object.keys(effect.modifiers).length > 0) {
      modifiersHtml =
        '<div class="tooltip-modifiers" style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 5px;">';
      for (const [key, value] of Object.entries(effect.modifiers)) {
        const valStr = (value as number) >= 0 ? `+${value}` : `${value}`;
        modifiersHtml += `<div class="tooltip-mod" style="display: flex; justify-content: space-between; font-size: 0.9em;"><span>${key}:</span> <strong>${valStr}</strong></div>`;
      }
      modifiersHtml += '</div>';
    }

    // We use inline styles to ensure it looks good without external CSS dependency for now
    // The outer div doesn't need a class for Foundry's tooltip to work, but we add one for potential custom styling
    return `
      <div class="guard-tooltip patrol-effect-tooltip" style="text-align: left; min-width: 200px; max-width: 300px;">
        <div class="tooltip-header" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 5px;">
          <img src="${img}" style="width: 32px; height: 32px; border: none; object-fit: cover;" />
          <span style="font-weight: bold; font-size: 1.1em;">${effect.label}</span>
        </div>
        <div class="tooltip-body" style="font-size: 0.9em; color: #ddd; margin-bottom: 5px;">
          ${description}
        </div>
        ${modifiersHtml}
      </div>
    `;
  }
}
