'use client';

import { useState } from 'react';

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  count?: number;
}

interface ChecklistSection {
  title: string;
  items: ChecklistItem[];
}

export default function DocumentChecklist() {
  const [checklist, setChecklist] = useState<ChecklistSection[]>([
    {
      title: 'Employment Income',
      items: [
        { id: 'w2-taxpayer', label: 'W-2 Forms (Taxpayer)', checked: false, count: 0 },
        { id: 'w2-spouse', label: 'W-2 Forms (Spouse)', checked: false, count: 0 },
      ],
    },
    {
      title: 'Interest and Dividend Income',
      items: [
        { id: '1099-int', label: '1099-INT (Interest Income)', checked: false, count: 0 },
        { id: '1099-div', label: '1099-DIV (Dividend Income)', checked: false, count: 0 },
        { id: '1099-oid', label: '1099-OID (Original Issue Discount)', checked: false, count: 0 },
      ],
    },
    {
      title: 'Retirement Income',
      items: [
        { id: '1099-r', label: '1099-R (Pension, IRA, Annuity)', checked: false, count: 0 },
        { id: 'ssa-1099', label: 'SSA-1099 (Social Security)', checked: false, count: 0 },
        { id: 'rrb-1099', label: 'RRB-1099 (Railroad Retirement)', checked: false, count: 0 },
      ],
    },
    {
      title: 'Self-Employment and Business Income',
      items: [
        { id: '1099-nec', label: '1099-NEC (Nonemployee Compensation)', checked: false, count: 0 },
        { id: '1099-misc', label: '1099-MISC (Miscellaneous Income)', checked: false, count: 0 },
        { id: '1099-k', label: '1099-K (Payment Card Transactions)', checked: false, count: 0 },
        { id: 'schedule-k1', label: 'Schedule K-1 (Partnership, S-Corp)', checked: false, count: 0 },
        { id: 'business-records', label: 'Business Profit/Loss Records', checked: false },
      ],
    },
    {
      title: 'Investment Income',
      items: [
        { id: '1099-b', label: '1099-B (Broker Transactions)', checked: false, count: 0 },
        { id: '1099-s', label: '1099-S (Real Estate Transactions)', checked: false, count: 0 },
        { id: 'crypto', label: 'Cryptocurrency Transaction Summary', checked: false },
      ],
    },
    {
      title: 'Rental Income',
      items: [
        { id: 'rental-address', label: 'Rental Property Address(es)', checked: false },
        { id: 'rental-records', label: 'Rental Income and Expense Records', checked: false },
      ],
    },
    {
      title: 'Other Income',
      items: [
        { id: '1099-g', label: '1099-G (Unemployment, State Refunds)', checked: false, count: 0 },
        { id: '1099-c', label: '1099-C (Cancellation of Debt)', checked: false, count: 0 },
        { id: 'alimony', label: 'Alimony Received Documentation', checked: false },
        { id: 'w2g', label: 'W-2G (Gambling Winnings)', checked: false, count: 0 },
        { id: 'jury-duty', label: 'Jury Duty Pay Documentation', checked: false },
      ],
    },
    {
      title: 'Home Ownership (Itemizing)',
      items: [
        { id: '1098', label: '1098 (Mortgage Interest)', checked: false, count: 0 },
        { id: 'property-tax', label: 'Property Tax Statements', checked: false, count: 0 },
        { id: 'mortgage-insurance', label: 'Mortgage Insurance Premiums', checked: false },
        { id: 'home-equity', label: 'Home Equity Loan Interest', checked: false },
      ],
    },
    {
      title: 'Charitable Contributions (Itemizing)',
      items: [
        { id: 'cash-charity', label: 'Cash Contributions Summary/Receipts', checked: false },
        { id: 'noncash-charity', label: 'Non-Cash Contributions (>$250)', checked: false },
        { id: 'charity-mileage', label: 'Mileage Log for Charitable Activities', checked: false },
        { id: 'form-8283', label: 'Form 8283 (Non-Cash >$500)', checked: false },
      ],
    },
    {
      title: 'Medical Expenses (Itemizing)',
      items: [
        { id: 'health-insurance', label: 'Health Insurance Premiums', checked: false },
        { id: 'medical-expenses', label: 'Out-of-Pocket Medical Expenses', checked: false },
        { id: 'prescriptions', label: 'Prescription Medications', checked: false },
        { id: 'medical-mileage', label: 'Medical Appointment Mileage Log', checked: false },
      ],
    },
    {
      title: 'State and Local Taxes (Itemizing)',
      items: [
        { id: 'state-income-tax', label: 'State/Local Income Taxes Paid', checked: false },
        { id: 'real-estate-tax', label: 'Real Estate Taxes Paid', checked: false },
        { id: 'property-tax-vehicle', label: 'Personal Property Taxes (Vehicle)', checked: false },
      ],
    },
    {
      title: 'Retirement Contributions',
      items: [
        { id: 'traditional-ira', label: 'Traditional IRA Contributions', checked: false },
        { id: '5498', label: '5498 (IRA Contribution Info)', checked: false, count: 0 },
        { id: 'hsa', label: '1099-SA / 5498-SA (HSA)', checked: false },
      ],
    },
    {
      title: 'Education Expenses',
      items: [
        { id: '1098-e', label: '1098-E (Student Loan Interest)', checked: false, count: 0 },
        { id: '1098-t', label: '1098-T (Tuition Statement)', checked: false, count: 0 },
        { id: 'education-expenses', label: 'Qualified Education Expenses', checked: false },
      ],
    },
    {
      title: 'Child and Dependent Care',
      items: [
        { id: 'childcare-provider', label: 'Child Care Provider Name & Tax ID', checked: false },
        { id: 'childcare-expenses', label: 'Child Care Expenses Paid', checked: false },
        { id: 'form-2441', label: 'Form 2441 Information', checked: false },
      ],
    },
    {
      title: 'Business Expenses (Self-Employed)',
      items: [
        { id: 'vehicle-mileage', label: 'Vehicle Mileage Log', checked: false },
        { id: 'home-office', label: 'Home Office Square Footage', checked: false },
        { id: 'business-expenses', label: 'Business Expenses Summary', checked: false },
      ],
    },
    {
      title: 'Energy Credits',
      items: [
        { id: 'energy-improvements', label: 'Energy-Efficient Home Improvements', checked: false },
        { id: 'electric-vehicle', label: 'Electric Vehicle Purchase', checked: false },
      ],
    },
    {
      title: 'Healthcare Information',
      items: [
        { id: '1095-a', label: '1095-A (Marketplace Statement)', checked: false },
        { id: '1095-b', label: '1095-B (Health Coverage)', checked: false },
        { id: '1095-c', label: '1095-C (Employer Insurance)', checked: false },
      ],
    },
    {
      title: 'Estimated Tax Payments',
      items: [
        { id: 'federal-estimated', label: 'Federal Estimated Tax Payments', checked: false },
        { id: 'state-estimated', label: 'State Estimated Tax Payments', checked: false },
      ],
    },
    {
      title: 'Prior Year Returns',
      items: [
        { id: 'prior-federal', label: 'Prior Year Federal Tax Return (1040)', checked: false },
        { id: 'prior-state', label: 'Prior Year State Tax Return', checked: false },
      ],
    },
  ]);

  const handleToggle = (sectionIndex: number, itemIndex: number) => {
    setChecklist((prev) => {
      const updated = [...prev];
      updated[sectionIndex].items[itemIndex].checked =
        !updated[sectionIndex].items[itemIndex].checked;
      return updated;
    });
  };

  const handleCountChange = (sectionIndex: number, itemIndex: number, count: number) => {
    setChecklist((prev) => {
      const updated = [...prev];
      updated[sectionIndex].items[itemIndex].count = count;
      return updated;
    });
  };

  const getProgress = () => {
    const totalItems = checklist.reduce((sum, section) => sum + section.items.length, 0);
    const checkedItems = checklist.reduce(
      (sum, section) => sum + section.items.filter((item) => item.checked).length,
      0
    );
    return Math.round((checkedItems / totalItems) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h3 className="card-title text-base-content">Document Collection Progress</h3>
          <div className="flex items-center gap-4">
            <progress
              className="progress progress-primary w-full"
              value={getProgress()}
              max="100"
            ></progress>
            <span className="text-base-content font-semibold">{getProgress()}%</span>
          </div>
          <p className="text-sm text-base-content/60">
            {checklist.reduce(
              (sum, section) => sum + section.items.filter((item) => item.checked).length,
              0
            )}{' '}
            of{' '}
            {checklist.reduce((sum, section) => sum + section.items.length, 0)} items collected
          </p>
        </div>
      </div>

      {/* Checklist Sections */}
      {checklist.map((section, sectionIndex) => (
        <div key={sectionIndex} className="collapse collapse-arrow bg-base-100 shadow-xl">
          <input type="checkbox" defaultChecked />
          <div className="collapse-title text-xl font-medium text-base-content">
            <div className="flex items-center justify-between">
              <span>{section.title}</span>
              <span className="badge badge-primary">
                {section.items.filter((item) => item.checked).length} / {section.items.length}
              </span>
            </div>
          </div>
          <div className="collapse-content">
            <div className="space-y-3 mt-4">
              {section.items.map((item, itemIndex) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={item.checked}
                      onChange={() => handleToggle(sectionIndex, itemIndex)}
                    />
                    <span className={`${item.checked ? 'line-through text-base-content/50' : 'text-base-content'}`}>
                      {item.label}
                    </span>
                  </div>
                  {item.count !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-base-content/60">Count:</span>
                      <input
                        type="number"
                        min="0"
                        className="input input-bordered input-sm w-20"
                        value={item.count}
                        onChange={(e) =>
                          handleCountChange(sectionIndex, itemIndex, parseInt(e.target.value) || 0)
                        }
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* Summary and Notes */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h3 className="card-title text-base-content">Special Notes</h3>
          <textarea
            className="textarea textarea-bordered h-32"
            placeholder="Add any special notes about the client's documents, missing items, or follow-up needed..."
          ></textarea>
        </div>
      </div>

      {/* Quick Reference */}
      <div className="alert bg-info/20 border-info">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          className="stroke-info shrink-0 w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          ></path>
        </svg>
        <div>
          <h4 className="font-bold text-base-content">Important Reminders</h4>
          <p className="text-sm text-base-content/70">
            • Document retention: Keep all tax records for at least 3 years
            <br />
            • Missing documents: Contact issuers directly or check online accounts
            <br />
            • Tax deadline: April 15th (or next business day)
            <br />• In the future, this will link to the document management system for file uploads
          </p>
        </div>
      </div>
    </div>
  );
}
