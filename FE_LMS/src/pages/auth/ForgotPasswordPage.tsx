import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";

const ForgotPasswordPage: React.FC = () => {
  const { darkMode } = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [isEmailValid, setIsEmailValid] = useState(false);

  
  // Email validation function
  const validateEmail = (email: string): { isValid: boolean; error: string } => {
    if (!email.trim()) {
      return { isValid: false, error: "Email is required" };
    }
    
    // More strict email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,63}$/;
    
    if (!emailRegex.test(email)) {
      return { isValid: false, error: "Please enter a valid email address" };
    }
    
    // Additional checks
    if (email.length > 254) {
      return { isValid: false, error: "Email address is too long" };
    }
    
    // Check for consecutive dots
    if (email.includes('..')) {
      return { isValid: false, error: "Email cannot contain consecutive dots" };
    }
    
    // Check local part length (before @)
    const localPart = email.split('@')[0];
    if (localPart.length > 64) {
      return { isValid: false, error: "Email local part is too long" };
    }
    
    // Check domain part length (after @)
    const domainPart = email.split('@')[1];
    if (domainPart.length > 253) {
      return { isValid: false, error: "Email domain is too long" };
    }
    
    // Optional: Restrict to common TLDs (uncomment if needed)
    // const commonTlds = ['com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'info', 'biz', 'name', 'pro', 'aero', 'coop', 'museum'];
    // const tld = domainPart.split('.').pop()?.toLowerCase();
    // if (tld && !commonTlds.includes(tld)) {
    //   return { isValid: false, error: "Please use a recognized email domain" };
    // }
    
    return { isValid: true, error: "" };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    const validation = validateEmail(value);
    setEmailError(validation.error);
    setIsEmailValid(validation.isValid); // ← Đảm bảo cập nhật
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  
    if (!isEmailValid) return;
    
    // Validate email before submission
    const validation = validateEmail(email);
    if (!validation.isValid) {
      setEmailError(validation.error);
      return;
    }
    
    setLoading(true);
    setError("");
    setEmailError("");

    try {
      // TODO: Replace with actual API call
      // const response = await authService.forgotPassword(email);
      
      // Simulate API call with better error handling
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          // Simulate different scenarios
          if (email === "test@error.com") {
            reject(new Error("Email not found in our system"));
          } else if (email === "test@server.com") {
            reject(new Error("Server error. Please try again later"));
          } else {
            resolve(true);
          }
        }, 2000);
      });
      
      setIsSubmitted(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send reset link";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Xử lý quay lại login - dùng cho nút sau khi gửi email
  const handleBackToLogin = () => {
    navigate("/login");
  };

  // Xử lý nút back arrow (góc trên)
  const handleBackClick = () => {
    navigate(-1); // Quay lại trang trước
  };

  if (isSubmitted) {
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
                  {/* NÚT BACK ARROW - ĐÃ SỬA */}
                  <button 
                    onClick={handleBackClick}
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
                    Check Your Email
                  </h1>
                  <p 
                    style={{
                      color: darkMode ? '#d1d5db' : '#6b7280',
                    }}
                  >
                    We've sent a password reset link to your email address
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
                    Email Sent!
                  </h3>
                  <p 
                    className="mb-6"
                    style={{
                      color: darkMode ? '#d1d5db' : '#6b7280',
                    }}
                  >
                    We've sent a password reset link to <strong>{email}</strong>
                  </p>
                  
                  <div className="space-y-4">
                    {/* NÚT BACK TO LOGIN SAU KHI GỬI */}
                    <button
                      onClick={handleBackToLogin}
                      className="auth-button w-full text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center"
                    >
                      Back to Login
                      <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setIsSubmitted(false)}
                      className="w-full py-3 px-4 font-medium transition-colors"
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
                      Try different email
                    </button>
                  </div>

                  <div 
                    className="mt-8 p-4 rounded-xl"
                    style={{
                      backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.1)' : '#dbeafe',
                    }}
                  >
                    <p 
                      className="text-sm"
                      style={{
                        color: darkMode ? '#93c5fd' : '#1e40af',
                      }}
                    >
                      <strong>Didn't receive the email?</strong> Check your spam folder or try again in a few minutes.
                    </p>
                  </div>
                </div>

                
              </div>
            </div>

            {/* Right Side - Illustrative Content */}
            <div className="gradient-bg hidden md:flex md:flex-1 p-12 relative overflow-hidden items-center">
              <div className="absolute inset-0">
                <div className="floating-element absolute top-20 left-10 w-24 h-24 bg-white/10 rounded-full"></div>
                <div className="floating-element absolute top-40 right-16 w-20 h-20 bg-white/5 rounded-full"></div>
                <div className="floating-element absolute bottom-32 left-20 w-32 h-32 bg-white/8 rounded-full"></div>
                <div className="floating-element absolute bottom-20 right-20 w-16 h-16 bg-white/15 rounded-full"></div>
              </div>
              
              <div className="relative z-10 space-y-10 w-full">
                <div className="floating-card rounded-3xl p-10 shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <div className="text-lg font-medium text-white/80">Reset Password</div>
                    <div className="w-4 h-4 bg-orange-400 rounded-full animate-pulse"></div>
                  </div>
                  <div className="text-5xl font-bold text-white mb-8">45</div>
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
                      <path d="M0,60 Q75,30 150,50 T300,40" stroke="url(#wave1)" strokeWidth="5" fill="none" />
                      <path d="M0,70 Q75,40 150,60 T300,50" stroke="url(#wave2)" strokeWidth="5" fill="none" />
                      <circle cx="150" cy="45" r="12" fill="white" className="drop-shadow-lg">
                        <animate attributeName="cy" values="45;40;45" dur="2s" repeatCount="indefinite"/>
                      </circle>
                      <text x="150" y="50" textAnchor="middle" className="text-sm font-bold fill-gray-800">45</text>
                    </svg>
                  </div>
                </div>

                <div className="floating-card rounded-3xl p-10 shadow-2xl">
                  <div className="flex items-start space-x-6">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center">
                        <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-white text-xl mb-3">Secure Process</h3>
                      <p className="text-white/80 text-base leading-relaxed">
                        Your data is protected with advanced encryption
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
                <div className="floating-element  w-16 h-16 bg-black rounded-full flex items-center justify-center shadow-lg">
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
          {/* Left Side - Forgot Password Form */}
          <div className="flex-1 p-8 flex items-center">
            <div className="max-w-md mx-auto w-full">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                {/* NÚT BACK ARROW - ĐÃ SỬA */}
                <button 
                  onClick={handleBackClick}
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
                  Forgot Password
                </h1>
                <p 
                  style={{
                    color: darkMode ? '#d1d5db' : '#6b7280',
                  }}
                >
                  Enter your email address and we'll send you a reset link
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Field */}
                <div className="form-group">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg 
                        className={`h-5 w-5 transition-colors duration-200 ${
                          emailError ? 'text-red-400' : 
                          isEmailValid ? 'text-green-400' : 
                          'text-gray-400'
                        }`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={handleInputChange}
                      className={`auth-input w-full pl-12 pr-12 py-3 border rounded-lg focus:ring-2 focus:border-transparent transition-colors duration-300 ${
                        emailError ? 'border-red-500 focus:ring-red-500' :
                        isEmailValid ? 'border-green-500 focus:ring-green-500' :
                        'focus:ring-blue-500'
                      }`}
                      style={{
                        backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                        borderColor: emailError ? '#ef4444' : 
                                   isEmailValid ? '#10b981' : 
                                   darkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(209, 213, 219, 0.3)',
                        color: darkMode ? '#ffffff' : '#000000',
                      }}
                      placeholder="Enter your email address"
                      required
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      {emailError ? (
                        <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                          <svg className="h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                      ) : isEmailValid ? (
                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                          <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  
                  {/* Email validation error message */}
                  {emailError && (
                    <div className="mt-2 text-sm text-red-600 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {emailError}
                    </div>
                  )}
                  
                  {/* Email validation success message */}
                  {isEmailValid && !emailError && (
                    <div className="mt-2 text-sm text-green-600 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Valid email address
                    </div>
                  )}
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

                {/* Send Reset Link Button */}
                <button
                  type="submit"
                  disabled={loading || !isEmailValid || !!emailError}
                  className={`auth-button w-full text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center transition-all duration-200 ${
                    loading || !isEmailValid || !!emailError 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:shadow-lg transform hover:-translate-y-0.5'
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="pulse-ring w-5 h-5 border-2 border-white rounded-full mr-3"></div>
                      Sending...
                    </div>
                  ) : (
                    <>
                      Send Reset Link
                      <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>

                {/* LINK BACK TO LOGIN - ĐÃ SỬA */}
                <div className="text-center">
                  <Link
                    to="/login"
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
                    Back to Login
                  </Link>
                </div>

              </form>
            </div>
          </div>

          {/* Right Side - Illustrative Content */}
          <div className="gradient-bg hidden md:flex md:flex-1 p-12 relative overflow-hidden items-center">
            <div className="absolute inset-0">
              <div className="floating-element absolute top-20 left-10 w-24 h-24 bg-white/10 rounded-full"></div>
              <div className="floating-element absolute top-40 right-16 w-20 h-20 bg-white/5 rounded-full"></div>
              <div className="floating-element absolute bottom-32 left-20 w-32 h-32 bg-white/8 rounded-full"></div>
              <div className="floating-element absolute bottom-20 right-20 w-16 h-16 bg-white/15 rounded-full"></div>
            </div>
            
            <div className="relative z-10 space-y-10 w-full">
              <div className="floating-card rounded-3xl p-10 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="text-lg font-medium text-white/80">Reset Password</div>
                  <div className="w-4 h-4 bg-orange-400 rounded-full animate-pulse"></div>
                </div>
                <div className="text-5xl font-bold text-white mb-8">45</div>
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
                    <path d="M0,60 Q75,30 150,50 T300,40" stroke="url(#wave1)" strokeWidth="5" fill="none" />
                    <path d="M0,70 Q75,40 150,60 T300,50" stroke="url(#wave2)" strokeWidth="5" fill="none" />
                    <circle cx="150" cy="45" r="12" fill="white" className="drop-shadow-lg">
                      <animate attributeName="cy" values="45;40;45" dur="2s" repeatCount="indefinite"/>
                    </circle>
                    <text x="150" y="50" textAnchor="middle" className="text-sm font-bold fill-gray-800">45</text>
                  </svg>
                </div>
              </div>

              <div className="floating-card rounded-3xl p-10 shadow-2xl">
                <div className="flex items-start space-x-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center">
                      <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white text-xl mb-3">Secure Process</h3>
                    <p className="text-white/80 text-base leading-relaxed">
                      Your data is protected with advanced encryption
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
};

export default ForgotPasswordPage;
