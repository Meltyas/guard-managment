---
applyTo: '**'
---

NEVER TOUCH THE DAGGERHEART WORKSPACE, IS JUST READ ONLY.

# AI Assistant Context: Guard Management Module

## 📋 Project Overview

**Guard Management** is a **Foundry VTT module** designed for the **Daggerheart** system to manage guard operations in campaigns.

**Key paths:**
- Module: `C:\Games\foundry\Data\modules\guard-management`
- MCP server: `C:\Users\merty\OneDrive\Documents\projects\foundry-vtt-mcp\packages\mcp-server`
- Campaign world: `C:\Users\merty\OneDrive\Documents\projects\guardiarines`
  - All lore, buildings, NPCs, factions and zones are documented there.
  - Always consult the guardiarines docs when populating or referencing world data.

The module handles comprehensive guard management including statistics, patrols, resources, reputation, and temporary effects with full synchronization between GM and Players.

---

## 🔧 Technical Stack

| Technology      | Version | Purpose                                |
| --------------- | ------- | -------------------------------------- |
| **TypeScript**  | Latest  | Type-safe JavaScript development       |
| **Vite**        | Latest  | Fast build tool and development server |
| **Vitest**      | Latest  | Fast unit testing framework            |
| **Foundry VTT** | V14     | Target platform                        |
| **Node.js**     | 20.11.0 | Required version (managed via nvm)     |

### Foundry V14 API Notes

- **Use** `foundry.applications.handlebars.loadTemplates(...)` instead of the deprecated global `loadTemplates(...)`
- **Use** `foundry.applications.handlebars.renderTemplate(...)` instead of the deprecated global `renderTemplate(...)`

---

## 🏗️ Core Architecture

```
🏛️ Guard Organization (base stats + resources + reputation)
    ├── 📦 Resources (organizational level)
    ├── 🤝 Reputation (organizational level)
    ├── ⚡ Guard Modifiers (affect entire organization)
    └── 👥 Patrols (derive from Guard organization stats)
        ├── 🎯 Patrol Effects (specific to patrol)
        ├── 🔧 Custom Modifiers (patrol-specific adjustments)
        └── 👤 Leader (references Actors)

🗄️ GM Storage
    ↓ (templates for)
All Effect Types + Resources + Reputation + Modifiers
```

---

## 🎯 Primary Entities

1. **🏛️ Guard Organization**: Complete guard organization with 4 base stats
   - Robustismo, Analítica, Subterfugio, Elocuencia

2. **👥 Patrols**: Operational units (1-12 members + leader) with derived stats

3. **📦 Resources**: Tracked materials and supplies

4. **🤝 Reputation**: 7-tier relationship system with factions

5. **⚡ Effects**: Temporary modifiers (organizational or patrol-specific)

6. **🗄️ GM Storage**: Centralized template management

---

## 🚀 Development Workflow

### Prerequisites

```bash
npm run build    # Vite build → dist/
npm run dev      # Watch mode
```

No automated test suite. After changes:
1. `npm run build` — must be clean (no TS errors)
2. Reload Foundry (F5)
3. Verify in browser console

---

## 🏗️ Manager Pattern

All data lives in `src/managers/`. Each manager:
- Stores data in Foundry world settings via `game.settings.get/set`
- Has `getAll*()` / `get*(id)` / `create*()` / `update*(id, data)` / `delete*(id)` methods
- Is exposed on `GuardManagementModule` as a public property in `src/main.ts`

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
4. Register its settings key in `settings.ts` with `scope: 'world'`
5. **Expose via MCP** (see MCP section below — this is mandatory)

---

## 📝 Task Management Rules

### ✅ Core Requirements

- **Make sure you are using v14 on foundry**: Look for the documentation if you don't know how to do it.
- **Clarity**: Tasks must be clear, specific, and actionable—avoid ambiguity
- **Ownership**: Every task must be assigned a responsible agent, explicitly tagged
- **Atomicity**: Complex tasks must be broken into atomic, trackable subtasks
- **Compatibility**: No task may conflict with or bypass existing validated system behaviour
- **Security Review**: Security-related tasks must undergo mandatory review by a designated reviewer agent
- **Documentation**: Agents must update task status and outcomes in the shared task file
- **Dependencies**: Dependencies between tasks must be explicitly declared
- **Escalation**: Agents must escalate ambiguous, contradictory, or unscoped tasks for clarification

