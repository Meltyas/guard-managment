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
        const val = value as number;
        const valStr = val >= 0 ? `+${val}` : `${val}`;
        
        let color = '#ffffff'; // Neutral
        if (val > 0) color = '#4ae89a'; // Green
        else if (val < 0) color = '#e84a4a'; // Red

        modifiersHtml += `<div class="tooltip-mod" style="display: flex; justify-content: space-between; font-size: 0.9em;"><span>${key}:</span> <strong style="color: ${color}">${valStr}</strong></div>`;
      }
      modifiersHtml += '</div>';
    }

    return this.buildTooltipHtml(effect.label, img, description, modifiersHtml);
  }

  /**
   * Generates HTML content for a Resource tooltip
   * @param resource The resource instance
   * @returns HTML string
   */
  static generateResourceTooltip(resource: any): string {
    const img = resource.image || 'icons/svg/item-bag.svg';
    const description = resource.description || 'Sin descripción';
    
    const quantityHtml = `
      <div class="tooltip-stat" style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 5px;">
        <div style="display: flex; justify-content: space-between; font-size: 0.9em;">
          <span>Cantidad:</span> <strong>${resource.quantity}</strong>
        </div>
      </div>
    `;

    return this.buildTooltipHtml(resource.name, img, description, quantityHtml);
  }

  /**
   * Generates HTML content for a Reputation tooltip
   * @param reputation The reputation instance
   * @returns HTML string
   */
  static generateReputationTooltip(reputation: any): string {
    const img = reputation.image || 'icons/svg/target.svg';
    const description = reputation.description || 'Sin descripción';
    
    const levelHtml = `
      <div class="tooltip-stat" style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 5px;">
        <div style="display: flex; justify-content: space-between; font-size: 0.9em;">
          <span>Estado:</span> <strong class="${reputation.statusClass || ''}">${reputation.value || 'Desconocido'}</strong>
        </div>
      </div>
    `;

    return this.buildTooltipHtml(reputation.name, img, description, levelHtml);
  }

  private static buildTooltipHtml(title: string, img: string, description: string, extraHtml: string = ''): string {
    return `
      <div class="guard-tooltip" style="text-align: left; min-width: 200px; max-width: 300px;">
        <div class="tooltip-header" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 5px;">
          <img src="${img}" style="width: 32px; height: 32px; border: none; object-fit: cover;" />
          <span style="font-weight: bold; font-size: 1.1em;">${title}</span>
        </div>
        <div class="tooltip-body" style="font-size: 0.9em; color: #ddd; margin-bottom: 5px;">
          ${description}
        </div>
        ${extraHtml}
        <div class="tooltip-footer" style="margin-top: 8px; font-size: 0.8em; color: #aaa; font-style: italic;">
          Click: Chat | Shift+Click: Editar | Click Dcho: Borrar
        </div>
      </div>
    `;
  }
}
