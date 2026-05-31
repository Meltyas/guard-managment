/**
 * Simple Resource Manager - Manages resources using game.settings
 * Migrated from Document-based to settings-based storage
 */

import type { Resource, ResourceLogAction, ResourceLogEntry, ResourceOrder } from '../types/entities';

export class SimpleResourceManager {
  private resources: Map<string, Resource> = new Map();

  public async initialize(): Promise<void> {
    await this.loadFromSettings();
    // Listen for phase advances to process arrived orders
    window.addEventListener('guard-phase-advanced', this._onPhaseAdvanced.bind(this));
  }

  /** Handle phase advance — process any orders that have arrived */
  private _onPhaseAdvanced(event: Event): void {
    const { turn } = (event as CustomEvent).detail as { turn: number };
    this.processArrivedOrders(turn).catch((e) =>
      console.error('SimpleResourceManager | processArrivedOrders failed:', e)
    );
  }

  // ── Log helpers ────────────────────────────────────────────────────────

  private _buildLogEntry(
    action: ResourceLogAction,
    details?: string,
    quantityBefore?: number,
    quantityAfter?: number,
    turn?: number
  ): ResourceLogEntry {
    return {
      id: foundry.utils.randomID(),
      action,
      timestamp: Date.now(),
      performedBy: (game as any)?.user?.name || 'Unknown',
      details,
      quantityBefore,
      quantityAfter,
      turn,
    };
  }

  /**
   * Delete a single log entry from a resource.
   * Called by the GM via the UI delete button.
   */
  public async deleteLogEntry(resourceId: string, entryId: string): Promise<boolean> {
    const resource = this.resources.get(resourceId);
    if (!resource) return false;
    const log = (resource.log ?? []).filter((e) => e.id !== entryId);
    await this.updateResource(resourceId, { log }, /* skipLog */ true);
    return true;
  }

  /** Cancel and remove a pending order. Refunds budget if order had a cost. */
  public async deleteOrder(resourceId: string, orderId: string): Promise<boolean> {
    const resource = this.resources.get(resourceId);
    if (!resource) return false;
    const order = (resource.orders ?? []).find((o) => o.id === orderId);
    if (!order || order.status !== 'pending') return false;
    const orders = (resource.orders ?? []).filter((o) => o.id !== orderId);

    // Refund budget if the order had a cost
    if (order.totalCost > 0) {
      const gm = (window as any).GuardManagement;
      const fm = gm?.financeManager;
      if (fm) {
        const currentBudget = fm.getTotalBudget() as number;
        await fm.setTotalBudget(currentBudget + order.totalCost);
      }
    }

    const costNote = order.totalCost > 0 ? `, reembolso: ${order.totalCost}` : '';
    const logEntry = this._buildLogEntry(
      'order_cancelled',
      `Encargo cancelado: +${order.quantity} uds. (${order.type}), turno llegada ${order.arrivalTurn}${costNote}`
    );
    await this.updateResource(
      resourceId,
      { orders, log: [...(resource.log ?? []), logEntry] },
      /* skipLog */ true
    );
    return true;
  }

  // ── Order processing ────────────────────────────────────────────────────

  /**
   * Process orders whose arrivalTurn <= currentTurn.
   * Adds arrived quantity to the resource and notifies via chat.
   */
  public async processArrivedOrders(currentTurn: number): Promise<void> {
    let anyArrived = false;

    for (const resource of this.resources.values()) {
      if (!resource.orders?.length) continue;

      const arrivedOrders = resource.orders.filter(
        (o) => o.status === 'pending' && o.arrivalTurn <= currentTurn
      );
      if (!arrivedOrders.length) continue;

      const totalArrived = arrivedOrders.reduce((sum, o) => sum + o.quantity, 0);
      const updatedOrders = resource.orders.map((o) =>
        arrivedOrders.find((ao) => ao.id === o.id) ? { ...o, status: 'arrived' as const } : o
      );

      // Build log entries for each arrived order
      const newLogEntries: ResourceLogEntry[] = arrivedOrders.map((order) =>
        this._buildLogEntry(
          'order_arrived',
          `Encargo llegado: +${order.quantity} uds. (${order.type})`,
          resource.quantity,
          resource.quantity + order.quantity,
          currentTurn
        )
      );

      await this.updateResource(
        resource.id,
        {
          quantity: resource.quantity + totalArrived,
          orders: updatedOrders,
          log: [...(resource.log ?? []), ...newLogEntries],
        },
        /* skipLog */ true
      );

      // Notify via chat for each arrived order
      const ChatMessage = (CONFIG as any).ChatMessage?.documentClass;
      if (ChatMessage) {
        for (const order of arrivedOrders) {
          const whisper = order.showArrivalToPlayers
            ? []
            : [(game as any)?.user?.id].filter(Boolean);
          await ChatMessage.create({
            content: `<div style="padding:8px;border-left:3px solid #f3c267;">
              <strong>📦 Encargo llegado</strong><br/>
              <strong>${resource.name}</strong>: +${order.quantity} unidades
              (${order.type})<br/>
              <small style="color:#aaa;">Turno ${currentTurn}</small>
            </div>`,
            whisper,
          });
        }
      }

      anyArrived = true;
    }

    if (anyArrived) {
      window.dispatchEvent(new CustomEvent('guard-resources-updated'));
    }
  }

