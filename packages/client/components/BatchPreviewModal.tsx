'use client';

import { useState } from 'react';
import { CorporateClient } from './MultiClientSearch';

export interface PersonalizedMessage {
  client: CorporateClient;
  subject: string;
  content: string;
  missingVariables: string[];
  hasWarnings: boolean;
  warnings: string[];
}

interface BatchPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  personalizedMessages: PersonalizedMessage[];
  onSend: (excludeWarnings: boolean) => void;
  isSending: boolean;
}

export default function BatchPreviewModal({
  isOpen,
  onClose,
  personalizedMessages,
  onSend,
  isSending
}: BatchPreviewModalProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [excludeWarnings, setExcludeWarnings] = useState(false);

  if (!isOpen) return null;

  const messagesWithWarnings = personalizedMessages.filter(m => m.hasWarnings);
  const validMessages = personalizedMessages.filter(m => !m.hasWarnings);
  const totalClients = personalizedMessages.length;
  const clientsToSend = excludeWarnings ? validMessages.length : totalClients;

  const highlightVariables = (text: string) => {
    return text.split(/(\{\{\w+\}\})/).map((part, index) => {
      if (part.match(/^\{\{\w+\}\}$/)) {
        return (
          <span key={index} className="bg-error text-error-content px-1 rounded font-mono text-xs">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const getCurrentMessage = () => {
    return personalizedMessages[activeTab];
  };

  const currentMessage = getCurrentMessage();

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-5xl h-[90vh] flex flex-col p-0">
        {/* Header */}
        <div className="sticky top-0 bg-base-100 border-b border-base-300 p-6 z-10">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-2xl">Preview Batch Messages</h3>
              <p className="text-sm text-base-content/70 mt-1">
                Review personalized messages before sending to {totalClients} client{totalClients !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="btn btn-sm btn-circle btn-ghost"
              disabled={isSending}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          {/* Validation Summary */}
          {messagesWithWarnings.length > 0 ? (
            <div className="alert alert-warning mt-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <div className="font-semibold">
                  {messagesWithWarnings.length} client{messagesWithWarnings.length !== 1 ? 's' : ''} with warnings
                </div>
                <div className="text-xs mt-1">
                  {validMessages.length} ready to send
                </div>
              </div>
              <div className="form-control">
                <label className="label cursor-pointer gap-2">
                  <span className="label-text">Exclude clients with warnings</span>
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={excludeWarnings}
                    onChange={(e) => setExcludeWarnings(e.target.checked)}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="alert alert-success mt-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>All {totalClients} messages validated successfully!</span>
            </div>
          )}
        </div>

        {/* Client Tabs */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="tabs tabs-boxed bg-base-200 p-2 overflow-x-auto flex-shrink-0">
            {personalizedMessages.map((message, index) => (
              <button
                key={message.client.id}
                className={`tab gap-2 ${activeTab === index ? 'tab-active' : ''}`}
                onClick={() => setActiveTab(index)}
              >
                <span className="max-w-32 truncate">{message.client.name}</span>
                {message.hasWarnings && (
                  <svg className="w-4 h-4 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Message Preview */}
          {currentMessage && (
            <div className="flex-1 overflow-y-auto p-6">
              {/* Client Info */}
              <div className="card bg-base-200 mb-4">
                <div className="card-body p-4">
                  <h4 className="font-semibold text-lg mb-2">{currentMessage.client.name}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {currentMessage.client.email && (
                      <div>
                        <span className="text-base-content/70">Email:</span>{' '}
                        <span className="font-medium">{currentMessage.client.email}</span>
                      </div>
                    )}
                    {currentMessage.client.ein && (
                      <div>
                        <span className="text-base-content/70">EIN:</span>{' '}
                        <span className="font-mono">{currentMessage.client.ein}</span>
                      </div>
                    )}
                    {currentMessage.client.clientCode && (
                      <div>
                        <span className="text-base-content/70">Code:</span>{' '}
                        <span className="font-mono">{currentMessage.client.clientCode}</span>
                      </div>
                    )}
                    {currentMessage.client.city && currentMessage.client.state && (
                      <div>
                        <span className="text-base-content/70">Location:</span>{' '}
                        <span>{currentMessage.client.city}, {currentMessage.client.state}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {currentMessage.hasWarnings && (
                <div className="alert alert-warning mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <div className="font-semibold">Issues found:</div>
                    <ul className="list-disc list-inside text-sm mt-1">
                      {currentMessage.warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Email Subject */}
              <div className="mb-4">
                <label className="label">
                  <span className="label-text font-semibold">Subject:</span>
                </label>
                <div className="p-4 bg-base-200 rounded-lg border-l-4 border-primary">
                  <div className="font-medium">
                    {currentMessage.missingVariables.length > 0
                      ? highlightVariables(currentMessage.subject)
                      : currentMessage.subject}
                  </div>
                </div>
              </div>

              {/* Email Content */}
              <div>
                <label className="label">
                  <span className="label-text font-semibold">Content:</span>
                </label>
                <div className="p-4 bg-base-200 rounded-lg border-l-4 border-secondary whitespace-pre-wrap">
                  {currentMessage.missingVariables.length > 0
                    ? highlightVariables(currentMessage.content)
                    : currentMessage.content}
                </div>
              </div>

              {/* Missing Variables */}
              {currentMessage.missingVariables.length > 0 && (
                <div className="alert alert-error mt-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <div className="font-semibold">Unreplaced variables:</div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {currentMessage.missingVariables.map((varName) => (
                        <span key={varName} className="badge badge-error font-mono">
                          {`{{${varName}}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-base-100 border-t border-base-300 p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-base-content/70">
              Viewing {activeTab + 1} of {totalClients}
              {excludeWarnings && messagesWithWarnings.length > 0 && (
                <span className="ml-2 text-warning">
                  ({messagesWithWarnings.length} will be excluded)
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="btn btn-ghost"
                disabled={isSending}
              >
                Cancel
              </button>
              <button
                onClick={() => onSend(excludeWarnings)}
                className="btn btn-primary"
                disabled={isSending || (excludeWarnings && validMessages.length === 0)}
              >
                {isSending ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Sending...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                    </svg>
                    Send to {clientsToSend} Client{clientsToSend !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
