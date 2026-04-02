/**
 * Console helper functions for testing Guard Management with Custom Sub-Types
 */

declare global {
  interface Window {
    GuardManagement: any;
    GuardManagementHelpers: typeof GuardManagementHelpers;
  }
}

export class GuardManagementHelpers {
  /**
   * Debug module state
   */
  static debugModuleState() {
    console.log('=== GUARD MANAGEMENT DEBUG ===');
    const gm = window.GuardManagement;
    console.log('Window.GuardManagement:', !!gm);

    if (gm) {
      console.log('Module state:', {
        isInitialized: gm.isInitialized,
        modifierManager: !!gm.modifierManager,
        patrolEffectManager: !!gm.patrolEffectManager,
        guardOrganizationManager: !!gm.guardOrganizationManager,
        guardDialogManager: !!gm.guardDialogManager,
        floatingPanel: !!gm.floatingPanel,
      });

      if (gm.debugModuleState) {
        gm.debugModuleState();
      }
    } else {
      console.error('GuardManagement module not found on window object');
      console.log('Attempting recovery...');
      GuardManagementHelpers.attemptModuleRecovery();
    }
  }

  /**
   * Debug drag & drop setup
   */
  static debugDragDrop() {
    console.log('=== DRAG & DROP DEBUG ===');

    const dropZones = document.querySelectorAll('.drop-zone');
    const draggables = document.querySelectorAll('[draggable="true"]');

    console.log('Drop zones found:', dropZones.length);
    console.log('Draggable elements found:', draggables.length);

    dropZones.forEach((zone, index) => {
      const htmlZone = zone as HTMLElement;
      console.log(`Drop zone ${index}:`, {
        element: zone,
        classList: zone.classList.toString(),
        organizationId: htmlZone.dataset.organizationId,
        bounds: zone.getBoundingClientRect(),
      });
    });

    draggables.forEach((element, index) => {
      const htmlElement = element as HTMLElement;
      console.log(`Draggable ${index}:`, {
        element: element,
        resourceId: htmlElement.dataset.resourceId,
        classList: element.classList.toString(),
      });
    });

    return {
      dropZones: dropZones.length,
      draggables: draggables.length,
    };
  }

  /**
   * Force setup of drag & drop event listeners
   */
  static setupDragDropListeners() {
    console.log('=== FORCING DRAG & DROP SETUP ===');

    const dropZones = document.querySelectorAll('.drop-zone');

    if (dropZones.length === 0) {
      console.warn('No drop zones found. Make sure an organization dialog is open.');
      return false;
    }

    // Create temporary handlers for testing
    const handleDragOver = (event: Event) => {
      console.log('FORCE: Drag over');
      const dragEvent = event as DragEvent;
      dragEvent.preventDefault();
      dragEvent.dataTransfer!.dropEffect = 'copy';
    };

    const handleDragEnter = (event: Event) => {
      console.log('FORCE: Drag enter');
      const dragEvent = event as DragEvent;
      dragEvent.preventDefault();
      (dragEvent.target as HTMLElement).closest('.drop-zone')?.classList.add('drag-over');
    };

    const handleDragLeave = (event: Event) => {
      console.log('FORCE: Drag leave');
      const dragEvent = event as DragEvent;
      const dropZone = (dragEvent.target as HTMLElement).closest('.drop-zone');
      const relatedTarget = dragEvent.relatedTarget as HTMLElement;
      if (dropZone && (!relatedTarget || !dropZone.contains(relatedTarget))) {
        dropZone.classList.remove('drag-over');
      }
    };

    const handleDrop = async (event: Event) => {
      console.log('FORCE: Drop event!');
      const dragEvent = event as DragEvent;
      dragEvent.preventDefault();

      const dropZone = (dragEvent.target as HTMLElement).closest('.drop-zone') as HTMLElement;
      if (!dropZone) return;

      dropZone.classList.remove('drag-over');

      const dragData = dragEvent.dataTransfer?.getData('text/plain');
      console.log('FORCE: Drag data:', dragData);

      if (dragData) {
        try {
          const data = JSON.parse(dragData);
          console.log('FORCE: Parsed data:', data);

          if (data.type === 'guard-resource') {
            const organizationId = dropZone.dataset.organizationId;
            console.log('FORCE: Organization ID:', organizationId);

            // Show success message
            if ((globalThis as any).ui?.notifications) {
              (globalThis as any).ui.notifications.info(
                `FORCE DROP: Would assign ${data.resourceData.name} to org ${organizationId}`
              );
            }
          }
        } catch (error) {
          console.error('FORCE: Error parsing drag data:', error);
        }
      }
    };

    // Apply handlers to all drop zones
    dropZones.forEach((zone, index) => {
      console.log(`Setting up forced listeners on drop zone ${index}`);

      // Remove existing listeners
      zone.removeEventListener('dragover', handleDragOver);
      zone.removeEventListener('dragenter', handleDragEnter);
      zone.removeEventListener('dragleave', handleDragLeave);
      zone.removeEventListener('drop', handleDrop);

      // Add new listeners
      zone.addEventListener('dragover', handleDragOver);
      zone.addEventListener('dragenter', handleDragEnter);
      zone.addEventListener('dragleave', handleDragLeave);
      zone.addEventListener('drop', handleDrop);
    });

    console.log(`Forced drag & drop setup complete on ${dropZones.length} drop zones`);
    return true;
  }

