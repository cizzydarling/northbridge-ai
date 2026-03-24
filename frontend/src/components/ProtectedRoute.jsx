import { Navigate, Outlet } from "react-router-dom";
import { getToken, getCurrentUserLocal } from "../api";

export default function ProtectedRoute() {
  const token = getToken();
  const user = getCurrentUserLocal();

  if (!token || !user) {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
}