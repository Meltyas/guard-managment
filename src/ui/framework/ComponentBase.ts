// Minimal component base similar to Angular mental model (no lit-html)
// KISS: string template + single delegated listener hook.
// Provides: state handling, render lifecycle, destroy, simple diff-less update.

export interface ComponentLifecycle {
  onInit?(): void;
  afterRender?(): void;
  onDestroy?(): void;
}

export abstract class ComponentBase<S extends Record<string, any> = any>
  implements ComponentLifecycle
{
  protected root: HTMLElement;
  protected state: S;
  private mounted = false;
  private destroyed = false;

  constructor(root: HTMLElement, initialState: S) {
    this.root = root;
    this.state = { ...initialState } as S;
  }

  // Must return full HTML for this component root
  protected abstract template(state: Readonly<S>): string;

  // Optional lifecycle hooks
  onInit(): void {}
  afterRender(): void {}
  onDestroy(): void {}

  /** Initial mount (idempotent) */
  mount(): void {
    if (this.mounted || this.destroyed) return;
    this.onInit();
    this.render();
    this.mounted = true;
  }

  /** Set partial state and re-render */
  setState(patch: Partial<S>): void {
    if (this.destroyed) return;
    this.state = Object.assign({}, this.state, patch);
    this.render();
  }

  /** Force full re-render using current state */
  forceUpdate(): void {
    if (this.destroyed) return;
    this.render();
  }

  /** Basic render: replace children (simple & deterministic) */
  protected render(): void {
    // Security: ensure root still in DOM
    if (!this.root.isConnected) return;
    const html = this.template(this.state);
    // Use template element to avoid executing scripts unintentionally
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    this.root.replaceChildren(tpl.content);
    this.afterRender();
  }

  /** Destroy component */
  destroy(): void {
    if (this.destroyed) return;
    this.onDestroy();
    this.root.replaceChildren();
    this.destroyed = true;
  }
}

// Helper escape for interpolated text (basic XSS guard)
export function escapeHtml(value: any): string {
  const str = value == null ? '' : String(value);
  return str.replace(/[&<>"]|'/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return ch;
    }
  });
}