  /**
   * Attempt to recover the module if it's missing
   */
  static attemptModuleRecovery() {
    console.log('GuardManagementHelpers | Attempting module recovery...');

    // Try to find if Foundry has the module loaded
    const foundryModules = (game as any)?.modules;
    if (foundryModules) {
      const guardModule = foundryModules.get('guard-management');
      if (guardModule) {
        console.log('Found guard-management module in Foundry:', guardModule);

        // Check if the module has an active flag
        if (guardModule.active) {
          console.log('Module is marked as active, but window.GuardManagement is missing');
          console.log('This suggests the module was deleted from window after initialization');
          console.log('Please reload the page to restore the module');

          if ((globalThis as any).ui?.notifications) {
            (globalThis as any).ui.notifications.error(
              'Guard Management module needs to be reloaded. Please refresh the page.'
            );
          }
        } else {
          console.log('Module is not active in Foundry');
        }
      } else {
        console.log('guard-management module not found in Foundry modules');
      }
    }
  }

  /**
   * Force restore the module (if we have a backup reference)
   */
  static forceRestoreModule() {
    console.log('GuardManagementHelpers | Attempting to force restore module...');

    // This would need to be implemented if we store a backup reference
    console.log('Force restore not implemented yet - please reload the page');

    if ((globalThis as any).ui?.notifications) {
      (globalThis as any).ui.notifications.warn(
        'Please reload the page to restore the Guard Management module.'
      );
    }
  }

  /**
   * Create sample data for testing
   */
  static async createSampleData() {
    const gm = window.GuardManagement;
    if (!gm) {
      console.error('GuardManagement not found. Make sure the module is loaded.');
      return;
    }

    console.log('Creating sample data...');
    console.log('Sample data creation via console is no longer supported. Use the UI instead.');
  }

  /**
   * List all Guard Organizations
   */
  static listOrganizations() {
    const gm = window.GuardManagement;
    if (!gm) return [];

    const org = gm.guardOrganizationManager?.getOrganization?.();
    const orgs = org ? [org] : [];
    console.table(
      orgs.map((o: any) => ({
        id: o.id,
        name: o.name,
        subtitle: o.subtitle,
        agility: o.baseStats?.agility,
        strength: o.baseStats?.strength,
        finesse: o.baseStats?.finesse,
        instinct: o.baseStats?.instinct,
        presence: o.baseStats?.presence,
        knowledge: o.baseStats?.knowledge,
      }))
    );

    return orgs;
  }

  /**
   * Debug floating panel GM configuration
   */
  static debugFloatingPanel() {
    const gm = window.GuardManagement;
    if (!gm) {
      console.error('GuardManagement not found');
      return;
    }

    console.log('=== Floating Panel Debug ===');
    console.log('Panel exists:', !!gm.floatingPanel);
    console.log('Panel element:', gm.floatingPanel?.panel);
    console.log('Current user isGM:', (game as any)?.user?.isGM);
    console.log(
      'GM elements found:',
      gm.floatingPanel?.panel?.querySelectorAll?.('.gm-only')?.length || 0
    );

    // Force reconfigure
    if (gm.floatingPanel?.forceConfigureGM) {
      console.log('Forcing GM reconfiguration...');
      gm.floatingPanel.forceConfigureGM();
    }

    return {
      panel: gm.floatingPanel,
      isGM: (game as any)?.user?.isGM,
      gmElements: gm.floatingPanel?.panel?.querySelectorAll?.('.gm-only'),
    };
  }

  /**
   * List all Patrols
   */
  static listPatrols() {
    const gm = window.GuardManagement;
    if (!gm) return [];

    const patrolMgr = gm.guardOrganizationManager?.getPatrolManager?.();
    const patrols = patrolMgr?.list?.() || [];
    console.table(
      patrols.map((patrol: any) => ({
        id: patrol.id,
        name: patrol.name,
        organizationId: patrol.organizationId,
        soldiers: patrol.soldiers?.length || 0,
        effects: patrol.patrolEffects?.length || 0,
      }))
    );

    return patrols;
  }

