/**
 * DOM Event Setup Utility
 * Provides consistent patterns for setting up event listeners across dialogs
 */

export class DOMEventSetup {
  /**
   * Setup event listeners with retry mechanism for DialogV2 compatibility
   */
  static withRetry(
    selectors: string | string[],
    setupFn: () => void,
    retries: number = 5,
    delay: number = 200
  ): void {
    const selectorArray = Array.isArray(selectors) ? selectors : [selectors];

    const attempt = () => {
      let foundElements = 0;

      for (const selector of selectorArray) {
        const elements = document.querySelectorAll(selector);
        foundElements += elements.length;
      }

      if (foundElements > 0) {
        console.log(`DOMEventSetup | Found ${foundElements} elements, running setup function`);
        setupFn();
      } else if (retries > 0) {
        console.log(
          `DOMEventSetup | No elements found, retrying in ${delay}ms (${retries} retries left)`
        );
        setTimeout(() => this.withRetry(selectors, setupFn, retries - 1, delay), delay);
      } else {
        console.warn(
          `DOMEventSetup | Could not find elements after multiple retries: ${selectorArray.join(', ')}`
        );
      }
    };

    attempt();
  }

  /**
   * Observe DOM changes and run setup when target elements appear
   */
  static observe(
    targetSelectors: string | string[],
    callback: () => void,
    timeout: number = 5000
  ): MutationObserver {
    const selectorArray = Array.isArray(targetSelectors) ? targetSelectors : [targetSelectors];

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node instanceof Element) {
              // Check if any target selectors match the added node or its children
              for (const selector of selectorArray) {
                if (node.matches?.(selector) || node.querySelector?.(selector)) {
                  console.log(`DOMEventSetup | Target elements detected: ${selector}`);
                  callback();
                  observer.disconnect();
                  return;
                }
              }
            }
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Cleanup observer after timeout
    setTimeout(() => {
      observer.disconnect();
      console.log(`DOMEventSetup | Observer disconnected after ${timeout}ms timeout`);
    }, timeout);

    return observer;
  }

  /**
   * Setup event listeners immediately if elements exist, with fallback to retry
   */
  static setupOrRetry(
    selectors: string | string[],
    setupFn: () => void,
    retries: number = 3
  ): void {
    const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
    let foundElements = 0;

    for (const selector of selectorArray) {
      const elements = document.querySelectorAll(selector);
      foundElements += elements.length;
    }

    if (foundElements > 0) {
      console.log(`DOMEventSetup | Elements found immediately, running setup`);
      setupFn();
    } else {
      console.log(`DOMEventSetup | No elements found, falling back to retry mechanism`);
      this.withRetry(selectors, setupFn, retries);
    }
  }

  /**
   * Add event listener to elements matching selector with deduplication
   */
  static addListener(
    selector: string,
    eventType: string,
    handler: (event: Event) => void,
    setupAttribute: string = 'data-event-setup'
  ): number {
    const elements = document.querySelectorAll(selector);
    let setupCount = 0;

    elements.forEach((element) => {
      if (!element.hasAttribute(setupAttribute)) {
        element.setAttribute(setupAttribute, 'true');
        element.addEventListener(eventType, handler);
        setupCount++;
      }
    });

    return setupCount;
  }

  /**
   * Remove setup attributes to allow re-setup
   */
  static cleanup(setupAttribute: string = 'data-event-setup'): void {
    document.querySelectorAll(`[${setupAttribute}]`).forEach((element) => {
      element.removeAttribute(setupAttribute);
    });
  }

  /**
   * Setup multiple event listeners with a single configuration
   */
  static setupMultiple(
    configs: Array<{
      selector: string;
      eventType: string;
      handler: (event: Event) => void;
      setupAttribute?: string;
    }>
  ): void {
    let totalSetup = 0;

    configs.forEach((config) => {
      const count = this.addListener(
        config.selector,
        config.eventType,
        config.handler,
        config.setupAttribute
      );
      totalSetup += count;
    });

    console.log(
      `DOMEventSetup | Setup ${totalSetup} event listeners across ${configs.length} configurations`
    );
  }

  /**
   * Wait for specific elements to appear in DOM
   */
  static waitForElements(selectors: string | string[], timeout: number = 5000): Promise<Element[]> {
    const selectorArray = Array.isArray(selectors) ? selectors : [selectors];

    return new Promise((resolve, reject) => {
      // Check if elements already exist
      const existingElements: Element[] = [];
      selectorArray.forEach((selector) => {
        existingElements.push(...Array.from(document.querySelectorAll(selector)));
      });

      if (existingElements.length > 0) {
        resolve(existingElements);
        return;
      }

      // Setup observer to wait for elements
      const observer = new MutationObserver(() => {
        const foundElements: Element[] = [];
        selectorArray.forEach((selector) => {
          foundElements.push(...Array.from(document.querySelectorAll(selector)));
        });

        if (foundElements.length > 0) {
          observer.disconnect();
          resolve(foundElements);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      // Timeout after specified time
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Elements not found within ${timeout}ms: ${selectorArray.join(', ')}`));
      }, timeout);
    });
  }
}
