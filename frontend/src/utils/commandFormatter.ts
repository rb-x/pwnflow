import type { Context } from '@/types/api';

interface FormattedCommand {
  formattedText: string;
  plainText: string;
  replacements: Array<{
    key: string;
    value: string;
    contextName: string;
  }>;
  missingVariables: string[];
  sensitiveVariables: string[];
}

export function formatCommand(
  command: string, 
  contexts: Context[] = []
): FormattedCommand {
  if (!command) {
    return {
      formattedText: '',
      plainText: '',
      replacements: [],
      missingVariables: [],
      sensitiveVariables: [],
    };
  }

  let formattedText = command;
  let plainText = command;
  const replacements: Array<{ key: string; value: string; contextName: string }> = [];
  const missingVariables: string[] = [];
  const sensitiveVariables: string[] = [];

  // Create a map of variables from all contexts
  const variableMap = new Map<string, { value: string; contextName: string; isSensitive: boolean }>();
  
  contexts.forEach((context) => {
    (context.variables || []).forEach((variable) => {
      // Store with the variable name as key
      variableMap.set(variable.name, {
        value: variable.value,
        contextName: context.name,
        isSensitive: variable.sensitive,
      });
    });
  });

  // Find all variables in the command (format: {{variable_name}})
  const variableMatches = command.match(/{{\s*([^}]+)\s*}}/g) || [];

  // Replace each variable
  variableMatches.forEach((varMatch) => {
    const key = varMatch.replace(/{{\s*|\s*}}/g, '').trim();
    const varInfo = variableMap.get(key);

    if (varInfo && !varInfo.isSensitive) {
      // Replace in plain text
      plainText = plainText.replace(varMatch, varInfo.value);

      // Replace in formatted text with HTML
      formattedText = formattedText.replace(
        varMatch,
        `<span class="text-blue-500 bg-blue-500/10 px-1 rounded" title="${varInfo.contextName}: ${key}">${varInfo.value}</span>`
      );

      replacements.push({
        key,
        value: varInfo.value,
        contextName: varInfo.contextName,
      });
    } else if (varInfo && varInfo.isSensitive) {
      // Handle sensitive variables separately - they're not missing, just masked for display
      sensitiveVariables.push(key);
      
      // Replace with REAL value in plain text (for copying)
      plainText = plainText.replace(varMatch, varInfo.value);
      
      // Show masked value in formatted text (for display)
      formattedText = formattedText.replace(
        varMatch,
        `<span class="text-orange-500 bg-orange-500/10 px-1 rounded" title="${varInfo.contextName}: ${key} (Sensitive)">••••••••</span>`
      );

      // Track the replacement for reference (even though it's sensitive)
      replacements.push({
        key,
        value: varInfo.value,
        contextName: varInfo.contextName,
      });
    } else {
      missingVariables.push(key);

      // Highlight missing variables in red
      formattedText = formattedText.replace(
        varMatch,
        `<span class="text-red-500 bg-red-500/10 px-1 rounded" title="Missing variable">${varMatch}</span>`
      );
    }
  });

  return {
    formattedText,
    plainText,
    replacements,
    missingVariables,
    sensitiveVariables,
  };
}

export function copyCommand(command: string, contexts: Context[] = []): void {
  if (!command) return;

  const formatted = formatCommand(command, contexts);
  navigator.clipboard.writeText(formatted.plainText).catch((err) => 
    console.error('Failed to copy command:', err)
  );
}

export function hasVariables(command: string): boolean {
  return /{{.*?}}/.test(command);
}

// Escape HTML for safe rendering
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}