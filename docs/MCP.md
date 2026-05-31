# MCP Integration — Guard Management

This document explains how the guard-management module exposes its data via the
`foundry-mcp-bridge` MCP server, and how to configure each AI tool to use it.

---

## Architecture

```
AI Tool (Claude Code / OpenCode / Codex)
    │
    │  MCP protocol (stdio)
    ▼
MCP Server  (Node.js)
  C:\Users\merty\OneDrive\Documents\projects\foundry-vtt-mcp\packages\mcp-server\dist\index.js
    │
    │  Socket.IO  (localhost:31415/foundry-mcp)
    ▼
Foundry VTT  (localhost:31415)
    │
    │  CONFIG.queries["guard-management.*"]
    ▼
guard-management module  (MCPBridgeIntegration.ts)
    │
    ▼
Individual Managers (OfficerManager, CrimeManager, etc.)
```

**Two pieces must both be running:**
1. Foundry VTT with modules `foundry-mcp-bridge` AND `guard-management` active
2. The MCP server Node process (started automatically by the AI tool via stdio)

---

## Available Tools

All tools are prefixed `guard-*`. They require GM context in Foundry.

| Tool | Description |
|------|-------------|
| `guard-organizations-list` | List all organizations |
| `guard-organizations-get` | Get one org by ID |
| `guard-organizations-create` | Create organization |
| `guard-organizations-update` | Update organization |
| `guard-organizations-delete` | Delete organization |
| `guard-patrols-list` | List patrols (active org) |
| `guard-patrols-create` | Create patrol |
| `guard-patrols-delete` | Delete patrol |
| `guard-officers-list` | *(via guard-list-officers)* |
| `guard-create-officer` | Create officer |
| `guard-update-officer` | Update officer |
| `guard-delete-officer` | Delete officer |
| `guard-list-officers` | List officers |
| `guard-resources-list/create/update/delete` | Resource CRUD |
| `guard-reputations-list/create/update/delete` | Reputation CRUD |
| `guard-crimes-list/create/update/delete` | Crime CRUD |
| `guard-gangs-list/create/update/delete` | Gang CRUD |
| `guard-pois-list/create/update/delete` | POI CRUD |
| `guard-prisoners-list/create/update/delete` | Prisoner CRUD |
| `guard-buildings-list/create/update/delete` | Building CRUD |
| `guard-finance-get` | Get finances (budget + expenses + history) |
| `guard-finance-update` | Update finances |
| `guard-phase-get` | Get current phase + turn |
| `guard-phase-advance` | Advance to next phase/turn |

Plus all standard Foundry tools: `get-world-info`, `list-characters`, `list-scenes`,
`get-current-scene`, etc.

---

## Setup per AI Tool

### OpenCode

Config file: `C:\Users\merty\.config\opencode\opencode.jsonc`

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "shell": "bash",
  "mcp": {
    "foundry-mcp": {
      "type": "local",
      "command": "node",
      "args": ["C:\\Users\\merty\\OneDrive\\Documents\\projects\\foundry-vtt-mcp\\packages\\mcp-server\\dist\\index.js"],
      "env": {
        "LOG_LEVEL": "info",
        "FOUNDRY_HOST": "localhost",
        "FOUNDRY_PORT": "31415",
        "FOUNDRY_NAMESPACE": "/foundry-mcp"
      }
    }
  }
}
```

**Restart opencode** after changing this file.

---

### Claude Code (claude.ai code editor / Claude Desktop)

Config file: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "foundry-mcp": {
      "command": "node",
      "args": ["C:\\Users\\merty\\OneDrive\\Documents\\projects\\foundry-vtt-mcp\\packages\\mcp-server\\dist\\index.js"],
      "env": {
        "LOG_LEVEL": "info",
        "FOUNDRY_HOST": "localhost",
        "FOUNDRY_PORT": "31415",
        "FOUNDRY_NAMESPACE": "/foundry-mcp"
      }
    }
  }
}
```

**Restart Claude Desktop** after changing this file.

---

### Codex (OpenAI)

Codex does not support MCP natively. To use Foundry data with Codex:

1. Use the MCP server as an external HTTP proxy, or
2. Query data manually via the Foundry REST API at `http://localhost:31415`, or
3. Paste relevant JSON from `CONFIG.queries` tool calls directly in the prompt.

If Codex gains MCP support in the future, the config format will be similar to
Claude Desktop above.

---

## Adding New MCP Tools

When adding a new manager or feature to the module, always expose it via MCP:

### Step 1 — Register in `src/mcp/MCPBridgeIntegration.ts`

```typescript
// Add to the tools object in MCPBridgeIntegration.register()
'guard-management.myfeature.list': gmOnly(async () => module.myManager.getAll()),
'guard-management.myfeature.create': gmOnly(async (data) => module.myManager.create(data)),
'guard-management.myfeature.update': gmOnly(async ({ id, ...updates }) => module.myManager.update(id, updates)),
'guard-management.myfeature.delete': gmOnly(async ({ id }) => module.myManager.delete(id)),
```

**Rules:**
- Handlers must return the data directly (no `{ success, data }` wrapper — the bridge adds that)
- Throw errors on failure; the bridge catches and formats them
- Always check real method names in the manager source before wiring

### Step 2 — Add to MCP server `src/tools/guard-management.ts`

Add tool definitions in `getToolDefinitions()`:

```typescript
{
  name: 'guard-myfeature-list',
  description: 'List all my features.',
  inputSchema: { type: 'object', properties: {} },
},
```

Add handlers at the bottom of the class:

```typescript
async handleMyfeatureList(_args: any) {
  return this.json(await this.query('guard-management.myfeature.list'));
}
```

### Step 3 — Add cases to `src/backend.ts`

```typescript
case 'guard-myfeature-list':
  result = await guardManagementTools.handleMyfeatureList(args);
  break;
```

### Step 4 — Build both projects

```bash
# In guard-management/
npm run build

# In foundry-vtt-mcp/packages/mcp-server/
npm run build
```

### Step 5 — Reload Foundry (F5) + restart the AI tool

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Foundry VTT module not connected` | `foundry-mcp-bridge` not active | Enable module in Foundry → Manage Modules |
| `No handler found for query: guard-management.*` | Module not loaded or MCP tools not registered | Reload Foundry (F5), check browser console for registration log |
| `X is not a function` | Wrong method name in MCPBridgeIntegration.ts | Check actual method names in the manager source file |
| MCP tools not visible in AI tool | Server not rebuilt or AI tool not restarted | `npm run build` in mcp-server, restart AI tool |

**Verify registration** in Foundry browser console:
```js
Object.keys(CONFIG.queries).filter(k => k.startsWith('guard-management'))
// Should return ~35 keys
```
