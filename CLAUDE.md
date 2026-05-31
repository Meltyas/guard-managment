# Guard Management — Project Instructions for Claude Code

## Project Overview

Foundry VTT module (TypeScript + Vite) for managing a city guard organization.
System: Daggerheart 2.x on Foundry VTT v13+.

**Key paths:**
- Module: `C:\Games\foundry\Data\modules\guard-management`
- MCP server: `C:\Users\merty\OneDrive\Documents\projects\foundry-vtt-mcp\packages\mcp-server`
- Campaign world: `C:\Users\merty\OneDrive\Documents\projects\guardiarines`
  - All lore, buildings, NPCs, factions and zones are documented there.
  - Always consult the guardiarines docs when populating or referencing world data.

## Build

```bash
npm run build        # Vite build → dist/
npm run dev          # Watch mode
```

Always verify a clean build after changes. Warnings about dynamic imports are pre-existing and expected.

## Architecture

### Manager Pattern

All game data lives in managers under `src/managers/`. Each manager:
- Stores data in Foundry world settings
- Has `getAll*()` / `get*(id)` / `create*()` / `update*(id, data)` / `delete*(id)` methods
- Is exposed on `GuardManagementModule` as a public property

**Current managers:**
- `guardOrganizationManager` — GuardOrganizationManager (also manages patrols)
- `officerManager` — OfficerManager
- `resourceManager` — SimpleResourceManager
- `reputationManager` — SimpleReputationManager
- `crimeManager` — CrimeManager
- `gangManager` — GangManager
- `poiManager` — PoiManager
- `prisonerManager` — PrisonerManager
- `buildingManager` — BuildingManager
- `financeManager` — FinanceManager
- `phaseManager` — PhaseManager

**When adding a new manager:**
1. Create `src/managers/MyManager.ts`
2. Add as public property on `GuardManagementModule` in `src/main.ts`
3. Initialize in `initialize()`
4. **Expose via MCP** (see MCP section below — this is mandatory)

### MCP Integration (MANDATORY)

Every new manager or significant feature MUST be exposed via MCP.
See `docs/MCP.md` for the complete workflow.

**Files to update when adding MCP tools:**
1. `src/mcp/MCPBridgeIntegration.ts` — register `CONFIG.queries` handlers
2. `C:\Users\merty\OneDrive\Documents\projects\foundry-vtt-mcp\packages\mcp-server\src\tools\guard-management.ts` — add tool definitions + handlers
3. `C:\Users\merty\OneDrive\Documents\projects\foundry-vtt-mcp\packages\mcp-server\src\backend.ts` — add switch cases

**Full CRUD coverage is MANDATORY:**
- Every entity exposed via MCP MUST ship with, at minimum, a **create**, an **update**, a **delete**, and a **list/get** tool.
- Never expose an entity with only a partial set (e.g. only `list` or only `create`). If the manager has CRUD methods, the MCP layer MUST mirror all of them.
- When you add a new manager, wire all four operations in the same change — do not defer create/update/delete to "later".

**Rules for MCP handlers:**
- Return data directly (no `{ success, data }` wrapper)
- Throw errors on failure — the bridge catches them
- Always check real method names in the manager source before wiring

**MCP tool schemas MUST be complete:**
- When a manager method gains a new field, the corresponding MCP tool `inputSchema` MUST be updated immediately.
- If a tool call fails or a field cannot be set via MCP because it is missing from the `inputSchema`, STOP and extend the schema before retrying.
- This applies to all tools: create, update, and any query that filters by field.
- Never leave an `inputSchema` with only `{ id }` if the underlying manager supports more fields.

**Build both projects after changes:**
```bash
# guard-management/
npm run build

# foundry-vtt-mcp/packages/mcp-server/
npm run build
```

Then reload Foundry (F5) and restart the AI tool.

## Code Conventions

- TypeScript strict mode
- No `any` unless interfacing with Foundry's untyped API (`(game as any)`, `(CONFIG as any)`)
- Manager methods are sync for reads, async for writes
- Settings key format: `guard-management.<domain>.<key>`
- All user-facing strings in Spanish (the campaign is in Spanish)

## Foundry API Notes

