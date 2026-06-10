import React, { useState } from "react";
import { Link } from "react-router-dom";
import { authService } from "../../services";
import { type RegisterRequest } from "../../types/auth";
import { useTheme } from "../../hooks/useTheme";

type ErrorType = string | { path?: string[]; code?: string; message?: string };

const RegisterPage: React.FC = () => {
  const { darkMode } = useTheme();
  const [formData, setFormData] = useState<RegisterRequest>({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    fullname: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorType | ErrorType[]>("");
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };
  //1. Validation 
  const validatePassword = (password: string) => {
    const hasMinLength = password.length >= 8;
    const hasNumberOrSymbol = /[0-9!@#$%^&*(),.?":{}|<>]/.test(password);
    const hasUpperAndLower = /[a-z]/.test(password) && /[A-Z]/.test(password);

    return { hasMinLength, hasNumberOrSymbol, hasUpperAndLower };
  };

  const passwordValidation = validatePassword(formData.password);
  const isPasswordValid = passwordValidation.hasMinLength && passwordValidation.hasNumberOrSymbol && passwordValidation.hasUpperAndLower;
  const isFormValid =
    formData.fullname &&
    formData.username &&
    formData.email &&
    isPasswordValid &&
    formData.password === formData.confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const response = await authService.register(formData);
      console.log("Registration successful:", response);
      setSuccess(true);
      // Don't redirect immediately - show success message about email verification
    } catch (err: unknown) {
      console.error("Registration error:", err);

      let finalError: ErrorType | ErrorType[] = "Đăng ký thất bại";

      // Ưu tiên lấy message từ response của API (vd: \"Email already in use\")
      const apiMessage =
        (err as any)?.response?.data?.message ??
        (err as any)?.response?.data?.error?.message;

      if (typeof apiMessage === "string" && apiMessage.trim()) {
        finalError = apiMessage;
      } else {
        // Fallback: lấy từ err.message như trước (có thể là JSON string)
        const maybeMessage = (err as { message?: unknown })?.message;
        if (typeof maybeMessage === "string") {
          try {
            const parsed = JSON.parse(maybeMessage);
            if (Array.isArray(parsed)) {
              finalError = parsed as ErrorType[];
            } else {
              finalError = maybeMessage;
            }
          } catch {
            finalError = maybeMessage;
          }
        }
      }

      setError(finalError);
    } finally {
      setLoading(false);
    }
  };

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
          {/* Left Side - Register Form */}
          <div className="flex-1 p-8 flex items-center">
            <div className="max-w-md mx-auto w-full">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <button
                  className="transition-colors duration-200 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                  style={{
                    color: darkMode ? '#d1d5db' : '#6b7280',
                  }}
                  onClick={() => window.location.href = '/login'}
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
                  Sign Up
                </h1>
                <p
                  style={{
                    color: darkMode ? '#d1d5db' : '#6b7280',
                  }}
                >
                  Secure Your Communications with Easymail
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Fullname Field */}
                <div className="form-group">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      name="fullname"
                      value={formData.fullname}
                      onChange={handleInputChange}
                      className="auth-input w-full pl-12 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-300"
                      style={{
                        backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                        borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(209, 213, 219, 0.3)',
                        color: darkMode ? '#ffffff' : '#000000',
                      }}
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                </div>

                {/* Username Field */}
                <div className="form-group">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      className="auth-input w-full pl-12 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-300"
                      style={{
                        backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                        borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(209, 213, 219, 0.3)',
                        color: darkMode ? '#ffffff' : '#000000',
                      }}
                      placeholder="Enter your username"
                      required
                    />
                  </div>
                </div>

                {/* Email Field */}
                <div className="form-group">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="auth-input w-full pl-12 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-300"
                      style={{
                        backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                        borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(209, 213, 219, 0.3)',
                        color: darkMode ? '#ffffff' : '#000000',
                      }}
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                </div>

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
                      placeholder="Enter your password"
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

                {/* Re-Type Password Field */}
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
                      className="auth-input w-full pl-12 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-300"
                      style={{
                        backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                        borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(209, 213, 219, 0.3)',
                        color: darkMode ? '#ffffff' : '#000000',
                      }}
                      placeholder="Re-Type Password"
                      required
                    />
                  </div>
                </div>

                {/* Error Message */}
                {/* Error Message */}
                {error && (
                  <div className="text-red-600 text-sm bg-red-50 p-4 rounded-xl border border-red-200 animate-pulse">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>
                        {Array.isArray(error) ? (
                          <ul className="list-none list-inside space-y-1">
                            {error.map((err, index) => (
                              <li key={index}>
                                {typeof err === 'object' && err !== null && 'path' in err && 'code' in err && 'message' in err
                                  ? (err.path?.[0] === "username" && err.code === "too_small"
                                    ? "Tên người dùng phải có ít nhất 3 ký tự"
                                    : err.message)
                                  : String(err)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          String(error)
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {/* Success Message */}
                {success && (
                  <div className="text-green-600 text-sm bg-green-50 p-4 rounded-xl border border-green-200 animate-pulse">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <div className="font-semibold">Registration Successful!</div>
                        <div className="text-sm mt-1">
                          Please check your email ({formData.email}) and click the verification link to activate your account.
                        </div>
                        <div className="text-sm mt-2">
                          <Link
                            to="/login"
                            className="underline transition-colors duration-200"
                            style={{
                              color: darkMode ? '#60a5fa' : '#2563eb',
                            }}
                          >
                            Go to Login Page
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sign Up Button */}
                <button
                  type="submit"
                  disabled={loading || !isFormValid}
                  className="auth-button w-full text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="pulse-ring w-5 h-5 border-2 border-white rounded-full mr-3"></div>
                      Creating Account...
                    </div>
                  ) : (
                    <>
                      Sign Up
                      <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>

                {/* Social Sign Up */}
                <div className="text-center">
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span
                        className="px-6 font-medium text-lg"
                        style={{
                          backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.95)' : '#ffffff',
                          color: darkMode ? '#d1d5db' : '#6b7280',
                        }}
                      >
                        Or continue with
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-center space-x-4">
                    <button className="social-button w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                    </button>
                    <button className="social-button w-12 h-12 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                    </button>
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
              {/* Inbox Card */}
              <div className="floating-card rounded-3xl p-10 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="text-lg font-medium text-white/80">Inbox</div>
                  <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse"></div>
                </div>
                <div className="text-5xl font-bold text-white mb-8">176,18</div>
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
                      <animate attributeName="cy" values="45;40;45" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <text x="150" y="50" textAnchor="middle" className="text-sm font-bold fill-gray-800">45</text>
                  </svg>
                </div>
              </div>

              {/* Security Card */}
              <div className="floating-card rounded-3xl p-10 shadow-2xl">
                <div className="flex items-start space-x-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center">
                      <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1721 9z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white text-xl mb-3">Your data, your rules</h3>
                    <p className="text-white/80 text-base leading-relaxed">
                      Your data belongs to you, and our encryption ensures that
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Social Icons */}
            <div className="absolute top-12 right-12 space-y-6">
              <div className="floating-element w-16 h-16 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.746-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24.009 12.017 24.009c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z" />
                </svg>
              </div>
              <div className="floating-element w-16 h-16 bg-black rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.78-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.08-2.03-1.25-3.33-3.13-3.73-5.38C.94 13.39.99 12.7.99 12c0-.7-.05-1.39-.1-2.08.4-2.25 1.7-4.13 3.73-5.38 1.22-.77 2.65-1.16 4.08-1.08 2.33.04 4.6 1.29 5.91 3.21.81 1.16 1.27 2.54 1.35 3.94-.03-2.91-.01-5.83-.02-8.75z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;