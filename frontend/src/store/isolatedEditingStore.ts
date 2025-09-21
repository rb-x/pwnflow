import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// Ultra-isolated editing store that prevents ALL re-renders during editing
interface IsolatedEditingState {
  // Active editing sessions - completely isolated from React re-renders
  activeSessions: Map<string, {
    nodeId: string;
    field: string;
    value: string;
    originalValue: string;
    isActive: boolean;
    lastUpdate: number;
  }>;

  // Focus state - completely separate from component state
  focusState: {
    nodeId: string | null;
    field: string | null;
    tabId: string | null;
    timestamp: number;
  };

  // Prevents any state changes from triggering React re-renders
  lockReRenders: boolean;

  // Actions that DON'T trigger React updates
  _startSession: (nodeId: string, field: string, value: string) => void;
  _updateSession: (nodeId: string, field: string, value: string) => void;
  _endSession: (nodeId: string, field: string) => void;
  _setFocus: (nodeId: string, field: string, tabId?: string) => void;
  _clearFocus: () => void;

  // Safe getters that don't cause re-renders
  getValue: (nodeId: string, field: string) => string | null;
  isActive: (nodeId: string, field: string) => boolean;
  hasFocus: (nodeId: string, field: string) => boolean;

  // Lock mechanism to prevent React updates during critical operations
  lockRenders: () => void;
  unlockRenders: () => void;
}

// Create store with subscribeWithSelector for fine-grained control
export const useIsolatedEditingStore = create<IsolatedEditingState>()(
  subscribeWithSelector(
    (set, get) => ({
      activeSessions: new Map(),
      focusState: {
        nodeId: null,
        field: null,
        tabId: null,
        timestamp: 0,
      },
      lockReRenders: false,

      _startSession: (nodeId: string, field: string, value: string) => {
        const key = `${nodeId}:${field}`;
        const state = get();

        // Don't trigger React update if locked
        if (state.lockReRenders) {
          state.activeSessions.set(key, {
            nodeId,
            field,
            value,
            originalValue: value,
            isActive: true,
            lastUpdate: Date.now(),
          });
          return;
        }

        set((state) => {
          const newSessions = new Map(state.activeSessions);
          newSessions.set(key, {
            nodeId,
            field,
            value,
            originalValue: value,
            isActive: true,
            lastUpdate: Date.now(),
          });
          return { activeSessions: newSessions };
        });
      },

      _updateSession: (nodeId: string, field: string, value: string) => {
        const key = `${nodeId}:${field}`;
        const state = get();
        const session = state.activeSessions.get(key);

        if (!session) return;

        // NEVER trigger React update during typing
        session.value = value;
        session.lastUpdate = Date.now();
      },

      _endSession: (nodeId: string, field: string) => {
        const key = `${nodeId}:${field}`;
        set((state) => {
          const newSessions = new Map(state.activeSessions);
          newSessions.delete(key);
          return { activeSessions: newSessions };
        });
      },

      _setFocus: (nodeId: string, field: string, tabId?: string) => {
        const state = get();

        // Don't trigger React update if locked
        if (state.lockReRenders) {
          state.focusState.nodeId = nodeId;
          state.focusState.field = field;
          state.focusState.tabId = tabId || null;
          state.focusState.timestamp = Date.now();
          return;
        }

        set({
          focusState: {
            nodeId,
            field,
            tabId: tabId || null,
            timestamp: Date.now(),
          }
        });
      },

      _clearFocus: () => {
        set({
          focusState: {
            nodeId: null,
            field: null,
            tabId: null,
            timestamp: Date.now(),
          }
        });
      },

      getValue: (nodeId: string, field: string) => {
        const key = `${nodeId}:${field}`;
        const session = get().activeSessions.get(key);
        return session?.value || null;
      },

      isActive: (nodeId: string, field: string) => {
        const key = `${nodeId}:${field}`;
        const session = get().activeSessions.get(key);
        return session?.isActive || false;
      },

      hasFocus: (nodeId: string, field: string) => {
        const focus = get().focusState;
        return focus.nodeId === nodeId && focus.field === field;
      },

      lockRenders: () => {
        set({ lockReRenders: true });
      },

      unlockRenders: () => {
        set({ lockReRenders: false });
      },
    })
  )
);

