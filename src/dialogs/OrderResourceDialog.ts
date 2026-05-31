/**
 * OrderResourceDialog - Dialog for the GM to place a resource order.
 * Allows choosing between "comprar" / "craftear", setting quantity,
 * total cost (budget), phases until arrival, and player visibility.
 */

import type { Resource, ResourceOrder } from '../types/entities.js';
import { GuardModal } from '../ui/GuardModal.js';

export class OrderResourceDialog {
  static async open(resource: Resource, currentTurn: number): Promise<ResourceOrder | null> {
    const html = await foundry.applications.handlebars.renderTemplate(
      'modules/guard-management/templates/dialogs/order-resource.hbs',
      {
        resourceId: resource.id,
        resourceName: resource.name,
        currentTurn,
      }
    );

    return GuardModal.openAsync<ResourceOrder>({
      title: `Encargar: ${resource.name}`,
      icon: 'fas fa-box-open',
      body: html,
      width: 460,
      saveLabel: 'Confirmar Encargo',
      onSave: async (bodyEl: HTMLElement): Promise<ResourceOrder | false> => {
        const form = bodyEl.querySelector('form') as HTMLFormElement;
        if (!form) return false;

        const data = new FormData(form);

        const quantity = parseInt(data.get('quantity') as string, 10);
        const totalCost = parseFloat(data.get('totalCost') as string);
        const phasesUntilArrival = parseInt(data.get('phasesUntilArrival') as string, 10);
        const orderType = (data.get('orderType') as 'comprar' | 'craftear') ?? 'comprar';
        const showArrivalToPlayers =
          (form.querySelector('[name="showArrivalToPlayers"]') as HTMLInputElement)?.checked ??
          true;

        if (!Number.isFinite(quantity) || quantity < 1) {
          ui.notifications?.warn('La cantidad debe ser al menos 1.');
          return false;
        }
        if (!Number.isFinite(totalCost) || totalCost < 0) {
          ui.notifications?.warn('El coste no puede ser negativo.');
          return false;
        }
        if (!Number.isFinite(phasesUntilArrival) || phasesUntilArrival < 0) {
          ui.notifications?.warn('Las fases hasta llegar deben ser 0 o más.');
          return false;
        }

        const order: ResourceOrder = {
          id: foundry.utils.randomID(),
          type: orderType,
          quantity,
          totalCost,
          phasesUntilArrival,
          arrivalTurn: currentTurn + phasesUntilArrival,
          orderedTurn: currentTurn,
          showArrivalToPlayers,
          status: 'pending',
          createdAt: Date.now(),
        };

        return order;
      },
    });
  }
}
