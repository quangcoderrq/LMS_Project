import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  illustration?: React.ReactNode;
  showBackButton?: boolean;
  onBackClick?: () => void;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
  illustration,
  showBackButton = false,
  onBackClick
}) => {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Form (60-65% width) */}
      <div className="flex-1 lg:flex-[0.6] flex items-center justify-center px-6 lg:px-12 py-8">
        <div className="w-full max-w-md">
          {/* Back button */}
          {showBackButton && (
            <button
              onClick={onBackClick}
              className="mb-8 flex items-center text-gray-600 hover:text-gray-800 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          )}

          {/* Title and subtitle */}
          <div className="mb-8">
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-3">{title}</h1>
            <p className="text-gray-600 text-lg">{subtitle}</p>
          </div>

          {/* Form */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            {children}
          </div>

          {/* Language selector */}
          <div className="mt-8 flex items-center text-gray-500 text-sm">
            <img src="https://flagcdn.com/w20/gb.png" alt="English" className="w-5 h-4 mr-2" />
            <span>ENG</span>
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Right side - Illustration (35-40% width) */}
      <div className="hidden lg:flex flex-[0.4] items-center justify-center p-8 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600"></div>
        
        {/* Abstract shapes */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-blue-500 rounded-full opacity-20"></div>
        <div className="absolute bottom-20 right-10 w-24 h-24 bg-purple-500 rounded-full opacity-30"></div>
        <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-indigo-400 rounded-full opacity-25"></div>
        
        {/* Illustration content */}
        <div className="relative z-10 w-full max-w-sm">
          {illustration}
        </div>
      </div>
    </div>
  );
};