---

## 🔒 Security Compliance Guidelines

### 🚫 Prohibited Practices

- **No Hardcoded Credentials**: Use secure storage mechanisms
- **No eval() Usage**: Avoid eval, unsanitised shell calls, or command injection vectors
- **No Excessive Privileges**: File and process operations must follow principle of least privilege

### ✅ Required Practices

- **Input Validation**: All inputs must be validated, sanitised, and type-checked
- **Secure Logging**: All sensitive operations must be logged, excluding sensitive data values
- **Permission Checks**: Agents must check system-level permissions before accessing protected services

---

## ⚙️ Process Execution Requirements

### 📊 Logging & Monitoring

- **Severity Levels**: Agents must log all actions with appropriate severity (INFO, WARNING, ERROR)
- **Error Reports**: Any failed task must include a clear, human-readable error report
- **Resource Limits**: Agents must respect system resource limits (memory, CPU usage)

### 🔄 Task Management

- **Progress Indicators**: Long-running tasks must expose progress indicators or checkpoints
- **Retry Logic**: Retry logic must include exponential backoff and failure limits

---

## 🎯 Core Operational Principles

### 🚫 Never Do

- Use mock, fallback, or synthetic data in production tasks
- Make assumptions without verifiable evidence
- Perform destructive operations without validation

### ✅ Always Do

- Design error handling logic using test-first principles
- Act based on verifiable evidence, not assumptions
- Validate all preconditions before destructive or high-impact operations
- Ensure all decisions are traceable to logs, data, or configuration files

---

## 🏛️ Design Philosophy Principles

### 🎯 KISS (Keep It Simple, Stupid)

- Solutions must be **straightforward** and **easy to understand**
- **Avoid over-engineering** or unnecessary abstraction
- **Prioritise code readability** and maintainability

### 🎯 YAGNI (You Aren't Gonna Need It)

- **Do not add speculative features** or future-proofing unless explicitly required
- **Focus only on immediate requirements** and deliverables
- **Minimise code bloat** and long-term technical debt

### 🎯 SOLID Principles

| Principle                     | Description                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| **S** - Single Responsibility | Each module or function should do **one thing only**                               |
| **O** - Open-Closed           | Software entities should be **open for extension** but **closed for modification** |
| **L** - Liskov Substitution   | Derived classes must be **substitutable for their base types**                     |
| **I** - Interface Segregation | Prefer **many specific interfaces** over one general-purpose interface             |
| **D** - Dependency Inversion  | Depend on **abstractions**, not concrete implementations                           |

---

## 🔧 System Extension Guidelines

### 📋 Requirements

- **Interface Compliance**: All new agents must conform to existing interface, logging, and task structures
- **Testing**: Utility functions must be unit tested and peer reviewed before shared use
- **Documentation**: All configuration changes must be reflected in the system manifest with version stamps
- **Compatibility**: New features must maintain backward compatibility unless justified and documented
- **Performance**: All changes must include a performance impact assessment

---

## 🔌 MCP Integration (MANDATORY)

> **NEVER TOUCH THE DAGGERHEART WORKSPACE — it is read-only.** The MCP server lives in a separate project.

Every new manager or significant feature MUST be exposed via MCP. See `docs/MCP.md` for the complete workflow.

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

**Always build both projects after MCP changes:**
```bash
# guard-management/
npm run build
# foundry-vtt-mcp/packages/mcp-server/
npm run build
```

Then reload Foundry (F5). Verify registration in the browser console:
```js
Object.keys(CONFIG.queries).filter(k => k.startsWith('guard-management'))
```

### MCP Tool Index

These MCP tools are available as **direct function calls** — invoke them natively, do NOT use bash or HTTP to call them.

- In **Claude Desktop**: tools are named exactly as listed (e.g. `guard-resources-create`)
- In **Claude Code / OpenCode**: tools carry the server prefix (e.g. `foundry-mcp_guard-resources-create`)

