# Development Notes: Guard Management for Foundryborne/Daggerheart

## Project Overview

**Guard Management** is a Foundry VTT V13 module designed for the **Foundryborne system (Daggerheart)** to manage guard operations in campaigns. The module handles comprehensive guard management including statistics, patrols, resources, reputation, and temporary effects with full synchronization between GM and Players.

## Core Entities & CRUD Operations

### 1. Guard Statistics (Base Stats)

**Purpose**: Foundation statistics for all guard operations and patrol calculations.

**Structure**:

- **Name**: Primary guard name
- **Subtitle**: Secondary identifier
- **Base Statistics** (4 core + expandable):
  - Robustismo (Robustness)
  - Analítica (Analytical)
  - Subterfugio (Subterfuge)
  - Elocuencia (Eloquence)
  - _Future stats can be added_

**CRUD Operations**:

- ✅ **Create**: New guard with base stats
- ✅ **Read**: View current guard stats
- ✅ **Update**: Modify base statistics and names
- ✅ **Delete**: Remove guard (with safety checks)

### 2. Guard Modifiers (Temporary Effects)

**Purpose**: Temporary effects that modify base guard statistics.

**Structure**:

- **Name**: Effect identifier
- **Description**: Detailed explanation
- **Type**: Positive/Negative/Neutral indicator
- **Image**: Visual representation
- **Stat Modifications**: Which stats are affected and by how much

**CRUD Operations**:

- ✅ **Create**: New temporary modifier
- ✅ **Read**: List active/available modifiers
- ✅ **Update**: Modify effect properties
- ✅ **Delete**: Remove modifier
- 🔄 **Apply/Remove**: Activate/deactivate on guard

### 3. Patrols

**Purpose**: Operational units composed of leader + units with derived statistics.

**Structure**:

- **Name**: Patrol identifier
- **Leader**: Reference to Actor (1 required)
- **Units**: Count (1-12 members)
- **Statistics**: Derived from Guard base + custom modifiers
- **Custom Modifiers**: User-defined stat adjustments (e.g., +1 Robustismo, -1 Elocuencia)

**CRUD Operations**:

- ✅ **Create**: New patrol with leader and units
- ✅ **Read**: View patrol details and current stats
- ✅ **Update**: Modify composition, leader, or custom modifiers
- ✅ **Delete**: Disband patrol
- 🔄 **Deploy/Recall**: Change patrol status

### 4. Patrol Effects

**Purpose**: Temporary effects specific to individual patrols.

**Structure**:

- **Name**: Effect identifier
- **Description**: Detailed explanation
- **Type**: Positive/Negative/Neutral indicator
- **Image**: Visual representation
- **Target Patrol**: Which patrol is affected
- **Stat Modifications**: Specific statistical changes

**CRUD Operations**:

- ✅ **Create**: New patrol-specific effect
- ✅ **Read**: View effects on specific patrol
- ✅ **Update**: Modify effect properties
- ✅ **Delete**: Remove effect
- 🔄 **Apply/Remove**: Activate/deactivate on patrol

### 5. Resources

**Purpose**: Tracked materials and supplies for guard operations.

**Structure**:

- **Name**: Resource identifier
- **Description**: What the resource represents
- **Quantity**: Current amount (numeric)

**CRUD Operations**:

- ✅ **Create**: New resource type
- ✅ **Read**: View current resources and quantities
- ✅ **Update**: Modify description or adjust quantities
- ✅ **Delete**: Remove resource type
- 🔄 **Spend/Gain**: Modify quantities through operations

### 6. Reputation

**Purpose**: Relationship tracking with various factions/groups.

**Structure**:

- **Name**: Faction/group identifier
- **Description**: Context about the relationship
- **Level**: 7-tier system:
  1. **Enemigos** (Enemies)
  2. **Hostiles** (Hostile)
  3. **Desconfiados** (Distrustful)
  4. **Neutrales** (Neutral)
  5. **Amistosos** (Friendly)
  6. **Confiados** (Trusting)
  7. **Aliados** (Allies)

**CRUD Operations**:

- ✅ **Create**: New faction relationship
- ✅ **Read**: View current reputation levels
- ✅ **Update**: Change reputation level or description
- ✅ **Delete**: Remove faction relationship
- 🔄 **Improve/Degrade**: Modify reputation levels

### 7. GM Storage/Warehouse

**Purpose**: Centralized storage for GM to pre-create and manage templates.

**Stored Items**:

- **Resources**: Pre-defined resource types for quick assignment
- **Reputation Entries**: Template faction relationships
- **Patrol Effects**: Ready-to-apply patrol modifications
- **Guard Modifiers**: Prepared temporary effects

**Operations**:

