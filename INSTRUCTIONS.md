# Instructions for AI Assistant: Guard Management Module

## Project Overview

This is a Foundry VTT V13 module designed to test data synchronization between Player and GM clients. The primary goal is to understand and prevent synchronization "death spirals" where sync conflicts create cascading failures.

## Project Structure

```
guard-management/
├── src/                     # Source code
│   ├── main.ts             # Main entry point
│   ├── managers/           # Core business logic
│   │   ├── GuardManager.ts # Guard data management
│   │   └── SyncManager.ts  # Synchronization logic
│   ├── types/              # TypeScript type definitions
│   │   └── sync.ts         # Sync-related types
│   ├── styles/             # CSS styles
│   │   └── main.css        # Main stylesheet
│   ├── settings.ts         # Foundry settings registration
│   └── hooks.ts            # Foundry hook registrations
├── tests/                  # Test files
│   ├── GuardManager.test.ts
│   └── SyncManager.test.ts
├── lang/                   # Localization files
│   └── en.json
├── dist/                   # Built files (generated)
├── package.json            # Dependencies and scripts
├── module.json             # Foundry module manifest
├── vite.config.ts          # Build configuration
├── tsconfig.json           # TypeScript configuration
├── .eslintrc.js            # Linting rules
├── .prettierrc.json        # Code formatting
└── README.md               # Documentation
```

## Key Technologies

- **TypeScript**: Type-safe JavaScript development
- **Vite**: Fast build tool and development server
- **Vitest**: Fast unit testing framework
- **ESLint + Prettier**: Code quality and formatting
- **Foundry VTT Types**: Type definitions for Foundry API

## Development Workflow

### Prerequisites

#### Node Version Manager (nvm) Setup
This project uses nvm to ensure consistent Node.js versions across development environments.

**Windows (nvm-windows):**
1. Download and install nvm-windows from: https://github.com/coreybutler/nvm-windows
2. Open a new terminal (bash.exe or PowerShell)
3. Verify installation: `nvm version`

**Using nvm with this project:**
```bash
# Use the Node.js version specified in .nvmrc
nvm use

# If the version isn't installed, install it first
nvm install 20.11.0
nvm use 20.11.0

# Verify the correct version is active
node --version  # Should output v20.11.0
npm --version   # Should be compatible version
```

### Initial Setup
```bash
# Ensure correct Node.js version
nvm use

# Install dependencies
npm install

# Build the module
npm run build
```

### Development Commands
```bash
npm run dev         # Development with hot reload
npm run test        # Run tests
npm run test:watch  # Tests in watch mode
npm run test:ui     # Tests with UI
npm run lint        # Check code quality
npm run lint:fix    # Fix linting issues
npm run format      # Format code
```

## Core Components

### 1. GuardManager (`src/managers/GuardManager.ts`)
- **Purpose**: Manages guard entities and their data
- **Key Methods**:
  - `createGuard()`: Create new guards
  - `updateGuard()`: Modify existing guards
  - `getGuard()` / `getAllGuards()`: Retrieve guard data
  - `deleteGuard()`: Remove guards
  - `createSampleGuards()`: Generate test data

### 2. SyncManager (`src/managers/SyncManager.ts`)
- **Purpose**: Handles data synchronization between clients
- **Key Features**:
  - Queue-based sync processing
  - Multiple conflict resolution strategies
  - Auto-sync with configurable intervals
  - Conflict detection and resolution
- **Strategies**:
  - `last-write-wins`: Newest timestamp wins
  - `gm-priority`: GM changes override players
  - `manual-resolve`: Queue for user resolution

### 3. Types (`src/types/sync.ts`)
- **SyncData**: Base sync data structure
- **GuardData**: Guard entity structure
- **SyncConflict**: Conflict representation
- **SyncOptions**: Configuration options

## Anti-Death Spiral Design

### Prevention Mechanisms
1. **Version Tracking**: Each sync operation includes version numbers
2. **Timestamp Validation**: Prevent processing outdated sync data
3. **User Identification**: Track sync origin to prevent loops
4. **Circuit Breaker**: Limit sync attempts to prevent cascading failures
5. **Conflict Queuing**: Handle conflicts asynchronously

### Conflict Resolution
1. **Detection**: Compare timestamps, versions, user IDs
2. **Classification**: Determine conflict type
3. **Resolution**: Apply configured strategy
4. **Notification**: Alert users when manual intervention needed

## Testing Strategy

