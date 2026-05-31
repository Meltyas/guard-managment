/**
 * MCPBridgeIntegration
 *
 * Registers guard-management tools with the foundry-mcp-bridge module.
 * Tools are registered in CONFIG.queries under the "guard-management.*" namespace.
 *
 * The bridge wraps results as { success: true, data: <handler return value> },
 * so handlers return the payload directly and throw on error.
 */

import type { GuardManagementModule } from '../main';

type ToolHandler = (data: any) => Promise<any>;

function gmOnly(fn: ToolHandler): ToolHandler {
  return async (data) => {
    if (!(game as any)?.user?.isGM) {
      throw new Error('GM permission required');
    }
    return fn(data);
  };
}

const TOOL_KEYS: string[] = [];

/** Dispatch a UI refresh event so the floating panel re-renders without F5 */
function uiRefresh(documentType: string): void {
  document.dispatchEvent(new CustomEvent('guard-ui-refresh', { detail: { documentType } }));
}

/** Wrap a mutating handler so it triggers a UI refresh after completing */
function withRefresh(documentType: string, fn: ToolHandler): ToolHandler {
  return async (data) => {
    const result = await fn(data);
    uiRefresh(documentType);
    return result;
  };
}

/** GM-only + auto UI refresh for mutating operations */
function gmMutation(documentType: string, fn: ToolHandler): ToolHandler {
  return gmOnly(withRefresh(documentType, fn));
}

