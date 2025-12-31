---
applyTo: '**'
---

NEVER TOUCH THE DAGGERHEART WORKSPACE, IS JUST READ ONLY.

# AI Assistant Context: Guard Management Module

## 📋 Project Overview

**Guard Management** is a **Foundry VTT V13 module** designed for the **Foundryborne system (Daggerheart)** to manage guard operations in campaigns. The module handles comprehensive guard management including statistics, patrols, resources, reputation, and temporary effects with full synchronization between GM and Players.

---

## 🔧 Technical Stack

| Technology      | Version | Purpose                                |
| --------------- | ------- | -------------------------------------- |
| **TypeScript**  | Latest  | Type-safe JavaScript development       |
| **Vite**        | Latest  | Fast build tool and development server |
| **Vitest**      | Latest  | Fast unit testing framework            |
| **Foundry VTT** | V13     | Target platform                        |
| **Node.js**     | 20.11.0 | Required version (managed via nvm)     |

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
# Always use correct Node.js version
nvm use 20.11.0

# Development options
npm run dev          # Hot reload development
npm run build:watch  # Auto-rebuild for Foundry
npm run test:watch   # Tests in watch mode
```

---

## 📝 Task Management Rules

### ✅ Core Requirements

- **Make sure you are using v13 on foundry**: Look for the documentation if you don't know how to do it.
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
- ✅ **Chat integration**
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

### 🛡️ Anti-Death Spiral Design

- **Universal Edit Access**: All users should be able to edit all entities
- **Version Tracking**: Version tracking for all entities
- **Conflict Detection**: Conflict detection and resolution
- **Permission-Based Access**: GM vs Player permissions
- **Real-time Updates**: Real-time updates with DialogV2

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

## 📝 Project Notes

> **Note**: This module is primarily for testing synchronization patterns in Foundry VTT. Focus on clear, well-tested code that demonstrates different sync scenarios rather than production features.