> ⚠️ **CRITICAL**: Guard Management data (resources, reputations, officers, buildings, crimes, gangs, POIs, prisoners, patrols…) is stored in `game.settings`, NOT in Foundry Actors, Items, or Journals.
> - **NEVER** use `manage-world-items`, `list-characters`, `search-compendium`, or any standard Foundry tool to find Guard Management data.
> - **ALWAYS** use the `guard-*` MCP tools below to read or write Guard Management data.
> - If you can't find a resource, officer, or building in Foundry's actor/item lists, that is expected — look it up with `guard-resources-list`, `guard-list-officers`, `guard-buildings-list`, etc.

All tools follow the pattern `guard-<entity>-<action>`.

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
- **Officer**: `actorId` (required), `actorName` (required), `title` (required), `actorImg`, `organizationId`, `isCivil`, `skill` (`{name, image}`), `pros`/`cons` (array de `{title, description}`)
- **Patrol**: `name`, `subtitle`, `soldierSlots`, `baseStats`, `officerId`, `maxHope`, `currentHope`
- **Phase Event**: `title` (required), `triggerTurn` (required), `description`, `category` (`aviso|recordatorio|economico|prision|banda|aleatorio|otro`), `visibility` (`all|players|gm`), `recurrence` (`{mode, interval, endTurn}`), `notifyChat`, `linkedId`

---

## 🔍 Quality Assurance Procedures

### 🛡️ Review Requirements

- **Security Review**: A reviewer agent must review all changes involving security, system config, or agent roles
- **Documentation Review**: Documentation must be proofread for clarity, consistency, and technical correctness

### 📝 User Experience Standards

- **Clear Messaging**: User-facing output (logs, messages, errors) must be clear, non-technical, and actionable
- **Error Guidance**: All error messages should suggest remediation paths or diagnostic steps
- **Rollback Plans**: All major updates must include a rollback plan or safe revert mechanism

---

## 📊 Implementation Completeness Framework

### 1. 🔍 Mandatory Comparative Analysis

> **When implementing a system following an existing pattern, ALWAYS perform a complete line-by-line audit of the reference system first. List ALL functionalities found before starting implementation.**

### 2. ✅ Mandatory Implementation Checklist

**For each pattern implementation, create and verify this checklist:**

- ✅ **Templates & HTML**
- ✅ **Event handlers**
- ✅ **Drag & Drop functionality**: Make sure that the new system has a fully functional drag & drop implementation, including:
  - Draggable elements (ensure they have `draggable="true"`)
  - Event handlers for drag start, drag end, and drop
  - Drop zones (ensure they are correctly identified)
  - Visual feedback (Use the current CSS classes)
  - Data transfer handling (handleGlobalDragStart, handleGlobalDragEnd)
  - Assure that the drag & drop works in the Guard info dialog and the Gm Warehouse dialog
- ✅ **Dialog integration**
- ✅ **CSS styling**
- ✅ **Manager methods (CRUD)**
- ✅ **Warehouse integration**
- ✅ **Error handling**
- ✅ **Notifications**
- ✅ **Chat integration** — Every entity card/panel MUST have a "Enviar al chat" button that sends a formatted summary to the Foundry chat via `ChatMessage.create`. All chat messages (except dice rolls) MUST use the `.dh-card` card style for visual consistency. If the entity has no image, omit the header image and divider — render only the text body (add `.dh-card--no-image` class to skip the header).
- ✅ **Focus management**
- ✅ **Validation**

### 3. 🔍 Related Files Analysis

> **Before completing an implementation, search ALL files containing the reference system name and analyze what functionalities they implement that might be missing in the new system. Ensure content exists and functions work - don't assume without verification.**

### 4. ✅ Completeness Declaration

> **When finishing any pattern-based implementation, explicitly declare: 'This implementation is COMPLETE and has 1:1 functional parity with [reference system]' only after verifying each checklist point.**

---

## 🧪 TDD Implementation Strategy

### 🔴 Red → 🟢 Green → 🔵 Refactor

1. **🔴 Red**: Write failing tests for functionality
2. **🟢 Green**: Implement minimal working code
3. **🔵 Refactor**: Optimize and clean up

### 🎯 Testing Priorities

- **Unit Tests**: CRUD operations, stat calculations, validation
- **Integration Tests**: Entity relationships, sync operations

---

