import ElectricBorder from "../../components/effects/ElectricBorder"
import { useNavigate } from 'react-router-dom'

function NotFound() {
  const navigate = useNavigate();

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <ElectricBorder
        color="#7df9ff"
        speed={1}
        chaos={0.5}
        thickness={2}
        style={{ borderRadius: 16 }}
        className="w-full max-w-md"

>
        <div className="bg-gray-800 p-8 rounded-2xl">
          {/* Featured Tag */}
          <div className="inline-block bg-gray-700 text-white text-xs font-medium px-3 py-1 rounded-lg mb-4">
            Error
          </div>
          
          {/* Main Title */}
          <h1 className="text-6xl font-bold text-white mb-4">
            404
          </h1>
          
          {/* Description */}
          <p className="text-gray-400 mb-8">
            Page Not Found.
          </p>
          
          {/* CTA Button */}
          <div className="flex justify-center">
            <button 
              onClick={handleGoBack}
              className="bg-gradient-to-r from-blue-400 to-white text-gray-800 font-semibold px-8 py-3 rounded-xl hover:from-blue-300 hover:to-gray-100 transition-all duration-200 inline-block cursor-pointer"
            >
              Go Back
            </button>
          </div>
        </div>
      </ElectricBorder>
    </div>
  );
}

export default NotFound;
