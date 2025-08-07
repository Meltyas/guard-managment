/**
 * Guard Organization Dialog - Create/Edit Guard Organizations using DialogV2
 */

import { html, TemplateResult } from 'lit-html';
import type { GuardOrganization, GuardStats } from '../types/entities';
import { DEFAULT_GUARD_STATS } from '../types/entities';
import { renderTemplateToString } from '../utils/template-renderer.js';

export interface GuardOrganizationDialogData {
  name: string;
  subtitle: string;
  robustismo: number;
  analitica: number;
  subterfugio: number;
  elocuencia: number;
}

// New internal type for rendering instead of using any
interface GuardOrganizationFormRenderData {
  name: string;
  subtitle: string;
  baseStats: GuardStats;
}

export class GuardOrganizationDialog {
  // LocalStorage keys
  private static readonly STORAGE_PREFIX = 'guard-management.orgDialog.';
  private static readonly KEY_SELECTED_TAB = GuardOrganizationDialog.STORAGE_PREFIX + 'selectedTab';
  private static readonly KEY_WAS_OPEN = GuardOrganizationDialog.STORAGE_PREFIX + 'wasOpen';
  private static readonly KEY_POS_X = GuardOrganizationDialog.STORAGE_PREFIX + 'posX';
  private static readonly KEY_POS_Y = GuardOrganizationDialog.STORAGE_PREFIX + 'posY';

  constructor() {
    // Constructor
  }

