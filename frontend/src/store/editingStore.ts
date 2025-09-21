import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Types for editing sessions
export interface EditingSession {
  nodeId: string;
  field: string;
  originalValue: string;
  currentValue: string;
  isDirty: boolean;
  lastModified: Date;
  autoSaveTimeoutId?: NodeJS.Timeout;
}

export interface OptimisticUpdate {
  nodeId: string;
  field: string;
  value: string;
  timestamp: Date;
  isCommitting: boolean;
}

export interface FocusState {
  nodeId: string;
  field: string;
  timestamp: Date;
}

export interface EditingStoreState {
  // Active editing sessions keyed by `${nodeId}:${field}`
  activeEdits: Map<string, EditingSession>;

  // Optimistic updates before server confirmation
  optimisticUpdates: Map<string, OptimisticUpdate>;

  // Current focus state
  focusedField: FocusState | null;

  // Conflict detection
  conflictResolution: 'local' | 'server' | 'prompt';

  // Actions
  startEditing: (nodeId: string, field: string, initialValue: string) => void;
  updateField: (nodeId: string, field: string, value: string, autoSave?: boolean) => void;
  commitEdit: (nodeId: string, field: string) => Promise<boolean>;
  cancelEdit: (nodeId: string, field: string) => void;
  setFocus: (nodeId: string, field: string) => void;
  clearFocus: () => void;

  // Query helpers
  isEditing: (nodeId: string, field?: string) => boolean;
  getEditingValue: (nodeId: string, field: string) => string | undefined;
  getDisplayValue: (nodeId: string, field: string, serverValue?: string) => string;
  isDirty: (nodeId: string, field: string) => boolean;
  hasConflict: (nodeId: string, field: string) => boolean;

  // Batch operations
  commitAllEdits: (nodeId: string) => Promise<boolean>;
  cancelAllEdits: (nodeId: string) => void;

  // Internal helpers
  _createEditKey: (nodeId: string, field: string) => string;
  _scheduleAutoSave: (nodeId: string, field: string, delay?: number) => void;
  _clearAutoSave: (nodeId: string, field: string) => void;
  _addOptimisticUpdate: (nodeId: string, field: string, value: string) => void;
  _removeOptimisticUpdate: (nodeId: string, field: string) => void;
}

// Auto-save configuration
const AUTO_SAVE_DELAY = 2000; // 2 seconds
const CONFLICT_CHECK_INTERVAL = 5000; // 5 seconds

