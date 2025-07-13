// Create: app/simple-theme-test/page.tsx
'use client';

export default function SimpleThemeTest() {
  const applyTheme = (theme: string) => {
    console.log(`Applying theme: ${theme}`);
    document.documentElement.setAttribute('data-theme', theme);
    
    // Force a re-check of CSS variables
    setTimeout(() => {
      const styles = getComputedStyle(document.documentElement);
      const primary = styles.getPropertyValue('--p');
      const secondary = styles.getPropertyValue('--s');
      
      console.log(`After applying ${theme}:`);
      console.log(`--p: ${primary}`);
      console.log(`--s: ${secondary}`);
      
      if (!primary) {
        console.error(`Theme ${theme} not found in CSS!`);
      } else {
        console.log(`Theme ${theme} applied successfully!`);
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-base-200 p-8">
      <h1 className="text-4xl font-bold mb-8">Simple Theme Test</h1>
      
      <div className="space-y-4 mb-8">
        <button 
          className="btn btn-primary mr-4"
          onClick={() => applyTheme('light')}
        >
          Light Theme
        </button>
        <button 
          className="btn btn-primary mr-4"
          onClick={() => applyTheme('dark')}
        >
          Dark Theme
        </button>
        <button 
          className="btn btn-primary mr-4"
          onClick={() => applyTheme('cupcake')}
        >
          Cupcake Theme
        </button>
        <button 
          className="btn btn-primary mr-4"
          onClick={() => applyTheme('synthwave')}
        >
          Synthwave Theme
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Test Card</h2>
            <p>This should change colors with themes</p>
            <div className="card-actions justify-end">
              <button className="btn btn-primary">Primary</button>
              <button className="btn btn-secondary">Secondary</button>
            </div>
          </div>
        </div>

        <div className="card bg-primary text-primary-content shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Primary Card</h2>
            <p>This uses primary theme colors</p>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="alert alert-info">
          <span>Open browser console (F12) to see debug information</span>
        </div>
      </div>
    </div>
  );
}