## 🔄 Synchronization Strategy

### 🛡️ Settings-Based Persistence (MANDATORY — NO EXCEPTIONS)

> **⚠️ CRITICAL RULE: ALL data MUST be stored in `game.settings`. NEVER use Foundry Actor documents, Item documents, `CONFIG.Actor.dataModels`, `CONFIG.Item.dataModels`, actor flags, or any other Foundry Document-based storage. Violating this rule causes crashes with Daggerheart (getRollData, isInventoryItem, updateActorsRangeDependentEffects) and orphaned document errors when the module is disabled. This was learned the hard way — do NOT revert to document-based storage under any circumstances.**

**ALL data persistence MUST use `game.settings` with `scope: 'world'` for automatic synchronization.**

#### ✅ Correct Pattern for ALL Managers:

```typescript
// 1. Manager Structure
export class MyEntityManager {
  private entities: Map<string, MyEntity> = new Map();

  // 2. Public loadFromSettings for onChange callback
  public async loadFromSettings(): Promise<void> {
    const data = game?.settings?.get('guard-management', 'myEntities') as MyEntity[];
    if (Array.isArray(data)) {
      this.entities.clear();
      for (const item of data) {
        this.entities.set(item.id, item);
      }
    }
  }

  // 3. Private save that ALWAYS writes (no optimization)
  private async _saveToSettingsAsync(): Promise<void> {
    const data = Array.from(this.entities.values());
    await game?.settings?.set('guard-management', 'myEntities', data);
  }

  // 4. CRUD methods that await save
  public async createEntity(data: any): Promise<MyEntity> {
    const entity = { id: foundry.utils.randomID(), ...data };
    this.entities.set(entity.id, entity);
    await this._saveToSettingsAsync(); // ← ALWAYS await
    return entity;
  }

  public async updateEntity(id: string, updates: any): Promise<MyEntity> {
    const entity = this.entities.get(id);
    if (!entity) return null;
    const updated = { ...entity, ...updates };
    this.entities.set(id, updated);
    await this._saveToSettingsAsync(); // ← ALWAYS await
    return updated;
  }

  public async deleteEntity(id: string): Promise<boolean> {
    const deleted = this.entities.delete(id);
    if (deleted) await this._saveToSettingsAsync(); // ← ALWAYS await
    return deleted;
  }
}
```

#### ✅ Settings Registration Pattern:

```typescript
// settings.ts
game?.settings?.register('guard-management', 'myEntities', {
  name: 'My Entities Data',
  scope: 'world', // ← REQUIRED for multi-client sync
  config: false,
  type: Array,
  default: [],
  onChange: (value) => {
    console.log('Settings onChange | MyEntities changed');
    const gm = (window as any).GuardManagement;
    if (gm?.myEntityManager) {
      gm.myEntityManager.loadFromSettings?.();
    }
    // Optionally refresh UI if dialog is open
    if (gm?.guardDialogManager?.customInfoDialog?.isOpen?.()) {
      gm.guardDialogManager.customInfoDialog.refreshMyEntitiesPanel?.();
    }
  },
});
```

#### ✅ Module Integration Pattern:

```typescript
// main.ts
class GuardManagementModule {
  public myEntityManager: MyEntityManager;

  constructor() {
    this.myEntityManager = new MyEntityManager();
  }

  public async initialize(): Promise<void> {
    registerSettings(); // ← Register BEFORE initializing managers
    await this.myEntityManager.initialize(); // ← Calls loadFromSettings()
  }
}
```

### 🚫 PROHIBITED Patterns:

❌ **NO Foundry Actor/Item documents for data storage** — causes Daggerheart crashes and orphaned document errors
❌ **NO `CONFIG.Actor.dataModels` or `CONFIG.Item.dataModels`** — system calls getRollData, isInventoryItem, etc. on our models
❌ **NO DocumentBasedManager or TypeDataModel subclasses** — removed permanently, do not recreate
❌ **NO version optimization** - Always save
❌ **NO .catch()** wrapping - Use await directly
❌ **NO queueSave()** debouncing - Save immediately
❌ **NO actor flags** - Settings only
❌ **NO sockets** - Foundry handles sync with `scope: 'world'`
❌ **NO private managers** - All managers must be accessible from `window.GuardManagement`