  /**
   * Show the dialog in create or edit mode
   */
  public async show(
    mode: 'create' | 'edit',
    existingOrganization?: GuardOrganization
  ): Promise<GuardOrganization | null> {
    const content = this.generateContent(mode, existingOrganization);
    const title =
      mode === 'create' ? 'Nueva Organización de Guardias' : 'Editar Organización de Guardias';

    try {
      // Usar la forma oficial de acceder a DialogV2 en Foundry V13
      const DialogV2Class = foundry.applications.api.DialogV2;

      if (!DialogV2Class) {
        console.warn('DialogV2 no está disponible, usando Dialog estándar como fallback');
        return this.showWithStandardDialog(mode, existingOrganization);
      }

      const result = await DialogV2Class.wait({
        window: {
          title,
          resizable: true,
        },
        content,
        buttons: [
          {
            action: 'save',
            icon: 'fas fa-save',
            label: mode === 'create' ? 'Crear' : 'Guardar',
            default: true,
            callback: (event: Event, button: any, dialog: any) => {
              try {
                console.log('Dialog callback triggered', { dialog, event, button });
                console.log('Dialog properties:', Object.keys(dialog));
                console.log('Event target:', event.target);
                console.log('Event currentTarget:', event.currentTarget);

                // En DialogV2, necesitamos usar diferentes métodos para acceder al contenido
                let form: HTMLFormElement | null = null;

                // Primero intentar con el event target
                if (event.target && event.target instanceof Element) {
                  form = event.target.closest('form') as HTMLFormElement;
                  if (!form) {
                    // Buscar el formulario en el elemento padre
                    const dialogElement = event.target.closest('.dialog');
                    if (dialogElement) {
                      form = dialogElement.querySelector('form.guard-organization-form');
                    }
                  }
                }

                // Si no encontramos el formulario con el event, intentar con el dialog
                if (!form && dialog.form) {
                  form = dialog.form;
                } else if (!form && dialog.element) {
                  form = dialog.element.querySelector('form.guard-organization-form');
                } else if (!form && dialog.contentElement) {
                  form = dialog.contentElement.querySelector('form.guard-organization-form');
                } else if (!form) {
                  // Buscar en el DOM usando el ID del diálogo
                  const dialogElement =
                    document.querySelector(`[data-appid="${dialog.id}"]`) ||
                    document.querySelector('.dialog.window-app:last-child') ||
                    document.querySelector('[data-app-id]:last-child');

                  if (dialogElement) {
                    form = dialogElement.querySelector('form.guard-organization-form');
                  }

                  // Último recurso: buscar en todo el documento
                  if (!form) {
                    const allForms = document.querySelectorAll('form.guard-organization-form');
                    form = allForms[allForms.length - 1] as HTMLFormElement; // Tomar el último formulario
                  }
                }

                console.log('Form found:', form);
                console.log('Form element type:', form?.constructor.name);

                if (!form || !(form instanceof HTMLFormElement)) {
                  console.error('No se encontró un HTMLFormElement válido', {
                    form,
                    dialog,
                    dialogId: dialog.id,
                    dialogElement: dialog.element,
                    allForms: document.querySelectorAll('form'),
                    allGuardForms: document.querySelectorAll('form.guard-organization-form'),
                  });

                  // Alternativa: extraer datos directamente por ID de campos
                  console.log('Intentando extraer datos directamente por ID de campos...');
                  const nameInput = document.getElementById('name') as HTMLInputElement;
                  const subtitleInput = document.getElementById('subtitle') as HTMLInputElement;
                  const robustismoInput = document.getElementById('robustismo') as HTMLInputElement;
                  const analiticaInput = document.getElementById('analitica') as HTMLInputElement;
                  const subterfugioInput = document.getElementById(
                    'subterfugio'
                  ) as HTMLInputElement;
                  const elocuenciaInput = document.getElementById('elocuencia') as HTMLInputElement;

                  if (
                    nameInput &&
                    robustismoInput &&
                    analiticaInput &&
                    subterfugioInput &&
                    elocuenciaInput
                  ) {
                    console.log('Datos extraídos directamente de los campos');
                    const data = {
                      name: nameInput.value || '',
                      subtitle: subtitleInput?.value || '',
                      robustismo:
                        robustismoInput.value !== ''
                          ? parseInt(robustismoInput.value)
                          : DEFAULT_GUARD_STATS.robustismo,
                      analitica:
                        analiticaInput.value !== ''
                          ? parseInt(analiticaInput.value)
                          : DEFAULT_GUARD_STATS.analitica,
                      subterfugio:
                        subterfugioInput.value !== ''
                          ? parseInt(subterfugioInput.value)
                          : DEFAULT_GUARD_STATS.subterfugio,
                      elocuencia:
                        elocuenciaInput.value !== ''
                          ? parseInt(elocuenciaInput.value)
                          : DEFAULT_GUARD_STATS.elocuencia,
                    };

                    console.log('Data extracted directly:', data);

                    // Validar datos
                    const validationResult = this.validateDataWithDetails(data);
                    if (!validationResult.isValid) {
                      console.error('Validation failed:', validationResult);
                      ui?.notifications?.error(validationResult.errorMessage);
                      return false;
                    }

                    return data;
                  }

                  ui?.notifications?.error('No se pudo encontrar el formulario ni los campos');
                  return false;
                }

                const formData = new FormData(form);
                console.log('FormData created:', formData);

                // Log de todos los valores del formulario para debug
                for (const [key, value] of formData.entries()) {
                  console.log(`FormData ${key}:`, value);
                }

                const data = this.extractFormData(formData);
                console.log('Data extracted:', data);

                // Validar datos
                const validationResult = this.validateDataWithDetails(data);
                if (!validationResult.isValid) {
                  console.error('Validation failed:', validationResult);

                  // Resaltar campos con errores
                  this.highlightErrorFields(form, validationResult.errorFields);

                  ui?.notifications?.error(validationResult.errorMessage);
                  return false;
                }

                return data;
              } catch (error) {
                console.error('Error in dialog callback:', error);
                if (error instanceof Error) {
                  console.error('Error stack:', error.stack);
                }
                ui?.notifications?.error('Error al procesar el formulario');
                return false;
              }
            },
          },
          {
            action: 'cancel',
            icon: 'fas fa-times',
            label: 'Cancelar',
            callback: () => null,
          },
        ],
      });

      if (result) {
        return this.createOrganizationFromData(result, mode, existingOrganization);
      }

      return null;
    } catch (error) {
      console.error('GuardOrganizationDialog | Error showing dialog:', error);
      ui?.notifications?.error('Error al mostrar el diálogo de organización');
      return null;
    }
  }

