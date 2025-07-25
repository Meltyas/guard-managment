// Debug test para ver qué está pasando con los templates
import { html } from 'lit-html';
import { renderTemplateToString } from './src/utils/template-renderer.js';

console.log('=== DEBUGGING TEMPLATE RENDERING ===');

// Test 1: Template simple
const simpleTemplate = html`<div>No hay organizaciones</div>`;
console.log('Simple template result:', renderTemplateToString(simpleTemplate));

// Test 2: Template con condición (como el que falla)
const conditionalTemplate = html`
  ${[].length === 0
    ? html`
        <div style="color: #999; font-size: 0.75rem; text-align: center; padding: 8px;">
          No hay organizaciones
        </div>
      `
    : html`<div>Hay organizaciones</div>`}
`;
console.log('Conditional template result:', renderTemplateToString(conditionalTemplate));

// Test 3: Template con botón GM
const buttonTemplate = html`
  <button class="action-btn secondary" data-action="open-warehouse">
    <i class="fas fa-warehouse"></i>
    <span>GM Warehouse</span>
  </button>
`;
console.log('Button template result:', renderTemplateToString(buttonTemplate));

// Test 4: Template complejo con condicional
const gmButtonConditional = html`
  ${true
    ? html`
        <button class="action-btn secondary gm-only" data-action="open-warehouse">
          <i class="fas fa-warehouse"></i>
          <span>GM Warehouse</span>
        </button>
      `
    : ''}
`;
console.log('GM Button conditional result:', renderTemplateToString(gmButtonConditional));