### ✅ All Entities Migrated to Settings:

| Entity          | Manager                   | Settings Key          | Status      |
| --------------- | ------------------------- | --------------------- | ----------- |
| Officers        | OfficerManager            | `'officers'`          | ✅ Migrated |
| Patrols         | PatrolManager             | `'patrols'`           | ✅ Migrated |
| Resources       | SimpleResourceManager     | `'resources'`         | ✅ Migrated |
| Reputations     | SimpleReputationManager   | `'reputations'`       | ✅ Migrated |
| Organization    | GuardOrganizationManager  | `'guardOrganization'` | ✅ Migrated |
| Guard Modifiers | SimpleModifierManager     | `'modifiers'`         | ✅ Migrated |
| Patrol Effects  | SimplePatrolEffectManager | `'patrolEffects'`     | ✅ Migrated |

### ⚖️ Conflict Resolution Priorities

1. **🔴 GM Override**: GM changes take precedence
2. **⏰ Timestamp**: Most recent change wins
3. **🛠️ Manual Resolution**: DialogV2 intervention for complex conflicts

---

## 🗺️ Key Implementation Notes

| Aspect                    | Implementation                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| **Entity Relationships**  | Guard Organization → Resources/Reputation → Patrols → Effects                                      |
| **Stat Calculation Flow** | Guard Base → Organization Modifiers → Patrol Derivation → Custom Modifiers → Effects → Final Stats |
| **Permission Matrix**     | GM has full CRUD, Players have read-all + limited modify                                           |
| **Dialog Architecture**   | Independent dialogs per entity type, all use DialogV2                                              |

### 🔢 Z-Index Rules

> **⚠️ CRITICAL: All module dialogs and modals MUST stay below Foundry's FilePicker z-index.** Foundry's core `Application._maxZ` manages window stacking and the FilePicker typically renders at z-index ~100-200+. Our modals must NOT block it.

| Component | z-index | Source |
|---|---|---|
| Custom dialogs (base) | `51` | `main.css` |
| Custom dialogs (focused) | `80` | `main.css` |
| GuardModal (base) | `80` | `GuardModal.ts` — `baseZIndex` |
| BaseWarehouseItemDialog | `80` | `BaseWarehouseItemDialog.ts` — `zIndexCounter` |
| OfficerWarehouseDialog | `100` | `OfficerWarehouseDialog.ts` |

**Rules:**
- **NEVER set z-index above 100** for any dialog or modal — Foundry's FilePicker and other core popups must always appear on top
- GuardModal stacks open modals sequentially (`baseZIndex + i`), so even with several modals open they stay in the 80-90 range
- The only exception is debug/error overlays (z-index 9999) which are temporary diagnostic tools

---

## 📈 Development Phases

1. **🏗️ Foundation**: Basic entity models, CRUD operations, simple sync
2. **⚙️ Business Logic**: Stat calculations, effect application, validation
3. **🔄 Advanced Sync**: Conflict resolution, permissions, real-time updates
4. **🛠️ GM Tools**: Storage management, batch operations, templates
5. **✨ Polish**: Enhanced UI, performance, error handling

---

## 🤖 AI Assistant Guidelines

### 🎯 Core Focus Areas

1. **🏛️ Entity Hierarchy**: Always maintain Guard Organization → Patrols relationship
2. **🔒 Permission Awareness**: Respect GM vs Player access throughout
3. **🧪 TDD Discipline**: Write tests first for all functionality
4. **💬 DialogV2 Focus**: Use DialogV2.query for all user interactions
5. **⚡ Performance**: Cache derived calculations, batch sync updates
6. **🌐 Bilingual Support**: Support Daggerheart terminology in both languages
7. **🖱️ Drag & Drop**: Implement extensive drag & drop for intuitive UX

---

## 📊 Current Project State

- **🏗️ Foundation Phase**: Core CRUD operations and basic sync implemented
- **💻 UI**: DialogV2-based interface with tab structure planned

---

## 🐛 Debug and Testing

### 🔍 Common Debug Scenarios

- **Never create a debug tool javascript** - we will use the UI
- Test guard CRUD operations
- Simulate sync conflicts
- Test permission boundaries
- Validate stat calculations

