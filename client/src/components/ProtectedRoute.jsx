import { Navigate, Outlet } from "react-router-dom";
import { getToken } from "../api/client.js";

export default function ProtectedRoute() {
  return getToken() ? <Outlet /> : <Navigate to="/login" replace />;
}
