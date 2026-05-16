# WebSocket Connection Migration Guide

## Overview

All WebSocket connections in the application MUST now use the centralized `WebSocketConnectionManager`. This ensures:

- ✅ **Single App ID Source** - All connections use the same configured app ID
- ✅ **Connection Pooling** - One shared connection instead of multiple duplicates
- ✅ **Automatic Reconnection** - Built-in retry logic with exponential backoff
- ✅ **Message Queuing** - Messages sent while disconnected are queued
- ✅ **Status Tracking** - All components notified of connection state changes
- ✅ **Hot-Swap App ID** - Change app ID without losing connections

---

## Migration Steps

### Step 1: Import the Manager

```typescript
import { WebSocketConnectionManager, SimpleWebSocketConnection } from '@/external/bot-skeleton/services/api/websocket-connection-manager';
```

### Step 2: Use One of Three Patterns

#### Pattern A: Direct Manager (Advanced)
```typescript
const manager = WebSocketConnectionManager.getInstance();

// Subscribe to messages
const unsubscribeMessage = manager.onMessage((data) => {
  console.log('Received:', data);
});

// Subscribe to status changes
const unsubscribeStatus = manager.onStatusChange((status) => {
  console.log('Connection status:', status);
});

// Send messages
manager.send({ ticks_history: 'R_10', subscribe: 1 });

// Cleanup
unsubscribeMessage();
unsubscribeStatus();
```

#### Pattern B: Simple Connection (Recommended for React)
```typescript
import { SimpleWebSocketConnection } from '@/external/bot-skeleton/services/api/websocket-connection-manager';

const ws = new SimpleWebSocketConnection(
  (data) => {
    // Handle messages
    console.log('Message:', data);
  },
  (status) => {
    // Handle status changes
    console.log('Status:', status); // 'connecting', 'connected', 'disconnected', 'error'
  }
);

ws.send({ ticks: 'R_10' });

// When done
ws.close();
```

#### Pattern C: React Hook (Best for Components)
```typescript
import { useEffect, useState } from 'react';
import { WebSocketConnectionManager, WsConnectionStatus } from '@/external/bot-skeleton/services/api/websocket-connection-manager';

export function useWebSocket() {
  const [status, setStatus] = useState<WsConnectionStatus>('disconnected');
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    const manager = WebSocketConnectionManager.getInstance();
    
    // Listen to status changes
    const unsubscribeStatus = manager.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    // Listen to messages
    const unsubscribeMessage = manager.onMessage((data) => {
      setMessages(prev => [...prev, data]);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeMessage();
    };
  }, []);

  const send = (data: any) => {
    const manager = WebSocketConnectionManager.getInstance();
    manager.send(data);
  };

  return { status, messages, send };
}

// In your component:
function MyComponent() {
  const { status, messages, send } = useWebSocket();
  
  return (
    <>
      <p>Status: {status}</p>
      <button onClick={() => send({ ticks: 'R_10' })}>Subscribe</button>
    </>
  );
}
```

---

## Migration Examples

### Before (OLD - Do NOT use)
```typescript
// ❌ WRONG - Multiple connections, inconsistent app IDs
const ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=80058`);

