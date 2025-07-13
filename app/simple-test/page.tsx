'use client';

// Create: app/simple-test/page.tsx
export default function SimpleDaisyUITest() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-8">DaisyUI Simple Test</h1>
      
      {/* Basic test - should be colorful if DaisyUI works */}
      <div className="space-y-4">
        <button className="btn btn-primary">Primary Button</button>
        <button className="btn btn-secondary">Secondary Button</button>
        <button className="btn btn-accent">Accent Button</button>
        
        <div className="alert alert-success">
          <span>Success! DaisyUI is working if this is green.</span>
        </div>
        
        <div className="card w-96 bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Card Title</h2>
            <p>If this card has styling, DaisyUI is working!</p>
          </div>
        </div>
      </div>
      
      {/* Theme test */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Theme Test</h2>
        <button 
          className="btn btn-outline mr-2"
          onClick={() => document.documentElement.setAttribute('data-theme', 'light')}
        >
          Light Theme
        </button>
        <button 
          className="btn btn-outline mr-2"
          onClick={() => document.documentElement.setAttribute('data-theme', 'dark')}
        >
          Dark Theme
        </button>
        <button 
          className="btn btn-outline"
          onClick={() => document.documentElement.setAttribute('data-theme', 'winter')}
        >
          Winter Theme
        </button>
      </div>
    </div>
  );
}