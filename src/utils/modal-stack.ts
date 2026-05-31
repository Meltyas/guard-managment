/**
 * ModalStack — Shared z-index stacking manager for all Guard Management modals.
 *
 * Any dialog that registers its root element will:
 *  - Be assigned a z-index in the 9000+ range based on stacking order
 *  - Automatically come to front on mousedown
 *  - Receive the `.is-top` CSS class when it is the topmost modal
 *
 * Usage:
 *   // When the dialog element is added to the DOM:
 *   ModalStack.register(this.element);
 *
 *   // When the dialog element is removed from the DOM:
 *   ModalStack.unregister(this.element);
 */

// Keep below Foundry's native app windows (~100) so all Foundry UI appears above.
const BASE_Z = 75;
const stack: HTMLElement[] = [];

function updateAll(): void {
  stack.forEach((el, i) => {
    el.style.zIndex = `${BASE_Z + i * 10}`;
    el.classList.toggle('is-top', i === stack.length - 1);
  });
}

function bringToFront(el: HTMLElement): void {
  const idx = stack.indexOf(el);
  if (idx !== -1 && idx !== stack.length - 1) {
    stack.splice(idx, 1);
    stack.push(el);
  }
  updateAll();
}

// Named function so we can add/remove the same reference as event listener
function onMouseDown(this: HTMLElement): void {
  bringToFront(this);
}

export const ModalStack = {
  /**
   * Register a modal element into the stack.
   * Call this after appending the element to the DOM.
   */
  register(el: HTMLElement): void {
    if (!stack.includes(el)) {
      stack.push(el);
      el.addEventListener('mousedown', onMouseDown);
    }
    updateAll();
  },

  /**
   * Unregister a modal element from the stack.
   * Call this when closing / removing the element from the DOM.
   */
  unregister(el: HTMLElement): void {
    const idx = stack.indexOf(el);
    if (idx !== -1) {
      stack.splice(idx, 1);
      el.removeEventListener('mousedown', onMouseDown);
    }
    updateAll();
  },

  /** Move the given element to the top of the stack. */
  bringToFront,

  /** Returns true if the given element is currently the topmost modal. */
  isTop(el: HTMLElement): boolean {
    return stack.length > 0 && stack[stack.length - 1] === el;
  },

  /** Returns the topmost element, or null if the stack is empty. */
  getTop(): HTMLElement | null {
    return stack.length > 0 ? stack[stack.length - 1] : null;
  },
};
