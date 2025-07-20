/**
 * Main Dialog Manager - Coordinates all dialogs and provides entry points
 */

import { GuardOrganizationManager } from '../managers/GuardOrganizationManager';

export class GuardDialogManager {
  private guardOrganizationManager: GuardOrganizationManager;

  constructor(guardOrganizationManager: GuardOrganizationManager) {
    this.guardOrganizationManager = guardOrganizationManager;
  }

  /**
   * Open the main Guard Management dialog
   */
  public async showMainDialog(): Promise<void> {
    try {
      const organizations = this.guardOrganizationManager.getAllOrganizations();
      
      if (organizations.length === 0) {
        // No organizations exist, prompt to create first one
        const shouldCreate = await this.showWelcomeDialog();
        if (shouldCreate) {
          await this.guardOrganizationManager.showCreateDialog();
        }
        return;
      }

      // Show organization selection dialog
      await this.showOrganizationListDialog(organizations);
    } catch (error) {
      console.error('GuardDialogManager | Error showing main dialog:', error);
      ui?.notifications?.error('Error al abrir el gestor de guardias');
    }
  }

  /**
   * Show welcome dialog for first time users
   */
  private async showWelcomeDialog(): Promise<boolean> {
    try {
      const result = await (globalThis as any).DialogV2.query({
        window: { 
          title: 'Bienvenido al Gestor de Guardias',
          id: 'guard-welcome-dialog',
        },
        content: `
          <div class="guard-welcome">
            <h2>🛡️ Gestor de Guardias</h2>
            <p>No hay organizaciones de guardias creadas aún.</p>
            <p>¿Te gustaría crear tu primera organización de guardias?</p>
            
            <div class="welcome-info">
              <h3>Con el Gestor de Guardias podrás:</h3>
              <ul>
                <li>✅ Crear organizaciones de guardias</li>
                <li>✅ Gestionar patrullas y unidades</li>
                <li>✅ Administrar recursos y reputación</li>
                <li>✅ Aplicar modificadores y efectos</li>
                <li>✅ Sincronizar datos entre GM y jugadores</li>
              </ul>
            </div>
          </div>
          
          <style>
            .guard-welcome {
              padding: 1rem;
              text-align: center;
            }
            
            .guard-welcome h2 {
              color: #f0f0e0;
              margin-bottom: 1rem;
            }
            
            .guard-welcome p {
              margin: 0.5rem 0;
              color: #d0d0d0;
            }
            
            .welcome-info {
              margin-top: 1.5rem;
              text-align: left;
              background: rgba(0, 0, 0, 0.3);
              padding: 1rem;
              border-radius: 4px;
            }
            
            .welcome-info h3 {
              color: #f0f0e0;
              margin-bottom: 0.5rem;
            }
            
            .welcome-info ul {
              margin: 0;
              padding-left: 1.5rem;
            }
            
            .welcome-info li {
              color: #d0d0d0;
              margin: 0.25rem 0;
            }
          </style>
        `,
        buttons: [
          {
            action: 'create',
            icon: 'fas fa-plus',
            label: 'Crear Primera Organización',
            default: true,
            callback: () => true,
          },
          {
            action: 'cancel',
            icon: 'fas fa-times',
            label: 'Cancelar',
            callback: () => false,
          },
        ],
      });

      return result === true;
    } catch (error) {
      console.error('GuardDialogManager | Error showing welcome dialog:', error);
      return false;
    }
  }

  /**
   * Show organization list dialog
   */
  private async showOrganizationListDialog(organizations: any[]): Promise<void> {
    try {
      const organizationsList = organizations.map(org => `
        <div class="organization-item" data-id="${org.id}">
          <div class="org-header">
            <h3>${org.name}</h3>
            <span class="org-subtitle">${org.subtitle}</span>
          </div>
          <div class="org-stats">
            <span>Rob: ${org.baseStats.robustismo}</span>
            <span>Ana: ${org.baseStats.analitica}</span>
            <span>Sub: ${org.baseStats.subterfugio}</span>
            <span>Elo: ${org.baseStats.elocuencia}</span>
          </div>
          <div class="org-actions">
            <button type="button" class="edit-org" data-id="${org.id}">
              <i class="fas fa-edit"></i> Editar
            </button>
            <button type="button" class="manage-org" data-id="${org.id}">
              <i class="fas fa-shield"></i> Gestionar
            </button>
          </div>
        </div>
      `).join('');

      await (globalThis as any).DialogV2.query({
        window: { 
          title: 'Gestión de Organizaciones de Guardias',
          id: 'guard-organizations-list',
          resizable: true,
        },
        content: `
          <div class="organizations-list">
            <div class="list-header">
              <h2>Organizaciones de Guardias</h2>
              <button type="button" class="create-new-org">
                <i class="fas fa-plus"></i> Nueva Organización
              </button>
            </div>
            
            <div class="organizations-container">
              ${organizationsList}
            </div>
          </div>
          
          <style>
            .organizations-list {
              padding: 1rem;
              min-width: 500px;
            }
            
            .list-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 1rem;
              padding-bottom: 0.5rem;
              border-bottom: 2px solid #444;
            }
            
            .list-header h2 {
              color: #f0f0e0;
              margin: 0;
            }
            
            .create-new-org {
              background: #28a745;
              color: white;
              border: none;
              padding: 0.5rem 1rem;
              border-radius: 4px;
              cursor: pointer;
            }
            
            .organizations-container {
              display: flex;
              flex-direction: column;
              gap: 1rem;
            }
            
            .organization-item {
              background: rgba(255, 255, 255, 0.1);
              border: 1px solid #666;
              border-radius: 4px;
              padding: 1rem;
            }
            
            .org-header h3 {
              color: #f0f0e0;
              margin: 0 0 0.25rem 0;
            }
            
            .org-subtitle {
              color: #bbb;
              font-style: italic;
            }
            
            .org-stats {
              display: flex;
              gap: 1rem;
              margin: 0.5rem 0;
              color: #d0d0d0;
              font-size: 0.9rem;
            }
            
            .org-actions {
              display: flex;
              gap: 0.5rem;
              margin-top: 0.5rem;
            }
            
            .org-actions button {
              background: #007bff;
              color: white;
              border: none;
              padding: 0.25rem 0.5rem;
              border-radius: 3px;
              cursor: pointer;
              font-size: 0.8rem;
            }
            
            .edit-org {
              background: #ffc107 !important;
              color: black !important;
            }
          </style>
          
          <script>
            document.addEventListener('click', (e) => {
              if (e.target.classList.contains('create-new-org')) {
                window.GuardManagement?.guardOrganizationManager?.showCreateDialog();
              } else if (e.target.classList.contains('edit-org')) {
                const orgId = e.target.dataset.id;
                window.GuardManagement?.guardOrganizationManager?.showEditDialog(orgId);
              } else if (e.target.classList.contains('manage-org')) {
                const orgId = e.target.dataset.id;
                // TODO: Open full management interface for this organization
                ui?.notifications?.info('Gestión completa - próximamente');
              }
            });
          </script>
        `,
        buttons: [
          {
            action: 'close',
            icon: 'fas fa-times',
            label: 'Cerrar',
            callback: () => null,
          },
        ],
      });
    } catch (error) {
      console.error('GuardDialogManager | Error showing organization list:', error);
    }
  }
}
