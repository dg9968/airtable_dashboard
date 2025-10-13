// Create: app/theme-test/page.tsx
'use client';

import { useState } from 'react';

export default function ThemeTest() {
  const [currentTheme, setCurrentTheme] = useState('cupcake');

  const themes = [
    "light", "dark", "cupcake", "bumblebee", "emerald", "corporate",
    "synthwave", "retro", "cyberpunk", "valentine", "halloween", "garden",
    "forest", "aqua", "lofi", "pastel", "fantasy", "wireframe", "black",
    "luxury", "dracula", "cmyk", "autumn", "business", "acid", "lemonade",
    "night", "coffee", "winter"
  ];

  const changeTheme = (theme: string) => {
    setCurrentTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);
  };

  return (
    <div className="min-h-screen bg-base-200 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">DaisyUI Theme Test</h1>
        
        <div className="alert alert-info mb-8">
          <span>Current theme: <strong>{currentTheme}</strong></span>
        </div>

        {/* Theme Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
          {themes.map((theme) => (
            <button
              key={theme}
              onClick={() => changeTheme(theme)}
              className={`btn btn-sm ${
                currentTheme === theme ? 'btn-primary' : 'btn-outline'
              }`}
            >
              {theme}
            </button>
          ))}
        </div>

        {/* Test Components */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Color Test</h2>
              <div className="space-y-2">
                <button className="btn btn-primary w-full">Primary</button>
                <button className="btn btn-secondary w-full">Secondary</button>
                <button className="btn btn-accent w-full">Accent</button>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="card bg-primary text-primary-content shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Primary Card</h2>
              <p>This card uses the primary theme colors.</p>
              <div className="badge badge-secondary">Badge</div>
            </div>
          </div>

          {/* Card 3 */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Alerts</h2>
              <div className="alert alert-success alert-sm">
                <span>Success message</span>
              </div>
              <div className="alert alert-warning alert-sm">
                <span>Warning message</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stats shadow w-full mt-8">
          <div className="stat">
            <div className="stat-title">Theme</div>
            <div className="stat-value text-primary">{currentTheme}</div>
            <div className="stat-desc">Currently active</div>
          </div>
          
          <div className="stat">
            <div className="stat-title">Total Themes</div>
            <div className="stat-value text-secondary">{themes.length}</div>
            <div className="stat-desc">Available themes</div>
          </div>
        </div>

        {/* Progress indicators */}
        <div className="mt-8 space-y-2">
          <progress className="progress progress-primary w-full" value={70} max="100"></progress>
          <progress className="progress progress-secondary w-full" value={50} max="100"></progress>
          <progress className="progress progress-accent w-full" value={30} max="100"></progress>
        </div>
      </div>
    </div>
  );
}