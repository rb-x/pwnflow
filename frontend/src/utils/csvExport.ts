import type { Node as NodeType, Context, Variable } from "@/types/api";
import { formatBackendTimestamp } from "./dateUtils";

interface Command {
  id: string;
  title: string;
  command: string;
  description?: string;
  nodeId: string;
  nodeTitle: string;
}

export function exportNodesToCSV(nodes: NodeType[], projectName: string) {
  const timestamp = new Date().toISOString().split("T")[0];
  const sanitizedProjectName = projectName.replace(/[^a-z0-9]/gi, "_");
  const nodesCSV = generateNodesCSV(nodes);
  downloadCSV(nodesCSV, `${sanitizedProjectName}_nodes_${timestamp}.csv`);
}

export function exportCommandsToCSV(commands: Command[], projectName: string) {
  const timestamp = new Date().toISOString().split("T")[0];
  const sanitizedProjectName = projectName.replace(/[^a-z0-9]/gi, "_");
  const commandsCSV = generateCommandsCSV(commands);
  downloadCSV(commandsCSV, `${sanitizedProjectName}_commands_${timestamp}.csv`);
}

export function exportVariablesToCSV(
  variables: Variable[],
  contexts: Context[],
  projectName: string
) {
  const timestamp = new Date().toISOString().split("T")[0];
  const sanitizedProjectName = projectName.replace(/[^a-z0-9]/gi, "_");
  const variablesCSV = generateVariablesCSV(variables, contexts);
  downloadCSV(variablesCSV, `${sanitizedProjectName}_variables_${timestamp}.csv`);
}

function generateNodesCSV(nodes: NodeType[]): string {
  const headers = [
    "ID",
    "Title",
    "Description",
    "Status",
    "Tags",
    "Commands Count",
    "Created At",
    "Updated At",
    "Findings",
  ];

  const rows = nodes.map((node) => [
    node.id,
    escapeCSV(node.title),
    escapeCSV(node.description || ""),
    node.status,
    node.tags?.join("; ") || "",
    node.commands?.length || 0,
    node.created_at || "",
    node.updated_at || "",
    escapeCSV(node.findings || ""),
  ]);

  return [headers, ...rows].map((row) => row.join(",")).join("\n");
}

function generateCommandsCSV(commands: Command[]): string {
  const headers = [
    "Command ID",
    "Command Title",
    "Command",
    "Description",
    "Node ID",
    "Node Title",
  ];

  const rows = commands.map((cmd) => [
    cmd.id,
    escapeCSV(cmd.title),
    escapeCSV(cmd.command),
    escapeCSV(cmd.description || ""),
    cmd.nodeId,
    escapeCSV(cmd.nodeTitle),
  ]);

  return [headers, ...rows].map((row) => row.join(",")).join("\n");
}

function generateVariablesCSV(
  variables: Variable[],
  contexts: Context[]
): string {
  const headers = [
    "Variable ID",
    "Name",
    "Value",
    "Sensitive",
    "Context ID",
    "Context Name",
    "Context Description",
  ];

  const rows = variables.map((variable) => {
    const context = contexts.find((ctx) => 
      ctx.variables?.some((v) => v.id === variable.id)
    );

    return [
      variable.id,
      escapeCSV(variable.name),
      escapeCSV(variable.value),
      variable.sensitive ? "Yes" : "No",
      context?.id || "",
      escapeCSV(context?.name || ""),
      escapeCSV(context?.description || ""),
    ];
  });

  return [headers, ...rows].map((row) => row.join(",")).join("\n");
}

function escapeCSV(str: string): string {
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}