export class MCPBridgeIntegration {
  static register(module: GuardManagementModule): void {
    if (!game.modules?.get('foundry-mcp-bridge')?.active) return;

    const org = module.guardOrganizationManager;
    const officer = module.officerManager;
    const resource = module.resourceManager;
    const reputation = module.reputationManager;
    const crime = module.crimeManager;
    const gang = module.gangManager;
    const poi = module.poiManager;
    const prisoner = module.prisonerManager;
    const building = module.buildingManager;
    const finance = module.financeManager;
    const phase = module.phaseManager;
    const phaseEvent = module.phaseEventManager;

    const tools: Record<string, ToolHandler> = {
      // ── Organizations ──────────────────────────────────────────────────
      'guard-management.organizations.list': gmOnly(async () => org.getAllOrganizations()),
      'guard-management.organizations.get': gmOnly(async ({ id }) => org.getOrganization(id)),
      'guard-management.organizations.create': gmMutation('guard-management.organizations', async (data) => org.createOrganization(data)),
      'guard-management.organizations.update': gmMutation('guard-management.organizations', async (data) => org.updateOrganization(data)),
      'guard-management.organizations.delete': gmMutation('guard-management.organizations', async ({ id }) => org.deleteOrganization(id)),

      // ── Patrols (operate on the currently active organization) ─────────
      'guard-management.patrols.list': gmOnly(async () => org.listOrganizationPatrols()),
      'guard-management.patrols.create': gmMutation('guard-management.patrols', async (data) => org.createPatrolForOrganization(data)),
      'guard-management.patrols.delete': gmMutation('guard-management.patrols', async ({ patrolId }) => org.removePatrol(patrolId)),

      // ── Officers ───────────────────────────────────────────────────────
      'guard-management.officers.list': gmOnly(async () => officer.getOfficers()),
      'guard-management.officers.create': gmMutation('guard-management.officers', async (data) => officer.createOfficer(data)),
      'guard-management.officers.update': gmMutation('guard-management.officers', async ({ id, ...updates }) => officer.updateOfficer(id, updates)),
      'guard-management.officers.delete': gmMutation('guard-management.officers', async ({ id }) => officer.deleteOfficer(id)),

      // ── Resources ──────────────────────────────────────────────────────
      'guard-management.resources.list': gmOnly(async () => resource.getAllResources()),
      'guard-management.resources.create': gmMutation('guard-management.resources', async (data) => resource.createResource(data)),
      'guard-management.resources.update': gmMutation('guard-management.resources', async ({ id, ...updates }) => resource.updateResource(id, updates)),
      'guard-management.resources.delete': gmMutation('guard-management.resources', async ({ id }) => resource.deleteResource(id)),

      // ── Reputation ─────────────────────────────────────────────────────
      'guard-management.reputations.list': gmOnly(async () => reputation.getAllReputations()),
      'guard-management.reputations.create': gmMutation('guard-management.reputations', async (data) => reputation.createReputation(data)),
      'guard-management.reputations.update': gmMutation('guard-management.reputations', async ({ id, ...updates }) => reputation.updateReputation(id, updates)),
      'guard-management.reputations.delete': gmMutation('guard-management.reputations', async ({ id }) => reputation.deleteReputation(id)),

      // ── Crimes ─────────────────────────────────────────────────────────
      'guard-management.crimes.list': gmOnly(async () => crime.getAllCrimes()),
      'guard-management.crimes.create': gmMutation('guard-management.crimes', async (data) => crime.createCrime(data)),
      'guard-management.crimes.update': gmMutation('guard-management.crimes', async ({ id, ...updates }) => crime.updateCrime(id, updates)),
      'guard-management.crimes.delete': gmMutation('guard-management.crimes', async ({ id }) => crime.deleteCrime(id)),

      // ── Gangs ──────────────────────────────────────────────────────────
      'guard-management.gangs.list': gmOnly(async () => gang.getAllGangs()),
      'guard-management.gangs.create': gmMutation('guard-management.gangs', async (data) => gang.addGang(data)),
      'guard-management.gangs.update': gmMutation('guard-management.gangs', async ({ id, ...updates }) => gang.updateGang(id, updates)),
      'guard-management.gangs.delete': gmMutation('guard-management.gangs', async ({ id }) => gang.deleteGang(id)),

      // ── POIs ───────────────────────────────────────────────────────────
      'guard-management.pois.list': gmOnly(async () => poi.getAllPois()),
      'guard-management.pois.create': gmMutation('guard-management.pois', async (data) => poi.addPoi(data)),
      'guard-management.pois.update': gmMutation('guard-management.pois', async ({ id, ...updates }) => poi.updatePoi(id, updates)),
      'guard-management.pois.delete': gmMutation('guard-management.pois', async ({ id }) => poi.deletePoi(id)),

      // ── Prisoners ──────────────────────────────────────────────────────
      'guard-management.prisoners.list': gmOnly(async () => prisoner.getAllPrisoners()),
      'guard-management.prisoners.create': gmMutation('guard-management.prisoners', async (data) => prisoner.addPrisoner(data)),
      'guard-management.prisoners.update': gmMutation('guard-management.prisoners', async ({ id, ...updates }) => prisoner.updatePrisoner(id, updates)),
      'guard-management.prisoners.delete': gmMutation('guard-management.prisoners', async ({ id }) => prisoner.removePrisoner(id)),

      // ── Buildings ──────────────────────────────────────────────────────
      'guard-management.buildings.list': gmOnly(async () => building.getAllBuildings()),
      'guard-management.buildings.create': gmMutation('guard-management.buildings', async (data) => building.addBuilding(data)),
      'guard-management.buildings.update': gmMutation('guard-management.buildings', async ({ id, ...updates }) => building.updateBuilding(id, updates)),
      'guard-management.buildings.delete': gmMutation('guard-management.buildings', async ({ id }) => building.deleteBuilding(id)),
      'guard-management.buildings.activate': gmMutation('guard-management.buildings', async ({ id }) => building.activateBuilding(id)),
      'guard-management.buildings.deactivate': gmMutation('guard-management.buildings', async ({ id }) => building.deactivateBuilding(id)),
      'guard-management.buildings.setHidden': gmMutation('guard-management.buildings', async ({ id, hidden }) => building.setHidden(id, hidden)),

      // ── Finance ────────────────────────────────────────────────────────
      'guard-management.finance.get': gmOnly(async () => ({
        budget: finance.getAllBudgetEntries(),
        expenses: finance.getAllExpenses(),
        totalBudget: finance.getTotalBudget(),
        expectedNextTurn: finance.getExpectedNextTurn(),
        recurringNet: finance.getRecurringNet(),
        history: finance.getHistory(),
      })),

      // ── Phase ──────────────────────────────────────────────────────────
      'guard-management.phase.get': gmOnly(async () => phase.getPhaseData()),
      'guard-management.phase.advance': gmMutation('guard-management.phase', async () => phase.advanceTurn()),

      // ── Phase Events ───────────────────────────────────────────────────
      'guard-management.phaseEvents.list': gmOnly(async () => phaseEvent.getAllEvents()),
      'guard-management.phaseEvents.get': gmOnly(async ({ id }) => phaseEvent.getEvent(id)),
      'guard-management.phaseEvents.search': gmOnly(async (filters) => phaseEvent.searchEvents(filters || {})),
      'guard-management.phaseEvents.create': gmMutation('guard-management.phaseEvents', async (data) => phaseEvent.createEvent(data)),
      'guard-management.phaseEvents.update': gmMutation('guard-management.phaseEvents', async ({ id, ...updates }) => phaseEvent.updateEvent(id, updates)),
      'guard-management.phaseEvents.cancel': gmMutation('guard-management.phaseEvents', async ({ id }) => phaseEvent.cancelEvent(id)),
      'guard-management.phaseEvents.delete': gmMutation('guard-management.phaseEvents', async ({ id }) => phaseEvent.deleteEvent(id)),

      // ── Phase Reports ──────────────────────────────────────────────────
      'guard-management.phaseReports.list': gmOnly(async () => phaseEvent.getAllReports()),
      'guard-management.phaseReports.get': gmOnly(async ({ turn }) => phaseEvent.getReport(turn)),
      'guard-management.phaseReports.search': gmOnly(async (filters) => phaseEvent.searchReports(filters || {})),
    };

    const queries = (CONFIG as any).queries ?? {};
    for (const [key, handler] of Object.entries(tools)) {
      queries[key] = handler;
      TOOL_KEYS.push(key);
    }
    (CONFIG as any).queries = queries;

    console.log(`Guard Management | Registered ${TOOL_KEYS.length} MCP tools`);
  }

  static unregister(): void {
    const queries = (CONFIG as any).queries;
    if (!queries) return;
    for (const key of TOOL_KEYS) {
      delete queries[key];
    }
    TOOL_KEYS.length = 0;
    console.log('Guard Management | Unregistered MCP tools');
  }
}
