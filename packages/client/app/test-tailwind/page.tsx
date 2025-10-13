// Create a test file: app/test-tailwind/page.tsx
export default function TailwindTest() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md">
        <h1 className="text-4xl font-bold text-gray-800 mb-6 text-center">
          Tailwind CSS Test
        </h1>
        
        <div className="space-y-4">
          <div className="bg-red-500 text-white p-4 rounded-lg">
            ✅ If you see this red box, Tailwind is working!
          </div>
          
          <div className="bg-green-500 text-white p-4 rounded-lg">
            ✅ Green box = Tailwind colors work
          </div>
          
          <div className="bg-blue-500 text-white p-4 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
            ✅ Hover me = Tailwind interactions work
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-yellow-400 h-12 rounded"></div>
            <div className="bg-pink-400 h-12 rounded"></div>
            <div className="bg-indigo-400 h-12 rounded"></div>
          </div>
          
          <p className="text-sm text-gray-600 text-center">
            If everything above looks colorful and styled, Tailwind is working correctly!
          </p>
        </div>
        
        <button className="w-full mt-6 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
          Test Button
        </button>
      </div>
    </div>
  )
}