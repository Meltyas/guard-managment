# Guard Management — Project Instructions for Codex

## Project Overview

Foundry VTT module (TypeScript + Vite) for managing a city guard organization.
System: Daggerheart 2.x on Foundry VTT v13+.

**Key paths:**
- Module: `C:\Games\foundry\Data\modules\guard-management`
- MCP server: `C:\Users\merty\OneDrive\Documents\projects\foundry-vtt-mcp\packages\mcp-server`
- Campaign world: `C:\Users\merty\OneDrive\Documents\projects\guardiarines`
  - All lore, buildings, NPCs, factions and zones are documented there.
  - Always consult the guardiarines docs when populating or referencing world data.

## Build & Test

```bash
npm run build    # Vite build → dist/
npm run dev      # Watch mode
```

No automated test suite. After changes:
1. `npm run build` — must be clean (no TS errors)
2. Reload Foundry (F5)
3. Verify in browser console

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

**Files to update:**
1. `src/mcp/MCPBridgeIntegration.ts` — register `CONFIG.queries` handlers
2. `C:\Users\merty\OneDrive\Documents\projects\foundry-vtt-mcp\packages\mcp-server\src\tools\guard-management.ts` — tool definitions + handlers
3. `C:\Users\merty\OneDrive\Documents\projects\foundry-vtt-mcp\packages\mcp-server\src\backend.ts` — switch cases

**Handler rules:**
- Return data directly (no `{ success, data }` wrapper)
- Throw on error — the bridge catches it
- Verify actual method names in manager source before wiring

**MCP tool schemas MUST be complete:**
- When a manager method gains a new field (e.g. `zone` on buildings), the corresponding MCP tool `inputSchema` MUST be updated immediately.
- If a tool call fails or a field cannot be set via MCP because it is missing from the `inputSchema`, STOP and extend the schema before retrying.
- This applies to all tools: create, update, and any query that filters by field.
- Never leave an `inputSchema` with only `{ id }` if the underlying manager supports more fields.

**Always build both after MCP changes:**
```bash
# Module
npm run build
# MCP server
cd C:\Users\merty\OneDrive\Documents\projects\foundry-vtt-mcp\packages\mcp-server && npm run build
```

## Code Conventions

- TypeScript strict mode
- No `any` unless interfacing with Foundry's untyped API
- Manager reads are sync, writes are async
- Settings key format: `guard-management.<domain>.<key>`
- All user-facing strings in Spanish

## MCP — Codex Usage

Codex does not natively support MCP. Options:
1. Query data via `http://localhost:31415` REST endpoints when Foundry is running
2. Paste relevant JSON output from another MCP-connected tool into the prompt
3. Use the browser console in Foundry to call managers directly and paste results

Full MCP setup documentation: `docs/MCP.md`

## Verify MCP Registration (Foundry Console)

```js
Object.keys(CONFIG.queries).filter(k => k.startsWith('guard-management'))
// Should return ~35 keys when module is loaded
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
  "system.difficulty": <difficulty>,
  "system.resources.hitPoints.max": <hp>,
  "system.resources.hitPoints.value": 0,
  "system.resources.stress.max": <stress>,
  "system.resources.stress.value": 0,
  "system.damageThresholds.major": <minor_umbral>,
  "system.damageThresholds.severe": <major_umbral>,
  "system.bonuses.roll.attack.bonus": <attack_bonus>,
  "system.experiences": {
    "<randomId1>": { "name": "<exp1>", "value": <mod1>, "description": "" },
    "<randomId2>": { "name": "<exp2>", "value": <mod2>, "description": "" }
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
- **Ranged**: si el arma puede lanzarse (daga, navaja, lanza) → versión ranged del mismo arma. Si es exclusivamente melee (longsword, maul, estoque, garras, porra, vara) → usar **Ballesta** (`icons/weapons/crossbows/crossbow.webp`) con `range: "far"`.

```json
[
  {
    "name": "<NombreArma> (Melee)",
    "type": "feature",
    "img": "<icono-arma>",
    "system": {
      "description": "<p><strong>Melee · 1d8+<bonus></strong> — descripción del ataque cuerpo a cuerpo.</p>",
      "actions": {
        "<randomId>": {
          "_id": "<randomId>",
          "type": "attack",
          "systemPath": "actions",
          "chatDisplay": true,
          "cost": [],
          "range": "melee",
          "target": { "type": "any", "amount": 1 },
          "roll": { "type": "attack", "advStat": "neutral" },
          "damage": {
            "parts": {
              "hitPoints": {
                "applyTo": "hitPoints",
                "bonus": <bonus>,
                "custom": { "enabled": true, "formula": "d8" },
                "type": ["physical"]
              }
            }
          }
        }
      }
    }
  },
  {
    "name": "<NombreArma> (Ranged)  ← o \"Ballesta (Ranged)\" si es arma melee pura",
    "type": "feature",
    "img": "<icono-arma>  ← o icons/weapons/crossbows/crossbow.webp para ballesta",
    "system": {
      "description": "<p><strong>Ranged · 1d8+<bonus></strong> — descripción del ataque a distancia.</p>",
      "actions": {
        "<randomId>": {
          "_id": "<randomId>",
          "type": "attack",
          "systemPath": "actions",
          "chatDisplay": true,
          "cost": [],
          "range": "far",
          "target": { "type": "any", "amount": 1 },
          "roll": { "type": "attack", "advStat": "neutral" },
          "damage": {
            "parts": {
              "hitPoints": {
                "applyTo": "hitPoints",
                "bonus": <bonus>,
                "custom": { "enabled": true, "formula": "d8" },
                "type": ["physical"]
              }
            }
          }
        }
      }
    }
  }
]
```
> ⚠️ **CRÍTICO**: Los IDs en `system.actions` (tanto la clave del objeto como `_id`) DEBEN ser strings de exactamente **16 caracteres alfanuméricos** (formato Foundry ID, e.g. `"MeleeAtkLanza001"`). IDs más cortos o con guiones hacen que `createEmbeddedDocuments` rechace el item silenciosamente (retorna `created: []`).

Si ya existen como features sin actions, actualizarlas con `update-actor` usando dot notation:
`items.<itemId>.system.actions`

### 7. Añadir features (via `manage-world-items → add-to-actor`)
Cada feature con imagen apropiada:
```json
[
  { "name": "<Feature>", "type": "feature", "img": "<icono>", "system": { "description": "<HTML>" } }
]
```
**Buscar iconos** en las constantes de `daggerheart.js`:
- Shield/Block → `icons/magic/defensive/shield-barrier-glowing-blue.webp`
- Detain/Chains → `icons/magic/control/debuff-chains-shackle-movement-red.webp`
- Barrier/Dome → `icons/magic/defensive/barrier-shield-dome-blue-purple.webp`
- Polearm/Ice → `icons/skills/melee/strike-weapon-polearm-ice-blue.webp`
- Fear/Menace → `icons/magic/control/fear-fright-mask-orange.webp`
- Prone/Knockback → `icons/magic/control/silhouette-fall-slip-prone.webp`

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
**Iconos de skill**: usar siempre iconos built-in de Foundry (`icons/...webp`). Las URLs externas de game-icons.net se rompen frecuentemente.

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