- `game.settings.get/set` for persistence
- `Hooks.on/once` for lifecycle
- `(game as any).user.isGM` for GM checks
- Socket via `game.socket.emit/on('module.guard-management', ...)`
- Use `foundry.applications.handlebars.loadTemplates(...)` — NOT the deprecated global `loadTemplates(...)`
- Use `foundry.applications.handlebars.renderTemplate(...)` — NOT the deprecated global `renderTemplate(...)`

## Settings-Based Persistence (MANDATORY — NO EXCEPTIONS)

> **⚠️ CRITICAL RULE: ALL data MUST be stored in `game.settings`. NEVER use Foundry Actor documents, Item documents, `CONFIG.Actor.dataModels`, `CONFIG.Item.dataModels`, actor flags, or any other Foundry Document-based storage. Violating this rule causes crashes with Daggerheart (getRollData, isInventoryItem, updateActorsRangeDependentEffects) and orphaned document errors when the module is disabled.**

**ALL data persistence MUST use `game.settings` with `scope: 'world'` for automatic synchronization.**

### Correct Pattern for ALL Managers:

```typescript
export class MyEntityManager {
  private entities: Map<string, MyEntity> = new Map();

  public async loadFromSettings(): Promise<void> {
    const data = game?.settings?.get('guard-management', 'myEntities') as MyEntity[];
    if (Array.isArray(data)) {
      this.entities.clear();
      for (const item of data) this.entities.set(item.id, item);
    }
  }

  private async _saveToSettingsAsync(): Promise<void> {
    await game?.settings?.set('guard-management', 'myEntities', Array.from(this.entities.values()));
  }

  public async createEntity(data: any): Promise<MyEntity> {
    const entity = { id: foundry.utils.randomID(), ...data };
    this.entities.set(entity.id, entity);
    await this._saveToSettingsAsync();
    return entity;
  }

  public async updateEntity(id: string, updates: any): Promise<MyEntity> {
    const entity = this.entities.get(id);
    if (!entity) return null;
    const updated = { ...entity, ...updates };
    this.entities.set(id, updated);
    await this._saveToSettingsAsync();
    return updated;
  }

  public async deleteEntity(id: string): Promise<boolean> {
    const deleted = this.entities.delete(id);
    if (deleted) await this._saveToSettingsAsync();
    return deleted;
  }
}
```

### Prohibited Patterns:

❌ **NO Foundry Actor/Item documents for data storage** — causes Daggerheart crashes
❌ **NO `CONFIG.Actor.dataModels` or `CONFIG.Item.dataModels`**
❌ **NO DocumentBasedManager or TypeDataModel subclasses**
❌ **NO version optimization** — Always save
❌ **NO .catch()** wrapping — Use await directly
❌ **NO queueSave()** debouncing — Save immediately
❌ **NO actor flags** — Settings only
❌ **NO sockets** — Foundry handles sync with `scope: 'world'`
❌ **NO private managers** — All managers must be accessible from `window.GuardManagement`

## Key Implementation Notes

### Z-Index Rules

> **⚠️ CRITICAL: All module dialogs MUST stay below Foundry's FilePicker z-index.**

| Component | z-index | Source |
|---|---|---|
| Custom dialogs (base) | `51` | `main.css` |
| Custom dialogs (focused) | `80` | `main.css` |
| GuardModal (base) | `80` | `GuardModal.ts` |
| BaseWarehouseItemDialog | `80` | `BaseWarehouseItemDialog.ts` |
| OfficerWarehouseDialog | `100` | `OfficerWarehouseDialog.ts` |

**NEVER set z-index above 100** for any dialog or modal.

## Log Pattern (Activity Log)

Every entity that has meaningful state changes MUST maintain an activity log visible to the GM.

### Rules
- Each entity stores a `log?: EntityLogEntry[]` array on its data model.
- Log entries are **never auto-deleted** — only the GM can remove them individually via a delete button in the UI.
- The log is displayed inside the expanded detail of the entity row, as a **collapsible section** (collapsed by default).
- Log entries are shown **newest first** (sort by `timestamp` descending before rendering).

### Log Entry interface (adapt per entity):
```typescript
export interface EntityLogEntry {
  id: string;                  // foundry.utils.randomID()
  action: EntityLogAction;     // string union of action types
  timestamp: number;           // Date.now()
  performedBy: string;         // game.user.name
  details?: string;            // human-readable description in Spanish
  quantityBefore?: number;     // for numeric changes
  quantityAfter?: number;
  turn?: number;               // current guard phase turn if relevant
}
```

