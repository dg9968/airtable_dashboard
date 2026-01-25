'use client';

import { useState } from 'react';
import CorporateClientSearch from './CorporateClientSearch';
import BatchCommunicationsForm from './BatchCommunicationsForm';

interface CorporateClient {
  id: string;
  clientCode?: string;
  name: string;
  ein: string;
  entityNumber: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
}

export default function CommunicationsForm() {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
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

      // Step 3: Trigger n8n webhook (using batch format for consistency)
      const webhookRes = await fetch('/api/communications-webhook/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'batch',
          batchId: `single_${Date.now()}`,
          timestamp: new Date().toISOString(),
          totalClients: 1,
          clients: [
            {
              messageId,
              corporateId: selectedClient.id,
              junctionRecordId: junctionData.data.id,
              clientData: {
                name: selectedClient.name || '',
                email: selectedClient.email || '',
                ein: selectedClient.ein || '',
                phone: selectedClient.phone || '',
                address: selectedClient.address || '',
                city: selectedClient.city || '',
                state: selectedClient.state || '',
                zipCode: selectedClient.zipCode || '',
                clientCode: selectedClient.clientCode || '',
              },
              emailSubject,
              emailContent,
              variableValues: {},
            },
          ],
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
      {/* Mode Toggle */}
      <div className="card bg-base-100 border border-base-300">
        <div className="card-body">
          <h3 className="card-title text-lg mb-3">Communication Mode</h3>
          <div className="btn-group w-full">
            <button
              className={`btn flex-1 ${mode === 'single' ? 'btn-active btn-primary' : ''}`}
              onClick={() => setMode('single')}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
              </svg>
              Single Client
            </button>
            <button
              className={`btn flex-1 ${mode === 'batch' ? 'btn-active btn-primary' : ''}`}
              onClick={() => setMode('batch')}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
              Multiple Clients (Batch)
            </button>
          </div>
          <p className="text-sm text-base-content/60 mt-2">
            {mode === 'single'
              ? 'Send a custom message to one client'
              : 'Send templated messages to multiple clients at once'}
          </p>
        </div>
      </div>

      {/* Conditional Rendering Based on Mode */}
      {mode === 'batch' ? (
        <BatchCommunicationsForm />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
