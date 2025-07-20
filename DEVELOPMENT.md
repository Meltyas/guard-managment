# Development Guide: Guard Management Module

## Quick Start for New Developers

### 1. Initial Setup
```bash
# Clone the repository (if not already done)
# Navigate to the project directory
cd c:/Games/foundry/Data/modules/guard-management

# Run the automated setup (Windows)
npm run setup:win

# OR run manual setup
nvm use 20.11.0
npm install
npm run build
```

### 2. Daily Development Workflow
```bash
# Always start with the correct Node.js version
nvm use 20.11.0

# Start development
npm run dev     # Starts Vite dev server

# In another terminal, run tests
npm run test:watch  # Run tests in watch mode
```

## Key Development Tools

### Node Version Manager (nvm)
- **Why**: Ensures all developers use the same Node.js version
- **Usage**: Always run `nvm use 20.11.0` when starting work
- **Setup**: Install nvm-windows from GitHub (Windows users)

### Vite
- **Why**: Fast build tool with hot module replacement
- **Usage**: `npm run dev` for development, `npm run build` for production
- **Config**: See `vite.config.ts` for configuration

### Vitest
- **Why**: Fast testing framework that works with TypeScript/ESM
- **Usage**: `npm run test` or `npm run test:ui` for visual testing
- **Location**: Tests are in the `tests/` directory

### TypeScript
- **Why**: Type safety and better IDE support
- **Usage**: Automatically compiled by Vite
- **Config**: See `tsconfig.json` for configuration

## Testing Strategy

### Unit Tests
Focus on testing individual components:
- `GuardManager`: CRUD operations, data validation
- `SyncManager`: Synchronization logic, conflict resolution

### Integration Tests  
Test the interaction between components:
- End-to-end sync scenarios
- Multi-client simulation
- Conflict resolution workflows

### Manual Testing
Use the debug panel in Foundry to:
- Generate test data
- Simulate sync conflicts
- Test different strategies

## Synchronization Testing

### Basic Sync Testing
```javascript
// In Foundry console
const gm = window.GuardManagement;

// Create test guards
gm.guardManager.createSampleGuards();

// Simulate sync operations
gm.syncManager.simulateSync('guard', 5);

// Check sync status
gm.syncManager.getSyncOptions();
```

### Conflict Testing
```javascript
// Set manual resolution mode
gm.syncManager.updateSyncOptions({ 
  strategy: 'manual-resolve' 
});

// Generate conflicts
gm.syncManager.simulateSync('guard', 10);

// Check pending conflicts
gm.syncManager.getPendingConflicts();
```

## Common Development Tasks

### Adding New Features
1. **Update Types**: Modify interfaces in `src/types/sync.ts`
2. **Implement Logic**: Add to appropriate manager class
3. **Write Tests**: Create/update test files
4. **Update UI**: Modify styles/templates if needed
5. **Document**: Update README and instructions

### Debugging Sync Issues
1. **Enable Debug Mode**: In Foundry module settings
2. **Check Console**: Look for sync-related logs
3. **Use Browser DevTools**: Network tab for socket issues
4. **Test Isolation**: Use single-client testing first

### Performance Optimization
1. **Monitor Sync Queue**: Check queue length during high activity
2. **Adjust Intervals**: Tune sync frequency in settings
3. **Profile Code**: Use browser performance tools
4. **Memory Leaks**: Watch for growing object counts

## Best Practices

### Code Quality
- ✅ Run `npm run lint` before committing
- ✅ Format code with `npm run format`
- ✅ Ensure tests pass with `npm run test`
- ✅ Type-check with `npm run type-check`

### Git Workflow
- ✅ Use descriptive commit messages
- ✅ Test locally before pushing
- ✅ Keep changes focused and small
- ✅ Document any breaking changes

### Sync Development
- ✅ Always test with multiple clients
- ✅ Consider network latency scenarios
- ✅ Handle edge cases gracefully
- ✅ Log important operations for debugging

## Troubleshooting

### Node.js Version Issues
```bash
# Check current version
node --version

# Switch to project version
nvm use 20.11.0

# If version not installed
nvm install 20.11.0
nvm use 20.11.0
```

### Build Issues
```bash
# Clean and reinstall
npm run fresh

# Check for TypeScript errors
npm run type-check

# Check for linting issues
npm run lint
```

### Test Failures
```bash
# Run tests with verbose output
npm run test -- --reporter=verbose

# Run specific test file
npm run test GuardManager.test.ts

# Run tests with UI for debugging
npm run test:ui
```

### Foundry Integration Issues
- Check Foundry console for errors
- Verify module is enabled
- Ensure correct Foundry VTT version (V13)
- Check socket connections in Network tab

## VS Code Tips

### Recommended Extensions
- ESLint
- Prettier
- TypeScript Importer
- Vite (for better dev server integration)

### Useful Tasks (Ctrl+Shift+P > "Tasks: Run Task")
- "Guard Management: Setup with nvm"
- "Guard Management: Dev Server (with nvm)"
- "Guard Management: Build (with nvm)"
- "Guard Management: Test (with nvm)"

### Debugging
- Set breakpoints in TypeScript files
- Use VS Code debugger for Node.js tests
- Browser debugger for Foundry runtime code

## Module Architecture

### Core Components
```
src/
├── main.ts           # Entry point, module initialization
├── managers/         # Business logic
│   ├── GuardManager.ts   # Guard CRUD operations  
│   └── SyncManager.ts    # Synchronization logic
├── types/            # TypeScript definitions
├── settings.ts       # Foundry settings registration
└── hooks.ts          # Foundry hook handlers
```

### Data Flow
1. **User Action** → GuardManager → SyncManager → Socket
2. **Socket Event** → SyncManager → Conflict Detection → Resolution
3. **Resolution** → Data Update → UI Refresh

### Testing Philosophy
- **Unit**: Test individual methods in isolation
- **Integration**: Test component interactions
- **E2E**: Test full user workflows
- **Performance**: Test under load conditions

---

**Remember**: This module is for testing sync patterns, not production use. Focus on clear, well-tested code that demonstrates different synchronization scenarios.