  /**
   * Generate the HTML content for the dialog
   */
  public generateContent(_mode: 'create' | 'edit', organization?: GuardOrganization): string {
    const data: GuardOrganizationFormRenderData = organization
      ? {
          name: organization.name ?? '',
          subtitle: organization.subtitle ?? '',
          baseStats: { ...organization.baseStats },
        }
      : { name: '', subtitle: '', baseStats: { ...DEFAULT_GUARD_STATS } };

    const selectedTab =
      window.localStorage.getItem(GuardOrganizationDialog.KEY_SELECTED_TAB) || 'general';

    const template = this.renderOrganizationForm(data);
    const formHtml = renderTemplateToString(template);

    // Left tabs enhanced UI
    const tabsHtml = `
      <div class="guard-org-dialog-layout" data-current-tab="${selectedTab}">
        <nav class="guard-org-tabs" data-initial-tab="${selectedTab}" role="tablist" aria-orientation="vertical">
          <button type="button" class="tab-btn" role="tab" aria-selected="false" data-tab="general">
            <i class="fas fa-info-circle"></i><span>General</span>
          </button>
          <button type="button" class="tab-btn" role="tab" aria-selected="false" data-tab="patrols">
            <i class="fas fa-users"></i><span>Patrullas</span>
          </button>
          <div class="active-bar" aria-hidden="true"></div>
        </nav>
        <div class="guard-org-tab-content">
          <header class="tab-dynamic-header"><h2 data-tab-title></h2></header>
          <section class="tab-panel" role="tabpanel" data-tab-panel="general">${formHtml}</section>
          <section class="tab-panel" role="tabpanel" data-tab-panel="patrols">
            <div class="patrols-placeholder">
              <h3><i class='fas fa-users'></i> Patrullas</h3>
              <p class="muted">Interfaz de gestión de patrullas próximamente.</p>
              <ul class="placeholder-list">
                <li><i class="fas fa-plus-circle"></i> Crear patrulla</li>
                <li><i class="fas fa-sync"></i> Sincronización en tiempo real</li>
                <li><i class="fas fa-bolt"></i> Efectos y modificadores</li>
              </ul>
              <div class="coming-soon-pill">EN CONSTRUCCIÓN</div>
            </div>
          </section>
        </div>
      </div>
      <script>(function(){
        const LS_TAB='${GuardOrganizationDialog.KEY_SELECTED_TAB}';
        const LS_OPEN='${GuardOrganizationDialog.KEY_WAS_OPEN}';
        const LS_X='${GuardOrganizationDialog.KEY_POS_X}';
        const LS_Y='${GuardOrganizationDialog.KEY_POS_Y}';
        try{localStorage.setItem(LS_OPEN,'true');}catch(e){}
        const dialogEl=document.querySelector('.dialog.window-app:last-of-type');
        // Restore position
        try{ if(dialogEl){ const x=parseInt(localStorage.getItem(LS_X)||''); const y=parseInt(localStorage.getItem(LS_Y)||''); if(!isNaN(x)&&!isNaN(y)){ dialogEl.style.left=x+'px'; dialogEl.style.top=y+'px'; }
          const header=dialogEl.querySelector('.window-header'); if(header){ header.addEventListener('mouseup',()=>{ requestAnimationFrame(()=>{ const r=dialogEl.getBoundingClientRect(); try{localStorage.setItem(LS_X,String(r.left));localStorage.setItem(LS_Y,String(r.top));}catch(e){} }); }); }
        }}catch(e){}

        const tabsRoot=document.querySelector('.guard-org-tabs');
        const buttons=[...document.querySelectorAll('.guard-org-tabs .tab-btn')];
        const panels=[...document.querySelectorAll('.guard-org-tab-content .tab-panel')];
        const activeBar=tabsRoot?.querySelector('.active-bar');
        const titleEl=document.querySelector('[data-tab-title]');
        const tabTitles={general:'Organización', patrols:'Patrullas'};

        function positionActiveBar(btn){ if(!activeBar||!btn) return; const rect=btn.getBoundingClientRect(); const parentRect=tabsRoot.getBoundingClientRect(); activeBar.style.top=(btn.offsetTop)+'px'; activeBar.style.height=btn.offsetHeight+'px'; }

        function activate(tab){ buttons.forEach(b=>{ const on=b.dataset.tab===tab; b.classList.toggle('active',on); b.setAttribute('aria-selected', on? 'true':'false'); });
          panels.forEach(p=> p.classList.toggle('active', p.dataset.tabPanel===tab));
          document.querySelector('.guard-org-dialog-layout')?.setAttribute('data-current-tab',tab);
          try{localStorage.setItem(LS_TAB,tab);}catch(e){}
          const activeBtn=buttons.find(b=>b.dataset.tab===tab); positionActiveBar(activeBtn); if(titleEl) titleEl.textContent=tabTitles[tab]||'';
        }

        const initial=tabsRoot?.getAttribute('data-initial-tab')||'general';
        activate(initial);
        window.requestAnimationFrame(()=>{ const activeBtn=buttons.find(b=>b.classList.contains('active')); positionActiveBar(activeBtn); });

        // Click handlers
        buttons.forEach(b=> b.addEventListener('click', ()=> activate(b.dataset.tab)));

        // Keyboard navigation (Up/Down / W/S)
        document.addEventListener('keydown', (ev)=>{
          if(!dialogEl || !document.body.contains(dialogEl)) return; // dialog closed
          if(['ArrowUp','ArrowDown','w','s','W','S'].includes(ev.key)){
            const idx=buttons.findIndex(b=> b.classList.contains('active'));
            if(idx>-1){ let nextIdx=idx + (ev.key==='ArrowUp' || ev.key==='w' || ev.key==='W'? -1: 1); if(nextIdx<0) nextIdx=buttons.length-1; if(nextIdx>=buttons.length) nextIdx=0; activate(buttons[nextIdx].dataset.tab); buttons[nextIdx].focus(); ev.preventDefault(); }
          }
        });

        // Cleanup
        const observer=new MutationObserver(()=>{ if(dialogEl && !document.body.contains(dialogEl)){ try{localStorage.setItem(LS_OPEN,'false');}catch(e){} observer.disconnect(); }});
        if(dialogEl) observer.observe(document.body,{childList:true,subtree:true});
      })();</script>`;
    return tabsHtml;
  }

