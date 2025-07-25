/**
 * CSS verification script
 * Run this in the browser console to check CSS rules
 */

console.log('=== CSS Z-Index Rules Verification ===');

// Check if the CSS rules are loaded
const customDialogs = document.querySelectorAll(
  '.custom-dialog, .custom-info-dialog, .gm-warehouse-dialog'
);
console.log(`Found ${customDialogs.length} custom dialogs`);

// Check computed styles
customDialogs.forEach((dialog, index) => {
  const styles = window.getComputedStyle(dialog);
  const zIndex = styles.zIndex;
  const hasFocus = dialog.classList.contains('focused');
  const dialogType = dialog.classList.contains('custom-info-dialog')
    ? 'CustomInfoDialog'
    : dialog.classList.contains('gm-warehouse-dialog')
      ? 'GMWarehouseDialog'
      : 'Unknown';

  console.log(`Dialog ${index + 1} (${dialogType}):`);
  console.log(`  - Z-Index: ${zIndex}`);
  console.log(`  - Has 'focused' class: ${hasFocus}`);
  console.log(`  - Classes: ${dialog.className}`);
  console.log(`  - Expected z-index: ${hasFocus ? '80' : '51'}`);
  console.log('');
});

// Check if CSS rules exist
console.log('CSS Rules Check:');
const styleSheets = Array.from(document.styleSheets);
let foundRules = false;

styleSheets.forEach((sheet) => {
  try {
    const rules = Array.from(sheet.cssRules || sheet.rules || []);
    rules.forEach((rule) => {
      if (
        rule.selectorText &&
        (rule.selectorText.includes('.custom-dialog') ||
          rule.selectorText.includes('.custom-info-dialog') ||
          rule.selectorText.includes('.gm-warehouse-dialog'))
      ) {
        console.log(`Found CSS rule: ${rule.selectorText} { ${rule.style.cssText} }`);
        foundRules = true;
      }
    });
  } catch (e) {
    // Cross-origin or other access issues
  }
});

if (!foundRules) {
  console.log('No custom dialog CSS rules found in accessible stylesheets');
}

console.log('\nExpected CSS Rules:');
console.log('.custom-dialog { z-index: 51; }');
console.log('.custom-dialog.focused { z-index: 80; }');
console.log('.custom-info-dialog { z-index: 51; }');
console.log('.custom-info-dialog.focused { z-index: 80; }');
console.log('.gm-warehouse-dialog { z-index: 51; }');
console.log('.gm-warehouse-dialog.focused { z-index: 80; }');

// Test focus changes
console.log('\n=== Testing Focus Changes ===');
setTimeout(() => {
  const infoDialogs = document.querySelectorAll('.custom-info-dialog');
  const warehouseDialogs = document.querySelectorAll('.gm-warehouse-dialog');

  console.log(
    `Found ${infoDialogs.length} info dialogs and ${warehouseDialogs.length} warehouse dialogs`
  );

  infoDialogs.forEach((dialog, i) => {
    const focused = dialog.classList.contains('focused');
    const zIndex = window.getComputedStyle(dialog).zIndex;
    console.log(`Info Dialog ${i + 1}: focused=${focused}, z-index=${zIndex}`);
  });

  warehouseDialogs.forEach((dialog, i) => {
    const focused = dialog.classList.contains('focused');
    const zIndex = window.getComputedStyle(dialog).zIndex;
    console.log(`Warehouse Dialog ${i + 1}: focused=${focused}, z-index=${zIndex}`);
  });
}, 100);
