"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  tabs: Tab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, tabs, activeTab, onTabChange, ...props }, ref) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [hoverStyle, setHoverStyle] = useState({});
    const [activeStyle, setActiveStyle] = useState({
      left: "0px",
      width: "0px",
    });
    const tabRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Find the active index based on activeTab prop or default to 0
    const activeIndex = React.useMemo(() => {
      if (activeTab) {
        const index = tabs.findIndex((tab) => tab.id === activeTab);
        return index >= 0 ? index : 0;
      }
      return 0;
    }, [activeTab, tabs]);

    useEffect(() => {
      if (hoveredIndex !== null) {
        const hoveredElement = tabRefs.current[hoveredIndex];
        if (hoveredElement) {
          const { offsetLeft, offsetWidth } = hoveredElement;
          setHoverStyle({
            left: `${offsetLeft}px`,
            width: `${offsetWidth}px`,
          });
        }
      }
    }, [hoveredIndex]);

    useEffect(() => {
      const activeElement = tabRefs.current[activeIndex];
      if (activeElement) {
        const { offsetLeft, offsetWidth } = activeElement;
        setActiveStyle({
          left: `${offsetLeft}px`,
          width: `${offsetWidth}px`,
        });
      }
    }, [activeIndex]);

    useEffect(() => {
      requestAnimationFrame(() => {
        const activeElement = tabRefs.current[activeIndex];
        if (activeElement) {
          const { offsetLeft, offsetWidth } = activeElement;
          setActiveStyle({
            left: `${offsetLeft}px`,
            width: `${offsetWidth}px`,
          });
        }
      });
    }, [activeIndex]);

    return (
      <div ref={ref} className={cn("relative", className)} {...props}>
        <div className="relative">
          {/* Hover Highlight */}
          <div
            className="absolute h-[30px] transition-all duration-300 ease-out bg-foreground/10 rounded-[6px] flex items-center"
            style={{
              ...hoverStyle,
              opacity: hoveredIndex !== null ? 1 : 0,
            }}
          />

          {/* Active Indicator */}
          <div
            className="absolute bottom-[-6px] h-[2px] bg-primary transition-all duration-300 ease-out"
            style={activeStyle}
          />

          {/* Tabs */}
          <div className="relative flex space-x-[6px] items-center">
            {tabs.map((tab, index) => (
              <div
                key={tab.id}
                ref={(el) => (tabRefs.current[index] = el)}
                className={cn(
                  "px-3 py-2 cursor-pointer transition-all duration-300 h-[30px] rounded-[4px]",
                  "hover:text-foreground",
                  index === activeIndex
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground/80"
                )}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => {
                  onTabChange?.(tab.id);
                }}
              >
                <div className="text-sm font-medium leading-5 whitespace-nowrap flex items-center justify-center gap-1.5 h-full">
                  {tab.icon && (
                    <span className="flex-shrink-0">{tab.icon}</span>
                  )}
                  <span>{tab.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
);
Tabs.displayName = "Tabs";

export { Tabs };
