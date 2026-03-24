import { Navigate, Outlet } from "react-router-dom";
import { getCurrentUserLocal } from "../api";

export default function AgentRoute() {
  const user = getCurrentUserLocal();
  const isAgent = user?.plan === "agent" || user?.role === "agent";

  if (!isAgent) {
    return <Navigate to="/self/dashboard" replace />;
  }

  return <Outlet />;
}