  /**
   * Render the complete organization form
   */
  private renderOrganizationForm(data: GuardOrganizationFormRenderData): TemplateResult {
    return html`${this.renderFormContent(data)}`; // styles moved to external CSS file
  }

  /**
   * Render form content section
   */
  private renderFormContent(data: GuardOrganizationFormRenderData): TemplateResult {
    return html`
      <form class="guard-organization-form" data-form-scope="guard-organization">
        ${this.renderBasicInfoSection(data)} ${this.renderStatsSection(data)}
        ${this.renderInfoSection()}
      </form>
    `;
  }

  /**
   * Render basic information section
   */
  private renderBasicInfoSection(data: GuardOrganizationFormRenderData): TemplateResult {
    return html`
      <div class="form-group">
        <label for="name">Nombre de la Organización *</label>
        <input
          type="text"
          name="name"
          id="name"
          value="${data.name}"
          placeholder="ej: Guardia de la Ciudad"
          required
        />
      </div>

      <div class="form-group">
        <label for="subtitle">Subtítulo</label>
        <input
          type="text"
          name="subtitle"
          id="subtitle"
          value="${data.subtitle}"
          placeholder="ej: Protectores del Reino"
        />
      </div>
    `;
  }

  /**
   * Render stats section
   */
  private renderStatsSection(data: GuardOrganizationFormRenderData): TemplateResult {
    const stats: Array<{ key: keyof GuardStats; label: string }> = [
      { key: 'robustismo', label: 'Robustismo' },
      { key: 'analitica', label: 'Analítica' },
      { key: 'subterfugio', label: 'Subterfugio' },
      { key: 'elocuencia', label: 'Elocuencia' },
    ];

    return html`
      <div class="stats-section">
        <h3>Estadísticas Base</h3>
        <div class="stats-grid">
          ${stats.map((s) => this.renderStatInput(s.key, s.label, data))}
        </div>
      </div>
    `;
  }

