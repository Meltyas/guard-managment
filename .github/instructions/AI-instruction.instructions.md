---
applyTo: '**'
---

# AI Assistant Context: Guard Management Module

## Project Overview

**Guard Management** is a Foundry VTT V13 module designed for the **Foundryborne system (Daggerheart)** to manage guard operations in campaigns. The module handles comprehensive guard management including statistics, patrols, resources, reputation, and temporary effects with full synchronization between GM and Players.

## Key Project Information

### Technologies

- **TypeScript**: Type-safe JavaScript development
- **Vite**: Fast build tool and development server
- **Vitest**: Fast unit testing framework
- **Foundry VTT V13**: Target platform
- **Node.js 20.11.0**: Required version (managed via nvm)

### Core Architecture

```
Guard Organization (base stats + resources + reputation)
  ├── Resources (organizational level)
  ├── Reputation (organizational level)
  ├── Guard Modifiers (affect entire organization)
  └── Patrols (derive from Guard organization stats)
      ├── Patrol Effects (specific to patrol)
      ├── Custom Modifiers (patrol-specific adjustments)
      └── Leader (references Actors)

GM Storage
  ↓ (templates for)
All Effect Types + Resources + Reputation + Modifiers
```

### Primary Entities

1. **Guard Organization**: Complete guard organization with 4 base stats (Robustismo, Analítica, Subterfugio, Elocuencia)
2. **Patrols**: Operational units (1-12 members + leader) with derived stats
3. **Resources**: Tracked materials and supplies
4. **Reputation**: 7-tier relationship system with factions
5. **Effects**: Temporary modifiers (organizational or patrol-specific)
6. **GM Storage**: Centralized template management

### Development Workflow

**Prerequisites**:

```bash
# Always use correct Node.js version
nvm use 20.11.0

# Development options
npm run dev          # Hot reload development
npm run build:watch  # Auto-rebuild for Foundry
npm run test:watch   # Tests in watch mode
```

**Available VS Code Tasks**:

- Guard Management: Setup with nvm
- Guard Management: Dev Server (with nvm)
- Guard Management: Build (with nvm)
- Guard Management: Build Watch (with nvm)
- Guard Management: Test (with nvm)

### TDD Implementation Strategy

**Test-First Development Approach**:

1. **Red**: Write failing tests for functionality
2. **Green**: Implement minimal working code
3. **Refactor**: Optimize and clean up

**Testing Priorities**:

- Unit Tests: CRUD operations, stat calculations, validation
- Integration Tests: Entity relationships, sync operations
- E2E Tests: Complete workflows, cross-client sync

### Synchronization Strategy

**Anti-Death Spiral Design**:

- Version tracking for all entities
- Conflict detection and resolution
- Permission-based access (GM vs Player)
- Real-time updates with DialogV2

**Conflict Resolution Priorities**:

1. GM Override: GM changes take precedence
2. Timestamp: Most recent change wins
3. Manual Resolution: DialogV2 intervention for complex conflicts

### Key Implementation Notes

**Entity Relationships**: Guard Organization → Resources/Reputation → Patrols → Effects
**Stat Calculation Flow**: Guard Base → Organization Modifiers → Patrol Derivation → Custom Modifiers → Effects → Final Stats
**Permission Matrix**: GM has full CRUD, Players have read-all + limited modify
**Dialog Architecture**: Independent dialogs per entity type, all use DialogV2.query

### Development Phases

1. **Foundation**: Basic entity models, CRUD operations, simple sync
2. **Business Logic**: Stat calculations, effect application, validation
3. **Advanced Sync**: Conflict resolution, permissions, real-time updates
4. **GM Tools**: Storage management, batch operations, templates
5. **Polish**: Enhanced UI, performance, error handling

## AI Assistant Guidelines

When working on this project:

1. **Entity Hierarchy**: Always maintain Guard Organization → Patrols relationship
2. **Permission Awareness**: Respect GM vs Player access throughout
3. **TDD Discipline**: Write tests first for all functionality
4. **DialogV2 Focus**: Use DialogV2.query for all user interactions
5. **Performance**: Cache derived calculations, batch sync updates
6. **Spanish/English**: Support Daggerheart terminology in both languages
7. **Drag & Drop**: Implement extensive drag & drop for intuitive UX

## Current Project State

- **Foundation Phase**: Core CRUD operations and basic sync implemented
- **Testing**: Comprehensive test suite with mocked Foundry environment
- **Architecture**: Manager pattern with GuardManager and SyncManager
- **UI**: DialogV2-based interface with tab structure planned

## Debug and Testing

**Console Access**:

```javascript
const gm = window.GuardManagement;
gm.guardManager.createSampleGuards();
gm.syncManager.simulateSync('guard', 5);
```

**Common Debug Scenarios**:

- Test guard CRUD operations
- Simulate sync conflicts
- Test permission boundaries
- Validate stat calculations

---

**Note**: This module is primarily for testing synchronization patterns in Foundry VTT. Focus on clear, well-tested code that demonstrates different sync scenarios rather than production features.
