import { useEffect, useId, useMemo, useState } from "react";
import mermaid from "mermaid";

interface StateDiagramProps {
  theme?: string;
}

export default function StateDiagram({ theme = "default" }: StateDiagramProps) {
  const id = useId().replace(/:/g, "_");
  const [svg, setSvg] = useState("");

  // State checkboxes for the new workflow
  const [clientEngagement, setClientEngagement] = useState(false);
  const [engagementLetterSigned, setEngagementLetterSigned] = useState(false);
  const [questionnaireFilled, setQuestionnaireFilled] = useState(false);
  const [documentUploaded, setDocumentUploaded] = useState(false);
  const [proforma, setProforma] = useState(false);
  const [readyToAssign, setReadyToAssign] = useState(false);
  const [assignedToTaxPreparer, setAssignedToTaxPreparer] = useState(false);
  const [questions, setQuestions] = useState(false);
  const [missingDocuments, setMissingDocuments] = useState(false);

  // Dynamic state diagram definition based on checkbox states
  const def = useMemo(() => {
    return `---
config:
  layout: elk
---
stateDiagram
  direction TB
  classDef Sky stroke-width:1px,stroke-dasharray:none,stroke:#374D7C,fill:#E2EBFF,color:#374D7C;
  state ClientEngagement {
    direction LR
    [*] --> ClientEngagementLetterSigned
    ClientEngagementLetterSigned --> QuestionnaireFilled
    QuestionnaireFilled --> DocumentUploaded
    DocumentUploaded --> Proforma
    Proforma --> ReadyToAssign
    [*] --> ClientEngagementLetterSigned
    QuestionnaireFilled
    DocumentUploaded
    Proforma
    ReadyToAssign
  }
  state AssignedToTaxPreparer {
    direction TB
    Questions --> MissingDocuments
    MissingDocuments --> Questions
    Escalate
    MissingDocuments
  }
  state ClientReview {
    direction TB
    [*] --> ScheduleMeet
    ScheduleMeet --> Sign
    Sign --> Invoice
    [*] --> ScheduleMeet
    Sign
    Invoice
  }
  [*] --> ClientEngagement
  ClientEngagement --> AssignedToTaxPreparer
  AssignedToTaxPreparer --> ClientReview
  AssignedToTaxPreparer --> MissingDocuments
  EFiled --> InProcess
  ClientEngagement:Client Engagement
  ClientEngagementLetterSigned:Client engagement letter signed
  QuestionnaireFilled:Questionnaire filled
  DocumentUploaded:Document uploaded to document management system
  Proforma:MyTaxPrep either previous year or new basic info
  ReadyToAssign:Ready to be assigned to tax preparer
  AssignedToTaxPreparer:Assigned to Tax Preparer
  MissingDocuments:Missing Documents
  ClientReview:Client Review
  ScheduleMeet:Schedule Meet
  Escalate:If you need a consultaion escalate to manager
  Escalated
  EFiled:E-Filed
  InProcess:In Process
  s1
  Complete
  SentAsPaperReturn:Sent As Paper Return
  class Escalated Sky`;
  }, []);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: theme as any
    });
    (async () => {
      const { svg } = await mermaid.render(id, def);
      setSvg(svg);
    })();
  }, [def, id, theme]);

  return (
    <div className="w-full">
      {/* State Control Checkboxes */}
      <div className="mb-6 p-4 bg-base-200 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Tax Preparation Workflow States</h3>

        <div className="space-y-4">
          {/* Client Engagement States */}
          <div>
            <h4 className="font-medium text-primary mb-2">Client Engagement Phase</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ml-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={engagementLetterSigned}
                  onChange={(e) => setEngagementLetterSigned(e.target.checked)}
                />
                <span className="text-sm">Engagement Letter Signed</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={questionnaireFilled}
                  onChange={(e) => setQuestionnaireFilled(e.target.checked)}
                />
                <span className="text-sm">Questionnaire Filled</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={documentUploaded}
                  onChange={(e) => setDocumentUploaded(e.target.checked)}
                />
                <span className="text-sm">Document Uploaded</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={proforma}
                  onChange={(e) => setProforma(e.target.checked)}
                />
                <span className="text-sm">Proforma (MyTaxPrep)</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={readyToAssign}
                  onChange={(e) => setReadyToAssign(e.target.checked)}
                />
                <span className="text-sm">Ready to Assign</span>
              </label>
            </div>
          </div>

          {/* Tax Preparer Phase */}
          <div>
            <h4 className="font-medium text-secondary mb-2">Tax Preparer Phase</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox checkbox-secondary"
                  checked={assignedToTaxPreparer}
                  onChange={(e) => setAssignedToTaxPreparer(e.target.checked)}
                />
                <span className="text-sm">Assigned to Tax Preparer</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox checkbox-warning"
                  checked={questions}
                  onChange={(e) => setQuestions(e.target.checked)}
                />
                <span className="text-sm">Questions</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox checkbox-error"
                  checked={missingDocuments}
                  onChange={(e) => setMissingDocuments(e.target.checked)}
                />
                <span className="text-sm">Missing Documents</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Mermaid Diagram */}
      <div
        className="mermaid-diagram"
        dangerouslySetInnerHTML={{ __html: svg }}
        role="img"
        aria-label="Tax return state diagram"
        style={{ maxWidth: "100%" }}
      />
    </div>
  );
}