### Manager responsibilities
- `_buildLogEntry(action, details?, before?, after?, turn?)` — private helper that sets `id`, `timestamp`, `performedBy`.
- `updateEntity(id, updates, skipLog = false)` — if `skipLog=false` and a quantity-like field changed, auto-append a log entry.
- `deleteLogEntry(entityId, entryId)` — removes a single entry, saves. Called by the GM via the UI.

### CSS
All log styles are in `src/styles/resource-dialog.css` under `/* ── Resource Activity Log */`.
Reuse the same class names (`.resource-log-section`, `.resource-log-entry`, etc.) for all entities.
Color coding: `--positive` (green border), `--negative` (red border), `--pending` (gold border).

## Testing

No automated test suite. Test by:
1. Build and reload Foundry
2. Use browser console to call managers directly
3. Use MCP tools via the AI tool to verify data round-trips

## MCP Quick Reference

These MCP tools are available to you as **direct function calls** — invoke them natively, do NOT use bash or HTTP to call them.

- In **Claude Desktop**: tools are named exactly as listed (e.g. `guard-resources-create`)
- In **Claude Code / OpenCode**: tools carry the server prefix (e.g. `foundry-mcp_guard-resources-create`)

> ⚠️ **CRITICAL**: Guard Management data (resources, reputations, officers, buildings, crimes, gangs, POIs, prisoners, patrols…) is stored in `game.settings`, NOT in Foundry Actors, Items, or Journals.
> - **NEVER** use `manage-world-items`, `list-characters`, `search-compendium`, or any standard Foundry tool to find Guard Management data.
> - **ALWAYS** use the `guard-*` MCP tools below to read or write Guard Management data.
> - If you can't find a resource, officer, or building in Foundry's actor/item lists, that is expected — look it up with `guard-resources-list`, `guard-list-officers`, `guard-buildings-list`, etc.

**If `guard-*` tools do not appear in the available tool list:**
- The MCP server is running an old build — the user must **restart Claude Desktop** to reload the server.
- Or the Guard Management module is not active in Foundry — the user must load it and press F5.
- Do NOT attempt the task using alternative tools. Tell the user to restart Claude Desktop.

Verify MCP tools are registered:
```js
// In Foundry browser console
Object.keys(CONFIG.queries).filter(k => k.startsWith('guard-management'))
```

### MCP Tool Index

All tools follow the pattern `guard-<entity>-<action>`. Use these names directly when calling MCP tools.

| Entity | Tools available |
|---|---|
| **Organizations** | `guard-organizations-list` · `guard-organizations-get` · `guard-organizations-create` · `guard-organizations-update` · `guard-organizations-delete` |
| **Patrols** | `guard-patrols-list` · `guard-patrols-create` · `guard-patrols-update` · `guard-patrols-delete` |
| **Officers** | `guard-list-officers` · `guard-create-officer` · `guard-update-officer` · `guard-delete-officer` |
| **Resources** | `guard-resources-list` · `guard-resources-create` · `guard-resources-update` · `guard-resources-delete` |
| **Reputations** | `guard-reputations-list` · `guard-reputations-create` · `guard-reputations-update` · `guard-reputations-delete` |
| **Crimes** | `guard-crimes-list` · `guard-crimes-create` · `guard-crimes-update` · `guard-crimes-delete` |
| **Gangs** | `guard-gangs-list` · `guard-gangs-create` · `guard-gangs-update` · `guard-gangs-delete` |
| **POIs** | `guard-pois-list` · `guard-pois-create` · `guard-pois-update` · `guard-pois-delete` |
| **Prisoners** | `guard-prisoners-list` · `guard-prisoners-create` · `guard-prisoners-update` · `guard-prisoners-delete` |
| **Buildings** | `guard-buildings-list` · `guard-buildings-create` · `guard-buildings-update` · `guard-buildings-delete` · `guard-buildings-activate` · `guard-buildings-deactivate` · `guard-buildings-setHidden` |
| **Finance** | `guard-finance-get` · `guard-finance-update` |
| **Phase** | `guard-phase-get` · `guard-phase-advance` |
| **Phase Events** | `guard-phase-events-list` · `guard-phase-events-get` · `guard-phase-events-search` · `guard-phase-events-create` · `guard-phase-events-update` · `guard-phase-events-cancel` · `guard-phase-events-delete` |
| **Phase Reports** | `guard-phase-reports-list` · `guard-phase-reports-get` · `guard-phase-reports-search` |

