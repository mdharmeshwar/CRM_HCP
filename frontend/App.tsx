/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from "react-router-dom";
import { Provider, useSelector, useDispatch } from "react-redux";
import { store, RootState, logout } from "./redux/store.ts";
import {
  LayoutDashboard,
  Users,
  MessageSquarePlus,
  History,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Activity,
} from "lucide-react";

// Import pages
import Login from "./pages/Login.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import HCPList from "./pages/HCPList.tsx";
import LogInteraction from "./pages/LogInteraction.tsx";
import InteractionHistory from "./pages/InteractionHistory.tsx";
import InteractionDetails from "./pages/InteractionDetails.tsx";
import Analytics from "./pages/Analytics.tsx";
import Settings from "./pages/Settings.tsx";

interface NavigationSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

function NavigationSidebar({ isCollapsed, onToggleCollapse }: NavigationSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "HCP Directory", path: "/hcps", icon: Users },
    { label: "Log Interaction", path: "/log-interaction", icon: MessageSquarePlus },
    { label: "Ledger History", path: "/history", icon: History },
    { label: "CRM Analytics", path: "/analytics", icon: BarChart3 },
    { label: "Console Settings", path: "/settings", icon: SettingsIcon },
  ];

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  return (
    <>
      {/* Mobile Header Menu Trigger */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-slate-950 border-b border-white/5 z-40 relative">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-sm text-white tracking-wide">BioPharm Alliance</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-slate-400 hover:text-white bg-white/5 border border-white/10 rounded-xl"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Primary Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 bg-slate-950/80 backdrop-blur-2xl border-r border-white/10 flex flex-col z-50 transform transition-all duration-300 lg:static lg:h-screen lg:translate-x-0 shrink-0 ${
          isCollapsed ? "lg:w-20 lg:p-4" : "lg:w-64 lg:p-6"
        } p-6 ${mobileOpen ? "translate-x-0 w-64" : "-translate-x-full"}`}
      >
        {/* Collapse Toggle Button (Desktop Only) */}
        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          className="hidden lg:flex absolute -right-4 top-7 w-8 h-8 bg-slate-900 hover:bg-indigo-600 border border-white/10 hover:border-indigo-400 text-slate-400 hover:text-white rounded-lg items-center justify-center cursor-pointer transition-all shadow-lg z-50 hover:scale-105 active:scale-95"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Brand Header */}
        <div className={`flex items-center gap-3 mb-10 pb-5 border-b border-white/5 transition-all ${isCollapsed ? "justify-center" : ""}`}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Activity className="w-6 h-6 text-white" />
          </div>
          {!isCollapsed && (
            <div className="transition-opacity duration-200">
              <h1 className="font-bold text-sm text-white tracking-tight leading-none">BioPharm Alliance</h1>
              <span className="text-[10px] text-slate-500 font-medium uppercase tracking-widest block mt-1">CRM Console</span>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === "/history" && location.pathname.startsWith("/interactions"));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                title={isCollapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  isCollapsed ? "px-3 py-3 justify-center" : "px-4 py-3"
                } ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 border-l-4 border-indigo-400"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                {!isCollapsed && <span className="transition-opacity duration-200">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User profile footer action */}
        <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
          <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : ""}`}>
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0">
              AM
            </div>
            {!isCollapsed && (
              <div className="min-w-0 transition-opacity duration-200">
                <p className="text-xs font-bold text-white truncate leading-tight">Alex Mercer</p>
                <p className="text-[9px] text-slate-500 truncate mt-0.5">Commercial Representative</p>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            title={isCollapsed ? "Secure Logout" : undefined}
            className={`w-full py-2.5 bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
              isCollapsed ? "px-0 justify-center" : "px-4 gap-2"
            }`}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!isCollapsed && <span className="transition-opacity duration-200">Secure Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem("sidebar-collapsed") === "true";
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen w-screen bg-slate-950 flex flex-col lg:flex-row text-slate-100 overflow-hidden relative">
      {/* Frosted Glass Background Ambient Gradients */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[130px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/8 blur-[130px] rounded-full"></div>
      </div>

      <NavigationSidebar isCollapsed={isCollapsed} onToggleCollapse={toggleCollapse} />

      {/* Main viewport */}
      <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto z-10 relative h-full">
        <div className="max-w-7xl w-full mx-auto space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
}

export function AppContent() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <AuthenticatedLayout>
            <Dashboard />
          </AuthenticatedLayout>
        }
      />
      <Route
        path="/hcps"
        element={
          <AuthenticatedLayout>
            <HCPList />
          </AuthenticatedLayout>
        }
      />
      <Route
        path="/log-interaction"
        element={
          <AuthenticatedLayout>
            <LogInteraction />
          </AuthenticatedLayout>
        }
      />
      <Route
        path="/history"
        element={
          <AuthenticatedLayout>
            <InteractionHistory />
          </AuthenticatedLayout>
        }
      />
      <Route
        path="/interactions/:id"
        element={
          <AuthenticatedLayout>
            <InteractionDetails />
          </AuthenticatedLayout>
        }
      />
      <Route
        path="/analytics"
        element={
          <AuthenticatedLayout>
            <Analytics />
          </AuthenticatedLayout>
        }
      />
      <Route
        path="/settings"
        element={
          <AuthenticatedLayout>
            <Settings />
          </AuthenticatedLayout>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </Provider>
  );
}
