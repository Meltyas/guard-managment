/**
 * Simple Guard Dialog Manager - Works with DocumentBasedManager
 */

import { DocumentBasedManager } from './DocumentBasedManager.js';

export class SimpleGuardDialogManager {
  public documentManager: DocumentBasedManager;

  constructor(documentManager: DocumentBasedManager) {
    this.documentManager = documentManager;
  }

  /**
   * Initialize the dialog manager
   */
  public async initialize(): Promise<void> {
    console.log('SimpleGuardDialogManager | Initialized');
  }

  /**
   * Show a simple organization management dialog
   */
  public async showManageOrganizationsDialog(): Promise<void> {
    const organizations = this.documentManager.getGuardOrganizations();

    const content = `
      <div style="padding: 10px;">
        <h3>Guard Organizations</h3>
        <div style="margin-bottom: 10px;">
          <button type="button" id="create-org-btn" style="background: #4caf50; color: white; padding: 5px 10px; border: none; border-radius: 3px;">
            Create New Organization
          </button>
          <button type="button" id="create-sample-btn" style="background: #2196f3; color: white; padding: 5px 10px; border: none; border-radius: 3px; margin-left: 5px;">
            Create Sample Data
          </button>
        </div>
        <ul style="list-style: none; padding: 0;">
          ${organizations
            .map(
              (org) => `
            <li style="margin: 5px 0; padding: 10px; border: 1px solid #ccc; border-radius: 3px;">
              <strong>${org.name}</strong>
              ${org.system.subtitle ? `<br><em>${org.system.subtitle}</em>` : ''}
              <br>
              <small>
                Stats: R:${org.system.baseStats.robustismo} A:${org.system.baseStats.analitica}
                S:${org.system.baseStats.subterfugio} E:${org.system.baseStats.elocuencia}
              </small>
              <br>
              <small>
                Patrols: ${org.system.patrols.length} |
                Resources: ${org.system.resources.length} |
                Reputation: ${org.system.reputation.length}
              </small>
              <div style="margin-top: 5px;">
                <button type="button" data-action="edit" data-id="${org.id}" style="background: #ff9800; color: white; padding: 2px 6px; border: none; border-radius: 2px; font-size: 11px;">
                  Edit
                </button>
                <button type="button" data-action="delete" data-id="${org.id}" style="background: #f44336; color: white; padding: 2px 6px; border: none; border-radius: 2px; font-size: 11px; margin-left: 3px;">
                  Delete
                </button>
                <button type="button" data-action="patrol" data-id="${org.id}" style="background: #9c27b0; color: white; padding: 2px 6px; border: none; border-radius: 2px; font-size: 11px; margin-left: 3px;">
                  Manage Patrols
                </button>
              </div>
            </li>
          `
            )
            .join('')}
        </ul>
        ${organizations.length === 0 ? '<p><em>No organizations found. Create one to get started!</em></p>' : ''}
      </div>
    `;

    return new Promise((resolve) => {
      const d = new Dialog({
        title: 'Guard Management',
        content: content,
        buttons: {
          close: {
            label: 'Close',
            callback: () => resolve(),
          },
        },
        render: (html: JQuery) => {
          // Handle create organization
          html.find('#create-org-btn').on('click', async () => {
            const name = await this.promptForInput('Organization Name', 'Enter organization name:');
            if (name) {
              await this.documentManager.createGuardOrganization({ name });
              d.close();
              setTimeout(() => this.showManageOrganizationsDialog(), 100);
            }
          });

          // Handle create sample data
          html.find('#create-sample-btn').on('click', async () => {
            await this.documentManager.createSampleData();
            d.close();
            setTimeout(() => this.showManageOrganizationsDialog(), 100);
          });

          // Handle edit organization
          html.find('button[data-action="edit"]').on('click', async (event) => {
            const id = $(event.currentTarget).data('id');
            await this.editOrganization(id);
            d.close();
            setTimeout(() => this.showManageOrganizationsDialog(), 100);
          });

          // Handle delete organization
          html.find('button[data-action="delete"]').on('click', async (event) => {
            const id = $(event.currentTarget).data('id');
            const org = this.documentManager.getGuardOrganization(id);
            if (
              org &&
              confirm(
                `Delete ${org.name}? This will also delete all associated patrols, resources, and reputation.`
              )
            ) {
              await this.documentManager.deleteGuardOrganization(id);
              d.close();
              setTimeout(() => this.showManageOrganizationsDialog(), 100);
            }
          });

          // Handle manage patrols
          html.find('button[data-action="patrol"]').on('click', async (event) => {
            const id = $(event.currentTarget).data('id');
            await this.showManagePatrolsDialog(id);
          });
        },
        close: () => resolve(),
      });
      d.render(true);
    });
  }

