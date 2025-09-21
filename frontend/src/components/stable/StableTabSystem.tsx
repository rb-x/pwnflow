import React, { useRef, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface StableTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
}

interface StableTabSystemProps {
  tabs: StableTab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

// Ultra-stable tab system that NEVER remounts content
export function StableTabSystem({
  tabs,
  activeTabId,
  onTabChange,
  className
}: StableTabSystemProps) {
  const contentRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Memoize tab headers to prevent re-renders
  const tabHeaders = useMemo(() => (
    tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => onTabChange(tab.id)}
        className={cn(
          "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all",
          "border-b-2 border-transparent",
          "hover:text-foreground hover:border-border",
          activeTabId === tab.id
            ? "text-foreground border-primary bg-background"
            : "text-muted-foreground"
        )}
      >
        {tab.icon}
        {tab.label}
      </button>
    ))
  ), [tabs, activeTabId, onTabChange]);

  // Stable content renderer that doesn't remount
  const renderContent = useCallback(() => {
    return tabs.map((tab) => (
      <div
        key={tab.id}
        ref={(el) => {
          if (el) {
            contentRefs.current.set(tab.id, el);
          }
        }}
        className={cn(
          "h-full w-full",
          activeTabId === tab.id ? "block" : "hidden"
        )}
        style={{
          // Preserve component state even when hidden
          display: activeTabId === tab.id ? "block" : "none"
        }}
      >
        {tab.content}
      </div>
    ));
  }, [tabs, activeTabId]);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Tab Headers */}
      <div className="flex border-b border-border bg-muted/30">
        {tabHeaders}
      </div>

      {/* Tab Content - NEVER remounts */}
      <div className="flex-1 relative overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
}