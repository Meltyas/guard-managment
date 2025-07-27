/**
 * Debug import issues with AddOrEditResourceDialog from the correct location
 */

async function debugCorrectImport() {
  console.log('=== CORRECT IMPORT DEBUG ===');

  try {
    // Test from the correct relative path
    console.log('1. Testing from root directory...');
    const pathTest = '../src/dialogs/AddOrEditResourceDialog.js';
    console.log(`Attempting import from: ${pathTest}`);

    // Test 2: Dynamic import with full error catching
    console.log('2. Testing dynamic import...');
    const importResult = await import('../src/dialogs/AddOrEditResourceDialog.js').catch(
      (error) => {
        console.error('Import failed with error:', error);
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        return { error: error };
      }
    );

    console.log('3. Import result analysis:');
    console.log('Result type:', typeof importResult);
    console.log('Result keys:', Object.keys(importResult));
    console.log('Full result:', importResult);

    if (importResult.error) {
      console.log('Import failed completely');
      return;
    }

    // Test 3: Check exported class
    console.log('4. Checking exported class...');
    const DialogClass = importResult.AddOrEditResourceDialog;
    console.log('Dialog class type:', typeof DialogClass);
    console.log('Dialog class:', DialogClass);
  } catch (error) {
    console.error('Unexpected error in debug:', error);
  }
}

// Run the debug
debugCorrectImport();
