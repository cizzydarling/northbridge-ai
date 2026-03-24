import { Navigate, Outlet } from "react-router-dom";
import { getCurrentUserLocal } from "../api";

export default function SelfRoute() {
  const user = getCurrentUserLocal();
  const isAgent = user?.plan === "agent" || user?.role === "agent";

  if (isAgent) {
    return <Navigate to="/clients" replace />;
  }

  return <Outlet />;
}