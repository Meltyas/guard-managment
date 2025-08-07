/**
 * Centralized Reputation Event Handler
 * Eliminates code duplication across dialogs for reputation management
 * Follows exact same pattern as ResourceEventHandler for feature parity
 */

import { AddOrEditReputationDialog } from '../dialogs/AddOrEditReputationDialog.js';

export interface ReputationEventContext {
  organizationId?: string;
  onReputationAdded?: (reputation: any) => void;
  onReputationEdited?: (reputation: any) => void;
  onReputationRemoved?: (reputationId: string) => void;
  refreshUI?: () => void;
}

export class ReputationEventHandler {
  /**
   * Setup all reputation event listeners for a dialog/component
   */
  static setup(context: ReputationEventContext): void {
    console.log('🔧 ReputationEventHandler.setup() called with context:', context);

    // Expose debug methods globally
    this.exposeGlobalMethods();

    // SIMPLE APPROACH: Remove all existing handlers first
    this.removeAllHandlers();

    // Setup add reputation buttons
    const addReputationBtns = document.querySelectorAll(
      '.add-reputation-btn'
    ) as NodeListOf<HTMLButtonElement>;
    console.log('📍 Found add reputation buttons:', addReputationBtns.length);
    addReputationBtns.forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await this.handleAdd(context);
      });
    });

    // Setup edit reputation buttons
    const editReputationBtns = document.querySelectorAll(
      '.edit-reputation-btn'
    ) as NodeListOf<HTMLButtonElement>;
    editReputationBtns.forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const reputationId = btn.getAttribute('data-reputation-id');
        if (reputationId) {
          await this.handleEdit(context, reputationId);
        }
      });
    });

    // Setup remove reputation buttons
    const removeReputationBtns = document.querySelectorAll(
      '.remove-reputation-btn'
    ) as NodeListOf<HTMLButtonElement>;
    removeReputationBtns.forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const reputationId = btn.getAttribute('data-reputation-id');
        if (reputationId) {
          await this.handleRemove(context, reputationId);
        }
      });
    });

    // Setup delete reputation buttons (alternative class name)
    const deleteReputationBtns = document.querySelectorAll(
      '.delete-reputation-btn'
    ) as NodeListOf<HTMLButtonElement>;
    deleteReputationBtns.forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const reputationId = btn.getAttribute('data-reputation-id');
        if (reputationId) {
          await this.handleRemove(context, reputationId);
        }
      });
    });

    // Setup send to chat buttons
    const sendToChatBtns = document.querySelectorAll(
      '.send-to-chat-btn'
    ) as NodeListOf<HTMLButtonElement>;
    sendToChatBtns.forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const reputationId = btn.getAttribute('data-reputation-id');
        if (reputationId) {
          await this.handleSendToChat(context, reputationId);
        }
      });
    });

    // Setup drag and drop
    this.setupDragAndDrop(context);

    console.log('✅ ReputationEventHandler.setup() completed');
  }

  /**
   * Force remove all handlers by cloning elements (nuclear option)
   */
  static removeAllHandlers(): void {
    document
      .querySelectorAll(
        '.add-reputation-btn, .edit-reputation-btn, .remove-reputation-btn, .delete-reputation-btn, .send-to-chat-btn'
      )
      .forEach((btn) => {
        const clonedBtn = btn.cloneNode(true);
        btn.parentNode?.replaceChild(clonedBtn, btn);
      });
  }

  /**
   * Setup with retry mechanism for DialogV2 compatibility
   */
  static setupWithRetry(context: ReputationEventContext, retries: number = 5): void {
    const attempt = () => {
      const addBtns = document.querySelectorAll('.add-reputation-btn');
      const editBtns = document.querySelectorAll('.edit-reputation-btn');
      const removeBtns = document.querySelectorAll('.remove-reputation-btn');
      const deleteBtns = document.querySelectorAll('.delete-reputation-btn');
      const chatBtns = document.querySelectorAll('.send-to-chat-btn');
      const dropZones = document.querySelectorAll('.drop-zone');

      if (
        addBtns.length > 0 ||
        editBtns.length > 0 ||
        removeBtns.length > 0 ||
        deleteBtns.length > 0 ||
        chatBtns.length > 0 ||
        dropZones.length > 0
      ) {
        this.setup(context);
      } else if (retries > 0) {
        setTimeout(() => this.setupWithRetry(context, retries - 1), 200);
      } else {
        console.error(
          'ReputationEventHandler | Could not find reputation elements after multiple retries'
        );
      }
    };

    attempt();
  }

  /**
   * Handle adding a new reputation
   */
  private static async handleAdd(context: ReputationEventContext): Promise<void> {
    try {
      const organizationId = context.organizationId || 'temp-org-id';
      const newReputation = await AddOrEditReputationDialog.create(organizationId);

      if (newReputation) {
        if (ui?.notifications) {
          ui.notifications.info(`Reputación "${newReputation.name}" agregada`);
        }

        context.onReputationAdded?.(newReputation);
        context.refreshUI?.();
      }
    } catch (error) {
      console.error('ReputationEventHandler | Error adding reputation:', error);
      if (ui?.notifications) {
        ui.notifications.error('Error al agregar reputación');
      }
    }
  }

  /**
   * Handle editing an existing reputation
   */
  private static async handleEdit(
    context: ReputationEventContext,
    reputationId: string
  ): Promise<void> {
    try {
      // Get the reputation data
      const gm = (window as any).GuardManagement;
      let reputationData = null;

      if (gm?.documentManager) {
        const reputation = gm.documentManager
          .getGuardReputations()
          ?.find((r: any) => r.id === reputationId);
        if (reputation) {
          reputationData = reputation;
        }
      }

      if (!reputationData) {
        if (ui?.notifications) {
          ui.notifications.error('No se pudo encontrar la reputación');
        }
        return;
      }

      const updatedReputation = await AddOrEditReputationDialog.edit(reputationData);

      if (updatedReputation) {
        if (ui?.notifications) {
          ui.notifications.info(`Reputación "${updatedReputation.name}" actualizada`);
        }

        context.onReputationEdited?.(updatedReputation);
        context.refreshUI?.();
      }
    } catch (error) {
      console.error('ReputationEventHandler | Error editing reputation:', error);
      if (ui?.notifications) {
        ui.notifications.error('Error al editar reputación');
      }
    }
  }

  /**
   * Handle removing a reputation
   */
  private static async handleRemove(
    context: ReputationEventContext,
    reputationId: string
  ): Promise<void> {
    try {
      // Simple confirmation dialog
      const confirmed = await Dialog.confirm({
        title: 'Confirmar eliminación',
        content: '<p>¿Estás seguro de que quieres eliminar esta reputación?</p>',
        yes: () => true,
        no: () => false,
        defaultYes: false,
      });

      if (confirmed) {
        context.onReputationRemoved?.(reputationId);
        context.refreshUI?.();

        if (ui?.notifications) {
          ui.notifications.info('Reputación eliminada');
        }
      }
    } catch (error) {
      console.error('ReputationEventHandler | Error removing reputation:', error);
      if (ui?.notifications) {
        ui.notifications.error('Error al eliminar reputación');
      }
    }
  }

  /**
   * Handle sending reputation to chat
   */
  private static async handleSendToChat(
    context: ReputationEventContext,
    reputationId: string
  ): Promise<void> {
    try {
      // Import ReputationTemplate dynamically to avoid circular dependencies
      const { ReputationTemplate } = await import('../ui/ReputationTemplate.js');

      await ReputationTemplate.sendReputationToChat(reputationId);

      if (ui?.notifications) {
        ui.notifications.info('Reputación enviada al chat');
      }

      // Trigger refresh if needed
      context.refreshUI?.();
    } catch (error) {
      console.error('ReputationEventHandler | Error sending reputation to chat:', error);
      if (ui?.notifications) {
        ui.notifications.error('Error al enviar reputación al chat');
      }
    }
  }

  /**
   * Setup drag and drop functionality
   */
  private static setupDragAndDrop(context: ReputationEventContext): void {
    console.log('🔧 Setting up drag and drop for reputations...');

    // Setup draggable reputation items - try multiple selectors
    const selectors = [
      '.reputation-item[data-reputation-id]',
      '.reputation-item',
      '[data-reputation-id]',
    ];

    let totalFound = 0;
    selectors.forEach((selector) => {
      const items = document.querySelectorAll(selector);
      console.log(`📍 Found items with selector "${selector}":`, items.length);
      totalFound += items.length;
    });

    // Use the most specific selector that actually finds elements
    const reputationItems = document.querySelectorAll('.reputation-item');
    console.log('📍 Final count - reputation items for drag:', reputationItems.length);

    if (reputationItems.length === 0) {
      console.warn('⚠️ No reputation items found to make draggable');
      console.log('🔍 Available elements in DOM:');
      console.log('- .reputation-item:', document.querySelectorAll('.reputation-item').length);
      console.log(
        '- [data-reputation-id]:',
        document.querySelectorAll('[data-reputation-id]').length
      );
      console.log('- .reputations-list:', document.querySelectorAll('.reputations-list').length);
    }

    reputationItems.forEach((item, index) => {
      const element = item as HTMLElement;
      const reputationId = element.getAttribute('data-reputation-id') || `temp-${index}`;
      console.log(`🔧 Setting up drag for item ${index + 1}:`, {
        reputationId,
        hasDataAttribute: element.hasAttribute('data-reputation-id'),
        classes: element.className,
      });

      // Force draggable regardless of whether it has data-reputation-id
      element.draggable = true;
      element.style.cursor = 'grab';
      // Fix common CSS issues that prevent dragging
      element.style.userSelect = 'none';
      element.style.webkitUserSelect = 'none';
      element.style.setProperty('-moz-user-select', 'none');
      element.style.setProperty('-ms-user-select', 'none');
      element.style.pointerEvents = 'auto';
      element.setAttribute('data-has-drag-listeners', 'true');
      console.log('✅ Set draggable=true for item:', index + 1);

      element.addEventListener('dragstart', (event) => {
        console.log('🚀 Drag started for item:', index + 1, reputationId);
        element.style.cursor = 'grabbing';
        element.classList.add('dragging');

        // Emit custom event to notify other components about drag start
        document.dispatchEvent(
          new CustomEvent('guard-reputation-drag-start', {
            detail: { type: 'reputation', reputationId },
          })
        );

        if (event.dataTransfer) {
          // Try to get real data, but provide fallback
          const gm = (window as any).GuardManagement;
          let reputationData = null;

          if (gm?.documentManager && reputationId.startsWith('temp-') === false) {
            const reputation = gm.documentManager
              .getGuardReputations()
              ?.find((r: any) => r.id === reputationId);
            if (reputation) {
              reputationData = reputation;
            }
          }

          // Fallback data for testing
          if (!reputationData) {
            reputationData = {
              id: reputationId,
              name: `Test Reputation ${index + 1}`,
              level: 0,
              description: 'Test reputation for drag & drop',
            };
            console.log('🔄 Using fallback data for drag test');
          }

          event.dataTransfer.setData(
            'text/plain',
            JSON.stringify({
              type: 'reputation',
              reputation: reputationData,
            })
          );
          element.classList.add('dragging');
          console.log('✅ Drag data set for item:', reputationData.name);
        }
      });

      element.addEventListener('dragend', () => {
        console.log('🏁 Drag ended for item:', index + 1, reputationId);
        element.style.cursor = 'grab';
        element.classList.remove('dragging');

        // Emit custom event to notify other components about drag end
        document.dispatchEvent(
          new CustomEvent('guard-reputation-drag-end', {
            detail: { type: 'reputation', reputationId },
          })
        );
      });
    });

    // Setup drop zones
    const dropZones = document.querySelectorAll('.drop-zone');
    console.log('📍 Found drop zones:', dropZones.length);

    dropZones.forEach((zone) => {
      const element = zone as HTMLElement;

      element.addEventListener('dragover', (event) => {
        event.preventDefault();
        element.classList.add('drag-over');
      });

      element.addEventListener('dragleave', () => {
        element.classList.remove('drag-over');
      });

      element.addEventListener('drop', async (event) => {
        event.preventDefault();
        element.classList.remove('drag-over');
        console.log('💧 Drop event triggered');

        try {
          const data = event.dataTransfer?.getData('text/plain');
          if (data) {
            const draggedData = JSON.parse(data);
            console.log('📦 Dropped data:', draggedData);

            if (draggedData.type === 'reputation') {
              context.onReputationAdded?.(draggedData.reputation);
              context.refreshUI?.();

              if (ui?.notifications) {
                ui.notifications.info('Reputación agregada');
              }
            }
          }
        } catch (error) {
          console.error('ReputationEventHandler | Error handling drop:', error);
        }
      });
    });

    console.log('✅ Drag and drop setup completed');
  }

  /**
   * Test method to create temporary draggable elements for testing
   */
  static createTestDraggableElements(): void {
    console.log('🧪 Creating test draggable elements for debugging...');

    // Find reputations section or create one
    let reputationsSection = document.querySelector('.reputations-list');
    if (!reputationsSection) {
      reputationsSection = document.querySelector('.reputations-info-section');
      if (!reputationsSection) {
        console.log('📍 Creating test reputations section...');
        const testSection = document.createElement('div');
        testSection.className = 'reputations-info-section';
        testSection.innerHTML = `
          <h4>Test Reputations (for drag & drop testing)</h4>
          <div class="reputations-list"></div>
        `;
        document.body.appendChild(testSection);
        reputationsSection = testSection.querySelector('.reputations-list');
      }
    }

    if (reputationsSection) {
      // Create 3 test reputation items
      for (let i = 1; i <= 3; i++) {
        const testItem = document.createElement('div');
        testItem.className = 'reputation-item';
        testItem.setAttribute('data-reputation-id', `test-rep-${i}`);
        testItem.style.cssText = `
          padding: 10px;
          margin: 5px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid #555;
          border-radius: 4px;
          cursor: grab;
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        `;
        testItem.innerHTML = `
          <div class="reputation-info">
            <span class="reputation-name">Test Reputation ${i}</span>
            <span class="reputation-level">Level: Neutral</span>
            <span class="reputation-description">This is a test reputation for drag & drop testing</span>
          </div>
        `;
        reputationsSection.appendChild(testItem);
      }

      // Create a test drop zone
      const testDropZone = document.createElement('div');
      testDropZone.className = 'drop-zone';
      testDropZone.style.cssText = `
        border: 2px dashed #666;
        border-radius: 4px;
        padding: 20px;
        margin: 10px;
        text-align: center;
        color: #999;
        background: rgba(0, 0, 0, 0.1);
      `;
      testDropZone.textContent = 'Drop reputation items here (TEST ZONE)';
      reputationsSection.appendChild(testDropZone);

      console.log('✅ Test elements created. Now setting up drag & drop...');

      // Set up drag & drop for test elements
      this.setup({
        organizationId: 'test-org',
        onReputationAdded: (rep) => console.log('✅ Test drop successful:', rep),
        refreshUI: () => console.log('🔄 Test refresh called'),
      });
    }
  }

  /**
   * Diagnose drag and drop issues with detailed element inspection
   */
  static diagnoseDragAndDrop(): void {
    console.log('🔍 DIAGNOSING DRAG & DROP ISSUES...');

    // Check all reputation items
    const reputationItems = document.querySelectorAll('.reputation-item');
    console.log(`📊 Found ${reputationItems.length} reputation items`);

    reputationItems.forEach((item, index) => {
      const element = item as HTMLElement;
      console.log(`\n🔸 Element ${index + 1}:`);
      console.log('  - draggable attribute:', element.getAttribute('draggable'));
      console.log('  - draggable property:', element.draggable);
      console.log('  - classes:', element.className);
      console.log('  - computed style cursor:', getComputedStyle(element).cursor);
      console.log('  - computed style user-select:', getComputedStyle(element).userSelect);
      console.log('  - computed style pointer-events:', getComputedStyle(element).pointerEvents);
      console.log('  - computed style position:', getComputedStyle(element).position);
      console.log('  - has event listeners:', element.hasAttribute('data-has-drag-listeners'));
      console.log('  - innerHTML preview:', element.innerHTML.substring(0, 100) + '...');

      // Check if element is actually interactive
      console.log('  - offsetParent:', element.offsetParent ? 'visible' : 'hidden');
      console.log('  - dimensions:', {
        width: element.offsetWidth,
        height: element.offsetHeight,
        top: element.offsetTop,
        left: element.offsetLeft,
      });

      // Check parent hierarchy
      let parent = element.parentElement;
      let parentChain = [];
      while (parent && parentChain.length < 5) {
        parentChain.push({
          tag: parent.tagName,
          classes: parent.className,
          position: getComputedStyle(parent).position,
          overflow: getComputedStyle(parent).overflow,
        });
        parent = parent.parentElement;
      }
      console.log('  - parent chain:', parentChain);
    });

    // Test manual drag setup on first element
    if (reputationItems.length > 0) {
      const firstElement = reputationItems[0] as HTMLElement;
      console.log('\n🧪 TESTING MANUAL DRAG SETUP ON FIRST ELEMENT...');

      // Force drag properties
      firstElement.draggable = true;
      firstElement.style.cursor = 'grab';
      firstElement.style.userSelect = 'none';
      firstElement.setAttribute('data-has-drag-listeners', 'true');

      // Add test event listeners
      firstElement.addEventListener('mousedown', () => {
        console.log('🖱️ Mouse down on test element');
      });

      firstElement.addEventListener('dragstart', (e) => {
        console.log('🚀 DRAGSTART triggered on test element!');
        console.log('  - event:', e);
        console.log('  - dataTransfer:', e.dataTransfer);
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', 'test-drag-data');
          console.log('✅ Data set successfully');
        }
      });

      firstElement.addEventListener('drag', () => {
        console.log('🔄 DRAG event on test element');
      });

      firstElement.addEventListener('dragend', () => {
        console.log('🏁 DRAGEND event on test element');
      });

      console.log('✅ Manual test setup complete. Try dragging the first element now.');
    }

    console.log('\n📋 DIAGNOSIS COMPLETE');
  }

  /**
   * Force drag and drop on existing elements with aggressive setup
   */
  static forceDragAndDropSetup(): void {
    console.log('💪 FORCING DRAG & DROP SETUP WITH AGGRESSIVE CONFIGURATION...');

    const reputationItems = document.querySelectorAll('.reputation-item');
    console.log(`📍 Found ${reputationItems.length} items to force setup`);

    reputationItems.forEach((item, index) => {
      const element = item as HTMLElement;
      console.log(`🔧 Forcing setup on element ${index + 1}...`);

      // Remove any existing event listeners by cloning
      const newElement = element.cloneNode(true) as HTMLElement;
      element.parentNode?.replaceChild(newElement, element);

      // Aggressive drag setup
      newElement.draggable = true;
      newElement.setAttribute('draggable', 'true');

      // Force all CSS properties that might interfere
      const forceStyle = `
        cursor: grab !important;
        user-select: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        pointer-events: auto !important;
        position: relative !important;
        z-index: 1 !important;
      `;
      newElement.style.cssText += forceStyle;

      // Add visual indicator
      newElement.style.border = '2px solid #007bff';
      newElement.style.boxShadow = '0 0 5px rgba(0, 123, 255, 0.5)';
      newElement.title = 'DRAG TEST ELEMENT - This should be draggable';

      // Add simple event listeners with detailed logging
      newElement.addEventListener('mousedown', (e) => {
        console.log(`🖱️ MOUSEDOWN on element ${index + 1}:`, {
          button: e.button,
          clientX: e.clientX,
          clientY: e.clientY,
          target: e.target,
        });
      });

      newElement.addEventListener('dragstart', (e) => {
        console.log(`🚀 DRAGSTART SUCCESS on element ${index + 1}!`);
        console.log('Event details:', e);

        if (e.dataTransfer) {
          e.dataTransfer.setData(
            'text/plain',
            JSON.stringify({
              type: 'reputation-test',
              id: `force-test-${index}`,
              name: `Force Test Item ${index + 1}`,
            })
          );
          e.dataTransfer.effectAllowed = 'move';
          newElement.style.opacity = '0.5';
          console.log('✅ Data transfer configured');
        }
      });

      newElement.addEventListener('drag', () => {
        console.log(`🔄 DRAG event on element ${index + 1}`);
      });

      newElement.addEventListener('dragend', () => {
        console.log(`🏁 DRAGEND on element ${index + 1}`);
        newElement.style.opacity = '1';
      });

      // Test if the element is actually draggable by checking the property
      setTimeout(() => {
        console.log(`🔍 Final check for element ${index + 1}:`, {
          draggable: newElement.draggable,
          draggableAttr: newElement.getAttribute('draggable'),
          cursor: getComputedStyle(newElement).cursor,
          userSelect: getComputedStyle(newElement).userSelect,
          pointerEvents: getComputedStyle(newElement).pointerEvents,
        });
      }, 100);
    });

    // Create a super obvious drop zone
    const existingDropZone = document.querySelector('.drop-zone');
    if (!existingDropZone) {
      const forceDropZone = document.createElement('div');
      forceDropZone.className = 'drop-zone force-drop-zone';
      forceDropZone.style.cssText = `
        position: fixed;
        top: 50px;
        right: 50px;
        width: 200px;
        height: 100px;
        border: 3px dashed #ff6b6b;
        background: rgba(255, 107, 107, 0.1);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ff6b6b;
        font-weight: bold;
        z-index: 9999;
        font-size: 14px;
        text-align: center;
      `;
      forceDropZone.textContent = 'FORCE DROP ZONE\n(drag here to test)';
      document.body.appendChild(forceDropZone);

      // Setup drop events
      forceDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        forceDropZone.style.background = 'rgba(255, 107, 107, 0.3)';
        console.log('🎯 Dragover on force drop zone');
      });

      forceDropZone.addEventListener('dragleave', () => {
        forceDropZone.style.background = 'rgba(255, 107, 107, 0.1)';
        console.log('🚫 Dragleave from force drop zone');
      });

      forceDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        forceDropZone.style.background = 'rgba(255, 107, 107, 0.1)';
        console.log('💥 DROP SUCCESS on force drop zone!');

        const data = e.dataTransfer?.getData('text/plain');
        if (data) {
          console.log('📦 Dropped data:', JSON.parse(data));
          forceDropZone.textContent = 'DROP SUCCESS! ✅';
          setTimeout(() => {
            forceDropZone.textContent = 'FORCE DROP ZONE\n(drag here to test)';
          }, 2000);
        }
      });
    }

    console.log(
      '💪 FORCE SETUP COMPLETE - Elements should now be draggable with visual indicators'
    );
    console.log('🎯 Look for elements with blue borders - they should be draggable');
    console.log('🎯 Drop zone is positioned at top-right corner');
  }

  /**
   * Global access method for debugging from browser console
   */
  static exposeGlobalMethods(): void {
    // Expose methods to window for console access
    (window as any).RepDebug = {
      diagnose: () => this.diagnoseDragAndDrop(),
      force: () => this.forceDragAndDropSetup(),
      test: () => this.createTestDraggableElements(),
      setup: (context?: any) => this.setup(context || { organizationId: 'debug' }),

      // NEW: Simple diagnostics
      simple: () => this.simpleDiagnostics(),
      check: () => this.checkElements(),
      fix: () => this.fixElements(),
    };

    console.log('🌐 Debug methods exposed to window.RepDebug:');
    console.log('  - RepDebug.diagnose() - Diagnose current elements');
    console.log('  - RepDebug.force() - Force aggressive drag setup');
    console.log('  - RepDebug.test() - Create test elements');
    console.log('  - RepDebug.setup() - Run normal setup');
    console.log('  - RepDebug.simple() - Simple diagnostics');
    console.log('  - RepDebug.check() - Check elements');
    console.log('  - RepDebug.fix() - Fix elements');
  }

  /**
   * Clean up event listeners (call when dialog closes)
   */
  static cleanup(): void {
    // Remove all our custom attributes so elements can be re-setup
    document.querySelectorAll('[data-reputation-handler-setup]').forEach((el) => {
      el.removeAttribute('data-reputation-handler-setup');
    });

    document.querySelectorAll('[data-reputation-drop-setup]').forEach((el) => {
      el.removeAttribute('data-reputation-drop-setup');
    });

    // Remove dragging classes
    document.querySelectorAll('.reputation-item.dragging').forEach((el) => {
      el.classList.remove('dragging');
    });

    document.querySelectorAll('.drop-zone.drag-over').forEach((el) => {
      el.classList.remove('drag-over');
    });
  }

  /**
   * Simple diagnostics - check basic things
   */
  static simpleDiagnostics(): void {
    console.log('=== 🔍 SIMPLE REPUTATION DRAG DIAGNOSTICS ===');

    // 1. Check if reputation items exist
    const reputationItems = document.querySelectorAll('.reputation-item');
    console.log(`📊 Found ${reputationItems.length} .reputation-item elements`);

    // 2. Check each item
    reputationItems.forEach((item, index) => {
      const element = item as HTMLElement;
      console.log(`\n📝 Item ${index + 1}:`);
      console.log(`  - draggable: ${element.draggable}`);
      console.log(`  - getAttribute('draggable'): ${element.getAttribute('draggable')}`);
      console.log(`  - cursor style: ${element.style.cursor}`);
      console.log(`  - computed cursor: ${window.getComputedStyle(element).cursor}`);
      console.log(`  - classes: ${element.className}`);
      console.log(`  - has drag listeners: ${element.getAttribute('data-has-drag-listeners')}`);
    });

    // 3. Check CSS
    const styles = document.querySelectorAll('link[href*="guard-management"], style');
    console.log(`\n🎨 Found ${styles.length} style elements that might be related`);

    console.log('=== END SIMPLE DIAGNOSTICS ===');
  }

  /**
   * Check elements and show detailed info
   */
  static checkElements(): void {
    console.log('=== 🔍 CHECKING REPUTATION ELEMENTS ===');

    const items = document.querySelectorAll('.reputation-item');
    console.log(`Found ${items.length} reputation items`);

    items.forEach((item, index) => {
      const el = item as HTMLElement;
      console.log(`\nItem ${index + 1}:`);
      console.log(`  Element:`, el);
      console.log(`  Draggable: ${el.draggable}`);
      console.log(
        `  Data attributes:`,
        Array.from(el.attributes).filter((attr) => attr.name.startsWith('data-'))
      );
      console.log(
        `  Event listeners attached: ${el.getAttribute('data-has-drag-listeners') === 'true'}`
      );

      // Try to test drag start manually
      try {
        const dragEvent = new DragEvent('dragstart', {
          bubbles: true,
          cancelable: true,
          dataTransfer: new DataTransfer(),
        });
        el.dispatchEvent(dragEvent);
        console.log(`  ✅ Can dispatch drag event`);
      } catch (error) {
        console.log(`  ❌ Cannot dispatch drag event:`, error);
      }
    });
  }

  /**
   * Force fix elements
   */
  static fixElements(): void {
    console.log('=== 🔧 FIXING REPUTATION ELEMENTS ===');

    const items = document.querySelectorAll('.reputation-item');

    items.forEach((item, index) => {
      const el = item as HTMLElement;

      // Force set draggable
      el.draggable = true;
      el.setAttribute('draggable', 'true');

      // Force set cursor
      el.style.cursor = 'grab';

      // Add visual indicator
      el.style.border = '2px solid blue';

      // Force add drag listeners
      el.addEventListener('dragstart', (e) => {
        console.log(`🚀 MANUAL DRAG START on item ${index + 1}`);
        el.style.cursor = 'grabbing';
        el.classList.add('dragging');

        if (e.dataTransfer) {
          e.dataTransfer.setData(
            'text/plain',
            JSON.stringify({
              type: 'reputation',
              reputation: { id: `manual-${index}`, name: `Manual Test ${index}` },
            })
          );
        }

        // Emit custom event
        document.dispatchEvent(
          new CustomEvent('guard-reputation-drag-start', {
            detail: { type: 'reputation', reputationId: `manual-${index}` },
          })
        );
      });

      el.addEventListener('dragend', (_e) => {
        console.log(`🏁 MANUAL DRAG END on item ${index + 1}`);
        el.style.cursor = 'grab';
        el.classList.remove('dragging');

        // Emit custom event
        document.dispatchEvent(
          new CustomEvent('guard-reputation-drag-end', {
            detail: { type: 'reputation', reputationId: `manual-${index}` },
          })
        );
      });

      console.log(`✅ Fixed item ${index + 1}`);
    });

    console.log(`🔧 Fixed ${items.length} reputation items`);
  }
}