**Key fields per entity (for create/update):**

- **Resource**: `name`, `description`, `quantity` (number), `image` (icon path), `organizationId`
- **Reputation**: `name`, `level` (1–7), `faction`, `category` (`gremio|banda|noble|militar|religiosa|otra`), `trend` (`rising|stable|falling`), `contact`, `gmNotes`, `factionRelations` (array), `favors` (array)
- **Crime**: `name`, `description`, `offenseType` (`minor|major|capital|civil`), `customSentence`
- **Gang**: `name`, `img`, `notes`, `status` (`active|disbanded|arrested|unknown`)
- **POI**: `name`, `actorId`, `img`, `notes`, `possibleCrimes` (crime ID array), `gangIds` (gang ID array), `status` (`active|arrested|released|deceased`)
- **Prisoner**: `name`, `actorId`, `img`, `cellIndex`, `notes`, `crimes` (crime ID array), `sentencePhases`, `status` (`awaiting|serving|released|executed`)
- **Building**: `name`, `description`, `img`, `zone` (`claro-entrada|claro-obrero|claro-central|claro-fronterizo|claro-noble|zona-salvaje|bajo-arbol|fuera-arboria`), `tags` (`civil|auxiliar|guardia|publico|oficial`), `active`, `hidden`, `gangLink` (`{gangId, gangName, notes}`)
- **Officer**: `actorId` (required), `actorName` (required), `title` (required), `actorImg`, `organizationId`, `isCivil`, `skill` (`{name, image}`), `pros`/`cons` (array of `{title, description}`)
- **Patrol**: `name`, `subtitle`, `soldierSlots`, `baseStats`, `officerId`, `maxHope`, `currentHope`
- **Phase Event**: `title` (required), `triggerTurn` (required), `description`, `category` (`aviso|recordatorio|economico|prision|banda|aleatorio|otro`), `visibility` (`all|players|gm`), `recurrence` (`{mode, interval, endTurn}`), `notifyChat`, `linkedId`

Claude Desktop config: `%APPDATA%\Claude\claude_desktop_config.json`

All tools follow the pattern `guard-<entity>-<action>`. Use these names directly when calling MCP tools.

| Entity | Tools available |
|---|---|
| **Organizations** | `guard-organizations-list` · `guard-organizations-get` · `guard-organizations-create` · `guard-organizations-update` · `guard-organizations-delete` |
| **Patrols** | `guard-patrols-list` · `guard-patrols-create` · `guard-patrols-update` · `guard-patrols-delete` |
| **Officers** | `guard-list-officers` · `guard-create-officer` · `guard-update-officer` · `guard-delete-officer` |
| **Resources** | `guard-resources-list` · `guard-resources-create` · `guard-resources-update` · `guard-resources-delete` |
| **Reputations** | `guard-reputations-list` · `guard-reputations-create` · `guard-reputations-update` · `guard-reputations-delete` |
| **Crimes** | `guard-crimes-list` · `guard-crimes-create` · `guard-crimes-update` · `guard-crimes-delete` |
| **Gangs** | `guard-gangs-list` · `guard-gangs-create` · `guard-gangs-update` · `guard-gangs-delete` |
| **POIs** | `guard-pois-list` · `guard-pois-create` · `guard-pois-update` · `guard-pois-delete` |
| **Prisoners** | `guard-prisoners-list` · `guard-prisoners-create` · `guard-prisoners-update` · `guard-prisoners-delete` |
| **Buildings** | `guard-buildings-list` · `guard-buildings-create` · `guard-buildings-update` · `guard-buildings-delete` · `guard-buildings-activate` · `guard-buildings-deactivate` · `guard-buildings-setHidden` |
| **Finance** | `guard-finance-get` · `guard-finance-update` |
| **Phase** | `guard-phase-get` · `guard-phase-advance` |
| **Phase Events** | `guard-phase-events-list` · `guard-phase-events-get` · `guard-phase-events-search` · `guard-phase-events-create` · `guard-phase-events-update` · `guard-phase-events-cancel` · `guard-phase-events-delete` |
| **Phase Reports** | `guard-phase-reports-list` · `guard-phase-reports-get` · `guard-phase-reports-search` |

