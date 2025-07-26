/**
 * Test script for verifying the resource deletion display fix
 * Run in Foundry console to test the fixed functionality
 */

(async function testResourceDeletionDisplayFix() {
  console.log('🧪 Testing Resource Deletion Display Fix...');

  const gm = window.GuardManagement;

  if (!gm || !gm.isInitialized) {
    console.error('❌ GuardManagement not available or not initialized');
    return;
  }

  try {
    // Test 1: Create a test resource with a clear name
    console.log('\n1️⃣ Creating test resource with clear name...');
    const testResource = await gm.documentManager.createGuardResource({
      name: 'Test Resource for Display Fix',
      description: 'A test resource to verify proper name display',
      quantity: 25,
      organizationId: '',
    });
    console.log('✅ Test resource created:', testResource.name, testResource.id);

    // Test 2: Get organization and assign resource
    console.log('\n2️⃣ Assigning resource to organization...');
    const organizations = gm.documentManager.getGuardOrganizations();
    if (organizations.length > 0) {
      const org = organizations[0];

      // Assign resource to organization
      const currentResources = org.system?.resources || [];
      const newResources = [...currentResources, testResource.id];

      await gm.documentManager.updateGuardOrganization(org.id, {
        resources: newResources,
        version: (org.system.version || 0) + 1,
        updatedAt: new Date(),
      });

      console.log('✅ Resource assigned to organization:', org.name);

      // Test 3: Open CustomInfoDialog to see the resource
      console.log('\n3️⃣ Testing CustomInfoDialog display...');
      const updatedOrg = gm.guardOrganizationManager.getOrganization();
      if (updatedOrg) {
        // Create a CustomInfoDialog instance (simulating the UI)
        const customDialog = new gm.CustomInfoDialog();
        const content = customDialog.generateOrganizationInfoContent(updatedOrg);

        // Check if the resource name appears correctly in the content
        if (content.includes('Test Resource for Display Fix')) {
          console.log('✅ Resource name appears correctly in dialog content');
        } else if (content.includes(testResource.id)) {
          console.log('❌ Resource ID appears instead of name in dialog content');
        } else {
          console.log('ℹ️ Resource not found in dialog content (this could be normal)');
        }
      }

      // Test 4: Simulate deletion event and verify the name is passed correctly
      console.log('\n4️⃣ Testing deletion event with proper name...');

      // Create a mock event to test the event handling
      const mockEvent = new CustomEvent('guard-resource-deleted', {
        detail: {
          resourceId: testResource.id,
          resourceName: testResource.name,
        },
      });

      console.log('📤 Dispatching delete event with name:', testResource.name);
      document.dispatchEvent(mockEvent);

      // Test 5: Actually delete the resource using the warehouse method
      console.log('\n5️⃣ Actually deleting resource...');
      const deleted = await gm.documentManager.deleteGuardResource(testResource.id);
      console.log('✅ Resource deletion result:', deleted);

      // Verify resource was removed from organization
      const finalOrg = gm.guardOrganizationManager.getOrganization();
      const stillHasResource = finalOrg?.resources?.includes(testResource.id);
      console.log('✅ Resource removed from organization:', !stillHasResource);
    } else {
      console.log('⚠️ No organizations found - skipping assignment test');

      // Just delete the resource
      const deleted = await gm.documentManager.deleteGuardResource(testResource.id);
      console.log('✅ Resource deletion result:', deleted);
    }
  } catch (error) {
    console.error('❌ Error during testing:', error);
  }

  console.log('\n🎯 Resource deletion display fix testing complete!');
  console.log(
    'The fix should now show proper resource names instead of IDs when deleting resources.'
  );
})();

// Additional test functions for manual verification
function testResourceNameDisplay() {
  console.log('🔍 Testing Resource Name Display...');

  const gm = window.GuardManagement;
  if (!gm?.documentManager) {
    console.error('❌ DocumentManager not available');
    return;
  }

  const resources = gm.documentManager.getGuardResources();
  console.log('📦 Available resources:');

  resources.forEach((resource, index) => {
    console.log(`${index + 1}. Name: "${resource.name}" | ID: ${resource.id}`);
  });

  if (resources.length === 0) {
    console.log('ℹ️ No resources found. Create some resources first.');
  }
}

function testCustomInfoDialogRender() {
  console.log('🖥️ Testing CustomInfoDialog Resource Rendering...');

  const gm = window.GuardManagement;
  if (!gm?.guardOrganizationManager || !gm?.CustomInfoDialog) {
    console.error('❌ Required managers not available');
    return;
  }

  const organization = gm.guardOrganizationManager.getOrganization();
  if (!organization) {
    console.log('ℹ️ No organization found');
    return;
  }

  console.log('🏛️ Organization:', organization.name);
  console.log('📦 Resources assigned:', organization.resources || []);

  if (organization.resources && organization.resources.length > 0) {
    const customDialog = new gm.CustomInfoDialog();

    organization.resources.forEach((resourceId, index) => {
      console.log(`\n${index + 1}. Testing resource rendering for ID: ${resourceId}`);

      // Test if the resource exists in documentManager
      const resources = gm.documentManager.getGuardResources();
      const resource = resources.find((r) => r.id === resourceId);

      if (resource) {
        console.log(`   ✅ Resource found: "${resource.name}"`);
      } else {
        console.log(`   ❌ Resource NOT found - this will cause ID display issue`);
      }
    });
  } else {
    console.log('ℹ️ No resources assigned to organization');
  }
}

console.log('🔧 Resource Deletion Display Fix Test Functions Available:');
console.log('- testResourceNameDisplay() - Check available resources and their names');
console.log('- testCustomInfoDialogRender() - Test how resources render in dialog');
console.log('- Main test function runs automatically when script loads');
