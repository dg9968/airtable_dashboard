'use client';

import { useState } from 'react';
import MultiClientSearch, { CorporateClient } from './MultiClientSearch';
import TemplateSelector, { MessageTemplate } from './TemplateSelector';
import VariableInputManager, { VariableValues } from './VariableInputManager';
import BatchPreviewModal, { PersonalizedMessage } from './BatchPreviewModal';

export default function BatchCommunicationsForm() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [selectedClients, setSelectedClients] = useState<CorporateClient[]>([]);
  const [variableValues, setVariableValues] = useState<VariableValues>({
    mode: 'bulk',
    bulkValues: {},
    perClientValues: {},
  });
  const [personalizedMessages, setPersonalizedMessages] = useState<PersonalizedMessage[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const getCustomVariables = () => {
    if (!selectedTemplate) return [];
    return selectedTemplate.variableDefinitions.variables.filter(v => v.type === 'custom');
  };

  const canProceedToStep2 = selectedTemplate !== null;
  const canProceedToStep3 = selectedClients.length > 0;
  const canProceedToStep4 = () => {
    const customVars = getCustomVariables();
    if (customVars.length === 0) return true;

    // Check if all required custom variables are filled
    if (variableValues.mode === 'bulk') {
      return customVars
        .filter(v => v.required)
        .every(v => variableValues.bulkValues[v.name]?.toString().trim());
    } else {
      return selectedClients.every(client =>
        customVars
          .filter(v => v.required)
          .every(v => variableValues.perClientValues[client.id]?.[v.name]?.toString().trim())
      );
    }
  };

  const handleNextStep = () => {
    if (step === 1 && canProceedToStep2) {
      setStep(2);
    } else if (step === 2 && canProceedToStep3) {
      const customVars = getCustomVariables();
      if (customVars.length > 0) {
        setStep(3);
      } else {
        // Skip step 3 if no custom variables
        generatePreviews();
      }
    } else if (step === 3 && canProceedToStep4()) {
      generatePreviews();
    }
  };

  const generatePreviews = async () => {
    if (!selectedTemplate) return;

    setError(null);

    try {
      const previews: PersonalizedMessage[] = [];

      for (const client of selectedClients) {
        // Get variable values for this client
        const clientVariableValues =
          variableValues.mode === 'bulk'
            ? variableValues.bulkValues
            : variableValues.perClientValues[client.id] || {};

        // Render the message
        const response = await fetch(`${apiUrl}/api/communications/render-template`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectTemplate: selectedTemplate.subjectTemplate,
            contentTemplate: selectedTemplate.contentTemplate,
            variableValues: clientVariableValues,
            clientData: client,
            variableDefinitions: selectedTemplate.variableDefinitions.variables,
          }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to render template');
        }

        const warnings: string[] = [];

        // Check for missing email
        if (!client.email) {
          warnings.push('Missing email address');
        }

        // Check for unreplaced variables
        if (data.data.missingVariables.length > 0) {
          warnings.push(`Missing variables: ${data.data.missingVariables.join(', ')}`);
        }

        previews.push({
          client,
          subject: data.data.renderedSubject,
          content: data.data.renderedContent,
          missingVariables: data.data.missingVariables,
          hasWarnings: warnings.length > 0,
          warnings,
        });
      }

      setPersonalizedMessages(previews);
      setShowPreview(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate previews';
      setError(errorMessage);
      console.error('Error generating previews:', err);
    }
  };

  const handleSend = async (excludeWarnings: boolean) => {
    if (!selectedTemplate) return;

    setIsSending(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Filter messages based on excludeWarnings
      const messagesToSend = excludeWarnings
        ? personalizedMessages.filter(m => !m.hasWarnings)
        : personalizedMessages;

      if (messagesToSend.length === 0) {
        throw new Error('No valid messages to send');
      }

      // Generate batch ID
      const batchId = `batch_${Date.now()}`;

      // Prepare batch payload
      const batchPayload = {
        templateId: selectedTemplate.id,
        batchId,
        clients: messagesToSend.map(message => {
          const clientVariableValues =
            variableValues.mode === 'bulk'
              ? variableValues.bulkValues
              : variableValues.perClientValues[message.client.id] || {};

          return {
            corporateId: message.client.id,
            clientData: message.client,
            variableValues: clientVariableValues,
            personalizedSubject: message.subject,
            personalizedContent: message.content,
          };
        }),
      };

      // Send batch
      const response = await fetch(`${apiUrl}/api/communications/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchPayload),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to send batch');
      }

      // Success!
      setSuccessMessage(
        `Successfully sent ${messagesToSend.length} message${messagesToSend.length !== 1 ? 's' : ''}! Batch ID: ${batchId}`
      );
      setShowPreview(false);

      // Reset form
      setTimeout(() => {
        setSelectedTemplate(null);
        setSelectedClients([]);
        setVariableValues({
          mode: 'bulk',
          bulkValues: {},
          perClientValues: {},
        });
        setPersonalizedMessages([]);
        setStep(1);
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send batch';
      setError(errorMessage);
      console.error('Error sending batch:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {successMessage && (
        <div className="alert alert-success">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Progress Steps */}
      <div className="steps w-full">
        <div className={`step ${step >= 1 ? 'step-primary' : ''}`}>Choose Template</div>
        <div className={`step ${step >= 2 ? 'step-primary' : ''}`}>Select Clients</div>
        <div className={`step ${step >= 3 ? 'step-primary' : ''}`}>
          {getCustomVariables().length > 0 ? 'Enter Variables' : 'Review'}
        </div>
        <div className={`step ${step >= 4 ? 'step-primary' : ''}`}>Send</div>
      </div>

      {/* Step 1: Template Selection */}
      {step === 1 && (
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body">
            <h2 className="card-title">Step 1: Choose Message Template</h2>
            <p className="text-sm text-base-content/70 mb-4">
              Select a pre-designed template or create a custom message
            </p>

            <TemplateSelector
              onTemplateSelect={setSelectedTemplate}
              selectedTemplate={selectedTemplate}
              previewClient={null}
            />

            <div className="card-actions justify-end mt-6">
              <button
                onClick={() => handleNextStep()}
                className="btn btn-primary"
                disabled={!canProceedToStep2}
              >
                Next: Select Clients
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Client Selection */}
      {step === 2 && (
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body">
            <h2 className="card-title">Step 2: Select Clients</h2>
            <p className="text-sm text-base-content/70 mb-4">
              Search and select multiple corporate clients to receive this message
            </p>

            <MultiClientSearch
              onClientsChange={setSelectedClients}
              selectedClients={selectedClients}
            />

            <div className="card-actions justify-between mt-6">
              <button
                onClick={() => setStep(1)}
                className="btn btn-ghost"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                </svg>
                Back
              </button>
              <button
                onClick={() => handleNextStep()}
                className="btn btn-primary"
                disabled={!canProceedToStep3}
              >
                {getCustomVariables().length > 0 ? 'Next: Enter Variables' : 'Next: Preview & Send'}
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Variable Input (conditional) */}
      {step === 3 && getCustomVariables().length > 0 && (
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body">
            <h2 className="card-title">Step 3: Provide Variable Values</h2>
            <p className="text-sm text-base-content/70 mb-4">
              Enter values for custom variables in your template
            </p>

            <VariableInputManager
              customVariables={getCustomVariables()}
              selectedClients={selectedClients}
              variableValues={variableValues}
              onVariableValuesChange={setVariableValues}
            />

            <div className="card-actions justify-between mt-6">
              <button
                onClick={() => setStep(2)}
                className="btn btn-ghost"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                </svg>
                Back
              </button>
              <button
                onClick={() => handleNextStep()}
                className="btn btn-primary"
                disabled={!canProceedToStep4()}
              >
                Preview & Send
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <BatchPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        personalizedMessages={personalizedMessages}
        onSend={handleSend}
        isSending={isSending}
      />
    </div>
  );
}
