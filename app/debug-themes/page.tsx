'use client';

import { useState, useEffect } from 'react';

export default function ThemeDebugTool() {
  const [currentTheme, setCurrentTheme] = useState('dark');
  const [appliedTheme, setAppliedTheme] = useState('loading...');
  const [isMounted, setIsMounted] = useState(false);

  const themes = [
    'light', 'dark', 'cupcake', 'bumblebee', 'emerald', 'corporate',
    'synthwave', 'retro', 'cyberpunk', 'valentine', 'halloween', 'garden',
    'forest', 'aqua', 'lofi', 'pastel', 'fantasy', 'wireframe', 'black',
    'luxury', 'dracula', 'cmyk', 'autumn', 'business', 'acid', 'lemonade',
    'night', 'coffee', 'winter'
  ];

  useEffect(() => {
    setIsMounted(true);
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setCurrentTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
    setAppliedTheme(document.documentElement.getAttribute('data-theme') || 'none');
  }, []);

  const changeTheme = (theme: string) => {
    console.log(`Changing to theme: ${theme}`);
    setCurrentTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    setAppliedTheme(theme);
    
    // Debug: Log the actual data-theme attribute
    setTimeout(() => {
      const actualTheme = document.documentElement.getAttribute('data-theme');
      console.log(`Current data-theme attribute: ${actualTheme}`);
      
      // Debug: Log some CSS variables
      const styles = getComputedStyle(document.documentElement);
      console.log('CSS Variables:', {
        primary: styles.getPropertyValue('--p'),
        secondary: styles.getPropertyValue('--s'),
        accent: styles.getPropertyValue('--a'),
        base100: styles.getPropertyValue('--b1'),
      });
    }, 100);
  };

  // Don't render dynamic content until mounted to prevent hydration mismatch
  if (!isMounted) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Theme Debug Tool</h1>
          <div className="loading loading-spinner loading-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Theme Debug Tool</h1>
        
        {/* System Info Card */}
        <div className="card bg-base-100 shadow-xl mb-8">
          <div className="card-body">
            <h2 className="card-title">System Information</h2>
            <div className="space-y-2 text-sm">
              <p><strong>Current Theme:</strong> {currentTheme}</p>
              <p><strong>Applied data-theme:</strong> {appliedTheme}</p>
              <p><strong>DaisyUI Version:</strong> 5.0.46</p>
              <p><strong>Environment:</strong> Client-side rendered</p>
            </div>
          </div>
        </div>

        {/* Theme Grid */}
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4">Available Themes</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {themes.map((theme) => (
              <button
                key={theme}
                onClick={() => changeTheme(theme)}
                className={`btn btn-sm ${currentTheme === theme ? 'btn-primary' : 'btn-outline'}`}
              >
                {theme}
              </button>
            ))}
          </div>
        </div>

        {/* Color Test */}
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4">Color Test</h3>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary">Primary</button>
            <button className="btn btn-secondary">Secondary</button>
            <button className="btn btn-accent">Accent</button>
            <button className="btn btn-info">Info</button>
            <button className="btn btn-success">Success</button>
            <button className="btn btn-warning">Warning</button>
            <button className="btn btn-error">Error</button>
          </div>
        </div>

        {/* Background Test */}
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4">Background Test</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h4 className="card-title">Base-100</h4>
                <p>This should show the primary background color</p>
              </div>
            </div>
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <h4 className="card-title">Base-200</h4>
                <p>This should show a slightly different background</p>
              </div>
            </div>
            <div className="card bg-base-300 shadow-xl">
              <div className="card-body">
                <h4 className="card-title">Base-300</h4>
                <p>This should show an even more different background</p>
              </div>
            </div>
          </div>
        </div>

        {/* Cupcake Specific Test */}
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4">Cupcake Theme Specific Test</h3>
          <div className="alert alert-warning mb-4">
            <span>Click "cupcake" above and see if these colors change to pink/pastel tones</span>
          </div>
          
          <div className="space-y-4">
            <div className="bg-primary text-primary-content p-4 rounded">
              Primary color - Should be pink in cupcake theme
            </div>
            <div className="bg-secondary text-secondary-content p-4 rounded">
              Secondary color - Should be teal in cupcake theme
            </div>
            <div className="bg-accent text-accent-content p-4 rounded">
              Accent color - Should be violet in cupcake theme
            </div>
          </div>
        </div>

        {/* CSS Debug Info */}
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4">CSS Debug (Check Console)</h3>
          <button 
            className="btn btn-outline"
            onClick={() => {
              const styles = getComputedStyle(document.documentElement);
              console.log('All CSS Custom Properties:', {
                '--p': styles.getPropertyValue('--p'),
                '--pc': styles.getPropertyValue('--pc'),
                '--s': styles.getPropertyValue('--s'),
                '--sc': styles.getPropertyValue('--sc'),
                '--a': styles.getPropertyValue('--a'),
                '--ac': styles.getPropertyValue('--ac'),
                '--b1': styles.getPropertyValue('--b1'),
                '--b2': styles.getPropertyValue('--b2'),
                '--b3': styles.getPropertyValue('--b3'),
                '--bc': styles.getPropertyValue('--bc'),
              });
            }}
          >
            Log CSS Variables to Console
          </button>
        </div>

        {/* Manual cupcake test */}
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4">Manual Cupcake Test</h3>
          <button 
            className="btn btn-primary mr-2"
            onClick={() => {
              document.documentElement.setAttribute('data-theme', 'cupcake');
              setAppliedTheme('cupcake');
              setTimeout(() => {
                const actualTheme = document.documentElement.getAttribute('data-theme');
                alert(`Theme set to: ${actualTheme}`);
              }, 100);
            }}
          >
            Force Cupcake Theme
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => {
              document.documentElement.removeAttribute('data-theme');
              setAppliedTheme('removed');
              setTimeout(() => {
                const actualTheme = document.documentElement.getAttribute('data-theme');
                alert(`Theme attribute: ${actualTheme || 'removed'}`);
              }, 100);
            }}
          >
            Remove Theme Attribute
          </button>
        </div>

        <div className="text-sm opacity-70">
          <p>Open browser console (F12) to see debug information when switching themes.</p>
        </div>
      </div>
    </div>
  );
}