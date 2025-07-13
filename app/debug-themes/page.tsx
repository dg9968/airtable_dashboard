// Create: app/debug-themes/page.tsx
'use client';

import { useState, useEffect } from 'react';

export default function ThemeDebugTool() {
  const [currentTheme, setCurrentTheme] = useState('light');
  const [cssVariables, setCssVariables] = useState<Record<string, string>>({});
  const [appliedTheme, setAppliedTheme] = useState('');

  const themes = [
    "light", "dark", "cupcake", "bumblebee", "emerald", "corporate",
    "synthwave", "retro", "cyberpunk", "valentine", "halloween", "garden",
  ];

  const changeTheme = (theme: string) => {
    console.log(`🎨 Attempting to change theme to: ${theme}`);
    setCurrentTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);
    
    // Check if the attribute was actually set
    setTimeout(() => {
      const actualTheme = document.documentElement.getAttribute('data-theme');
      setAppliedTheme(actualTheme || 'none');
      console.log(`✅ Theme attribute set to: ${actualTheme}`);
      
      // Check CSS variables
      const styles = getComputedStyle(document.documentElement);
      const vars = {
        '--p': styles.getPropertyValue('--p'),
        '--s': styles.getPropertyValue('--s'),
        '--a': styles.getPropertyValue('--a'),
        '--b1': styles.getPropertyValue('--b1'),
        '--b2': styles.getPropertyValue('--b2'),
        '--b3': styles.getPropertyValue('--b3'),
      };
      setCssVariables(vars);
      
      console.log('🎨 CSS Variables:', vars);
      
      // Test if theme-specific classes exist
      const testElement = document.createElement('div');
      testElement.className = 'btn btn-primary';
      document.body.appendChild(testElement);
      const computedStyles = getComputedStyle(testElement);
      console.log('🧪 Button primary color:', computedStyles.backgroundColor);
      document.body.removeChild(testElement);
    }, 100);
  };

  useEffect(() => {
    // Check initial state
    const initialTheme = document.documentElement.getAttribute('data-theme');
    setAppliedTheme(initialTheme || 'none');
    console.log('🏁 Initial theme:', initialTheme);
  }, []);

  return (
    <div className="min-h-screen bg-base-200 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">DaisyUI Theme Debug Tool</h1>
        
        {/* Debug Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Debug Information</h2>
              <div className="space-y-2 text-sm">
                <p><strong>Selected Theme:</strong> {currentTheme}</p>
                <p><strong>Applied data-theme:</strong> {appliedTheme}</p>
                <p><strong>DaisyUI Version:</strong> 5.0.46</p>
                <p><strong>Tailwind Build:</strong> {typeof window !== 'undefined' ? 'Client' : 'Server'}</p>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">CSS Variables</h2>
              <div className="space-y-1 text-xs font-mono">
                {Object.entries(cssVariables).map(([key, value]) => (
                  <p key={key}>
                    <span className="text-primary">{key}:</span> {value || 'not set'}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Theme Buttons */}
        <div className="card bg-base-100 shadow-xl mb-8">
          <div className="card-body">
            <h2 className="card-title">Theme Selector</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
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
          </div>
        </div>

        {/* Color Test Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Primary Colors */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title text-lg">Primary Colors</h3>
              <div className="space-y-2">
                <button className="btn btn-primary w-full">Primary</button>
                <button className="btn btn-secondary w-full">Secondary</button>
                <button className="btn btn-accent w-full">Accent</button>
              </div>
            </div>
          </div>

          {/* Status Colors */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title text-lg">Status Colors</h3>
              <div className="space-y-2">
                <button className="btn btn-info w-full">Info</button>
                <button className="btn btn-success w-full">Success</button>
                <button className="btn btn-warning w-full">Warning</button>
                <button className="btn btn-error w-full">Error</button>
              </div>
            </div>
          </div>

          {/* Background Test */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title text-lg">Backgrounds</h3>
              <div className="space-y-2">
                <div className="bg-base-200 p-2 rounded text-center">Base-200</div>
                <div className="bg-base-300 p-2 rounded text-center">Base-300</div>
                <div className="bg-neutral p-2 rounded text-center text-neutral-content">Neutral</div>
              </div>
            </div>
          </div>
        </div>

        {/* Live CSS Test */}
        <div className="card bg-base-100 shadow-xl mb-8">
          <div className="card-body">
            <h3 className="card-title">Live CSS Test</h3>
            <p className="text-sm mb-4">These colors should change dramatically between themes:</p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Color swatches that should change with themes */}
              <div className="text-center">
                <div 
                  className="w-16 h-16 mx-auto rounded-lg mb-2"
                  style={{ backgroundColor: 'hsl(var(--p))' }}
                ></div>
                <p className="text-xs">Primary</p>
              </div>
              
              <div className="text-center">
                <div 
                  className="w-16 h-16 mx-auto rounded-lg mb-2"
                  style={{ backgroundColor: 'hsl(var(--s))' }}
                ></div>
                <p className="text-xs">Secondary</p>
              </div>
              
              <div className="text-center">
                <div 
                  className="w-16 h-16 mx-auto rounded-lg mb-2"
                  style={{ backgroundColor: 'hsl(var(--a))' }}
                ></div>
                <p className="text-xs">Accent</p>
              </div>
              
              <div className="text-center">
                <div 
                  className="w-16 h-16 mx-auto rounded-lg mb-2"
                  style={{ backgroundColor: 'hsl(var(--b1))' }}
                ></div>
                <p className="text-xs">Base</p>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="alert alert-info">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <h3 className="font-bold">Debug Instructions:</h3>
            <p className="text-sm">
              1. Open browser console (F12) to see debug logs<br/>
              2. Click different themes and watch the color swatches<br/>
              3. If only light/dark work, the issue is in your Tailwind build<br/>
              4. Check if CSS variables change when switching themes
            </p>
          </div>
        </div>

        {/* Manual CSS Override Test */}
        <div className="card bg-base-100 shadow-xl mt-8">
          <div className="card-body">
            <h3 className="card-title">Manual Override Test</h3>
            <p className="text-sm mb-4">Click to manually force cupcake theme CSS variables:</p>
            <button 
              className="btn btn-outline"
              onClick={() => {
                // Manually set cupcake theme variables
                const root = document.documentElement;
                root.style.setProperty('--p', '327 73% 84%');  // Pink
                root.style.setProperty('--s', '180 81% 69%');  // Teal  
                root.style.setProperty('--a', '271 91% 84%');  // Purple
                root.style.setProperty('--b1', '323 14% 96%'); // Light pink base
                console.log('🎨 Manually applied cupcake colors');
                
                // Re-check variables
                setTimeout(() => {
                  const styles = getComputedStyle(document.documentElement);
                  const vars = {
                    '--p': styles.getPropertyValue('--p'),
                    '--s': styles.getPropertyValue('--s'),
                    '--a': styles.getPropertyValue('--a'),
                    '--b1': styles.getPropertyValue('--b1'),
                  };
                  setCssVariables(vars);
                }, 100);
              }}
            >
              Force Cupcake Colors
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}