**Key fields per entity (for create/update):**

- **Resource**: `name`, `description`, `quantity` (number), `image` (icon path), `organizationId`
- **Reputation**: `name`, `level` (1–7), `faction`, `category` (`gremio|banda|noble|militar|religiosa|otra`), `trend` (`rising|stable|falling`), `contact`, `gmNotes`, `factionRelations` (array), `favors` (array)
- **Crime**: `name`, `description`, `offenseType` (`minor|major|capital|civil`), `customSentence`
- **Gang**: `name`, `img`, `notes`, `status` (`active|disbanded|arrested|unknown`)
- **POI**: `name`, `actorId`, `img`, `notes`, `possibleCrimes` (crime ID array), `gangIds` (gang ID array), `status` (`active|arrested|released|deceased`)
- **Prisoner**: `name`, `actorId`, `img`, `cellIndex`, `notes`, `crimes` (crime ID array), `sentencePhases`, `status` (`awaiting|serving|released|executed`)
- **Building**: `name`, `description`, `img`, `zone` (`claro-entrada|claro-obrero|claro-central|claro-fronterizo|claro-noble|zona-salvaje|bajo-arbol|fuera-arboria`), `tags` (`civil|auxiliar|guardia|publico|oficial`), `active`, `hidden`, `gangLink` (`{gangId, gangName, notes}`)
- **Officer**: `actorId` (required), `actorName` (required), `title` (required), `actorImg`, `organizationId`, `isCivil`, `skill` (`{name, image}`), `pros`/`cons` (array of `{title, description}`)
- **Patrol**: `name`, `subtitle`, `soldierSlots`, `baseStats`, `officerId`, `maxHope`, `currentHope`
- **Phase Event**: `title` (required), `triggerTurn` (required), `description`, `category` (`aviso|recordatorio|economico|prision|banda|aleatorio|otro`), `visibility` (`all|players|gm`), `recurrence` (`{mode, interval, endTurn}`), `notifyChat`, `linkedId`

Claude Desktop config: `%APPDATA%\Claude\claude_desktop_config.json`
```json
{
  "mcpServers": {
    "foundry-mcp": {
      "command": "node",
      "args": ["C:\\Users\\merty\\OneDrive\\Documents\\projects\\foundry-vtt-mcp\\packages\\mcp-server\\dist\\index.js"],
      "env": {
        "FOUNDRY_HOST": "localhost",
        "FOUNDRY_PORT": "31415",
        "FOUNDRY_NAMESPACE": "/foundry-mcp"
      }
    }
  }
}
```

---

## Protocolo de Creación de Actores / Oficiales (Daggerheart)

Cuando se crea un NPC oficial de los Cuervos, seguir estos pasos en orden:

### 1. Consultar la wiki del NPC
- Leer `C:\Users\merty\OneDrive\Documents\projects\guardiarines\docs\npcs\<nombre>.md`
- Extraer: Bloque Mecánico, Ficha de Oficial, Pros/Cons, imagen

### 2. Copiar imagen al mundo
```bash
cp "C:\Users\merty\OneDrive\Documents\projects\guardiarines\docs\npcs\images\<imagen>.png" \
   "C:\Games\foundry\Data\worlds\deverines-2\npcs\<nombre-kebab>.png"
```
Ruta Foundry: `worlds/deverines-2/npcs/<nombre-kebab>.png`

### 3. Crear actor (tipo `adversary`) desde la plantilla Standard
```
create-actor-from-compendium → packId: daggerheart-advmanager.templates, itemId: XCRpdycNjpNsYZgL
```

