# Development Notes: Foundry VTT V13 Features

## Key APIs to Investigate

### DialogV2.query

- **Purpose**: New dialog system in Foundry V13
- **Use Case**: Could be useful for conflict resolution UI
- **Investigation**: Test for better user interaction when sync conflicts occur
- **Documentation**: Check Foundry V13 API docs for DialogV2 methods

### Socket Communication

- **Reference**: https://foundryvtt.wiki/en/development/api/sockets
- **Current Usage**: Already implemented in SyncManager
- **Improvements**:
  - Error handling patterns
  - Rate limiting strategies
  - Connection stability monitoring
  - Message queuing during disconnections

## Implementation Ideas

### Enhanced Conflict Resolution with DialogV2

```javascript
// Potential implementation for manual conflict resolution
async showConflictDialog(conflict) {
  const result = await DialogV2.query({
    window: { title: "Sync Conflict Detected" },
    content: `
      <div class="conflict-resolution">
        <h3>Data Conflict</h3>
        <p>Choose which version to keep:</p>
        <div class="conflict-options">
          <div class="option local">
            <h4>Local Version</h4>
            <pre>${JSON.stringify(conflict.localData, null, 2)}</pre>
          </div>
          <div class="option remote">
            <h4>Remote Version</h4>
            <pre>${JSON.stringify(conflict.remoteData, null, 2)}</pre>
          </div>
        </div>
      </div>
    `,
    buttons: [
      {
        action: "local",
        icon: "fas fa-home",
        label: "Use Local",
        default: true
      },
      {
        action: "remote",
        icon: "fas fa-cloud",
        label: "Use Remote"
      },
      {
        action: "cancel",
        icon: "fas fa-times",
        label: "Cancel"
      }
    ]
  });

  return result;
}
```

### Advanced Socket Patterns

```javascript
// Enhanced socket handling with retry logic
class SocketManager {
  constructor() {
    this.messageQueue = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async sendWithRetry(data, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.send(data);
        return true;
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await this.delay(Math.pow(2, i) * 1000); // Exponential backoff
      }
    }
  }
}
```

## Research Tasks

### High Priority

- [ ] Test DialogV2.query with complex conflict scenarios
- [ ] Implement socket reconnection patterns
- [ ] Test multi-user scenarios with network interruptions
- [ ] Performance testing with large sync queues

### Medium Priority

- [ ] Explore Foundry V13 new hooks for better integration
- [ ] Test compatibility with other modules
- [ ] Implement data compression for large sync payloads
- [ ] Add metrics collection for sync performance

### Low Priority

- [ ] Custom CSS themes for conflict resolution UI
- [ ] Internationalization for conflict messages
- [ ] Integration with Foundry's notification system
- [ ] Advanced debugging tools and visualizations

## Testing Scenarios

### DialogV2 Testing

1. **Simple Conflicts**: Test basic conflict resolution UI
2. **Complex Data**: Test with nested objects and arrays
3. **Rapid Conflicts**: Test multiple conflicts in quick succession
4. **User Cancellation**: Test dialog cancellation behavior

### Socket Testing

1. **Connection Loss**: Simulate network disconnections
2. **Message Ordering**: Test out-of-order message handling
3. **Large Payloads**: Test with significant data volumes
4. **Concurrent Users**: Test with multiple simultaneous users

## Notes for AI Assistant

When working on this module:

1. **DialogV2 Focus**: Prioritize using DialogV2.query for user interactions
2. **Socket Reliability**: Implement robust error handling and retry logic
3. **Performance**: Monitor and optimize sync operations
4. **User Experience**: Ensure clear feedback during conflicts
5. **Testing**: Always test with multiple simulated clients

## References

- [Foundry VTT Sockets Documentation](https://foundryvtt.wiki/en/development/api/sockets)
- [DialogV2 API Documentation](https://foundryvtt.com/api/v13/DialogV2.html)
- [Foundry V13 Release Notes](https://foundryvtt.com/releases/13.0.0)
