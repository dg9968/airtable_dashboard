// Create: app/simple-test/page.tsx
export default function SimpleDaisyTest() {
  return (
    <div className="min-h-screen bg-base-200 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-4xl font-bold text-center">Simple DaisyUI Test</h1>
        
        {/* If these show up styled, DaisyUI is working */}
        <div className="alert alert-success">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>If this alert looks styled, DaisyUI is working!</span>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Card Test</h2>
            <p>This should be a styled card with shadow.</p>
            <div className="card-actions justify-end">
              <button className="btn btn-primary">Primary Button</button>
              <button className="btn btn-secondary">Secondary</button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button className="btn">Default</button>
          <button className="btn btn-primary">Primary</button>
          <button className="btn btn-secondary">Secondary</button>
          <button className="btn btn-accent">Accent</button>
          <button className="btn btn-ghost">Ghost</button>
        </div>

        <div className="form-control w-full max-w-xs">
          <label className="label">
            <span className="label-text">Test Input</span>
          </label>
          <input type="text" placeholder="Type here" className="input input-bordered w-full max-w-xs" />
        </div>

        <div className="stats shadow">
          <div className="stat">
            <div className="stat-title">DaisyUI</div>
            <div className="stat-value">Working</div>
            <div className="stat-desc">If styled properly</div>
          </div>
        </div>
      </div>
    </div>
  )
}