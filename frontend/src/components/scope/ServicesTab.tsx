import { ScopeTable } from "./ScopeTable";

interface ServicesTabProps {
  projectId: string;
}

export function ServicesTab({ projectId }: ServicesTabProps) {
  return <ScopeTable projectId={projectId} />;
}