// External API that prevents React re-renders
class EditingManager {
  private store = useIsolatedEditingStore;
  private mutations = new Map<string, Function>();

  startEditing(nodeId: string, field: string, initialValue: string) {
    const key = `${nodeId}:${field}`;
    const state = this.store.getState();

    // Create new session in the map
    const newSessions = new Map(state.activeSessions);
    newSessions.set(key, {
      nodeId,
      field,
      value: initialValue,
      originalValue: initialValue,
      isActive: true,
      lastUpdate: Date.now(),
    });

    // Update state to trigger React re-render
    this.store.setState({
      activeSessions: newSessions,
      focusState: {
        nodeId,
        field,
        tabId: null,
        timestamp: Date.now(),
      }
    });
  }

  updateValue(nodeId: string, field: string, value: string) {
    // Update the session and trigger React re-render for the input value
    const key = `${nodeId}:${field}`;
    const state = this.store.getState();
    const session = state.activeSessions.get(key);

    if (session) {
      // Create new map to trigger Zustand update
      const newSessions = new Map(state.activeSessions);
      newSessions.set(key, {
        ...session,
        value,
        lastUpdate: Date.now(),
      });

      // This will trigger React re-render for the specific hook
      this.store.setState({ activeSessions: newSessions });
    }
  }

  // Register mutation function for a specific project
  registerMutation(projectId: string, mutationFn: Function) {
    this.mutations.set(projectId, mutationFn);
  }

  async commitEditing(nodeId: string, field: string, projectId?: string): Promise<boolean> {
    const session = this.store.getState().activeSessions.get(`${nodeId}:${field}`);
    if (!session) {
      return false;
    }

    try {
      // Get the mutation function for this project
      const mutationFn = projectId ? this.mutations.get(projectId) : null;

      if (mutationFn && session.value !== session.originalValue) {
        // Prepare the update data
        const updateData: Record<string, any> = {};
        updateData[field] = session.value;

        // Make the API call
        await mutationFn({
          projectId,
          nodeId,
          data: updateData,
        });
      }

      // End the session after successful API call
      const key = `${nodeId}:${field}`;
      const state = this.store.getState();
      const newSessions = new Map(state.activeSessions);
      newSessions.delete(key);
      this.store.setState({ activeSessions: newSessions });
      return true;
    } catch (error) {
      console.error('Failed to commit editing:', error);
      // Don't end the session on error, keep editing state
      return false;
    }
  }

  cancelEditing(nodeId: string, field: string) {
    const key = `${nodeId}:${field}`;
    const state = this.store.getState();
    const newSessions = new Map(state.activeSessions);
    newSessions.delete(key);
    this.store.setState({ activeSessions: newSessions });
  }

  setFocus(nodeId: string, field: string, tabId?: string) {
    this.store.getState()._setFocus(nodeId, field, tabId);
  }

  getValue(nodeId: string, field: string, fallback?: string): string {
    return this.store.getState().getValue(nodeId, field) || fallback || '';
  }

  isActive(nodeId: string, field: string): boolean {
    return this.store.getState().isActive(nodeId, field);
  }

  hasFocus(nodeId: string, field: string): boolean {
    return this.store.getState().hasFocus(nodeId, field);
  }
}

// Singleton instance
export const editingManager = new EditingManager();

// React hooks that are safe to use
export const useEditingValue = (nodeId: string, field: string, serverValue: string = '') => {
  const getValue = useIsolatedEditingStore((state) => state.getValue);
  const isActive = useIsolatedEditingStore((state) => state.isActive);

  return {
    value: getValue(nodeId, field) || serverValue,
    isEditing: isActive(nodeId, field),
  };
};

export const useEditingFocus = (nodeId: string, field: string) => {
  const hasFocus = useIsolatedEditingStore((state) => state.hasFocus);
  return hasFocus(nodeId, field);
};

// Reactive hook that triggers re-renders when editing state changes
export const useEditingState = (nodeId: string, field: string) => {
  const key = `${nodeId}:${field}`;
  const session = useIsolatedEditingStore((state) => state.activeSessions.get(key));

  return {
    isEditing: session?.isActive || false,
    value: session?.value || '',
    hasChanges: session ? session.value !== session.originalValue : false,
  };
};