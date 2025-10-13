"use client";

import { useState } from "react";
import StateDiagram from "@/components/StateDiagram";

export default function DiagramTestPage() {
  const [theme, setTheme] = useState("default");

  const themes = ["default", "dark", "forest", "base", "neutral"];

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">State Diagram Test</h1>

      <div className="mb-6">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Theme</span>
          </label>
          <select
            className="select select-bordered w-full max-w-xs"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            {themes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Tax Preparation Workflow State Diagram</h2>
          <p className="text-sm text-base-content/70 mb-4">
            Use the checkboxes in the diagram to track progress through the tax preparation workflow.
            The diagram shows the complete process from client engagement through to completion.
          </p>
          <StateDiagram theme={theme} />
        </div>
      </div>
    </div>
  );
}