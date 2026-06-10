import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { authService } from "../../services";
import { useTheme } from "../../hooks/useTheme";

const ResetPasswordPage: React.FC = () => {
  const { darkMode } = useTheme();
  const { code } = useParams<{ code: string }>();
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const validatePassword = (password: string) => {
    const hasMinLength = password.length >= 8;
    const hasNumberOrSymbol = /[0-9!@#$%^&*(),.?":{}|<>]/.test(password);
    const hasUpperAndLower = /[a-z]/.test(password) && /[A-Z]/.test(password);
    
    return { hasMinLength, hasNumberOrSymbol, hasUpperAndLower };
  };

  const passwordValidation = validatePassword(formData.password);
  const isPasswordValid = passwordValidation.hasMinLength && passwordValidation.hasNumberOrSymbol && passwordValidation.hasUpperAndLower;
  const isFormValid = isPasswordValid && formData.password === formData.confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!code) {
      setError("Invalid reset link. Please request a new password reset.");
      setLoading(false);
      return;
    }

    try {
      await authService.resetPassword(code, formData.password);
      setIsSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Password reset failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    // Navigate back to login
    window.location.href = "/login";
  };

  if (isSuccess) {
    return (
      <div 
        className="auth-container flex items-center justify-center p-4 transition-colors duration-300"
        style={{
          backgroundColor: darkMode ? '#111827' : undefined,
          color: darkMode ? '#ffffff' : undefined,
        }}
      >
        <div 
          className="auth-card max-w-4xl w-full overflow-hidden transition-colors duration-300"
          style={{
            backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: darkMode ? 'rgba(75, 85, 99, 0.2)' : 'rgba(255, 255, 255, 0.2)',
          }}
        >
          <div className="flex flex-col md:flex-row min-h-[560px]">
            {/* Left Side - Success Message */}
            <div className="flex-1 p-8 flex items-center">
              <div className="max-w-md mx-auto w-full">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                  <button 
                    className="transition-colors duration-200 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                    style={{
                      color: darkMode ? '#d1d5db' : '#6b7280',
                    }}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div 
                    className="text-sm"
                    style={{
                      color: darkMode ? '#d1d5db' : '#6b7280',
                    }}
                  >
                    Already member?{" "}
                    <Link 
                      to="/login" 
                      className="font-medium transition-colors duration-200"
                      style={{
                        color: darkMode ? '#60a5fa' : '#2563eb',
                      }}
                    >
                      Sign in
                    </Link>
                  </div>
                </div>

                {/* Title */}
                <div className="mb-6">
                  <h1 
                    className="text-3xl font-bold mb-2"
                    style={{
                      color: darkMode ? '#d1d5db' : '#6b7280',
                    }}
                  >
                    Password Reset Successfully!
                  </h1>
                  <p 
                    style={{
                      color: darkMode ? '#d1d5db' : '#6b7280',
                    }}
                  >
                    Your password has been updated. You can now sign in with your new password.
                  </p>
                </div>

                {/* Success Content */}
                <div className="text-center">
                  <div className="w-20 h-20 bg-green-100 rounded-full mx-auto mb-6 flex items-center justify-center">
                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  
                  <h3 
                    className="text-xl font-semibold mb-2"
                    style={{
                      color: darkMode ? '#ffffff' : '#1f2937',
                    }}
                  >
                    All Set!
                  </h3>
                  <p 
                    className="mb-6"
                    style={{
                      color: darkMode ? '#d1d5db' : '#6b7280',
                    }}
                  >
                    Your password has been successfully updated. You can now sign in with your new password.
                  </p>
                  
                  <button
                    onClick={handleBackToLogin}
                    className="auth-button w-full text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center"
                  >
                    Sign In Now
                    <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* Language Selector */}
                <div className="flex items-center justify-start mt-6">
                  <div 
                    className="flex items-center space-x-2 transition-colors duration-200 cursor-pointer"
                    style={{
                      color: darkMode ? '#d1d5db' : '#6b7280',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = darkMode ? '#ffffff' : '#374151';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = darkMode ? '#d1d5db' : '#6b7280';
                    }}
                  >
                    <span className="text-2xl">🇬🇧</span>
                    <span className="text-sm font-medium">ENG</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Illustrative Content */}
            <div className="gradient-bg hidden md:flex md:flex-1 p-12 relative overflow-hidden items-center">
              {/* Same illustration as reset password form */}
              <div className="absolute inset-0">
                <div className="floating-element absolute top-20 left-10 w-24 h-24 bg-white/10 rounded-full"></div>
                <div className="floating-element absolute top-40 right-16 w-20 h-20 bg-white/5 rounded-full"></div>
                <div className="floating-element absolute bottom-32 left-20 w-32 h-32 bg-white/8 rounded-full"></div>
                <div className="floating-element absolute bottom-20 right-20 w-16 h-16 bg-white/15 rounded-full"></div>
              </div>
              
              <div className="relative z-10 space-y-10 w-full">
                <div className="floating-card rounded-3xl p-10 shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <div className="text-lg font-medium text-white/80">New Password</div>
                    <div className="w-4 h-4 bg-blue-400 rounded-full animate-pulse"></div>
                  </div>
                  <div className="text-5xl font-bold text-white mb-8">98%</div>
                  <div className="relative h-24">
                    <svg className="w-full h-full wave-animation" viewBox="0 0 300 100">
                      <defs>
                        <linearGradient id="wave1" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#f97316" />
                          <stop offset="100%" stopColor="#fb923c" />
                        </linearGradient>
                        <linearGradient id="wave2" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#60a5fa" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0,60 Q75,30 150,50 T300,40"
                        stroke="url(#wave1)"
                        strokeWidth="5"
                        fill="none"
                      />
                      <path
                        d="M0,70 Q75,40 150,60 T300,50"
                        stroke="url(#wave2)"
                        strokeWidth="5"
                        fill="none"
                      />
                      <circle cx="150" cy="45" r="12" fill="white" className="drop-shadow-lg">
                        <animate attributeName="cy" values="45;40;45" dur="2s" repeatCount="indefinite"/>
                      </circle>
                      <text x="150" y="50" textAnchor="middle" className="text-sm font-bold fill-gray-800">98</text>
                    </svg>
                  </div>
                </div>

                <div className="floating-card rounded-3xl p-10 shadow-2xl">
                  <div className="flex items-start space-x-6">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center">
                        <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-white text-xl mb-3">Your data, your rules</h3>
                      <p className="text-white/80 text-base leading-relaxed">
                        Full control over your account with advanced security
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute top-12 right-12 space-y-6">
                <div className="floating-element w-16 h-16 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.746-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24.009 12.017 24.009c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z"/>
                  </svg>
                </div>
                <div className="floating-element w-16 h-16 bg-black rounded-full flex items-center justify-center shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.78-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.08-2.03-1.25-3.33-3.13-3.73-5.38C.94 13.39.99 12.7.99 12c0-.7-.05-1.39-.1-2.08.4-2.25 1.7-4.13 3.73-5.38 1.22-.77 2.65-1.16 4.08-1.08 2.33.04 4.6 1.29 5.91 3.21.81 1.16 1.27 2.54 1.35 3.94-.03-2.91-.01-5.83-.02-8.75z"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="auth-container flex items-center justify-center p-4 transition-colors duration-300"
      style={{
        backgroundColor: darkMode ? '#111827' : undefined,
        color: darkMode ? '#ffffff' : undefined,
      }}
    >
      <div 
        className="auth-card max-w-4xl w-full overflow-hidden transition-colors duration-300"
        style={{
          backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderColor: darkMode ? 'rgba(75, 85, 99, 0.2)' : 'rgba(255, 255, 255, 0.2)',
        }}
      >
        <div className="flex flex-col md:flex-row min-h-[560px]">
          {/* Left Side - Reset Password Form */}
          <div className="flex-1 p-8 flex items-center">
            <div className="max-w-md mx-auto w-full">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <button className="text-gray-600 hover:text-gray-800 transition-colors duration-200 p-2 rounded-full hover:bg-gray-100">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="text-sm text-gray-600">
                  Already member?{" "}
                  <Link to="/login" className="text-blue-600 hover:text-blue-800 font-medium transition-colors duration-200">
                    Sign in
                  </Link>
                </div>
              </div>

              {/* Title */}
              <div className="mb-6">
                <h1 
                  className="text-3xl font-bold mb-2"
                  style={{
                    color: darkMode ? '#d1d5db' : '#6b7280',
                  }}
                >
                  Reset Password
                </h1>
                <p 
                  style={{
                    color: darkMode ? '#d1d5db' : '#6b7280',
                  }}
                >
                  Enter your new password below
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Password Field */}
                <div className="form-group">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="auth-input w-full pl-12 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-300"
                      style={{
                        backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                        borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(209, 213, 219, 0.3)',
                        color: darkMode ? '#ffffff' : '#000000',
                      }}
                      placeholder="Enter new password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center hover:bg-gray-50 rounded-r-lg transition-colors duration-200"
                    >
                      {showPassword ? (
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  
                  {/* Password Requirements */}
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center text-sm">
                      <div className={`w-3 h-3 rounded-full mr-3 transition-all duration-300 ${passwordValidation.hasMinLength ? 'bg-green-500 scale-110' : 'bg-gray-300'}`}></div>
                      <span 
                        className={`transition-colors duration-300 ${passwordValidation.hasMinLength ? 'font-medium' : ''}`}
                        style={{
                          color: passwordValidation.hasMinLength ? (darkMode ? '#10b981' : '#059669') : (darkMode ? '#6b7280' : '#9ca3af'),
                        }}
                      >
                        Least 8 characters
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <div className={`w-3 h-3 rounded-full mr-3 transition-all duration-300 ${passwordValidation.hasNumberOrSymbol ? 'bg-green-500 scale-110' : 'bg-gray-300'}`}></div>
                      <span 
                        className={`transition-colors duration-300 ${passwordValidation.hasNumberOrSymbol ? 'font-medium' : ''}`}
                        style={{
                          color: passwordValidation.hasNumberOrSymbol ? (darkMode ? '#10b981' : '#059669') : (darkMode ? '#6b7280' : '#9ca3af'),
                        }}
                      >
                        Least one number (0-9) or a symbol
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <div className={`w-3 h-3 rounded-full mr-3 transition-all duration-300 ${passwordValidation.hasUpperAndLower ? 'bg-green-500 scale-110' : 'bg-gray-300'}`}></div>
                      <span 
                        className={`transition-colors duration-300 ${passwordValidation.hasUpperAndLower ? 'font-medium' : ''}`}
                        style={{
                          color: passwordValidation.hasUpperAndLower ? (darkMode ? '#10b981' : '#059669') : (darkMode ? '#6b7280' : '#9ca3af'),
                        }}
                      >
                        Lowercase (a-z) and uppercase (A-Z)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div className="form-group">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="auth-input w-full pl-12 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-300"
                      style={{
                        backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                        borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(209, 213, 219, 0.3)',
                        color: darkMode ? '#ffffff' : '#000000',
                      }}
                      placeholder="Confirm new password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center hover:bg-gray-50 rounded-r-lg transition-colors duration-200"
                    >
                      {showConfirmPassword ? (
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="text-red-600 text-sm bg-red-50 p-4 rounded-xl border border-red-200 animate-pulse">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {error}
                    </div>
                  </div>
                )}

                {/* Update Password Button */}
                <button
                  type="submit"
                  disabled={loading || !isFormValid}
                  className="auth-button w-full text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="pulse-ring w-5 h-5 border-2 border-white rounded-full mr-3"></div>
                      Updating...
                    </div>
                  ) : (
                    <>
                      Update Password
                      <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>

                {/* Back to Login */}
                <div className="text-center">
                  <Link
                    to="/login"
                    type="button"
                    onClick={handleBackToLogin}
                    className="font-medium text-sm transition-colors"
                    style={{
                      color: darkMode ? '#d1d5db' : '#6b7280',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = darkMode ? '#ffffff' : '#374151';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = darkMode ? '#d1d5db' : '#6b7280';
                    }}
                  >
                    ← Back to Login
                  </Link>
                </div>

                {/* Language Selector */}
                <div className="flex items-center justify-start mt-6">
                  <div 
                    className="flex items-center space-x-2 transition-colors duration-200 cursor-pointer"
                    style={{
                      color: darkMode ? '#d1d5db' : '#6b7280',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = darkMode ? '#ffffff' : '#374151';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = darkMode ? '#d1d5db' : '#6b7280';
                    }}
                  >
                    <span className="text-2xl">🇬🇧</span>
                    <span className="text-sm font-medium">ENG</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Right Side - Illustrative Content */}
          <div className="gradient-bg hidden md:flex md:flex-1 p-12 relative overflow-hidden items-center">
            {/* Animated Background Elements */}
            <div className="absolute inset-0">
              <div className="floating-element absolute top-20 left-10 w-24 h-24 bg-white/10 rounded-full"></div>
              <div className="floating-element absolute top-40 right-16 w-20 h-20 bg-white/5 rounded-full"></div>
              <div className="floating-element absolute bottom-32 left-20 w-32 h-32 bg-white/8 rounded-full"></div>
              <div className="floating-element absolute bottom-20 right-20 w-16 h-16 bg-white/15 rounded-full"></div>
            </div>
            
            {/* Floating Cards */}
            <div className="relative z-10 space-y-10 w-full">
              {/* New Password Card */}
              <div className="floating-card rounded-3xl p-10 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="text-lg font-medium text-white/80">New Password</div>
                  <div className="w-4 h-4 bg-blue-400 rounded-full animate-pulse"></div>
                </div>
                <div className="text-5xl font-bold text-white mb-8">98%</div>
                <div className="relative h-24">
                  <svg className="w-full h-full wave-animation" viewBox="0 0 300 100">
                    <defs>
                      <linearGradient id="wave1" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#f97316" />
                        <stop offset="100%" stopColor="#fb923c" />
                      </linearGradient>
                      <linearGradient id="wave2" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#60a5fa" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,60 Q75,30 150,50 T300,40"
                      stroke="url(#wave1)"
                      strokeWidth="5"
                      fill="none"
                    />
                    <path
                      d="M0,70 Q75,40 150,60 T300,50"
                      stroke="url(#wave2)"
                      strokeWidth="5"
                      fill="none"
                    />
                    <circle cx="150" cy="45" r="12" fill="white" className="drop-shadow-lg">
                      <animate attributeName="cy" values="45;40;45" dur="2s" repeatCount="indefinite"/>
                    </circle>
                    <text x="150" y="50" textAnchor="middle" className="text-sm font-bold fill-gray-800">98</text>
                  </svg>
                </div>
              </div>

              {/* Security Card */}
              <div className="floating-card rounded-3xl p-10 shadow-2xl">
                <div className="flex items-start space-x-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center">
                      <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white text-xl mb-3">Your data, your rules</h3>
                    <p className="text-white/80 text-base leading-relaxed">
                      Full control over your account with advanced security
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Social Icons */}
            <div className="absolute top-12 right-12 space-y-6">
              <div className="floating-element w-16 h-16 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.746-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24.009 12.017 24.009c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z"/>
                </svg>
              </div>
              <div className="floating-element w-16 h-16 bg-black rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.78-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.08-2.03-1.25-3.33-3.13-3.73-5.38C.94 13.39.99 12.7.99 12c0-.7-.05-1.39-.1-2.08.4-2.25 1.7-4.13 3.73-5.38 1.22-.77 2.65-1.16 4.08-1.08 2.33.04 4.6 1.29 5.91 3.21.81 1.16 1.27 2.54 1.35 3.94-.03-2.91-.01-5.83-.02-8.75z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
