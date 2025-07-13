 // app/test-daisyui/page.tsx
'use client';

import { useState } from 'react';

export default function DaisyUITestPage() {
  const [selectedTab, setSelectedTab] = useState('buttons');
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-base-200">
      {/* Header */}
      <div className="navbar bg-base-100 shadow-lg">
        <div className="flex-1">
          <a className="btn btn-ghost text-xl">DaisyUI Test Components</a>
        </div>
        <div className="flex-none">
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost">
              Theme
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
              <li><a onClick={() => document.documentElement.setAttribute('data-theme', 'light')}>Light</a></li>
              <li><a onClick={() => document.documentElement.setAttribute('data-theme', 'dark')}>Dark</a></li>
              <li><a onClick={() => document.documentElement.setAttribute('data-theme', 'cupcake')}>Cupcake</a></li>
              <li><a onClick={() => document.documentElement.setAttribute('data-theme', 'synthwave')}>Synthwave</a></li>
              <li><a onClick={() => document.documentElement.setAttribute('data-theme', 'cyberpunk')}>Cyberpunk</a></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6">
        {/* Tab Navigation */}
        <div className="tabs tabs-boxed mb-6">
          <a 
            className={`tab ${selectedTab === 'buttons' ? 'tab-active' : ''}`}
            onClick={() => setSelectedTab('buttons')}
          >
            Buttons & Actions
          </a>
          <a 
            className={`tab ${selectedTab === 'data' ? 'tab-active' : ''}`}
            onClick={() => setSelectedTab('data')}
          >
            Data Display
          </a>
          <a 
            className={`tab ${selectedTab === 'forms' ? 'tab-active' : ''}`}
            onClick={() => setSelectedTab('forms')}
          >
            Forms
          </a>
          <a 
            className={`tab ${selectedTab === 'feedback' ? 'tab-active' : ''}`}
            onClick={() => setSelectedTab('feedback')}
          >
            Feedback
          </a>
        </div>

        {/* Buttons & Actions Tab */}
        {selectedTab === 'buttons' && (
          <div className="space-y-8">
            {/* Buttons */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Buttons</h2>
                <div className="flex flex-wrap gap-4">
                  <button className="btn">Default</button>
                  <button className="btn btn-primary">Primary</button>
                  <button className="btn btn-secondary">Secondary</button>
                  <button className="btn btn-accent">Accent</button>
                  <button className="btn btn-info">Info</button>
                  <button className="btn btn-success">Success</button>
                  <button className="btn btn-warning">Warning</button>
                  <button className="btn btn-error">Error</button>
                </div>
                <div className="flex flex-wrap gap-4 mt-4">
                  <button className="btn btn-outline">Outline</button>
                  <button className="btn btn-ghost">Ghost</button>
                  <button className="btn btn-link">Link</button>
                  <button className="btn btn-disabled">Disabled</button>
                  <button className="btn btn-sm">Small</button>
                  <button className="btn btn-lg">Large</button>
                </div>
              </div>
            </div>

            {/* Dropdown */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Dropdown</h2>
                <div className="dropdown">
                  <div tabIndex={0} role="button" className="btn m-1">
                    Click me
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                    <li><a>Item 1</a></li>
                    <li><a>Item 2</a></li>
                    <li><a>Item 3</a></li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Modal */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Modal</h2>
                <button className="btn btn-primary w-fit" onClick={() => setModalOpen(true)}>
                  Open Modal
                </button>
              </div>
            </div>

            {/* Drawer */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Drawer</h2>
                <button className="btn btn-secondary w-fit" onClick={() => setDrawerOpen(true)}>
                  Open Drawer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Data Display Tab */}
        {selectedTab === 'data' && (
          <div className="space-y-8">
            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="card w-full bg-base-100 shadow-xl">
                <figure>
                  <div className="w-full h-48 bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-primary-content">
                    Image Placeholder
                  </div>
                </figure>
                <div className="card-body">
                  <h2 className="card-title">Card Title</h2>
                  <p>If a dog chews shoes whose shoes does he choose?</p>
                  <div className="card-actions justify-end">
                    <button className="btn btn-primary">Buy Now</button>
                  </div>
                </div>
              </div>

              <div className="card w-full bg-base-100 shadow-xl">
                <div className="card-body">
                  <h2 className="card-title">Card with Badge</h2>
                  <div className="badge badge-secondary">NEW</div>
                  <p>This card has a badge and no image.</p>
                  <div className="card-actions justify-end">
                    <div className="badge badge-outline">Fashion</div>
                    <div className="badge badge-outline">Products</div>
                  </div>
                </div>
              </div>

              <div className="card w-full bg-primary text-primary-content">
                <div className="card-body">
                  <h2 className="card-title">Colored Card</h2>
                  <p>This card has primary color background.</p>
                  <div className="card-actions justify-end">
                    <button className="btn">Action</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Table</h2>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>
                          <label>
                            <input type="checkbox" className="checkbox" />
                          </label>
                        </th>
                        <th>Name</th>
                        <th>Job</th>
                        <th>Favorite Color</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th>
                          <label>
                            <input type="checkbox" className="checkbox" />
                          </label>
                        </th>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="avatar">
                              <div className="mask mask-squircle w-12 h-12">
                                <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center text-primary-content font-bold">
                                  CY
                                </div>
                              </div>
                            </div>
                            <div>
                              <div className="font-bold">Cy Ganderton</div>
                              <div className="text-sm opacity-50">United States</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          Quality Control Specialist
                          <br />
                          <span className="badge badge-ghost badge-sm">Desktop Support Technician</span>
                        </td>
                        <td>Purple</td>
                        <th>
                          <button className="btn btn-ghost btn-xs">details</button>
                        </th>
                      </tr>
                      <tr>
                        <th>
                          <label>
                            <input type="checkbox" className="checkbox" />
                          </label>
                        </th>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="avatar">
                              <div className="mask mask-squircle w-12 h-12">
                                <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center text-secondary-content font-bold">
                                  HB
                                </div>
                              </div>
                            </div>
                            <div>
                              <div className="font-bold">Hart Hagerty</div>
                              <div className="text-sm opacity-50">United States</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          Desktop Support Technician
                          <br />
                          <span className="badge badge-ghost badge-sm">Tax Accountant</span>
                        </td>
                        <td>Red</td>
                        <th>
                          <button className="btn btn-ghost btn-xs">details</button>
                        </th>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="stats shadow">
              <div className="stat">
                <div className="stat-figure text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-8 h-8 stroke-current">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                  </svg>
                </div>
                <div className="stat-title">Total Likes</div>
                <div className="stat-value text-primary">25.6K</div>
                <div className="stat-desc">21% more than last month</div>
              </div>

              <div className="stat">
                <div className="stat-figure text-secondary">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-8 h-8 stroke-current">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                  </svg>
                </div>
                <div className="stat-title">Page Views</div>
                <div className="stat-value text-secondary">2.6M</div>
                <div className="stat-desc">21% more than last month</div>
              </div>

              <div className="stat">
                <div className="stat-figure text-secondary">
                  <div className="avatar online">
                    <div className="w-16 rounded-full">
                      <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center text-accent-content font-bold text-xl">
                        U
                      </div>
                    </div>
                  </div>
                </div>
                <div className="stat-value">86%</div>
                <div className="stat-title">Tasks done</div>
                <div className="stat-desc text-secondary">31 tasks remaining</div>
              </div>
            </div>
          </div>
        )}

        {/* Forms Tab */}
        {selectedTab === 'forms' && (
          <div className="space-y-8">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Form Elements</h2>
                
                {/* Input Fields */}
                <div className="form-control w-full max-w-xs">
                  <label className="label">
                    <span className="label-text">What is your name?</span>
                  </label>
                  <input type="text" placeholder="Type here" className="input input-bordered w-full max-w-xs" />
                  <label className="label">
                    <span className="label-text-alt">Bottom Left label</span>
                    <span className="label-text-alt">Bottom Right label</span>
                  </label>
                </div>

                {/* Select */}
                <div className="form-control w-full max-w-xs">
                  <label className="label">
                    <span className="label-text">Pick your favorite</span>
                  </label>
                  <select className="select select-bordered">
                    <option disabled selected>Pick one</option>
                    <option>Star Wars</option>
                    <option>Harry Potter</option>
                    <option>Lord of the Rings</option>
                    <option>Planet of the Apes</option>
                    <option>Star Trek</option>
                  </select>
                </div>

                {/* Textarea */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Your bio</span>
                  </label>
                  <textarea className="textarea textarea-bordered h-24" placeholder="Bio"></textarea>
                </div>

                {/* Checkboxes */}
                <div className="form-control">
                  <label className="label cursor-pointer">
                    <span className="label-text">Remember me</span>
                    <input type="checkbox" defaultChecked className="checkbox" />
                  </label>
                </div>

                {/* Radio Buttons */}
                <div className="form-control">
                  <label className="label cursor-pointer">
                    <span className="label-text">Red pill</span>
                    <input type="radio" name="radio-10" className="radio checked:bg-red-500" defaultChecked />
                  </label>
                </div>
                <div className="form-control">
                  <label className="label cursor-pointer">
                    <span className="label-text">Blue pill</span>
                    <input type="radio" name="radio-10" className="radio checked:bg-blue-500" />
                  </label>
                </div>

                {/* Range */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Range</span>
                  </label>
                  <input type="range" min={0} max="100" defaultValue="40" className="range" />
                  <div className="w-full flex justify-between text-xs px-2">
                    <span>0</span>
                    <span>25</span>
                    <span>50</span>
                    <span>75</span>
                    <span>100</span>
                  </div>
                </div>

                {/* Toggle */}
                <div className="form-control">
                  <label className="label cursor-pointer">
                    <span className="label-text">Remember me</span>
                    <input type="checkbox" className="toggle" defaultChecked />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feedback Tab */}
        {selectedTab === 'feedback' && (
          <div className="space-y-8">
            {/* Alerts */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Alerts</h2>
                <div className="space-y-4">
                  <div className="alert alert-info">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span>New software update available.</span>
                  </div>
                  <div className="alert alert-success">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Your purchase has been confirmed!</span>
                  </div>
                  <div className="alert alert-warning">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span>Warning: Invalid email address!</span>
                  </div>
                  <div className="alert alert-error">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Error! Task failed successfully.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Loading */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Loading</h2>
                <div className="flex items-center gap-4">
                  <span className="loading loading-spinner"></span>
                  <span className="loading loading-dots loading-lg"></span>
                  <span className="loading loading-ring loading-lg"></span>
                  <span className="loading loading-ball loading-lg"></span>
                  <span className="loading loading-bars loading-lg"></span>
                  <span className="loading loading-infinity loading-lg"></span>
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Progress</h2>
                <div className="space-y-4">
                  <progress className="progress w-56"></progress>
                  <progress className="progress progress-primary w-56" value={32} max="100"></progress>
                  <progress className="progress progress-secondary w-56" value={70} max="100"></progress>
                  <progress className="progress progress-accent w-56" value={40} max="100"></progress>
                  <progress className="progress progress-info w-56" value={25} max="100"></progress>
                  <progress className="progress progress-success w-56" value={85} max="100"></progress>
                  <progress className="progress progress-warning w-56" value={60} max="100"></progress>
                  <progress className="progress progress-error w-56" value={15} max="100"></progress>
                </div>
              </div>
            </div>

            {/* Toast */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Toast</h2>
                <p>Toast notifications appear at the bottom-right corner.</p>
                <div className="toast toast-top toast-end">
                  <div className="alert alert-info">
                    <span>New message arrived.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Badges */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Badges</h2>
                <div className="flex flex-wrap gap-2">
                  <div className="badge">default</div>
                  <div className="badge badge-neutral">neutral</div>
                  <div className="badge badge-primary">primary</div>
                  <div className="badge badge-secondary">secondary</div>
                  <div className="badge badge-accent">accent</div>
                  <div className="badge badge-ghost">ghost</div>
                  <div className="badge badge-info">info</div>
                  <div className="badge badge-success">success</div>
                  <div className="badge badge-warning">warning</div>
                  <div className="badge badge-error">error</div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <div className="badge badge-outline">outline</div>
                  <div className="badge badge-primary badge-outline">primary</div>
                  <div className="badge badge-secondary badge-outline">secondary</div>
                  <div className="badge badge-accent badge-outline">accent</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Hello!</h3>
            <p className="py-4">This is a DaisyUI modal. Press ESC key or click the button below to close</p>
            <div className="modal-action">
              <button className="btn" onClick={() => setModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer */}
      <div className={`drawer ${drawerOpen ? 'drawer-open' : ''}`}>
        <input type="checkbox" className="drawer-toggle" checked={drawerOpen} readOnly />
        <div className="drawer-side">
          <label className="drawer-overlay" onClick={() => setDrawerOpen(false)}></label>
          <aside className="w-80 min-h-full bg-base-200 text-base-content">
            <div className="p-4">
              <h2 className="text-lg font-bold mb-4">Drawer Content</h2>
              <ul className="menu">
                <li><a>Sidebar Item 1</a></li>
                <li><a>Sidebar Item 2</a></li>
                <li>
                  <details open>
                    <summary>Parent</summary>
                    <ul>
                      <li><a>Submenu 1</a></li>
                      <li><a>Submenu 2</a></li>
                    </ul>
                  </details>
                </li>
              </ul>
              <button className="btn btn-primary mt-4" onClick={() => setDrawerOpen(false)}>
                Close Drawer
              </button>
            </div>
          </aside>
        </div>
      </div>

      {/* Back to home */}
      <div className="fixed bottom-4 left-4">
        <a href="/" className="btn btn-primary">
          ← Back to Home
        </a>
      </div>
    </div>
  );
}