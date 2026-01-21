'use client';

import { useState } from 'react';
import CorporateClientSearch from './CorporateClientSearch';

interface CorporateClient {
  id: string;
  clientCode?: string;
  name: string;
  ein: string;
  entityNumber: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
}

export default function CommunicationsForm() {
  const [selectedClient, setSelectedClient] = useState<CorporateClient | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSend = async () => {
    if (!selectedClient || !emailSubject || !emailContent) {
      setError('Please fill in all required fields');
      return;
    }

    setIsSending(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Step 1: Create Message record
      const messageRes = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailSubject,
          emailContent,
        }),
      });

      const messageData = await messageRes.json();
      if (!messageData.success) {
        throw new Error(messageData.error || 'Failed to create message');
      }

      const messageId = messageData.data.id;

      // Step 2: Create junction record linking Message to Corporate
      const junctionRes = await fetch('/api/communications-corporate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          corporateId: selectedClient.id,
        }),
      });

      const junctionData = await junctionRes.json();
      if (!junctionData.success) {
        throw new Error(junctionData.error || 'Failed to create communications record');
      }

      // Step 3: Trigger n8n webhook
      const webhookRes = await fetch('/api/communications-webhook/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          corporateId: selectedClient.id,
          emailSubject,
          emailContent,
          junctionRecordId: junctionData.data.id,
          timestamp: new Date().toISOString(),
        }),
      });

      const webhookData = await webhookRes.json();
      if (!webhookData.success) {
        throw new Error(webhookData.error || 'Failed to trigger webhook');
      }

      // Success - reset form
      setSuccessMessage('Email sent successfully!');
      setEmailSubject('');
      setEmailContent('');
      setSelectedClient(null);

      // Auto-dismiss success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);

    } catch (err) {
      console.error('Error sending email:', err);
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  const isFormValid = selectedClient && emailSubject.trim() && emailContent.trim();

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

      {/* Corporate Client Search */}
      <div className="form-control">
        <label className="label">
          <span className="label-text font-semibold">Select Corporate Client *</span>
        </label>
        <CorporateClientSearch
          onClientSelect={setSelectedClient}
          selectedClient={selectedClient}
          placeholder="Search by company name, EIN, or entity number..."
        />
        {selectedClient && (
          <div className="mt-2 p-4 bg-base-200 rounded-lg">
            <h3 className="font-semibold text-lg">{selectedClient.name}</h3>
            <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
              {selectedClient.ein && (
                <div>
                  <span className="text-base-content/70">EIN:</span> {selectedClient.ein}
                </div>
              )}
              {selectedClient.entityNumber && (
                <div>
                  <span className="text-base-content/70">Entity #:</span> {selectedClient.entityNumber}
                </div>
              )}
              {selectedClient.phone && (
                <div>
                  <span className="text-base-content/70">Phone:</span> {selectedClient.phone}
                </div>
              )}
              {selectedClient.address && (
                <div className="col-span-2">
                  <span className="text-base-content/70">Address:</span> {selectedClient.address}
                  {selectedClient.city && `, ${selectedClient.city}`}
                  {selectedClient.state && `, ${selectedClient.state}`}
                  {selectedClient.zipCode && ` ${selectedClient.zipCode}`}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Email Subject */}
      <div className="form-control">
        <label className="label">
          <span className="label-text font-semibold">Email Subject *</span>
        </label>
        <input
          type="text"
          className="input input-bordered w-full"
          value={emailSubject}
          onChange={(e) => setEmailSubject(e.target.value)}
          placeholder="Enter email subject..."
          disabled={isSending}
        />
      </div>

      {/* Email Content */}
      <div className="form-control">
        <label className="label">
          <span className="label-text font-semibold">Email Content *</span>
        </label>
        <textarea
          className="textarea textarea-bordered w-full h-64"
          value={emailContent}
          onChange={(e) => setEmailContent(e.target.value)}
          placeholder="Enter email content..."
          disabled={isSending}
        />
      </div>

      {/* Send Button */}
      <div className="flex justify-end gap-3">
        <button
          className="btn btn-ghost"
          onClick={() => {
            setEmailSubject('');
            setEmailContent('');
            setSelectedClient(null);
            setError(null);
            setSuccessMessage(null);
          }}
          disabled={isSending}
        >
          Clear
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSend}
          disabled={isSending || !isFormValid}
        >
          {isSending ? (
            <>
              <span className="loading loading-spinner loading-sm"></span>
              Sending...
            </>
          ) : (
            'Send Email'
          )}
        </button>
      </div>
    </div>
  );
}
