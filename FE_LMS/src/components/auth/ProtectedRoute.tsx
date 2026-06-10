import React, { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string | string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const location = useLocation();
  
  // For now, we'll use a simple localStorage check
  // Later you can integrate with the AuthContext
  const isAuthenticated = () => {
    // Check if user has valid session by making a request to /user endpoint
    // This is a simple implementation - you might want to use the AuthContext instead
    return localStorage.getItem('isAuthenticated') === 'true';
  };

  const getUserRole = () => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        return JSON.parse(userData).role;
      } catch {
        return null;
      }
    }
    return null;
  };

  if (!isAuthenticated()) {
    // Capture the current path and redirect to login with redirect parameter
    const currentPath = location.pathname + location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(currentPath)}`} replace />;
  }

  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!allowedRoles.includes(getUserRole())) {
    return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
