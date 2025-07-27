/**
 * Debug import issues with AddOrEditResourceDialog
 */

async function debugDetailedImport() {
  console.log('=== DETAILED IMPORT DEBUG ===');

  try {
    // Test 1: Simple module existence
    console.log('1. Testing module path existence...');
    const pathTest = './src/dialogs/AddOrEditResourceDialog.js';
    console.log(`Attempting import from: ${pathTest}`);

    // Test 2: Dynamic import with full error catching
    console.log('2. Testing dynamic import...');
    const importResult = await import('./src/dialogs/AddOrEditResourceDialog.js').catch((error) => {
      console.error('Import failed with error:', error);
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      return { error: error };
    });

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

    if (DialogClass) {
      console.log('Dialog class prototype:', DialogClass.prototype);
      console.log('Dialog class methods:', Object.getOwnPropertyNames(DialogClass.prototype));
      console.log('Dialog class static methods:', Object.getOwnPropertyNames(DialogClass));
    }

    // Test 4: Try to instantiate
    if (DialogClass && typeof DialogClass === 'function') {
      console.log('5. Testing instantiation...');
      try {
        const instance = new DialogClass();
        console.log('Instance created successfully:', instance);
      } catch (error) {
        console.error('Instantiation failed:', error);
      }
    }
  } catch (error) {
    console.error('Unexpected error in debug:', error);
  }
}

// Run the debug
debugDetailedImport();
