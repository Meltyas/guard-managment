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
   * Create sample data for testing
   */
  static async createSampleData() {
    const gm = window.GuardManagement;
    if (!gm) {
      console.error('GuardManagement not found. Make sure the module is loaded.');
      return;
    }

    console.log('Creating sample data...');
    await gm.documentManager.createSampleData();
    console.log('Sample data created successfully!');
  }

  /**
   * List all Guard Organizations
   */
  static listOrganizations() {
    const gm = window.GuardManagement;
    if (!gm) return [];

    const orgs = gm.documentManager.getGuardOrganizations();
    console.table(
      orgs.map((org: any) => ({
        id: org.id,
        name: org.name,
        subtitle: org.system.subtitle,
        robustismo: org.system.baseStats.robustismo,
        analitica: org.system.baseStats.analitica,
        subterfugio: org.system.baseStats.subterfugio,
        elocuencia: org.system.baseStats.elocuencia,
        patrols: org.system.patrols.length,
        resources: org.system.resources.length,
        reputation: org.system.reputation.length,
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
    console.log('Current user isGM:', game?.user?.isGM);
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
      isGM: game?.user?.isGM,
      gmElements: gm.floatingPanel?.panel?.querySelectorAll?.('.gm-only'),
    };
  }

  /**
   * List all Patrols
   */
  static listPatrols() {
    const gm = window.GuardManagement;
    if (!gm) return [];

    const patrols = gm.documentManager.getPatrols();
    console.table(
      patrols.map((patrol: any) => ({
        id: patrol.id,
        name: patrol.name,
        organizationId: patrol.system.organizationId,
        unitCount: patrol.system.unitCount,
        status: patrol.system.status,
        leaderId: patrol.system.leaderId || 'None',
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

    const resources = gm.documentManager.getGuardResources();
    console.table(
      resources.map((resource: any) => ({
        id: resource.id,
        name: resource.name,
        description: resource.system.description,
        quantity: resource.system.quantity,
        organizationId: resource.system.organizationId,
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

    const reputation = gm.documentManager.getGuardReputations();
    console.table(
      reputation.map((rep: any) => ({
        id: rep.id,
        name: rep.name,
        description: rep.system.description,
        level: rep.system.level,
        levelLabel: rep.system.levelLabel,
        organizationId: rep.system.organizationId,
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

    const org = await gm.documentManager.createGuardOrganization({
      name: name,
      subtitle: 'Test organization for development',
      baseStats: {
        robustismo: Math.floor(Math.random() * 10) + 8,
        analitica: Math.floor(Math.random() * 10) + 8,
        subterfugio: Math.floor(Math.random() * 10) + 8,
        elocuencia: Math.floor(Math.random() * 10) + 8,
      },
    });

    console.log(`Created organization: ${org.name} (${org.id})`);
    return org;
  }

  /**
   * Create a test patrol for an organization
   */
  static async createTestPatrol(organizationId: string, name: string = 'Test Patrol') {
    const gm = window.GuardManagement;
    if (!gm) return null;

    const patrol = await gm.documentManager.createPatrol({
      name: name,
      organizationId: organizationId,
      unitCount: Math.floor(Math.random() * 8) + 1,
      status: 'idle',
    });

    console.log(`Created patrol: ${patrol.name} (${patrol.id}) for organization ${organizationId}`);
    return patrol;
  }

  /**
   * Clean up all test data
   */
  static async cleanupTestData() {
    const gm = window.GuardManagement;
    if (!gm) return;

    const orgs = gm.documentManager.getGuardOrganizations();

    for (const org of orgs) {
      console.log(`Deleting organization: ${org.name}`);
      await gm.documentManager.deleteGuardOrganization(org.id);
    }

    console.log('All test data cleaned up!');
  }

  /**
   * Get helpful commands
   */
  static help() {
    console.log(`
Guard Management Console Helpers:

Basic Commands:
- GuardManagementHelpers.createSampleData()      // Create sample data
- GuardManagementHelpers.showManagementDialog()  // Open management UI
- GuardManagementHelpers.help()                  // Show this help

List Commands:
- GuardManagementHelpers.listOrganizations()     // List all organizations
- GuardManagementHelpers.listPatrols()          // List all patrols
- GuardManagementHelpers.listResources()        // List all resources
- GuardManagementHelpers.listReputation()       // List all reputation

Create Commands:
- GuardManagementHelpers.createTestOrganization('Name')  // Create test org
- GuardManagementHelpers.createTestPatrol('orgId', 'Name') // Create test patrol

Cleanup:
- GuardManagementHelpers.cleanupTestData()       // Delete all test data

Access the main module:
- window.GuardManagement.documentManager         // Main document manager
- window.GuardManagement.guardDialogManager      // Dialog manager
    `);
  }
}

// Make helpers available globally
if (typeof window !== 'undefined') {
  window.GuardManagementHelpers = GuardManagementHelpers;
}