  /**
   * Show patrols management for an organization
   */
  public async showManagePatrolsDialog(organizationId: string): Promise<void> {
    const organization = this.documentManager.getGuardOrganization(organizationId);
    if (!organization) return;

    const patrols = this.documentManager.getPatrolsForOrganization(organizationId);

    const content = `
      <div style="padding: 10px;">
        <h3>Patrols for ${organization.name}</h3>
        <div style="margin-bottom: 10px;">
          <button type="button" id="create-patrol-btn" style="background: #4caf50; color: white; padding: 5px 10px; border: none; border-radius: 3px;">
            Create New Patrol
          </button>
        </div>
        <ul style="list-style: none; padding: 0;">
          ${patrols
            .map(
              (patrol) => `
            <li style="margin: 5px 0; padding: 10px; border: 1px solid #ccc; border-radius: 3px;">
              <strong>${patrol.name}</strong>
              <br>
              <small>
                Units: ${patrol.system.unitCount} |
                Status: ${patrol.system.status} |
                Leader: ${patrol.system.leaderId || 'None'}
              </small>
              <div style="margin-top: 5px;">
                <button type="button" data-action="edit-patrol" data-id="${patrol.id}" style="background: #ff9800; color: white; padding: 2px 6px; border: none; border-radius: 2px; font-size: 11px;">
                  Edit
                </button>
                <button type="button" data-action="delete-patrol" data-id="${patrol.id}" style="background: #f44336; color: white; padding: 2px 6px; border: none; border-radius: 2px; font-size: 11px; margin-left: 3px;">
                  Delete
                </button>
              </div>
            </li>
          `
            )
            .join('')}
        </ul>
        ${patrols.length === 0 ? '<p><em>No patrols found for this organization.</em></p>' : ''}
      </div>
    `;

    return new Promise((resolve) => {
      const d = new Dialog({
        title: `Patrols - ${organization.name}`,
        content: content,
        buttons: {
          back: {
            label: 'Back to Organizations',
            callback: () => {
              resolve();
              setTimeout(() => this.showManageOrganizationsDialog(), 100);
            },
          },
          close: {
            label: 'Close',
            callback: () => resolve(),
          },
        },
        render: (html: JQuery) => {
          // Handle create patrol
          html.find('#create-patrol-btn').on('click', async () => {
            const name = await this.promptForInput('Patrol Name', 'Enter patrol name:');
            if (name) {
              await this.documentManager.createPatrol({
                name,
                organizationId,
                unitCount: 1,
                status: 'idle',
              });
              d.close();
              setTimeout(() => this.showManagePatrolsDialog(organizationId), 100);
            }
          });

          // Handle edit patrol
          html.find('button[data-action="edit-patrol"]').on('click', async (_event) => {
            // TODO: Implement patrol editing
            ui.notifications?.info('Patrol editing not yet implemented');
          });

          // Handle delete patrol
          html.find('button[data-action="delete-patrol"]').on('click', async (event) => {
            const id = $(event.currentTarget).data('id');
            const patrol = game?.actors?.get(id);
            if (patrol && confirm(`Delete ${patrol.name}?`)) {
              await this.documentManager.deletePatrol(id);
              d.close();
              setTimeout(() => this.showManagePatrolsDialog(organizationId), 100);
            }
          });
        },
        close: () => resolve(),
      });
      d.render(true);
    });
  }