### Unit Tests
- **GuardManager**: CRUD operations, data validation
- **SyncManager**: Sync operations, conflict resolution
- **Mock Environment**: Foundry globals are mocked for testing

### Integration Testing
- End-to-end sync scenarios
- Multi-client simulation
- Conflict resolution testing

### Manual Testing
- Debug panel with testing controls
- Sample data generation
- Sync simulation tools

## Common Development Tasks

### Adding New Guard Properties
1. Update `GuardData` interface in `src/types/sync.ts`
2. Modify `GuardManager` methods as needed
3. Update tests in `tests/GuardManager.test.ts`
4. Add UI elements if necessary

### Adding New Sync Strategy
1. Add strategy to `SyncStrategy` type in `src/types/sync.ts`
2. Implement resolution logic in `SyncManager.handleConflict()`
3. Add tests for the new strategy
4. Update settings registration

### Adding New Test Scenario
1. Create test method in appropriate manager
2. Add debug panel button if needed
3. Document the scenario in README

### Modifying UI
1. Update CSS in `src/styles/main.css`
2. Add localization strings to `lang/en.json`
3. Test across different screen sizes

## Debugging Guidelines

### Enable Debug Mode
1. Go to module settings in Foundry
2. Enable "Debug Mode"
3. Use browser developer tools for detailed logging

### Common Debug Scenarios
```javascript
// Access module instance
const gm = window.GuardManagement;

// Test guard operations
gm.guardManager.createSampleGuards();
gm.guardManager.getAllGuards();

// Test sync operations
gm.syncManager.simulateSync('guard', 5);
gm.syncManager.getSyncOptions();

// Test conflict scenarios
gm.syncManager.updateSyncOptions({ strategy: 'manual-resolve' });
```

### Performance Monitoring
- Monitor sync queue length
- Track conflict resolution time
- Watch for memory leaks in long sessions

## Code Quality Standards

### TypeScript
- Strict type checking enabled
- Prefer interfaces over `any`
- Use proper error handling

### Testing
- Aim for 80%+ test coverage
- Test both success and failure scenarios
- Mock external dependencies

### Documentation
- Update README for major changes
- Comment complex algorithms
- Maintain type definitions

## Common Issues and Solutions

### Issue: Module not loading
**Check**: Console errors, dependency installation, build process

### Issue: Sync not working
**Check**: Socket connections, user permissions, network connectivity

### Issue: Conflicts not resolving
**Check**: Strategy settings, conflict queue, manual resolution UI

### Issue: Performance problems
**Check**: Sync interval settings, queue length, memory usage

## Best Practices

### Sync Operations
- Batch multiple changes when possible
- Use debouncing for rapid updates
- Validate data before syncing
- Handle network failures gracefully

### Conflict Resolution
- Provide clear user feedback
- Log all conflict decisions
- Allow manual override when needed
- Test edge cases thoroughly

### Error Handling
- Graceful degradation when features fail
- Clear error messages for users
- Comprehensive logging for debugging
- Recovery mechanisms for data corruption

## Future Enhancements

### Potential Features
- **Real-time Visualization**: Live sync status dashboard
- **Advanced Conflict UI**: Rich conflict resolution interface
- **Performance Analytics**: Detailed sync performance metrics
- **Backup/Restore**: Data backup and recovery tools
- **Multi-Scene Support**: Cross-scene guard management

### Scalability Considerations
- Optimize for larger guard counts
- Improve network efficiency
- Add data compression
- Implement incremental sync

## Integration with Foundry

### Hooks Usage
- `userConnected`: Sync on user join
- `updateToken`: Track guard movement
- `updateCombat`: React to combat changes
- Custom hooks for module communication

### Settings System
- World settings for shared configuration
- Client settings for personal preferences
- Runtime setting updates

### Socket Communication
- Structured message format
- Error handling and retries
- Rate limiting and throttling

## When to Ask for Help

### Complex Foundry API Questions
- Use `get_vscode_api` tool for Foundry-specific questions
- Check Foundry documentation for API changes

### Build Issues
- Verify Node.js version compatibility
- Check for dependency conflicts
- Review Vite configuration

### Testing Problems
- Ensure test environment setup
- Verify mock configurations
- Check for async/await issues

### Performance Issues
- Profile with browser tools
- Monitor memory usage
- Check for infinite loops

Remember: This module is primarily for testing and learning about sync patterns. Focus on clear, well-tested code that demonstrates different synchronization scenarios rather than production features.
