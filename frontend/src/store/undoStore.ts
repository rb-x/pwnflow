import { create } from "zustand";
import type { Edge, Node } from "@xyflow/react";
import type { NodeData } from "@/types";

export type NodeCreateUndoAction = {
  type: "node-create";
  projectId: string;
  nodeId: string;
};

export type NodeDeleteUndoAction = {
  type: "node-delete";
  projectId: string;
  nodeSnapshot: Node<NodeData>;
  connectedEdges: Edge[];
};

export type EdgeLinkUndoAction = {
  type: "edge-link";
  projectId: string;
  edgeSnapshot: Edge;
};

export type EdgeUnlinkUndoAction = {
  type: "edge-unlink";
  projectId: string;
  edgeSnapshot: Edge;
};

export type UndoAction = NodeCreateUndoAction | NodeDeleteUndoAction | EdgeLinkUndoAction | EdgeUnlinkUndoAction;

interface UndoStoreState {
  stack: UndoAction[];
  maxDepth: number;
  pushAction: (action: UndoAction) => void;
  popAction: () => UndoAction | undefined;
  clear: () => void;
}

export const useUndoStore = create<UndoStoreState>()((set, get) => ({
  stack: [],
  maxDepth: 30,
  pushAction: (action) =>
    set((state) => {
      const nextStack = [...state.stack, action];
      if (nextStack.length > state.maxDepth) {
        nextStack.shift();
      }
      return { stack: nextStack };
    }),
  popAction: () => {
    const { stack } = get();
    if (!stack.length) return undefined;
    const nextStack = [...stack];
    const action = nextStack.pop();
    set({ stack: nextStack });
    return action;
  },
  clear: () => set({ stack: [] }),
}));