export const useEditingStore = create<EditingStoreState>()(
  devtools(
    (set, get) => ({
      activeEdits: new Map(),
      optimisticUpdates: new Map(),
      focusedField: null,
      conflictResolution: 'local',

      _createEditKey: (nodeId: string, field: string) => `${nodeId}:${field}`,

      startEditing: (nodeId: string, field: string, initialValue: string) => {
        const key = get()._createEditKey(nodeId, field);
        const now = new Date();

        set((state) => {
          const newActiveEdits = new Map(state.activeEdits);

          // If already editing, don't restart
          if (newActiveEdits.has(key)) {
            return state;
          }

          newActiveEdits.set(key, {
            nodeId,
            field,
            originalValue: initialValue,
            currentValue: initialValue,
            isDirty: false,
            lastModified: now,
          });

          return {
            ...state,
            activeEdits: newActiveEdits,
            focusedField: { nodeId, field, timestamp: now },
          };
        });
      },

      updateField: (nodeId: string, field: string, value: string, autoSave = true) => {
        const key = get()._createEditKey(nodeId, field);
        const now = new Date();

        set((state) => {
          const newActiveEdits = new Map(state.activeEdits);
          const existingEdit = newActiveEdits.get(key);

          if (!existingEdit) {
            // Start editing if not already started
            get().startEditing(nodeId, field, value);
            return state;
          }

          // Clear existing auto-save timeout
          if (existingEdit.autoSaveTimeoutId) {
            clearTimeout(existingEdit.autoSaveTimeoutId);
          }

          const updatedEdit: EditingSession = {
            ...existingEdit,
            currentValue: value,
            isDirty: value !== existingEdit.originalValue,
            lastModified: now,
          };

          newActiveEdits.set(key, updatedEdit);

          return {
            ...state,
            activeEdits: newActiveEdits,
          };
        });

        // Schedule auto-save if enabled
        if (autoSave) {
          get()._scheduleAutoSave(nodeId, field);
        }
      },

      _scheduleAutoSave: (nodeId: string, field: string, delay = AUTO_SAVE_DELAY) => {
        const key = get()._createEditKey(nodeId, field);

        set((state) => {
          const newActiveEdits = new Map(state.activeEdits);
          const edit = newActiveEdits.get(key);

          if (!edit || !edit.isDirty) return state;

          // Clear existing timeout
          if (edit.autoSaveTimeoutId) {
            clearTimeout(edit.autoSaveTimeoutId);
          }

          // Set new timeout
          const timeoutId = setTimeout(() => {
            get().commitEdit(nodeId, field);
          }, delay);

          newActiveEdits.set(key, {
            ...edit,
            autoSaveTimeoutId: timeoutId,
          });

          return {
            ...state,
            activeEdits: newActiveEdits,
          };
        });
      },

      _clearAutoSave: (nodeId: string, field: string) => {
        const key = get()._createEditKey(nodeId, field);

        set((state) => {
          const newActiveEdits = new Map(state.activeEdits);
          const edit = newActiveEdits.get(key);

          if (!edit) return state;

          if (edit.autoSaveTimeoutId) {
            clearTimeout(edit.autoSaveTimeoutId);
          }

          newActiveEdits.set(key, {
            ...edit,
            autoSaveTimeoutId: undefined,
          });

          return {
            ...state,
            activeEdits: newActiveEdits,
          };
        });
      },

      commitEdit: async (nodeId: string, field: string): Promise<boolean> => {
        const key = get()._createEditKey(nodeId, field);
        const edit = get().activeEdits.get(key);

        if (!edit || !edit.isDirty) {
          return true;
        }

        try {
          // Add optimistic update
          get()._addOptimisticUpdate(nodeId, field, edit.currentValue);

          // Clear auto-save timeout
          get()._clearAutoSave(nodeId, field);

          // Here we'll integrate with the API hooks in the next phase
          // For now, simulate success
          await new Promise(resolve => setTimeout(resolve, 100));

          // Remove the editing session after successful commit
          set((state) => {
            const newActiveEdits = new Map(state.activeEdits);
            newActiveEdits.delete(key);

            return {
              ...state,
              activeEdits: newActiveEdits,
            };
          });

          // Remove optimistic update after commit
          get()._removeOptimisticUpdate(nodeId, field);

          return true;
        } catch (error) {
          console.error('Failed to commit edit:', error);

          // Remove optimistic update on error
          get()._removeOptimisticUpdate(nodeId, field);

          return false;
        }
      },

      cancelEdit: (nodeId: string, field: string) => {
        const key = get()._createEditKey(nodeId, field);

        set((state) => {
          const newActiveEdits = new Map(state.activeEdits);
          const edit = newActiveEdits.get(key);

          if (edit) {
            // Clear auto-save timeout
            if (edit.autoSaveTimeoutId) {
              clearTimeout(edit.autoSaveTimeoutId);
            }

            newActiveEdits.delete(key);
          }

          return {
            ...state,
            activeEdits: newActiveEdits,
            focusedField: state.focusedField?.nodeId === nodeId && state.focusedField?.field === field
              ? null
              : state.focusedField,
          };
        });

        // Remove any optimistic updates
        get()._removeOptimisticUpdate(nodeId, field);
      },

      setFocus: (nodeId: string, field: string) => {
        set((state) => ({
          ...state,
          focusedField: { nodeId, field, timestamp: new Date() },
        }));
      },

      clearFocus: () => {
        set((state) => ({
          ...state,
          focusedField: null,
        }));
      },

      isEditing: (nodeId: string, field?: string) => {
        const state = get();

        if (field) {
          const key = state._createEditKey(nodeId, field);
          return state.activeEdits.has(key);
        }

        // Check if any field is being edited for this node
        for (const [key] of state.activeEdits) {
          if (key.startsWith(`${nodeId}:`)) {
            return true;
          }
        }

        return false;
      },

      getEditingValue: (nodeId: string, field: string) => {
        const key = get()._createEditKey(nodeId, field);
        const edit = get().activeEdits.get(key);
        return edit?.currentValue;
      },

      getDisplayValue: (nodeId: string, field: string, serverValue = '') => {
        const editingValue = get().getEditingValue(nodeId, field);
        const optimisticValue = get().optimisticUpdates.get(get()._createEditKey(nodeId, field))?.value;

        // Priority: editing value > optimistic value > server value
        return editingValue ?? optimisticValue ?? serverValue;
      },

      isDirty: (nodeId: string, field: string) => {
        const key = get()._createEditKey(nodeId, field);
        const edit = get().activeEdits.get(key);
        return edit?.isDirty ?? false;
      },

      hasConflict: (nodeId: string, field: string) => {
        // This will be implemented when we integrate with React Query
        // to detect server-side changes during editing
        return false;
      },

      commitAllEdits: async (nodeId: string): Promise<boolean> => {
        const state = get();
        const editsToCommit: Array<{ field: string; edit: EditingSession }> = [];

        // Find all dirty edits for this node
        for (const [key, edit] of state.activeEdits) {
          if (edit.nodeId === nodeId && edit.isDirty) {
            editsToCommit.push({ field: edit.field, edit });
          }
        }

        if (editsToCommit.length === 0) {
          return true;
        }

        // Commit all edits
        const results = await Promise.allSettled(
          editsToCommit.map(({ field }) => get().commitEdit(nodeId, field))
        );

        // Return true if all commits succeeded
        return results.every(result => result.status === 'fulfilled' && result.value === true);
      },

      cancelAllEdits: (nodeId: string) => {
        const state = get();
        const editsToCancel: string[] = [];

        // Find all edits for this node
        for (const [key, edit] of state.activeEdits) {
          if (edit.nodeId === nodeId) {
            editsToCancel.push(edit.field);
          }
        }

        // Cancel all edits
        editsToCancel.forEach(field => get().cancelEdit(nodeId, field));
      },

      _addOptimisticUpdate: (nodeId: string, field: string, value: string) => {
        const key = get()._createEditKey(nodeId, field);

        set((state) => {
          const newOptimisticUpdates = new Map(state.optimisticUpdates);
          newOptimisticUpdates.set(key, {
            nodeId,
            field,
            value,
            timestamp: new Date(),
            isCommitting: true,
          });

          return {
            ...state,
            optimisticUpdates: newOptimisticUpdates,
          };
        });
      },

      _removeOptimisticUpdate: (nodeId: string, field: string) => {
        const key = get()._createEditKey(nodeId, field);

        set((state) => {
          const newOptimisticUpdates = new Map(state.optimisticUpdates);
          newOptimisticUpdates.delete(key);

          return {
            ...state,
            optimisticUpdates: newOptimisticUpdates,
          };
        });
      },
    }),
    {
      name: 'editing-store',
      // Only persist focus state and conflict resolution preference
      partialize: (state) => ({
        conflictResolution: state.conflictResolution,
      }),
    }
  )
);

// Utility hooks for common patterns
export const useFieldEditing = (nodeId: string, field: string) => {
  const {
    isEditing,
    getDisplayValue,
    isDirty,
    startEditing,
    updateField,
    commitEdit,
    cancelEdit,
    setFocus,
    clearFocus,
  } = useEditingStore();

  return {
    isEditing: isEditing(nodeId, field),
    isDirty: isDirty(nodeId, field),
    getDisplayValue: (serverValue?: string) => getDisplayValue(nodeId, field, serverValue),
    startEditing: (initialValue: string) => startEditing(nodeId, field, initialValue),
    updateField: (value: string, autoSave?: boolean) => updateField(nodeId, field, value, autoSave),
    commitEdit: () => commitEdit(nodeId, field),
    cancelEdit: () => cancelEdit(nodeId, field),
    setFocus: () => setFocus(nodeId, field),
    clearFocus,
  };
};

// Focus management hook
export const useFocusManagement = () => {
  const { focusedField, setFocus, clearFocus } = useEditingStore();

  return {
    focusedField,
    isFocused: (nodeId: string, field: string) =>
      focusedField?.nodeId === nodeId && focusedField?.field === field,
    setFocus,
    clearFocus,
  };
};