  /**
   * Render individual stat input
   */
  private renderStatInput(
    statName: keyof GuardStats,
    label: string,
    data: GuardOrganizationFormRenderData
  ): TemplateResult {
    const value =
      data.baseStats?.[statName] !== undefined
        ? data.baseStats[statName]
        : (DEFAULT_GUARD_STATS as any)[statName];

    return html`
      <div class="stat-input">
        <label for="${statName}">${label}</label>
        <input
          type="number"
          name="${statName}"
          id="${statName}"
          value="${value}"
          min="-99"
          max="99"
          required
        />
      </div>
    `;
  }

  /**
   * Render information section
   */
  private renderInfoSection(): TemplateResult {
    return html`
      <div class="dialog-info">
        <p><small>* Campos requeridos</small></p>
        <p>
          <small>
            Las estadísticas pueden ser de -99 a 99 y modificadas más tarde mediante modificadores
            de organización.
          </small>
        </p>
      </div>
    `;
  }

  /**
   * Extract form data and convert to typed object
   */
  private extractFormData(formData: FormData): GuardOrganizationDialogData {
    const robustismoValue = formData.get('robustismo') as string;
    const analiticaValue = formData.get('analitica') as string;
    const subterfugioValue = formData.get('subterfugio') as string;
    const elocuenciaValue = formData.get('elocuencia') as string;

    return {
      name: (formData.get('name') as string) || '',
      subtitle: (formData.get('subtitle') as string) || '',
      robustismo:
        robustismoValue !== null && robustismoValue !== ''
          ? parseInt(robustismoValue)
          : DEFAULT_GUARD_STATS.robustismo,
      analitica:
        analiticaValue !== null && analiticaValue !== ''
          ? parseInt(analiticaValue)
          : DEFAULT_GUARD_STATS.analitica,
      subterfugio:
        subterfugioValue !== null && subterfugioValue !== ''
          ? parseInt(subterfugioValue)
          : DEFAULT_GUARD_STATS.subterfugio,
      elocuencia:
        elocuenciaValue !== null && elocuenciaValue !== ''
          ? parseInt(elocuenciaValue)
          : DEFAULT_GUARD_STATS.elocuencia,
    };
  }

  /**
   * Validate the form data
   */
  public validateData(data: GuardOrganizationDialogData): boolean {
    return this.validateDataWithDetails(data).isValid;
  }

  /**
   * Validate the form data with detailed error information
   */
  public validateDataWithDetails(data: GuardOrganizationDialogData): {
    isValid: boolean;
    errorMessage: string;
    errorFields: string[];
  } {
    const errorFields: string[] = [];
    const errors: string[] = [];

    // Check required fields
    if (!data.name || data.name.trim().length === 0) {
      errorFields.push('name');
      errors.push('El nombre es requerido');
    }

    // Check stat ranges
    const statChecks = [
      { value: data.robustismo, name: 'robustismo', label: 'Robustismo' },
      { value: data.analitica, name: 'analitica', label: 'Analítica' },
      { value: data.subterfugio, name: 'subterfugio', label: 'Subterfugio' },
      { value: data.elocuencia, name: 'elocuencia', label: 'Elocuencia' },
    ];

    for (const stat of statChecks) {
      if (stat.value < -99 || stat.value > 99 || isNaN(stat.value)) {
        errorFields.push(stat.name);
        errors.push(`${stat.label} debe estar entre -99 y 99`);
      }
    }

    return {
      isValid: errors.length === 0,
      errorMessage: errors.length > 0 ? errors.join('. ') : '',
      errorFields,
    };
  }