  /**
   * Edit an organization
   */
  private async editOrganization(id: string): Promise<void> {
    const org = this.documentManager.getGuardOrganization(id);
    if (!org) return;

    const content = `
      <form>
        <div style="margin-bottom: 10px;">
          <label>Name:</label>
          <input type="text" id="org-name" value="${org.name}" style="width: 100%; padding: 5px;">
        </div>
        <div style="margin-bottom: 10px;">
          <label>Subtitle:</label>
          <input type="text" id="org-subtitle" value="${org.system.subtitle || ''}" style="width: 100%; padding: 5px;">
        </div>
        <div style="margin-bottom: 10px;">
          <h4>Base Stats:</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label>Robustismo:</label>
              <input type="number" id="stat-robustismo" value="${org.system.baseStats.robustismo}" min="-99" max="99" style="width: 100%; padding: 5px;">
            </div>
            <div>
              <label>Analítica:</label>
              <input type="number" id="stat-analitica" value="${org.system.baseStats.analitica}" min="-99" max="99" style="width: 100%; padding: 5px;">
            </div>
            <div>
              <label>Subterfugio:</label>
              <input type="number" id="stat-subterfugio" value="${org.system.baseStats.subterfugio}" min="-99" max="99" style="width: 100%; padding: 5px;">
            </div>
            <div>
              <label>Elocuencia:</label>
              <input type="number" id="stat-elocuencia" value="${org.system.baseStats.elocuencia}" min="-99" max="99" style="width: 100%; padding: 5px;">
            </div>
          </div>
        </div>
      </form>
    `;

    return new Promise((resolve) => {
      const d = new Dialog({
        title: `Edit ${org.name}`,
        content: content,
        buttons: {
          save: {
            label: 'Save',
            callback: async (html: JQuery) => {
              const name = html.find('#org-name').val() as string;
              const subtitle = html.find('#org-subtitle').val() as string;
              const baseStats = {
                robustismo: parseInt(html.find('#stat-robustismo').val() as string) || 10,
                analitica: parseInt(html.find('#stat-analitica').val() as string) || 10,
                subterfugio: parseInt(html.find('#stat-subterfugio').val() as string) || 10,
                elocuencia: parseInt(html.find('#stat-elocuencia').val() as string) || 10,
              };

              await this.documentManager.updateGuardOrganization(id, {
                name,
                subtitle,
                baseStats,
                version: org.system.version + 1,
              });

              resolve();
            },
          },
          cancel: {
            label: 'Cancel',
            callback: () => resolve(),
          },
        },
        close: () => resolve(),
      });
      d.render(true);
    });
  }

  /**
   * Simple input prompt
   */
  private async promptForInput(title: string, label: string): Promise<string | null> {
    return new Promise((resolve) => {
      const d = new Dialog({
        title: title,
        content: `
          <form>
            <div style="margin-bottom: 10px;">
              <label>${label}</label>
              <input type="text" id="input-value" style="width: 100%; padding: 5px;">
            </div>
          </form>
        `,
        buttons: {
          ok: {
            label: 'OK',
            callback: (html: JQuery) => {
              const value = html.find('#input-value').val() as string;
              resolve(value?.trim() || null);
            },
          },
          cancel: {
            label: 'Cancel',
            callback: () => resolve(null),
          },
        },
        close: () => resolve(null),
      });
      d.render(true);
    });
  }

  /**
   * Cleanup when module is disabled
   */
  public cleanup(): void {
    console.log('SimpleGuardDialogManager | Cleaning up...');
  }
}
