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

    console.log(
      "ProtectedRoute Check -",
      "Token:",
      !!token,
      "Verified:",
      verified,
      "UserType:",
      userType,
      "Normalized:",
      normalizedUserType,
      "Required:",
      requiredRoles,
    );

    // If no token or not verified, redirect to appropriate page
    if (!token) {
      console.log("No token, redirecting to /login");
      navigate("/login", { replace: true });
      return;
    }

    if (!verified) {
      console.log("Not verified, redirecting to /verification");
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
        console.log(
          `User type "${userType}" (normalized: "${normalizedUserType}") not in required roles:`,
          requiredRoles,
        );
        console.log("Redirecting to /unauthorized");
        navigate("/unauthorized", { replace: true });
        return;
      }
    }

    console.log("Access granted!");
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
