# Guard Management — Project Instructions for Claude Code

## Project Overview

Foundry VTT module (TypeScript + Vite) for managing a city guard organization.
System: Daggerheart 2.x on Foundry VTT v13+.

**Key paths:**
- Module: `C:\Games\foundry\Data\modules\guard-management`
- MCP server: `C:\Users\merty\OneDrive\Documents\projects\foundry-vtt-mcp\packages\mcp-server`

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

**Rules for MCP handlers:**
- Return data directly (no `{ success, data }` wrapper)
- Throw errors on failure — the bridge catches them
- Always check real method names in the manager source before wiring

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

## Testing

No automated test suite. Test by:
1. Build and reload Foundry
2. Use browser console to call managers directly
3. Use MCP tools via the AI tool to verify data round-trips

## MCP Quick Reference

Full docs: `docs/MCP.md`

Verify MCP tools are registered:
```js
// In Foundry browser console
Object.keys(CONFIG.queries).filter(k => k.startsWith('guard-management'))
```

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
