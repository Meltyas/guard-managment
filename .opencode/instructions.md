# Guard Management — Project Instructions for OpenCode

## Project Overview

Foundry VTT module (TypeScript + Vite) for managing a city guard organization.
System: Daggerheart 2.x on Foundry VTT v13+.

**Key paths:**
- Module: `C:\Games\foundry\Data\modules\guard-management`
- MCP server: `C:\Users\merty\OneDrive\Documents\projects\foundry-vtt-mcp\packages\mcp-server`

## Build

```bash
npm run build    # Vite build → dist/
npm run dev      # Watch mode
```

No automated test suite. After changes:
1. `npm run build` — must be clean (no TS errors)
2. Reload Foundry (F5)
3. Verify in browser console or via MCP tools

## Architecture

### Manager Pattern

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

### MCP Integration (MANDATORY)

Every new manager or feature MUST be exposed via MCP. See `docs/MCP.md`.

OpenCode has the MCP server configured globally at:
`C:\Users\merty\.config\opencode\opencode.jsonc`

When MCP is active, you can call Foundry directly from this session using the
`foundry-mcp_guard-*` tools. Use these to inspect live data before and after changes.

**Files to update when adding MCP tools:**
1. `src/mcp/MCPBridgeIntegration.ts` — register `CONFIG.queries` handlers
2. `C:\Users\merty\OneDrive\Documents\projects\foundry-vtt-mcp\packages\mcp-server\src\tools\guard-management.ts` — tool definitions + handlers
3. `C:\Users\merty\OneDrive\Documents\projects\foundry-vtt-mcp\packages\mcp-server\src\backend.ts` — switch cases

**Handler rules:**
- Return data directly (no `{ success, data }` wrapper)
- Throw on error — the bridge catches it
- Verify actual method names in manager source before wiring

**Always build both after MCP changes:**
```bash
# Module
npm run build
# MCP server
cd C:\Users\merty\OneDrive\Documents\projects\foundry-vtt-mcp\packages\mcp-server && npm run build
```

Then reload Foundry (F5) and restart OpenCode.

## Code Conventions

- TypeScript strict mode
- No `any` unless interfacing with Foundry's untyped API
- Manager reads are sync, writes are async
- Settings key format: `guard-management.<domain>.<key>`
- All user-facing strings in Spanish

## Límite crítico de tamaño de respuesta

Cuando el modelo genera una respuesta muy larga (tool call con contenido de cientos de líneas), el JSON del tool call se trunca antes de cerrarse. Esto hace que el parámetro `command` (Bash) o `content` (Write) llegue incompleto → `SchemaError(Missing key at ["command"])` → `Tool execution aborted`.

**Reglas para evitarlo:**
- **Nunca** escribir más de ~80 líneas de código dentro de un solo `bash` o `Write`.
- Para archivos grandes (>150 líneas): escribir en múltiples pasos con Python append (`open(..., 'a')`), cada paso ≤80 líneas.
- El Write tool funciona bien para archivos pequeños/medianos. Para archivos nuevos grandes, usar bash+Python en chunks.
- Preferir `Edit` para modificar archivos existentes: los diffs son compactos y no truncan.

## MCP Quick Reference

Full docs: `docs/MCP.md`

Verify tools are registered in Foundry browser console:
```js
Object.keys(CONFIG.queries).filter(k => k.startsWith('guard-management'))
// Should return ~35 keys
```
