import React from "react";
import { Outlet } from "react-router-dom";
import AdminHeader from "../admin/AdminHeader.jsx";

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AdminHeader />
      <main className="max-w-6xl mx-auto px-5 py-6">
        <Outlet />
      </main>
    </div>
  );
}