  /**
   * Create an order for a resource.
   * Deducts budget immediately via financeManager (if provided).
   * If phasesUntilArrival === 0, adds quantity to resource right away.
   */
  public async createOrder(
    resourceId: string,
    order: ResourceOrder,
    financeManager?: any
  ): Promise<Resource | null> {
    const resource = this.resources.get(resourceId);
    if (!resource) return null;

    // Deduct budget immediately if cost > 0
    if (order.totalCost > 0 && financeManager) {
      const typeLabel = order.type === 'comprar' ? 'Compra' : 'Crafteo';
      await financeManager.addExpense({
        name: `${typeLabel}: ${resource.name} ×${order.quantity}`,
        description: `Encargo de ${order.quantity} unidades de "${resource.name}" (${order.type}). Llegada prevista en turno ${order.arrivalTurn}.`,
        amount: order.totalCost,
        type: 'specific',
        illegal: false,
        processed: false,
      });
    }

    const costStr = order.totalCost > 0 ? `, coste: ${order.totalCost}` : '';

    // If arrival is immediate, mark arrived and add quantity now
    if (order.phasesUntilArrival === 0) {
      const arrivedOrder: ResourceOrder = { ...order, status: 'arrived' };
      const logEntry = this._buildLogEntry(
        'order_arrived',
        `Encargo inmediato: +${order.quantity} uds. (${order.type}${costStr})`,
        resource.quantity,
        resource.quantity + order.quantity,
        order.orderedTurn
      );
      return this.updateResource(
        resourceId,
        {
          quantity: resource.quantity + order.quantity,
          orders: [...(resource.orders ?? []), arrivedOrder],
          log: [...(resource.log ?? []), logEntry],
        },
        /* skipLog */ true
      );
    }

    // Register as pending — log the placement
    const logEntry = this._buildLogEntry(
      'order_placed',
      `Encargo registrado: +${order.quantity} uds. (${order.type}${costStr}), llega turno ${order.arrivalTurn}`,
      undefined,
      undefined,
      order.orderedTurn
    );
    const result = await this.updateResource(
      resourceId,
      {
        orders: [...(resource.orders ?? []), order],
        log: [...(resource.log ?? []), logEntry],
      },
      /* skipLog */ true
    );

    // Create a phase calendar event at the arrival turn
    this._createArrivalCalendarEvent(resource.name, order).catch((e) =>
      console.warn('SimpleResourceManager | Could not create calendar event:', e)
    );

    return result;
  }

  /** Create a PhaseEvent in the calendar for when the order arrives. */
  private async _createArrivalCalendarEvent(
    resourceName: string,
    order: ResourceOrder
  ): Promise<void> {
    const gm = (window as any).GuardManagement;
    const phaseEventManager = gm?.phaseEventManager;
    if (!phaseEventManager) return;

    const typeLabel = order.type === 'comprar' ? 'Compra' : 'Crafteo';
    const visibility = order.showArrivalToPlayers ? 'all' : 'gm';

    await phaseEventManager.createEvent({
      title: `📦 ${resourceName} ×${order.quantity} llega`,
      description: `${typeLabel} de ${order.quantity} uds. de <strong>${resourceName}</strong> llega al almacén.${order.totalCost > 0 ? ` Coste pagado: ${order.totalCost} presupuesto.` : ''}`,
      triggerTurn: order.arrivalTurn,
      category: 'economico',
      visibility,
      notifyChat: true,
      linkedId: order.id,
    });
  }