- ✅ **Create Templates**: Pre-build effects, resources, etc.
- ✅ **Organize Storage**: Categorize and manage templates
- ✅ **Quick Apply**: Rapidly assign stored items to active elements
- ✅ **Batch Operations**: Apply multiple effects simultaneously

## TDD Implementation Strategy

### Test-First Development Approach

**Phase 1: Core CRUD (Red-Green-Refactor)**

1. **Red**: Write failing tests for basic entity creation
2. **Green**: Implement minimal CRUD functionality
3. **Refactor**: Optimize and clean up code

**Phase 2: Business Logic (Red-Green-Refactor)**

1. **Red**: Write failing tests for stat calculations
2. **Green**: Implement patrol stat derivation
3. **Refactor**: Optimize calculation logic

**Phase 3: Synchronization (Red-Green-Refactor)**

1. **Red**: Write failing tests for multi-client sync
2. **Green**: Implement basic synchronization
3. **Refactor**: Add conflict resolution

**Phase 4: UI Integration (Red-Green-Refactor)**

1. **Red**: Write failing tests for DialogV2 interactions
2. **Green**: Implement basic UI
3. **Refactor**: Enhance user experience

### Testing Priorities

**Unit Tests (High Priority)**:

- ✅ Guard stat calculations
- ✅ Patrol composition validation
- ✅ Modifier application logic
- ✅ Resource quantity management
- ✅ Reputation level changes

**Integration Tests (Medium Priority)**:

- ✅ Stat derivation from Guard → Patrol
- ✅ Effect application chains
- ✅ GM storage → Active assignment
- ✅ Multi-entity synchronization

**E2E Tests (Lower Priority)**:

- ✅ Complete patrol creation workflow
- ✅ GM storage management interface
- ✅ Player vs GM permission scenarios
- ✅ Cross-client synchronization validation

## Synchronization Strategy

### Anti-Death Spiral Design for Foundryborne

**Key Sync Challenges**:

1. **Multiple Entities**: Guards, Patrols, Resources, Reputation all need sync
2. **Derived Data**: Patrol stats depend on Guard stats + modifiers
3. **Permission Levels**: GM vs Player access to different operations
4. **Real-time Updates**: Changes should reflect immediately across clients

**Sync Patterns**:

- **Guard Base Stats**: GM and Players can edit, all read (real-time sync)
- **Patrols**: GM and Players can create/edit, all read (real-time sync)
- **Resources/Reputation**: GM and Players can edit, all read (real-time sync)
- **Effects**: GM and Players can apply, all see results (real-time sync)
- **GM Warehouse**: GM-only access (separate dialog, not synced to players)

**Conflict Resolution Priorities**:

1. **GM Override**: GM changes always take precedence
2. **Timestamp**: Most recent change wins for same permission level
3. **Manual Resolution**: Complex conflicts require DialogV2 intervention

## Development Phases

### Phase 1: Foundation (TDD Focus)

- ✅ Basic entity models and TypeScript types
- ✅ Core CRUD operations with full test coverage
- ✅ Simple synchronization without conflict resolution

### Phase 2: Business Logic (TDD Focus)

- ✅ Stat calculation and derivation logic
- ✅ Effect application and stacking rules
- ✅ Patrol composition validation

### Phase 3: Advanced Sync (TDD Focus)

- ✅ Conflict detection and resolution
- ✅ Permission-based access control
- ✅ Real-time updates with DialogV2

### Phase 4: GM Tools (TDD Focus)

- ✅ Storage/warehouse management interface
- ✅ Batch operations and templates
- ✅ Advanced admin features

### Phase 5: Polish (TDD Focus)

- ✅ Enhanced UI with Foundryborne theming
- ✅ Performance optimization
- ✅ Comprehensive error handling

## Key Implementation Notes

**Entity Relationships**:

```
Guard (base stats)
  ↓ (derives to)
Patrols (Guard stats + custom modifiers + effects)
  ↓ (references)
Actors (Leaders)

GM Storage
  ↓ (templates for)
All Effect Types + Resources + Reputation
```

**Stat Calculation Flow**:

```
Guard Base Stats
  → Apply Guard Modifiers
  → Derive to Patrol
  → Apply Custom Patrol Modifiers
  → Apply Patrol Effects
  → Final Patrol Stats
```

**Permission Matrix**:

- **GM**: Full CRUD on all entities
- **Players**: Read all, limited modify on assigned patrols
- **Storage**: GM-only access for template management

## Foundry V13 Technical Implementation

### DialogV2.query Integration

**Primary Use Cases**:

- **Conflict Resolution**: When sync conflicts occur between GM/Player changes
- **Patrol Assignment**: Assign leaders and units to patrols
- **Effect Application**: Apply modifiers and effects with visual confirmation
- **Resource Management**: Spend/gain resources with confirmation dialogs
- **Reputation Changes**: Modify faction relationships with context

**Implementation Pattern**:

