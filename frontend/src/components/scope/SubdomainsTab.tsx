import { ScopeTable } from "./ScopeTable";

interface SubdomainsTabProps {
  projectId: string;
}

export function SubdomainsTab({ projectId }: SubdomainsTabProps) {
  return <ScopeTable projectId={projectId} />;
}