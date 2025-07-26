import { useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface VariablePart {
  text: string;
  isVariable?: boolean;
  variable?: any;
  found?: boolean;
}

interface CommandDisplayProps {
  commandParts: VariablePart[];
  showSensitiveVariables: Record<string, boolean>;
  onToggleSensitive: (variableName: string) => void;
  className?: string;
  isReadOnly?: boolean;
}

export function CommandDisplay({ 
  commandParts, 
  showSensitiveVariables, 
  onToggleSensitive,
  className,
  isReadOnly = false 
}: CommandDisplayProps) {
  if (!commandParts || commandParts.length === 0) {
    return <div className={cn("font-mono text-xs", className)}>No command text</div>;
  }

  return (
    <div className={cn("font-mono text-xs break-all", className)}>
      {commandParts.map((part, index) => {
        if (!part.isVariable) {
          return <span key={index}>{part.text}</span>;
        }

        const variable = part.variable;
        const variableName = part.text.slice(2, -2).trim(); // Remove {{ }}
        
        if (!part.found) {
          // Variable not found in active contexts
          return (
            <span key={index} className="relative inline-flex items-center">
              <span className="text-red-500 underline decoration-wavy underline-offset-2">
                {part.text}
              </span>
              <AlertCircle className="h-3 w-3 text-red-500 ml-0.5" />
            </span>
          );
        }

        // Variable found
        const isSensitive = variable?.sensitive;
        const showValue = !isSensitive || showSensitiveVariables[variableName];
        
        return (
          <span key={index} className="relative inline-flex items-center group">
            <span 
              className={cn(
                "px-1 py-0.5 rounded transition-all",
                "bg-chart-1/10 text-chart-1",
                                  "hover:bg-chart-1/20"
              )}
              title={`${variableName}${variable.description ? `: ${variable.description}` : ''}`}
            >
              {showValue ? variable.value : '••••••••'}
            </span>
            {isSensitive && !isReadOnly && (
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onToggleSensitive(variableName)}
              >
                {showValue ? (
                  <EyeOff className="h-3 w-3" />
                ) : (
                  <Eye className="h-3 w-3" />
                )}
              </Button>
            )}
          </span>
        );
      })}
    </div>
  );
}