  /**
   * Highlight error fields in the form
   */
  private highlightErrorFields(form: HTMLFormElement, errorFields: string[]): void {
    // Clear previous error highlights
    const allInputs = form.querySelectorAll('input');
    allInputs.forEach((input) => {
      input.classList.remove('error');
      input.style.borderColor = '';
    });

    // Highlight error fields
    errorFields.forEach((fieldName) => {
      const field = form.querySelector(`input[name="${fieldName}"]`) as HTMLInputElement;
      if (field) {
        field.classList.add('error');
        field.style.borderColor = '#ff4444';
        field.style.backgroundColor = 'rgba(255, 68, 68, 0.1)';
      }
    });
  }

  /**
   * Create a GuardOrganization object from dialog data
   */
  private createOrganizationFromData(
    data: GuardOrganizationDialogData,
    mode: 'create' | 'edit',
    existingOrganization?: GuardOrganization
  ): GuardOrganization {
    const baseStats: GuardStats = {
      robustismo: data.robustismo,
      analitica: data.analitica,
      subterfugio: data.subterfugio,
      elocuencia: data.elocuencia,
    };

    if (mode === 'edit' && existingOrganization) {
      return {
        ...existingOrganization,
        name: data.name.trim(),
        subtitle: data.subtitle.trim(),
        baseStats,
        version: existingOrganization.version + 1,
      };
    } else {
      return {
        id: foundry.utils.randomID(),
        name: data.name.trim(),
        subtitle: data.subtitle.trim(),
        version: 1,
        baseStats,
        activeModifiers: [],
        resources: [],
        reputation: [],
        patrols: [],
      };
    }
  }

  /**
   * Fallback method using standard Dialog when DialogV2 is not available
   */
  private async showWithStandardDialog(
    mode: 'create' | 'edit',
    existingOrganization?: GuardOrganization
  ): Promise<GuardOrganization | null> {
    const content = this.generateContent(mode, existingOrganization);
    const title =
      mode === 'create' ? 'Nueva Organización de Guardias' : 'Editar Organización de Guardias';

    return new Promise((resolve) => {
      const dialog = new Dialog({
        title,
        content,
        buttons: {
          save: {
            icon: 'fas fa-save',
            label: mode === 'create' ? 'Crear' : 'Guardar',
            callback: (html: JQuery) => {
              const formData = new FormData(html.find('form')[0] as HTMLFormElement);
              const data = this.extractFormData(formData);

              // Validar con detalles
              const validationResult = this.validateDataWithDetails(data);
              if (!validationResult.isValid) {
                ui?.notifications?.error(validationResult.errorMessage);

                // Resaltar campos con errores
                const form = html.find('form')[0] as HTMLFormElement;
                this.highlightErrorFields(form, validationResult.errorFields);

                // No cerrar el diálogo - crear uno nuevo
                setTimeout(() => {
                  this.showWithStandardDialog(mode, existingOrganization).then(resolve);
                }, 100);
                return;
              }

              const organization = this.createOrganizationFromData(
                data,
                mode,
                existingOrganization
              );
              resolve(organization);
            },
          },
          cancel: {
            icon: 'fas fa-times',
            label: 'Cancelar',
            callback: () => resolve(null),
          },
        },
        default: 'save',
      });

      dialog.render(true);
    });
  }
}
