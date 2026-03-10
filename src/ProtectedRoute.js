import React, { useContext, useEffect, useState } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { UserContext } from "./UserContext";

const ProtectedRoute = ({ requiredRoles }) => {
  const { token, userType, verified } = useContext(UserContext);

  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // Normalize userType for comparison (make it case-insensitive)
    const normalizedUserType = userType?.toLowerCase() || "";

    // If no token or not verified, redirect to appropriate page
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    if (!verified) {
      navigate("/verification", { replace: true });
      return;
    }

    // Check if user has required role (case-insensitive comparison)
    if (requiredRoles && requiredRoles.length > 0) {
      const normalizedRequiredRoles = requiredRoles.map((role) =>
        role.toLowerCase(),
      );
      const hasRequiredRole =
        normalizedRequiredRoles.includes(normalizedUserType);

      if (!hasRequiredRole) {
        navigate("/unauthorized", { replace: true });
        return;
      }
    }

    setIsAuthorized(true);
  }, [token, verified, userType, requiredRoles, navigate]);

  // Don't render anything while checking or if not authorized
  if (!isAuthorized) {
    return null; // or a loading spinner
  }

  // Render the outlet only if authorized
  return <Outlet />;
};

export default ProtectedRoute;