ws.onopen = () => {
  ws.send(JSON.stringify({ ticks: 'R_10' }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

### After (NEW - Do THIS)
```typescript
// ✅ CORRECT - Single centralized connection
import { WebSocketConnectionManager } from '@/external/bot-skeleton/services/api/websocket-connection-manager';

const manager = WebSocketConnectionManager.getInstance();

const unsubscribe = manager.onMessage((data) => {
  console.log(data);
});

manager.onStatusChange((status) => {
  if (status === 'connected') {
    manager.send({ ticks: 'R_10' });
  }
});

// Cleanup
unsubscribe();
```

---

## Files to Update

### High Priority (Business Logic)
1. **`src/pages/analysis-tool/all-analysis.tsx`** - Hardcoded app_id=80058
2. **`src/pages/analysis-tool/tick-analyser.tsx`** - Hardcoded app_id=80058
3. **`src/pages/smart-trader/smart-trader.tsx`** - Hardcoded app_id=80058
4. **`src/stores/makoti-magic-store.js`** - Hardcoded app_id=101585
5. **`src/stores/over-under-store.ts`** - Should use manager instead

### Medium Priority (Public/External)
6. **`public/signals/signals.js`** - Hardcoded app_id=80058
7. **`public/circles/script.js`** - Uses ENDPOINT variable

### Low Priority (Already Using Config)
8. **`src/components/makoti-widget/makoti-ws.ts`** - Already good, just needs manager integration
9. **`src/pages/copy-trading/copy-trading-manager.ts`** - Already good, just needs manager integration

---

## Key API Reference

### `WebSocketConnectionManager.getInstance()`
Get singleton instance of the connection manager.

```typescript
const manager = WebSocketConnectionManager.getInstance();
```

### `manager.connect()`
Explicitly connect to the WebSocket (auto-connects on first message).

```typescript
await manager.connect();
```

### `manager.send(data)`
Send data through the WebSocket (auto-queues if disconnected).

```typescript
manager.send({ ticks: 'R_10', subscribe: 1 });
```

### `manager.onMessage(callback)`
Listen to incoming messages. Returns unsubscribe function.

```typescript
const unsubscribe = manager.onMessage((data) => {
  console.log('Message:', data);
});

// Later...
unsubscribe();
```

### `manager.onStatusChange(callback)`
Listen to connection status changes.

```typescript
manager.onStatusChange((status) => {
  console.log('Status:', status); // 'connecting' | 'connected' | 'disconnected' | 'error'
});
```

### `manager.getStatus()`
Get current connection status.

```typescript
const status = manager.getStatus();
```

### `manager.isConnected()`
Check if actively connected.

```typescript
if (manager.isConnected()) {
  manager.send({ ...message });
}
```

### `manager.updateAppId(newAppId)`
Change app ID and reconnect automatically.

```typescript
manager.updateAppId(111045);
```

### `manager.updateServerUrl(newUrl)`
Change server URL and reconnect.

```typescript
manager.updateServerUrl('ws.derivws.com');
```

### `manager.disconnect()`
Disconnect and clean up all listeners.

```typescript
manager.disconnect();
```

### `manager.getQueueLength()`
Check how many messages are queued.

```typescript
const queuedMessages = manager.getQueueLength();
```

---

## Testing Checklist

- [ ] All components load without creating multiple WebSocket connections
- [ ] Only ONE WebSocket connection in DevTools → Network
- [ ] App ID is consistent across all requests
- [ ] Messages queue when disconnected
- [ ] Queued messages send when reconnected
- [ ] Connection status updates propagate to all listeners
- [ ] Changing app ID doesn't break the app
- [ ] Automatic reconnection works after network failure
- [ ] No console errors about connection issues

---

## Troubleshooting

### Issue: Still creating multiple connections
**Solution:** Make sure ALL places use `WebSocketConnectionManager.getInstance()` - check for any remaining `new WebSocket()` calls.

### Issue: App ID not updating
**Solution:** Call `manager.updateAppId(newAppId)` after changing the app ID in localStorage.

### Issue: Messages not being sent
**Solution:** Check that `manager.isConnected()` returns true before sending, or just send anyway - they'll queue.

### Issue: Memory leaks
**Solution:** Always call the unsubscribe function returned by `onMessage()` and `onStatusChange()` in cleanup.

---

## Best Practices

1. **Always unsubscribe**: Capture the return value from `onMessage()` and call it in cleanup
2. **Don't reconnect manually**: The manager handles reconnection automatically
3. **Queue is safe**: Don't check `isConnected()` before sending - the manager queues
4. **One instance per app**: Don't create multiple managers - always use `getInstance()`
5. **Use TypeScript types**: Import `WsConnectionStatus` and `WsMessageCallback` for better IDE support

---

## Migration Rollout

1. ✅ **Phase 1**: Create `WebSocketConnectionManager` (DONE)
2. 🔄 **Phase 2**: Update all analysis tools (all-analysis, tick-analyser, smart-trader)
3. 🔄 **Phase 3**: Update all stores (makoti-magic-store, over-under-store)
4. 🔄 **Phase 4**: Update public scripts (signals.js, circles.js)
5. 🔄 **Phase 5**: Test all tools, tabs, and floating windows
6. ✅ **Phase 6**: Remove old WebSocket code, delete manual connections
