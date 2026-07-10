/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { fetchInteractions, fetchHCPs, fetchFollowUps, fetchAnalytics, AppDispatch } from "../redux/store.ts";
import {
  Database,
  User,
  MapPin,
  RefreshCw,
  Loader2,
  CheckCircle,
  Mail,
  Award,
  Server,
  Terminal,
  ShieldCheck,
} from "lucide-react";

export default function Settings() {
  const dispatch = useDispatch<AppDispatch>();
  const [resetting, setResetting] = useState(false);
  const [success, setSuccess] = useState(false);

  // MySQL real-time status state
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [loadingDbStatus, setLoadingDbStatus] = useState(false);

  const fetchDbStatus = async () => {
    setLoadingDbStatus(true);
    try {
      const res = await fetch("/api/db-status");
      const data = await res.json();
      setDbStatus(data);
    } catch (err) {
      console.error("Failed to fetch database status:", err);
    } finally {
      setLoadingDbStatus(false);
    }
  };

  useEffect(() => {
    fetchDbStatus();
  }, []);

  const handleResetDatabase = async () => {
    setResetting(true);
    setSuccess(false);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
      });
      await res.json();
      
      // Reload Redux data store
      await dispatch(fetchInteractions());
      await dispatch(fetchHCPs(undefined));
      await dispatch(fetchFollowUps());
      await dispatch(fetchAnalytics());

      setSuccess(true);
      await fetchDbStatus();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Database seed failure:", err);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div id="settings-page" className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Console Settings</h1>
        <p className="text-xs text-slate-400 mt-1">Manage your active territory representative profile and central diagnostic operations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <User className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">Representative Profile</h2>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-900">
              <span className="text-slate-400">Representative Name</span>
              <span className="text-white font-semibold">Alex Mercer</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-900">
              <span className="text-slate-400 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span>Assigned Email</span>
              </span>
              <span className="text-white font-mono">alex.mercer@biopharm-alliance.com</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-900">
              <span className="text-slate-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>Territory Region</span>
              </span>
              <span className="text-white flex items-center gap-1 font-semibold">
                <span>Pacific Northwest (Zone 4)</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-slate-500" />
                <span>Alliance Status</span>
              </span>
              <span className="text-emerald-400 font-bold uppercase tracking-wider">Senior Clinical Liaison</span>
            </div>
          </div>
        </div>

        {/* Database & Diagnostics Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <Database className="w-5 h-5 text-emerald-400" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">Data Sync & Seeding</h2>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Resets and re-seeds your local medical directory with default clinical specialists, formulary pharmaceutical products, and demo engagements. This is useful for clearing sandbox tables or restoring the default experience.
            </p>
          </div>

          <div className="pt-4 flex items-center justify-between">
            {success ? (
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle className="w-4 h-4" />
                <span>Roster Reseeded!</span>
              </span>
            ) : resetting ? (
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Seeding database...</span>
              </span>
            ) : (
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Diagnostic Command</span>
            )}

            <button
              onClick={handleResetDatabase}
              disabled={resetting}
              className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset & Seed DB</span>
            </button>
          </div>
        </div>
      </div>

      {/* MySQL Real-Time Verification Console */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">MySQL Verification & Diagnostics</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Validate live database state, query tables, and track transaction records in real-time</p>
            </div>
          </div>
          
          <button
            onClick={fetchDbStatus}
            disabled={loadingDbStatus}
            className="self-start sm:self-auto px-3.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            {loadingDbStatus ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>Refresh Counts</span>
          </button>
        </div>

        {/* Database Status Alert Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1 bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-3">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Connection Node</span>
            <div className="space-y-1">
              <span className="text-xs text-slate-400 block">Host: <span className="font-mono text-white">{dbStatus?.connectionDetails?.host || "localhost"}</span></span>
              <span className="text-xs text-slate-400 block">Database: <span className="font-mono text-white">{dbStatus?.connectionDetails?.database || "crm_db"}</span></span>
              <span className="text-xs text-slate-400 block">Port: <span className="font-mono text-white">{dbStatus?.connectionDetails?.port || "3306"}</span></span>
            </div>
            <div>
              {dbStatus?.connectionDetails?.status === "Connected" ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>MySQL Connected</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-bold text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>In-Memory Fallback Active</span>
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-2 bg-slate-950/60 border border-slate-800 p-4 rounded-xl">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-3">Live Table Row Counts (Real-Time Database Sync)</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-900 border border-slate-800/80 p-3 rounded-lg text-center">
                <span className="text-[10px] text-slate-400 block truncate">Registered HCPs</span>
                <span className="text-lg font-bold font-mono text-white mt-1 block">
                  {dbStatus?.connectionDetails?.status === "Connected" ? dbStatus?.mysqlCounts?.hcps : dbStatus?.tableCounts?.hcps ?? 0}
                </span>
                <span className="text-[9px] text-slate-500 block mt-0.5">hcps table</span>
              </div>
              <div className="bg-slate-900 border border-slate-800/80 p-3 rounded-lg text-center">
                <span className="text-[10px] text-slate-400 block truncate">Interactions</span>
                <span className="text-lg font-bold font-mono text-indigo-400 mt-1 block">
                  {dbStatus?.connectionDetails?.status === "Connected" ? dbStatus?.mysqlCounts?.interactions : dbStatus?.tableCounts?.interactions ?? 0}
                </span>
                <span className="text-[9px] text-slate-500 block mt-0.5">interactions</span>
              </div>
              <div className="bg-slate-900 border border-slate-800/80 p-3 rounded-lg text-center">
                <span className="text-[10px] text-slate-400 block truncate">Follow-ups</span>
                <span className="text-lg font-bold font-mono text-emerald-400 mt-1 block">
                  {dbStatus?.connectionDetails?.status === "Connected" ? dbStatus?.mysqlCounts?.followUps : dbStatus?.tableCounts?.followUps ?? 0}
                </span>
                <span className="text-[9px] text-slate-500 block mt-0.5">follow_ups</span>
              </div>
              <div className="bg-slate-900 border border-slate-800/80 p-3 rounded-lg text-center">
                <span className="text-[10px] text-slate-400 block truncate">Activity Logs</span>
                <span className="text-lg font-bold font-mono text-rose-400 mt-1 block">
                  {dbStatus?.connectionDetails?.status === "Connected" ? dbStatus?.mysqlCounts?.activityLogs : dbStatus?.tableCounts?.activityLogs ?? 0}
                </span>
                <span className="text-[9px] text-slate-500 block mt-0.5">activity_logs</span>
              </div>
            </div>
            <p className="text-[9px] text-slate-500 mt-3 italic leading-relaxed">
              * Note: Every time you register an HCP, log a medical meeting, or toggle a follow-up action on the dashboard, the changes sync directly to MySQL in real-time. Try refreshing to see counts update!
            </p>
          </div>
        </div>

        {/* Developer Step-by-Step MySQL Guide */}
        <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">How to verify updates directly inside MySQL Client</h3>
          </div>
          
          <div className="space-y-4 text-xs text-slate-300">
            <p className="leading-relaxed">
              To verify that updates are successfully saving in your MySQL instance, connect to your MySQL Server using your preferred CLI, workbench, DBeaver, or connection manager, and run the following commands:
            </p>

            <div className="space-y-3 font-mono text-[11px]">
              <div>
                <span className="text-indigo-400 font-semibold block mb-1">1. Query registered Healthcare Professionals (HCPs):</span>
                <div className="bg-slate-900 p-2.5 rounded border border-slate-800 text-white flex justify-between items-center select-all">
                  <span>SELECT id, name, hospital, speciality FROM hcps;</span>
                </div>
              </div>

              <div>
                <span className="text-indigo-400 font-semibold block mb-1">2. Query clinical interactions & marketing discussions (latest first):</span>
                <div className="bg-slate-900 p-2.5 rounded border border-slate-800 text-white flex justify-between items-center select-all">
                  <span>SELECT id, hcp_name, date, type, summary, priority FROM interactions ORDER BY date DESC;</span>
                </div>
              </div>

              <div>
                <span className="text-indigo-400 font-semibold block mb-1">3. Query follow-up tasks & deadlines:</span>
                <div className="bg-slate-900 p-2.5 rounded border border-slate-800 text-white flex justify-between items-center select-all">
                  <span>SELECT hcp_name, action_item, due_date, status FROM follow_ups;</span>
                </div>
              </div>

              <div>
                <span className="text-indigo-400 font-semibold block mb-1">4. Query backend audit trails:</span>
                <div className="bg-slate-900 p-2.5 rounded border border-slate-800 text-white flex justify-between items-center select-all">
                  <span>SELECT action, timestamp, details FROM activity_logs ORDER BY timestamp DESC LIMIT 5;</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 flex items-start gap-1.5 leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Automatic Table Bootstrapping:</strong> The application automatically provisions these tables on launch if they do not exist. Your data is structured matching live types perfectly, allowing direct integration into secondary business intelligence or analytical software.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