### 4. Actualizar stats Daggerheart (via `update-actor`)
Campos obligatorios:
```json
{
  "img": "worlds/deverines-2/npcs/<nombre>.png",
  "prototypeToken.texture.src": "worlds/deverines-2/npcs/<nombre>.png",
  "system.tier": 1,
  "system.type": "standard",
  "system.difficulty": "<difficulty>",
  "system.resources.hitPoints.max": "<hp>",
  "system.resources.hitPoints.value": 0,
  "system.resources.stress.max": "<stress>",
  "system.resources.stress.value": 0,
  "system.damageThresholds.major": "<minor_umbral>",
  "system.damageThresholds.severe": "<major_umbral>",
  "system.bonuses.roll.attack.bonus": "<attack_bonus>",
  "system.experiences": {
    "<randomId1>": { "name": "<exp1>", "value": "<mod1>", "description": "" },
    "<randomId2>": { "name": "<exp2>", "value": "<mod2>", "description": "" }
  },
  "system.description": "<HTML con raza, rol, apariencia, personalidad>"
}
```

> **Umbrales:** `damageThresholds.major` = Minor del wiki, `damageThresholds.severe` = Major del wiki.

### 5. Configurar el ataque principal (via `update-actor`)
```json
{
  "system.attack.name": "<NombreArma> (Ranged)",
  "system.attack.img": "<icono-arma>",
  "system.attack.range": "far",
  "system.attack.damage.parts.hitPoints.value.custom.enabled": true,
  "system.attack.damage.parts.hitPoints.value.custom.formula": "d8"
}
```
Rango ranged = `"far"`, rango melee = `"melee"`.

### 6. Añadir armas (via `manage-world-items → add-to-actor`)
Siempre añadir DOS versiones del arma con `system.actions` configurado como acción de ataque real:
- **Melee**: usar el arma del wiki (longsword, daga, maul, etc.)
- **Ranged**: si el arma puede lanzarse → versión ranged del mismo arma. Si es exclusivamente melee → usar **Ballesta** (`icons/weapons/crossbows/crossbow.webp`) con `range: "far"`.

> ⚠️ **CRÍTICO**: Los IDs en `system.actions` (tanto la clave del objeto como `_id`) DEBEN ser strings de exactamente **16 caracteres alfanuméricos** (formato Foundry ID). IDs más cortos o con guiones hacen que `createEmbeddedDocuments` rechace el item silenciosamente.

### 7. Añadir features (via `manage-world-items → add-to-actor`)
```json
[
  { "name": "<Feature>", "type": "feature", "img": "<icono>", "system": { "description": "<HTML>" } }
]
```

### 8. Actualizar iconos de features (via `update-actor-items`)
Si las features ya existen sin icono, usar `update-actor-items` con los IDs.

### 9. Crear oficial en el módulo (via `guard-create-officer`)
```json
{
  "actorId": "<actor_id>",
  "actorName": "<Nombre>",
  "actorImg": "worlds/deverines-2/npcs/<nombre>.png",
  "title": "Oficial",
  "skill": { "name": "<NombreHabilidad>", "image": "<url-icono-svg>" },
  "pros": [{ "title": "...", "description": "..." }],
  "cons": [{ "title": "...", "description": "..." }]
}
```
**Iconos de skill**: usar siempre iconos built-in de Foundry (`icons/...webp`). Las URLs externas se rompen frecuentemente.

### Iconos de skill recomendados (Foundry built-in)
- Hielo / Frío → `icons/magic/water/ice-crystal-snow-blue.webp`
- Fuego → `icons/magic/fire/flame-burning-orange.webp`
- Escudo / Protección → `icons/magic/defensive/shield-barrier-glowing-blue.webp`
- Investigación / Ojo → `icons/magic/symbols/eye.webp`
- Sigilo / Sombra → `icons/skills/stealth/person-shadow-walking.webp`
- Veneno → `icons/magic/unholy/strike-beam-purple.webp`
- Social / Diplomacia → `icons/skills/social/diplomacy.webp`
- Intimidación → `icons/skills/social/intimidation.webp`
- Medicina → `icons/consumables/potions/potion-flask-red.webp`
- Naturaleza / Árbol → `icons/magic/nature/tree-spirit-oak-green.webp`
- No muerto / Muerte → `icons/magic/death/undead-eye-blue.webp`
- Rayo / Tormenta → `icons/magic/lightning/lightning-bolt-blue-yellow.webp`
- Lobo / Manada → `icons/creatures/mammals/wolf-dire-snarling.webp`
- Interrogatorio → `icons/magic/sonic/wave-rings.webp`
