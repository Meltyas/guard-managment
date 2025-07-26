/**
 * Debug script for testing drag & drop functionality
 * Run this in the browser console to test the complete flow
 */

// Helper function to test drag & drop workflow
window.debugDragDrop = {
  // Test function to verify the complete workflow
  async testCompleteFlow() {
    console.log('🧪 Starting Drag & Drop Test...');

    const gm = window.GuardManagement;
    if (!gm) {
      console.error('❌ GuardManagement not found');
      return;
    }

    try {
      // 1. Check if we have organizations
      const orgs = await gm.guardManager.getGuardOrganizations();
      console.log('📋 Available organizations:', orgs.length);

      if (orgs.length === 0) {
        console.log('📝 Creating test organization...');
        await gm.guardManager.createSampleGuards();
        const newOrgs = await gm.guardManager.getGuardOrganizations();
        console.log('✅ Created organizations:', newOrgs.length);
      }

      // 2. Check if we have resources
      const resources = gm.documentManager.getGuardResources();
      console.log('📦 Available resources:', resources.length);

      if (resources.length === 0) {
        console.log('📝 Creating test resource...');
        const testResource = {
          name: 'Espadas de Hierro',
          description: 'Espadas básicas para la guardia',
          quantity: 10,
        };
        await gm.documentManager.createGuardResource(testResource);
        console.log('✅ Created test resource');
      }

      // 3. Open warehouse and info dialogs
      console.log('🏭 Opening GM Warehouse...');
      const warehouse = window.GMWarehouseDialog.show();

      console.log('ℹ️ Opening organization info...');
      const firstOrg = orgs[0] || (await gm.guardManager.getGuardOrganizations())[0];
      if (firstOrg) {
        await gm.guardDialogManager.showGuardDialog(firstOrg);
      }

      console.log('✅ Test setup complete!');
      console.log('🎯 Now try dragging a resource from warehouse to organization info dialog');

      return {
        warehouse,
        organization: firstOrg,
        resources: gm.documentManager.getGuardResources(),
      };
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  },

  // Test function to simulate drag & drop programmatically
  async simulateDragDrop(resourceId, organizationId) {
    console.log('🔄 Simulating drag & drop...');

    const gm = window.GuardManagement;
    if (!gm) {
      console.error('❌ GuardManagement not found');
      return;
    }

    try {
      // Get resource data
      const resource = gm.documentManager.getGuardResources().find((r) => r.id === resourceId);
      if (!resource) {
        console.error('❌ Resource not found:', resourceId);
        return;
      }

      // Get organization
      const org = await gm.guardManager.getGuardOrganization(organizationId);
      if (!org) {
        console.error('❌ Organization not found:', organizationId);
        return;
      }

      console.log('📦 Resource:', resource.name);
      console.log('🏛️ Organization:', org.name);
      console.log('📋 Current resources:', org.resources || []);

      // Add resource to organization
      if (!org.resources) org.resources = [];

      if (!org.resources.includes(resource.id)) {
        org.resources.push(resource.id);
        await gm.guardManager.updateGuardOrganization(organizationId, org);
        console.log('✅ Resource assigned successfully');
      } else {
        console.log('ℹ️ Resource already assigned');
      }

      return org;
    } catch (error) {
      console.error('❌ Simulation failed:', error);
    }
  },

  // Check current state
  async checkState() {
    const gm = window.GuardManagement;
    if (!gm) {
      console.error('❌ GuardManagement not found');
      return;
    }

    const orgs = await gm.guardManager.getGuardOrganizations();
    const resources = gm.documentManager.getGuardResources();

    console.log('🔍 Current State:');
    console.log('Organizations:', orgs.length);
    orgs.forEach((org) => {
      console.log(`  - ${org.name}: ${org.resources?.length || 0} resources`, org.resources);
    });

    console.log('Resources:', resources.length);
    resources.forEach((res) => {
      console.log(`  - ${res.name} (${res.id}): qty ${res.quantity}`);
    });

    return { organizations: orgs, resources };
  },
};

console.log('🔧 Debug tools loaded! Use:');
console.log('  debugDragDrop.testCompleteFlow() - Set up test environment');
console.log('  debugDragDrop.simulateDragDrop(resourceId, orgId) - Simulate assignment');
console.log('  debugDragDrop.checkState() - Check current state');
