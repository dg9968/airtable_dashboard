// components/ThemeForcer.tsx
export default function ThemeForcer() {
  return (
    <div className="hidden">
      {/* Force DaisyUI to include these themes in build */}
      <div data-theme="light" className="btn btn-primary"></div>
      <div data-theme="dark" className="btn btn-primary"></div>
      <div data-theme="cupcake" className="btn btn-primary"></div>
      <div data-theme="synthwave" className="btn btn-primary"></div>
      <div data-theme="cyberpunk" className="btn btn-primary"></div>
    </div>
  );
}