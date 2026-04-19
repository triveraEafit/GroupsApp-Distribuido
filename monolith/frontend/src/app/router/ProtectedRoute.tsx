import { Navigate } from "react-router-dom";
import { tokenStorage } from "@/shared/auth/tokenStorage";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = tokenStorage.get();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}