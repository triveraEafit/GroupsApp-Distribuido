import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "@/pages/Login.jsx";
import Register from "@/pages/Register.jsx";
import Groups from "@/pages/Groups.jsx";
import GroupDetail from "@/pages/GroupDetail.jsx";
import Chat from "@/pages/Chat.jsx";

import { AuthLayout } from "@/layouts/AuthLayout";
import { AppLayout } from "@/layouts/AppLayout";
import { ProtectedRoute } from "@/app/router/ProtectedRoute";
import { tokenStorage } from "@/shared/auth/tokenStorage";

function HomeRedirect() {
  const token = tokenStorage.get();
  return <Navigate to={token ? "/chat" : "/login"} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Root */}
      <Route path="/" element={<HomeRedirect />} />

      {/* Auth */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* App (protected) */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/groups" element={<Groups />} />
        <Route path="/groups/:id" element={<GroupDetail />} />
        <Route path="/chat" element={<Chat />} />
      </Route>

      {/* Not found */}
      <Route path="*" element={<div className="p-6 text-[rgb(var(--muted))]">404</div>} />
    </Routes>
  );
}