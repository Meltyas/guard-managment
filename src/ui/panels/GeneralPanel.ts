import type { GuardOrganization } from '../../types/entities';

export class GeneralPanel {
  static get template() {
    return 'modules/guard-management/templates/panels/general.hbs';
  }

  static async render(container: HTMLElement, organization: GuardOrganization) {
      const htmlContent = await renderTemplate(this.template, { organization });
      container.innerHTML = htmlContent;
  }
}
