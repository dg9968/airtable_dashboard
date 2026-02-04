"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface LedgerEntry {
  id: string;
  fields: {
    "Service Rendered": string;
    "Receipt Date": string;
    "Amount Charged": number;
    "Name of Client": string;
    "Payment Method": string;
    "Processor": string;
    "Created Time": string;
  };
  clientName: string;
  serviceRendered: string;
  receiptDate: string;
  amountCharged: number;
  paymentMethod: string;
  processor: string;
  createdTime: string;
}

interface GroupedLedger {
  groupName: string;
  entries: LedgerEntry[];
  totalAmount: number;
  count: number;
}

export default function LedgerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [groupedEntries, setGroupedEntries] = useState<GroupedLedger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [clientFilterInput, setClientFilterInput] = useState(""); // Input value for debouncing
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("All");
  const [groupBy, setGroupBy] = useState<"client" | "date" | "payment">("client");
  const [viewMode, setViewMode] = useState<"all" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth">("all");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  // Debounce client filter input
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setClientFilter(clientFilterInput);
    }, 500); // 500ms delay after user stops typing

    return () => clearTimeout(timeoutId);
  }, [clientFilterInput]);

  const getThisWeekDates = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const firstDay = new Date(now);
    firstDay.setDate(now.getDate() - dayOfWeek); // Go back to Sunday
    const lastDay = new Date(now);
    lastDay.setDate(now.getDate() + (6 - dayOfWeek)); // Go forward to Saturday
    return {
      start: firstDay.toISOString().split('T')[0],
      end: lastDay.toISOString().split('T')[0],
    };
  };

  const getLastWeekDates = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const firstDay = new Date(now);
    firstDay.setDate(now.getDate() - dayOfWeek - 7); // Last Sunday
    const lastDay = new Date(now);
    lastDay.setDate(now.getDate() - dayOfWeek - 1); // Last Saturday
    return {
      start: firstDay.toISOString().split('T')[0],
      end: lastDay.toISOString().split('T')[0],
    };
  };

  const getThisMonthDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: firstDay.toISOString().split('T')[0],
      end: lastDay.toISOString().split('T')[0],
    };
  };

  const getLastMonthDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      start: firstDay.toISOString().split('T')[0],
      end: lastDay.toISOString().split('T')[0],
    };
  };

  const setViewPeriod = (mode: "all" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth") => {
    if (mode === "all") {
      setStartDate("");
      setEndDate("");
      setViewMode("all");
    } else if (mode === "thisWeek") {
      const { start, end } = getThisWeekDates();
      setStartDate(start);
      setEndDate(end);
      setViewMode("thisWeek");
    } else if (mode === "lastWeek") {
      const { start, end } = getLastWeekDates();
      setStartDate(start);
      setEndDate(end);
      setViewMode("lastWeek");
    } else if (mode === "thisMonth") {
      const { start, end } = getThisMonthDates();
      setStartDate(start);
      setEndDate(end);
      setViewMode("thisMonth");
    } else if (mode === "lastMonth") {
      const { start, end } = getLastMonthDates();
      setStartDate(start);
      setEndDate(end);
      setViewMode("lastMonth");
    }
  };

  const fetchLedgerEntries = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (clientFilter) params.append("clientName", clientFilter);
      if (paymentMethodFilter !== "All") params.append("paymentMethod", paymentMethodFilter);
      params.append("groupBy", groupBy);

      const response = await fetch(`/api/ledger?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setEntries(data.data.entries);
        setGroupedEntries(data.data.grouped);
      } else {
        setError(data.error || "Failed to fetch ledger entries");
      }
    } catch (err) {
      console.error("Error fetching ledger:", err);
      setError("Failed to load ledger entries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchLedgerEntries();
    }
  }, [status, startDate, endDate, clientFilter, paymentMethodFilter, groupBy]);

  if (status === "loading" || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  const totalRevenue = entries.reduce((sum, entry) => sum + entry.amountCharged, 0);
  const averageTransaction = entries.length > 0 ? totalRevenue / entries.length : 0;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">Revenue Ledger</h1>
          <button
            onClick={() => router.push("/billing")}
            className="btn btn-outline btn-sm"
          >
            ← Back to Billing
          </button>
        </div>

        {/* Date Range Toggle Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setViewPeriod("all")}
            className={`btn btn-sm ${viewMode === "all" ? "btn-primary" : "btn-outline"}`}
          >
            All Time
          </button>
          <button
            onClick={() => setViewPeriod("thisWeek")}
            className={`btn btn-sm ${viewMode === "thisWeek" ? "btn-primary" : "btn-outline"}`}
          >
            {viewMode === "thisWeek" ? "📅 This Week" : "This Week"}
          </button>
          <button
            onClick={() => setViewPeriod("lastWeek")}
            className={`btn btn-sm ${viewMode === "lastWeek" ? "btn-primary" : "btn-outline"}`}
          >
            {viewMode === "lastWeek" ? "📅 Last Week" : "Last Week"}
          </button>
          <button
            onClick={() => setViewPeriod("thisMonth")}
            className={`btn btn-sm ${viewMode === "thisMonth" ? "btn-primary" : "btn-outline"}`}
          >
            {viewMode === "thisMonth" ? "📅 This Month" : "This Month"}
          </button>
          <button
            onClick={() => setViewPeriod("lastMonth")}
            className={`btn btn-sm ${viewMode === "lastMonth" ? "btn-primary" : "btn-outline"}`}
          >
            {viewMode === "lastMonth" ? "📅 Last Month" : "Last Month"}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-sm">Total Revenue</h2>
            <p className="text-3xl font-bold text-success">
              ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-sm opacity-70">{entries.length} transactions</p>
          </div>
        </div>

        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-sm">Average Transaction</h2>
            <p className="text-3xl font-bold text-info">
              ${averageTransaction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-sm opacity-70">Per service</p>
          </div>
        </div>

        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-sm">Unique Clients</h2>
            <p className="text-3xl font-bold text-warning">
              {new Set(entries.map(e => e.clientName)).size}
            </p>
            <p className="text-sm opacity-70">Served</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title text-lg mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Start Date</span>
              </label>
              <input
                type="date"
                className="input input-bordered input-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">End Date</span>
              </label>
              <input
                type="date"
                className="input input-bordered input-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Client Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered input-sm"
                placeholder="Search client..."
                value={clientFilterInput}
                onChange={(e) => setClientFilterInput(e.target.value)}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Payment Method</span>
              </label>
              <select
                className="select select-bordered select-sm"
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
              >
                <option>All</option>
                <option>Credit Card</option>
                <option>Cash</option>
                <option>Zelle</option>
                <option>Check</option>
                <option>ACH</option>
                <option>TPG Bank Product</option>
                <option>Other</option>
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Group By</span>
              </label>
              <select
                className="select select-bordered select-sm"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as "client" | "date" | "payment")}
              >
                <option value="client">Client</option>
                <option value="date">Date</option>
                <option value="payment">Payment Method</option>
              </select>
            </div>
          </div>

          {(startDate || endDate || clientFilter || paymentMethodFilter !== "All") && (
            <button
              className="btn btn-sm btn-ghost mt-4"
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setClientFilter("");
                setClientFilterInput("");
                setPaymentMethodFilter("All");
                setViewMode("all");
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="alert alert-error mb-6">
          <span>{error}</span>
        </div>
      )}

      {/* Grouped Ledger Entries */}
      {groupedEntries.length === 0 ? (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body items-center text-center">
            <p className="text-lg opacity-70">No ledger entries found</p>
            <p className="text-sm opacity-50">
              Ledger entries are created when services are billed and marked as paid.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedEntries.map((group, idx) => (
            <div key={idx} className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="card-title text-xl">{group.groupName}</h3>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-success">
                      ${group.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm opacity-70">{group.count} entries</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="table table-zebra">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Client</th>
                        <th>Service</th>
                        <th>Processor</th>
                        <th>Payment Method</th>
                        <th className="text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.entries.map((entry) => (
                        <tr key={entry.id}>
                          <td>{new Date(entry.receiptDate).toLocaleDateString()}</td>
                          <td className="font-medium">{entry.clientName}</td>
                          <td>{entry.serviceRendered}</td>
                          <td>{entry.processor || '-'}</td>
                          <td>
                            <span className="badge badge-outline">
                              {entry.paymentMethod}
                            </span>
                          </td>
                          <td className="text-right font-semibold">
                            ${entry.amountCharged.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