```javascript
// Enhanced conflict resolution for Guard Management
async showGuardConflictDialog(conflict) {
  const result = await DialogV2.query({
    window: { title: `Guard Sync Conflict: ${conflict.entityType}` },
    content: `
      <div class="guard-conflict-resolution">
        <h3>Synchronization Conflict Detected</h3>
        <p>Choose which version to keep for ${conflict.entityName}:</p>
        <div class="conflict-options">
          <div class="option local">
            <h4>Local Version (${conflict.localUser})</h4>
            <div class="guard-stats">${this.formatGuardData(conflict.localData)}</div>
          </div>
          <div class="option remote">
            <h4>Remote Version (${conflict.remoteUser})</h4>
            <div class="guard-stats">${this.formatGuardData(conflict.remoteData)}</div>
          </div>
        </div>
      </div>
    `,
    buttons: [
      { action: "local", icon: "fas fa-user", label: "Keep Local", default: true },
      { action: "remote", icon: "fas fa-cloud", label: "Accept Remote" },
      { action: "merge", icon: "fas fa-code-merge", label: "Attempt Merge" },
      { action: "cancel", icon: "fas fa-times", label: "Cancel" }
    ]
  });
  return result;
}
```

### Socket Communication Patterns

**Guard Management Specific Events**:

- `guard-management.guard-updated`: Base guard statistics changed
- `guard-management.patrol-created`: New patrol formed
- `guard-management.effect-applied`: Modifier/effect activated
- `guard-management.resource-changed`: Resource quantities modified
- `guard-management.reputation-updated`: Faction relationship changed

**Enhanced Socket Manager for Foundryborne**:

```javascript
class GuardSyncManager extends SyncManager {
  constructor() {
    super();
    this.entityTypes = ['guard', 'patrol', 'modifier', 'effect', 'resource', 'reputation'];
    this.derivedDataCache = new Map(); // For patrol stat calculations
  }

  async syncGuardEntity(entityType, entityData, operation = 'update') {
    // Handle derived data invalidation
    if (entityType === 'guard' && operation === 'update') {
      this.invalidatePatrolStats(entityData.id);
    }

    return super.queueSync({
      id: entityData.id,
      type: entityType,
      operation: operation,
      data: entityData,
      version: entityData.version || 1,
    });
  }

  invalidatePatrolStats(guardId) {
    // Recalculate all patrol stats that depend on this guard
    this.derivedDataCache.forEach((value, key) => {
      if (key.startsWith(`patrol-${guardId}`)) {
        this.derivedDataCache.delete(key);
      }
    });
  }
}
```

## Research Tasks for Foundryborne Integration

### High Priority

- [ ] Test DialogV2.query with guard-specific conflict scenarios
- [ ] Implement patrol stat derivation with real-time updates
- [ ] Test multi-patrol synchronization with effect cascading
- [ ] Performance testing with large numbers of patrols and effects

### Medium Priority

- [ ] Explore Foundry V13 Actor integration for patrol leaders
- [ ] Test compatibility with Foundryborne system hooks
- [ ] Implement visual indicators for active effects
- [ ] Add drag-and-drop support for GM storage items

### Low Priority

- [ ] Custom CSS themes matching Foundryborne aesthetics
- [ ] Internationalization for Spanish/English Daggerheart terms
- [ ] Integration with Foundryborne's existing UI elements
- [ ] Advanced patrol visualization tools

## Testing Scenarios for Guard Management

### Entity-Specific Testing

**Guard Statistics**:

1. **Basic CRUD**: Create guard with 4 base stats, update individual stats
2. **Modifier Application**: Apply positive/negative/neutral modifiers
3. **Stat Boundaries**: Test minimum/maximum stat values
4. **Derived Calculations**: Verify patrol stats derive correctly from guard base

**Patrol Management**:

1. **Composition Validation**: Test 1-12 unit limits with leader requirement
2. **Stat Inheritance**: Verify base stats come from guard correctly
3. **Custom Modifiers**: Test user-defined stat adjustments
4. **Effect Stacking**: Multiple effects on same patrol

**Resource Tracking**:

1. **Quantity Management**: Spend/gain resources with validation
2. **Negative Prevention**: Ensure quantities don't go below zero
3. **Bulk Operations**: Add/remove large quantities efficiently

**Reputation System**:

1. **Level Transitions**: Test all 7 reputation levels
2. **Faction Management**: Multiple factions with different levels
3. **Relationship Changes**: Improve/degrade reputation over time

### Synchronization Testing

**Multi-Client Scenarios**:

1. **GM Creates, Player Views**: Immediate update visibility
2. **Simultaneous Modifications**: Conflict resolution testing
3. **Permission Boundaries**: Players can't modify GM-only content
4. **Offline/Online**: Handle disconnected clients gracefully

