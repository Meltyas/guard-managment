# Guard Management - Foundry VTT Module

A comprehensive guard organization management system for Foundry VTT V13, built specifically for the **Foundryborne system (Daggerheart)**. This module uses **Custom Document Sub-Types** to provide seamless synchronization and permission management between GM and Players.

## 🚀 New Architecture (v2.0)

This module has been completely rewritten to use **Foundry's Custom Sub-Types** instead of Settings, providing:

- ✅ **Native Permissions**: Full GM/Player permission control per document
- ✅ **Automatic Sync**: Real-time synchronization handled by Foundry
- ✅ **No Permission Issues**: Eliminates all Settings-based permission problems
- ✅ **Drag & Drop**: Native Foundry drag & drop between documents
- ✅ **Export/Import**: Automatic backup with world data

## 📋 Features

### Guard Organizations (Actor Sub-Type)

- Complete guard organizations with 4 base stats (Robustismo, Analítica, Subterfugio, Elocuencia)
- Organizational-level resources and reputation tracking
- Automatic stat calculation with modifiers
- Relationship management with patrols

### Patrols (Actor Sub-Type)

- Operational units (1-12 members + leader)
- Derived stats from parent organization
- Custom modifiers and temporary effects
- Status tracking (idle, deployed, recalled)

### Resources (Item Sub-Type)

- Organizational resource management
- Quantity tracking with automatic calculations
- Transfer capabilities between organizations
- Low stock warnings

### Reputation (Item Sub-Type)

- 7-tier reputation system (Enemigos to Aliados)
- Faction relationship tracking
- Automatic modifier calculations
- Action availability based on reputation level

## 🎮 Quick Start

### Installation

1. Download the module from the releases page
2. Install in Foundry VTT V13
3. Enable the module in your world
4. The floating management panel will appear automatically

### Basic Usage

**Via Console (for testing):**

```javascript
// Create sample data
GuardManagementHelpers.createSampleData();

// Show management dialog
GuardManagementHelpers.showManagementDialog();

// List organizations
GuardManagementHelpers.listOrganizations();

// Get help
GuardManagementHelpers.help();
```

**Via UI:**

1. Use the floating panel that appears on the left
2. Click "Manage Organizations" to open the main dialog
3. Create, edit, and manage your guard organizations
4. Manage patrols for each organization

## 🔧 Document Types

### Actor Sub-Types

- `guard-management.guard-organization`: Main organizational units
- `guard-management.patrol`: Operational patrol units

### Item Sub-Types

- `guard-management.guard-resource`: Organizational resources
- `guard-management.guard-reputation`: Faction relationships

These appear in the standard Foundry Actors and Items directories with their custom icons and sheets.

## 📊 Data Structure

### Guard Organization

```typescript
{
  name: "City Watch",
  type: "guard-management.guard-organization",
  system: {
    subtitle: "Protectors of the Realm",
    baseStats: {
      robustismo: 12,
      analitica: 10,
      subterfugio: 8,
      elocuencia: 11
    },
    patrols: ["patrol-id-1", "patrol-id-2"],
    resources: ["resource-id-1"],
    reputation: ["reputation-id-1"]
  }
}
```

## 🔌 API Access

```javascript
const gm = window.GuardManagement;

// Document management
const org = await gm.documentManager.createGuardOrganization({...});
const patrol = await gm.documentManager.createPatrol({...});
const resource = await gm.documentManager.createGuardResource({...});

// Show UI
await gm.guardDialogManager.showManageOrganizationsDialog();

// Listen for changes
window.addEventListener('guard-document-updated', (event) => {
  console.log('Document updated:', event.detail);
});
```

## 🧪 Development

### Setup

```bash
# Use correct Node.js version
nvm use 20.11.0

# Install dependencies
npm install

# Development with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm run test
```

### VS Code Tasks

- **Guard Management: Setup**: Initial setup with nvm
- **Guard Management: Dev Server**: Hot reload development
- **Guard Management: Build**: Production build
- **Guard Management: Build Watch**: Auto-rebuild for Foundry
- **Guard Management: Test**: Run test suite

### Testing in Foundry

1. Run `npm run build:watch` to auto-rebuild on changes
2. Refresh Foundry to reload the module
3. Use console helpers for quick testing:
   ```javascript
   GuardManagementHelpers.createSampleData();
   GuardManagementHelpers.showManagementDialog();
   ```

## 🎯 Stat System

### Base Stats (Daggerheart)

- **Robustismo**: Physical strength and resilience
- **Analítica**: Analytical thinking and investigation
- **Subterfugio**: Stealth and deception capabilities
- **Elocuencia**: Communication and leadership skills

### Calculation Flow

1. **Organization Base Stats** → Foundation values
2. **Organization Modifiers** → Applied to base stats
3. **Patrol Derivation** → Patrols inherit modified stats
4. **Patrol Custom Modifiers** → Unit-specific adjustments
5. **Patrol Effects** → Temporary modifications

### Reputation Levels

1. **Enemigos** (-3 modifier): Active hostility
2. **Hostiles** (-2 modifier): Unfriendly relations
3. **Desconfiados** (-1 modifier): Suspicious attitude
4. **Neutrales** (0 modifier): Neutral standing
5. **Amistosos** (+1 modifier): Friendly relations
6. **Confiados** (+2 modifier): Trusted allies
7. **Aliados** (+3 modifier): Close alliance

## 📁 File Structure

```
src/
├── documents/           # Custom sub-types and DataModels
│   ├── models/         # DataModel definitions
│   │   ├── GuardOrganizationModel.ts
│   │   ├── PatrolModel.ts
│   │   ├── GuardResourceModel.ts
│   │   └── GuardReputationModel.ts
│   └── index.ts        # Document registration
├── managers/           # Business logic managers
│   ├── DocumentBasedManager.ts      # Main document CRUD
│   └── SimpleGuardDialogManager.ts  # UI management
├── types/              # TypeScript definitions
│   ├── entities.ts     # Entity interfaces
│   └── foundry.d.ts    # Foundry API types
├── ui/                 # User interface components
├── utils/              # Utility functions
└── main.ts             # Module entry point
```

## 🐛 Migration from v1.0

The module automatically handles the new architecture. If you have old Settings-based data, it will remain in your world but won't be used by the new system. You can:

1. Export old data manually if needed
2. Create new data using the new system
3. The old Settings remain untouched for safety

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the existing patterns
4. Add tests for new functionality
5. Submit a pull request

### Development Philosophy

- **Test-First Development**: Write tests before implementing features
- **Type Safety**: Full TypeScript coverage
- **Foundry Integration**: Use native Foundry APIs whenever possible
- **Permission Aware**: Always consider GM vs Player permissions

## 📜 License

MIT License - see LICENSE file for details

## 🔗 Links

- **GitHub**: [guard-management](https://github.com/meltyas/guard-management)
- **Issues**: [Bug Reports & Feature Requests](https://github.com/meltyas/guard-management/issues)
- **Foundry VTT**: [Official Website](https://foundryvtt.com/)

## 📝 Changelog

### v2.0.0 (Current)

- ✨ Complete rewrite using Custom Sub-Types
- ✨ Native Foundry permissions and synchronization
- ✨ New DocumentBasedManager architecture
- ✨ Simplified UI with native Foundry integration
- ✨ Console helpers for development and testing
- 🐛 Fixed all permission-related issues
- 🐛 Eliminated sync conflicts and race conditions

### v1.0.0 (Legacy)

- Settings-based architecture (deprecated)
- Complex sync manager with conflict resolution
- Permission limitations