  // ── Settings persistence ─────────────────────────────────────────────────

  /**
   * Load resources from world settings (public for onChange callback)
   */
  public async loadFromSettings(): Promise<void> {
    try {
      const resources = game?.settings?.get('guard-management', 'resources') as Resource[] | null;
      if (resources && Array.isArray(resources)) {
        this.resources.clear();
        for (const r of resources) {
          this.resources.set(r.id, r);
        }
        console.log(`SimpleResourceManager | Loaded ${resources.length} resources from settings`);
      }
    } catch (e) {
      console.warn('SimpleResourceManager | loadFromSettings failed:', e);
    }
  }

  /**
   * Save resources to world settings
   */
  private async _saveToSettingsAsync(): Promise<void> {
    try {
      // Don't save if game is not ready yet
      if (!game?.ready) {
        console.log('SimpleResourceManager | Skipping save - game not ready yet');
        return;
      }

      const data = Array.from(this.resources.values());
      console.log('💾 SimpleResourceManager | Saving to settings...', {
        user: game?.user?.name,
        isGM: game?.user?.isGM,
        count: data.length,
      });
      await game?.settings?.set('guard-management', 'resources', data);
      console.log(`SimpleResourceManager | Saved ${data.length} resources to settings`);
    } catch (error) {
      console.error('SimpleResourceManager | Error saving resources:', error);
    }
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  /**
   * Create a new resource
   */
  public async createResource(data: {
    name: string;
    description: string;
    quantity: number;
    image?: string;
    organizationId: string;
  }): Promise<Resource> {
    const id = foundry.utils.randomID();

    const logEntry = this._buildLogEntry(
      'resource_created',
      `Recurso creado con ${data.quantity} uds. iniciales`
    );

    const resource: Resource = {
      id,
      name: data.name,
      description: data.description,
      quantity: data.quantity,
      image: data.image || '',
      organizationId: data.organizationId,
      version: 1,
      log: [logEntry],
    };

    this.resources.set(id, resource);
    await this._saveToSettingsAsync();

    return resource;
  }

  /**
   * Get a resource by ID
   */
  public getResource(id: string): Resource | null {
    return this.resources.get(id) || null;
  }

  /**
   * Get all resources
   */
  public getAllResources(): Resource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Get resources for an organization
   */
  public getResourcesByOrganization(organizationId: string): Resource[] {
    return this.getAllResources().filter((r) => r.organizationId === organizationId);
  }

  /**
   * Update an existing resource.
   * @param skipLog - if true, skip automatic quantity-change log (caller has already built entries)
   */
  public async updateResource(
    id: string,
    updates: Partial<Resource>,
    skipLog = false
  ): Promise<Resource | null> {
    const resource = this.resources.get(id);
    if (!resource) return null;

    // Auto-log quantity changes when they come from external callers (edit dialog, etc.)
    let autoLogEntries: ResourceLogEntry[] = [];
    if (!skipLog && updates.quantity !== undefined && updates.quantity !== resource.quantity) {
      const delta = updates.quantity - resource.quantity;
      const action: ResourceLogAction = delta > 0 ? 'quantity_added' : 'quantity_removed';
      autoLogEntries = [
        this._buildLogEntry(
          action,
          `Cantidad ajustada manualmente: ${delta > 0 ? '+' : ''}${delta} uds.`,
          resource.quantity,
          updates.quantity
        ),
      ];
    }

    // Determine final log:
    // - skipLog=true + caller provides updates.log → use it directly (caller manages)
    // - skipLog=false + caller provides updates.log → merge updates.log + auto entries
    // - skipLog=false + no updates.log → existing log + auto entries
    let finalLog: ResourceLogEntry[];
    if (skipLog && updates.log !== undefined) {
      finalLog = updates.log;
    } else {
      const base = updates.log !== undefined ? updates.log : (resource.log ?? []);
      finalLog = [...base, ...autoLogEntries];
    }

    const updated: Resource = {
      ...resource,
      ...updates,
      id: resource.id,
      version: resource.version + 1,
      log: finalLog,
    };

    this.resources.set(id, updated);
    await this._saveToSettingsAsync();

    return updated;
  }

  /**
   * Delete a resource
   */
  public async deleteResource(id: string): Promise<boolean> {
    const deleted = this.resources.delete(id);
    if (deleted) {
      await this._saveToSettingsAsync();
    }
    return deleted;
  }
}