  /**
   * List all Resources
   */
  static listResources() {
    const gm = window.GuardManagement;
    if (!gm) return [];

    const resources = gm.resourceManager?.getAllResources?.() || [];
    console.table(
      resources.map((resource: any) => ({
        id: resource.id,
        name: resource.name,
        description: resource.description,
        quantity: resource.quantity,
        organizationId: resource.organizationId,
      }))
    );

    return resources;
  }

  /**
   * List all Reputation entries
   */
  static listReputation() {
    const gm = window.GuardManagement;
    if (!gm) return [];

    const reputation = gm.reputationManager?.getAllReputations?.() || [];
    console.table(
      reputation.map((rep: any) => ({
        id: rep.id,
        name: rep.name,
        description: rep.description,
        level: rep.level,
        organizationId: rep.organizationId,
      }))
    );

    return reputation;
  }

  /**
   * Show management dialog
   */
  static async showManagementDialog() {
    const gm = window.GuardManagement;
    if (!gm) {
      console.error('GuardManagement not found.');
      return;
    }

    await gm.guardDialogManager.showManageOrganizationsDialog();
  }

  /**
   * Create a quick organization for testing
   */
  static async createTestOrganization(name: string = 'Test Organization') {
    const gm = window.GuardManagement;
    if (!gm) return null;

    console.log('Creating test organization via settings...');
    await gm.guardOrganizationManager?.createOrganization?.({
      name: name,
      subtitle: 'Test organization for development',
      baseStats: {
        agility: Math.floor(Math.random() * 10) + 8,
        strength: Math.floor(Math.random() * 10) + 8,
        finesse: Math.floor(Math.random() * 10) + 8,
        instinct: Math.floor(Math.random() * 10) + 8,
        presence: Math.floor(Math.random() * 10) + 8,
        knowledge: Math.floor(Math.random() * 10) + 8,
      },
    });

    console.log(`Created organization: ${name}`);
    return gm.guardOrganizationManager?.getOrganization?.();
  }

  /**
   * Create a test patrol for an organization
   */
  static async createTestPatrol(organizationId: string, name: string = 'Test Patrol') {
    const gm = window.GuardManagement;
    if (!gm) return null;

    const patrolMgr = gm.guardOrganizationManager?.getPatrolManager?.();
    if (!patrolMgr) return null;

    const patrol = await patrolMgr.createPatrol({
      name: name,
      organizationId: organizationId,
    });

    console.log(
      `Created patrol: ${patrol?.name} (${patrol?.id}) for organization ${organizationId}`
    );
    return patrol;
  }

  /**
   * Clean up all test data
   */
  static async cleanupTestData() {
    const gm = window.GuardManagement;
    if (!gm) return;

    console.log('Cleanup via console is no longer supported. Data is stored in settings.');
    console.log('Use Foundry settings menu or the module UI to manage data.');
  }

  /**
   * Fix permissions for all Guard Management documents
   */
  static async fixPermissions() {
    console.log('=== DOCUMENT PERMISSIONS ===');
    console.log('Document-based storage has been removed. All data is in settings.');
    console.log('No document permissions to fix.');
    return true;
  }

  /**
   * Get helpful commands
   */
  static help() {
    console.log(`
Guard Management Console Helpers:

Basic Commands:
- GuardManagementHelpers.debugModuleState()     // Debug module initialization
- GuardManagementHelpers.createSampleData()      // Create sample data
- GuardManagementHelpers.showManagementDialog()  // Open management UI
- GuardManagementHelpers.help()                  // Show this help

Permission Commands:
- GuardManagementHelpers.fixPermissions()        // Fix all document permissions (allows all users to edit)

Recovery Commands:
- GuardManagementHelpers.attemptModuleRecovery() // Try to recover missing module
- GuardManagementHelpers.forceRestoreModule()    // Force restore (reload required)

List Commands:
- GuardManagementHelpers.listOrganizations()     // List all organizations
- GuardManagementHelpers.listPatrols()          // List all patrols
- GuardManagementHelpers.listResources()        // List all resources
- GuardManagementHelpers.listReputation()       // List all reputation

Create Commands:
- GuardManagementHelpers.createTestOrganization('Name')  // Create test org
- GuardManagementHelpers.createTestPatrol('orgId', 'Name') // Create test patrol

Debug Commands:
- GuardManagementHelpers.debugFloatingPanel()   // Debug floating panel
- GuardManagementHelpers.debugDragDrop()        // Debug drag & drop elements
- GuardManagementHelpers.setupDragDropListeners() // Force setup drag & drop

Cleanup:
- GuardManagementHelpers.cleanupTestData()       // Delete all test data

Access the main module:
- window.GuardManagement.modifierManager           // Guard modifiers (settings)
- window.GuardManagement.patrolEffectManager       // Patrol effects (settings)
- window.GuardManagement.guardDialogManager        // Dialog manager
    `);
  }
}

// Make helpers available globally
if (typeof window !== 'undefined') {
  window.GuardManagementHelpers = GuardManagementHelpers;
}
