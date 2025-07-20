# Guard Management Module for Foundry VTT V13

A testing module for Foundry VTT V13 focused on data synchronization between Player and GM clients, designed to help understand and prevent synchronization death spirals.

## Features

- **Real-time Data Synchronization**: Test data sync between multiple clients
- **Conflict Resolution**: Multiple strategies for handling sync conflicts
- **Guard Management**: Simple guard system for testing purposes
- **Debug Tools**: Built-in debugging and testing utilities
- **Anti-Death Spiral**: Designed to prevent synchronization loops

## Development Setup

### Prerequisites

- **Node Version Manager (nvm)**: For consistent Node.js versions
  - Windows: [nvm-windows](https://github.com/coreybutler/nvm-windows)
  - macOS/Linux: [nvm](https://github.com/nvm-sh/nvm)
- Foundry VTT V13

### Quick Start

1. Clone or download this module to your Foundry modules directory:

   ```
   c:\Games\foundry\Data\modules\guard-management\
   ```

2. **Easy Setup (Recommended)**:

   ```bash
   # Windows
   npm run setup:win

   # macOS/Linux/WSL
   npm run setup
   ```

3. **Manual Setup**:

   ```bash
   # Use the correct Node.js version
   nvm use

   # Install dependencies
   npm install

   # Build the module
   npm run build
   ```

4. Enable the module in Foundry VTT

### Node.js Version Management

This project uses `.nvmrc` to specify the required Node.js version (20.11.0). Always ensure you're using the correct version:

```bash
# Switch to the project's Node.js version
nvm use

# Check your current Node.js version
npm run check-node
```

### Development Commands

**Setup & Maintenance:**

- `npm run setup` / `npm run setup:win` - Complete project setup
- `npm run check-node` - Verify Node.js/npm versions
- `npm run fresh` - Clean install (removes node_modules and reinstalls)

**Development:**

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build

**Testing:**

- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:ui` - Run tests with UI

**Code Quality:**

- `npm run lint` - Lint code
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Format code with Prettier
- `npm run type-check` - TypeScript type checking

### Testing

The module includes comprehensive tests for:

- Guard management operations
- Synchronization scenarios
- Conflict resolution strategies
- Edge cases and error handling

Run tests with:

```bash
npm test
```

## Architecture

### Core Components

1. **GuardManager**: Handles guard data and operations
2. **SyncManager**: Manages data synchronization between clients
3. **Conflict Resolution**: Multiple strategies for handling sync conflicts

### Synchronization Strategies

- **Last Write Wins**: Most recent update takes precedence
- **GM Priority**: GM changes override player changes
- **Manual Resolution**: Queue conflicts for manual review

### Anti-Death Spiral Features

- Version tracking to prevent duplicate syncs
- Timestamp-based conflict detection
- User-based priority systems
- Circuit breaker for excessive sync attempts

## Usage

### Basic Guard Operations

```javascript
// Access the module instance
const guardModule = window.GuardManagement;

// Create a new guard
const guard = guardModule.guardManager.createGuard({
  name: 'Guard Alpha',
  position: { x: 100, y: 100 },
  status: 'active',
  assignedArea: 'North Gate',
});

// Update guard status
guardModule.guardManager.updateGuard(guard.id, {
  status: 'alert',
  position: { x: 120, y: 110 },
});
```

### Sync Testing

```javascript
// Simulate sync operations
guardModule.syncManager.simulateSync('guard', 5);

// Test different conflict scenarios
guardModule.syncManager.updateSyncOptions({
  strategy: 'last-write-wins',
  autoSync: true,
  syncInterval: 3000,
});
```

### Debug Mode

Enable debug mode in module settings to see:

- Real-time sync operations
- Conflict detection and resolution
- Performance metrics
- Network activity

## Configuration

### Module Settings

- **Sync Strategy**: Choose conflict resolution method
- **Auto Sync Interval**: How often to sync (1-30 seconds)
- **Enable Auto Sync**: Toggle automatic synchronization
- **Debug Mode**: Enable debugging features

### Advanced Configuration

Edit `vite.config.ts` for build settings:

- Change bundle format
- Modify external dependencies
- Adjust output directory

## Contributing

### Code Style

- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting
- Vitest for testing

### Adding Features

1. Create feature branch
2. Add tests for new functionality
3. Update documentation
4. Submit pull request

## Troubleshooting

### Common Issues

1. **Module not loading**: Check console for errors, ensure all dependencies are installed
2. **Sync not working**: Verify socket connections and user permissions
3. **Conflicts not resolving**: Check sync strategy settings

### Debug Tools

1. Enable debug mode in settings
2. Use browser developer tools
3. Check Foundry console for errors
4. Monitor network tab for socket activity

## Technical Details

### Data Flow

1. User action creates/modifies data
2. Data is queued for synchronization
3. SyncManager processes queue
4. Data is sent via socket to other clients
5. Receiving clients check for conflicts
6. Conflicts are resolved based on strategy
7. Final data is applied to local state

### Conflict Resolution

The module implements a sophisticated conflict resolution system:

1. **Detection**: Compare timestamps, versions, and user IDs
2. **Classification**: Determine conflict type (version, timestamp, user)
3. **Resolution**: Apply configured strategy
4. **Notification**: Alert users to conflicts when needed

### Performance Considerations

- Debounced sync operations
- Batch processing of multiple changes
- Efficient conflict detection algorithms
- Minimal data transfer

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review the console logs
3. Test with debug mode enabled
4. File an issue with reproduction steps