### 🛠️ Debugging Tools & Procedures

#### Global Debug Access

When working with event handlers (like ReputationEventHandler), debug methods are automatically exposed to `window`:

```javascript
// Browser Console Commands
RepDebug.diagnose(); // Diagnose current elements
RepDebug.force(); // Force aggressive drag setup with visual indicators
RepDebug.test(); // Create test draggable elements
RepDebug.setup(); // Run normal setup
```

#### Drag & Drop Debugging Process

1. **🔍 Diagnose First**: Run `RepDebug.diagnose()` to inspect element properties
2. **💪 Force Setup**: Run `RepDebug.force()` for aggressive configuration with visual indicators
3. **👀 Visual Feedback**: Look for blue borders on draggable elements
4. **🎯 Drop Zone**: Check for fixed-position drop zone in top-right corner

#### CSS Conflict Resolution

- **Override user-select**: Set to 'none' for drag handles
- **Override pointer-events**: Ensure 'auto' for interactive elements
- **Check parent constraints**: Verify overflow, position, z-index don't block drag
- **Apply visual indicators**: Use border colors for debugging feedback

---

## 📋 Log Pattern (Activity Log)

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

---

## 🎭 Protocolo de Creación de Actores / Oficiales (Daggerheart)

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

---

## 👁️ Player Presence System

The module includes a **real-time player presence system** that shows which players are viewing which tab/element in the organization dialog. This system uses **Foundry User Flags** for cross-client sync (NOT sockets, NOT game.settings).

### Architecture

| Component | File | Purpose |
|---|---|---|
| **PresenceIndicator** | `src/ui/PresenceIndicator.ts` | Core class: flag management, avatar rendering, hover tracking, highlight diffing |
| **Presence CSS** | `src/styles/presence.css` | Floating avatars, hover overlay styling |
| **Toggle button** | `templates/dialogs/info-dialog.hbs` | Eye toggle in dialog header `.custom-dialog-controls` |
| **Integration** | `src/ui/CustomInfoDialog.ts` | 5 integration points (attach, detach, tab switch, drag, resize) |

### Key Design Decisions

- **User Flags** (`game.user.setFlag/getFlag/unsetFlag`) for presence sync — Foundry handles cross-client propagation automatically via `Hooks.on('updateUser', ...)`
- **Overlay-based highlights** — Hover highlights use an absolutely positioned `<div class="gm-presence-hover-overlay">` with `inset: 0` inside the target element, NOT border changes on the element itself (which cause layout reflow)
- **Diff-based DOM updates** — `updateHighlights()` tracks `activeHighlights: Map<selector, overlayElement>` and only modifies DOM when actual state changes, avoiding thrashing from frequent `updateUser` hook fires
- **Separated rendering** — `renderAvatars()` (lightweight, floating container only) and `updateHighlights()` (diff-based, content DOM) are independent methods
- **Visibility toggle** — Local-only toggle (localStorage key `guard-management.presence.visible`) hides incoming avatars/overlays but does NOT stop broadcasting your own presence. Alt key inverts the toggle while held
- **Fine-grained patrol hover** — `PATROL_SUB_SELECTORS` detect sub-sections within patrol/auxiliary cards (officer, soldiers, stats, etc.) before falling back to the whole card
- **Multi-player segmented borders** — When multiple players hover the same element, a `conic-gradient(from 225deg, ...)` with `border-image` divides the border by player count using each player's `user.color`
- **3-minute inactivity** — Players are marked inactive after 3 minutes without clicks inside the dialog

### When Modifying

- If adding new entity types/panels, add their selectors to `ENTITY_SELECTORS` array in `PresenceIndicator.ts`
- If adding sub-sections to patrol cards, add them to `PATROL_SUB_SELECTORS`
- The overlay approach (`position: absolute; inset: 0`) requires the parent element to NOT be `position: static` — the code sets `position: relative` automatically when needed and cleans it up on removal
- Never use direct border/outline modifications for highlights — always use the overlay div pattern to avoid layout shifts

---

## 📝 Project Notes

> **Note**: This module is primarily for testing synchronization patterns in Foundry VTT. Focus on clear, well-tested code that demonstrates different sync scenarios rather than production features.