**Complex Entity Relationships**:

1. **Guard → Patrol Updates**: Base stat changes propagate to patrols
2. **Effect Cascading**: Guard modifiers affect all derived patrols
3. **Leader Changes**: Patrol leader updates from Actor changes
4. **Storage Assignment**: GM storage items applied to active entities

## UI/UX Design Decisions

### Dialog Architecture

- **Independent Dialogs**: Each entity type has its own dedicated dialog
- **Reusable Pattern**: Same dialog structure for Create/Edit modes
- **Player Permissions**: Players have FULL access to edit all entities (except GM Warehouse)
- **GM Warehouse**: Only GM access, separate interface

### Main Interface Structure

```
Main Guard Management Window
├── Tab 1: Guard Statistics (primary)
│   ├── Guard Stats Management (top section)
│   └── Sub-tabs (bottom section):
│       ├── Resources Sub-tab
│       └── Reputation Sub-tab
├── Tab 2: Patrols
│   └── Grid View Layout:
│       ├── Left Side: Leader & Units (drag&drop zones)
│       └── Right Side: Patrol Details & Stats
└── Separate Dialog: GM Warehouse (completely independent)
```

### Dialog Architecture Specifics

- **Guard Stats**: Independent create/edit dialogs
- **Resources**: Independent create/edit dialogs
- **Reputation**: Independent create/edit dialogs
- **Patrols**: Independent create/edit dialogs with grid layout
- **GM Warehouse**: Completely separate dialog window (not tab)

### Patrol Grid Layout Design

```
Patrol Tab Layout:
┌─────────────────┬──────────────────────────────┐
│ Leader & Units  │ Patrol Details & Stats       │
│ (Left Panel)    │ (Right Panel)                │
├─────────────────┼──────────────────────────────│
│ ☰ Leader        │ 📊 Calculated Stats          │
│ [Drag Drop Zone]│ • Robustismo: 12 (+2)       │
│                 │ • Analítica: 8 (-1)         │
│ 👥 Units (1-12) │ • Subterfugio: 15 (+3)      │
│ [Drag Drop Zone]│ • Elocuencia: 10 (base)     │
│                 │                              │
│                 │ ⚡ Active Effects             │
│                 │ • [Effect 1] [x]             │
│                 │ • [Effect 2] [x]             │
│                 │                              │
│                 │ 🔧 Custom Modifiers          │
│                 │ • Rob: +1  Ana: -1  Sub: +2  │
└─────────────────┴──────────────────────────────┘
```

### Drag & Drop Flow Patterns

- **Actor Assignment**: Foundry Sidebar → Patrol Leader/Units zones (both supported)
- **Effect Application**: GM Warehouse → Patrol Effects → Drag onto specific patrol dialog
- **Real-time Updates**: All stat calculations update immediately upon any change

### Confirmation Dialogs Required

- ✅ **Delete Operations**: All entity deletions require confirmation
- ❌ **Apply Effects**: No confirmation needed (immediate application)
- ❌ **Modify Stats**: No confirmation needed (real-time updates)

### Input Types by Entity

- **Reputation**: Select dropdown (7 levels)
- **Images**: File picker for effects/modifiers
- **Stats**: Individual numeric inputs per stat (real-time calculation)
- **Leaders/Units**: Drag & Drop from Foundry Actor sidebar OR canvas
- **Effects**: Drag & Drop from GM Warehouse to patrol dialogs

## Notes for AI Assistant

When developing Guard Management for Foundryborne:

1. **Entity Relationship Priority**: Always maintain Guard → Patrol → Effects hierarchy
2. **Permission Awareness**: Respect GM vs Player access levels throughout
3. **Derived Data Management**: Invalidate and recalculate patrol stats when base guard stats change
4. **Foundryborne Integration**: Use Daggerheart terminology and maintain system compatibility
5. **TDD Discipline**: Write tests first for all CRUD operations and business logic
6. **DialogV2 Focus**: Prioritize DialogV2.query for all user interactions requiring choice
7. **Performance Consciousness**: Cache derived calculations and batch synchronization updates
8. **Spanish/English Support**: Support both languages for Daggerheart terminology
9. **Dialog Reusability**: Use same dialog pattern for create/edit across all entities
10. **Drag & Drop Priority**: Implement extensive drag & drop for intuitive UX

## References

- [Foundry VTT Sockets Documentation](https://foundryvtt.wiki/en/development/api/sockets)
- [DialogV2 API Documentation](https://foundryvtt.com/api/v13/DialogV2.html)
- [Foundry V13 Release Notes](https://foundryvtt.com/releases/13.0.0)
- [Daggerheart System Documentation](https://daggerheart.com/)
- [Foundryborne Module Repository](https://github.com/foundryvtt-daggerheart/foundryvtt-daggerheart)
