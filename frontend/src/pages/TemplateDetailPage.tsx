import { useParams } from "react-router-dom";
import { ProjectDetailPage } from "./ProjectDetailPage";

export function TemplateDetailPage() {
  const { templateId } = useParams<{ templateId: string }>();

  // Simply reuse ProjectDetailPage with isTemplate flag
  // Templates and projects are the same, just templates are reusable
  return <ProjectDetailPage isTemplate={true} templateId={templateId} />;
}
