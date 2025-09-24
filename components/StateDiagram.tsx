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

  // Check if all Client Engagement steps are complete
  const clientEngagementComplete = engagementLetterSigned && questionnaireFilled && documentUploaded && proforma && readyToAssign;

  // Check if Tax Preparer phase is complete (questions resolved)
  const taxPreparerComplete = assignedToTaxPreparer && questions && !missingDocuments;

  // Dynamic state diagram definition based on checkbox states
  const def = useMemo(() => {
    let diagram = `stateDiagram
  direction TB
  classDef Sky stroke-width:1px,stroke-dasharray:none,stroke:#374D7C,fill:#E2EBFF,color:#374D7C;
  classDef Active stroke-width:2px,stroke:#22c55e,fill:#dcfce7,color:#166534;
  classDef Pending stroke-width:1px,stroke:#94a3b8,fill:#f1f5f9,color:#64748b;

  state ClientEngagement {
    direction LR
    [*] --> ClientEngagementLetterSigned
    ClientEngagementLetterSigned --> QuestionnaireFilled
    QuestionnaireFilled --> DocumentUploaded
    DocumentUploaded --> Proforma
    Proforma --> ReadyToAssign
  }`;

    // Only show Tax Preparer phase if Client Engagement is complete
    if (clientEngagementComplete) {
      diagram += `
  state AssignedToTaxPreparer {
    direction TB
    Questions --> MissingDocuments
    MissingDocuments --> Questions
    Escalate
  }`;
    }

    // Only show Client Review phase if Tax Preparer phase is complete
    if (clientEngagementComplete && taxPreparerComplete) {
      diagram += `
  state ClientReview {
    direction TB
    [*] --> ScheduleMeet
    ScheduleMeet --> Sign
    Sign --> Invoice
  }`;
    }

    // Main flow connections
    diagram += `
  [*] --> ClientEngagement`;

    if (clientEngagementComplete) {
      diagram += `
  ClientEngagement --> AssignedToTaxPreparer`;
    }

    if (clientEngagementComplete && taxPreparerComplete) {
      diagram += `
  AssignedToTaxPreparer --> ClientReview`;
    }

    // State labels
    diagram += `
  ClientEngagement:Client Engagement
  ClientEngagementLetterSigned:Client engagement letter signed
  QuestionnaireFilled:Questionnaire filled
  DocumentUploaded:Document uploaded to document management system
  Proforma:MyTaxPrep either previous year or new basic info
  ReadyToAssign:Ready to be assigned to tax preparer`;

    if (clientEngagementComplete) {
      diagram += `
  AssignedToTaxPreparer:Assigned to Tax Preparer
  MissingDocuments:Missing Documents
  Escalate:If you need a consultation escalate to manager`;
    }

    if (clientEngagementComplete && taxPreparerComplete) {
      diagram += `
  ClientReview:Client Review
  ScheduleMeet:Schedule Meet`;
    }

    diagram += `
  EFiled:E-Filed
  InProcess:In Process
  Escalated
  Complete
  SentAsPaperReturn:Sent As Paper Return
  class Escalated Sky`;

    // Apply styling based on completion status
    if (clientEngagementComplete) {
      diagram += `
  class ClientEngagement Active`;
    }

    if (clientEngagementComplete && assignedToTaxPreparer) {
      diagram += `
  class AssignedToTaxPreparer Active`;
    }

    if (clientEngagementComplete && taxPreparerComplete) {
      diagram += `
  class ClientReview Active`;
    }

    return diagram;
  }, [clientEngagementComplete, taxPreparerComplete, engagementLetterSigned, questionnaireFilled, documentUploaded, proforma, readyToAssign, assignedToTaxPreparer, questions, missingDocuments]);

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

          {/* Tax Preparer Phase - Only show when Client Engagement is complete */}
          {clientEngagementComplete && (
            <div>
              <h4 className="font-medium text-secondary mb-2">
                Tax Preparer Phase
                {clientEngagementComplete && <span className="text-green-600 ml-2">✓ Unlocked</span>}
              </h4>
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

                {assignedToTaxPreparer && (
                  <>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-warning"
                        checked={questions}
                        onChange={(e) => setQuestions(e.target.checked)}
                      />
                      <span className="text-sm">Questions Resolved</span>
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
                  </>
                )}
              </div>
            </div>
          )}

          {/* Client Review Phase - Only show when Tax Preparer phase is complete */}
          {clientEngagementComplete && taxPreparerComplete && (
            <div>
              <h4 className="font-medium text-accent mb-2">
                Client Review Phase
                <span className="text-green-600 ml-2">✓ Unlocked</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-accent"
                    checked={false}
                    onChange={() => {}}
                  />
                  <span className="text-sm">Schedule Meeting</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-accent"
                    checked={false}
                    onChange={() => {}}
                  />
                  <span className="text-sm">Client Signed</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-success"
                    checked={false}
                    onChange={() => {}}
                  />
                  <span className="text-sm">Invoice Sent</span>
                </label>
              </div>
            </div>
          )}

          {/* Progress Indicator */}
          <div className="mt-4 p-3 bg-base-100 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Workflow Progress</span>
              <span className="text-sm text-base-content/70">
                {clientEngagementComplete ? (taxPreparerComplete ? "3/3" : "2/3") : "1/3"} Phases
              </span>
            </div>
            <div className="flex space-x-2">
              <div className={`flex-1 h-2 rounded ${clientEngagementComplete ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              <div className={`flex-1 h-2 rounded ${clientEngagementComplete && assignedToTaxPreparer ? 'bg-yellow-500' : 'bg-gray-300'}`}></div>
              <div className={`flex-1 h-2 rounded ${taxPreparerComplete ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
            </div>
            <div className="flex justify-between text-xs text-base-content/60 mt-1">
              <span>Client Engagement</span>
              <span>Tax Preparer</span>
              <span>Client Review</span>
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