/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import { fetchInteractions, fetchHCPs, fetchFollowUps, fetchAnalytics, toggleFollowUp, RootState, AppDispatch } from "../redux/store.ts";
import {
  Users,
  MessageSquare,
  CalendarDays,
  FileCheck2,
  Plus,
  ArrowRight,
  TrendingUp,
  Inbox,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";

export default function Dashboard() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  
  const { list: interactions, loading: intLoading } = useSelector((state: RootState) => state.interaction);
  const { list: hcps } = useSelector((state: RootState) => state.hcp);
  const { followUps } = useSelector((state: RootState) => state.interaction);
  const { data: analytics } = useSelector((state: RootState) => state.analytics);

  useEffect(() => {
    dispatch(fetchInteractions());
    dispatch(fetchHCPs(undefined));
    dispatch(fetchFollowUps());
    dispatch(fetchAnalytics());
  }, [dispatch]);

  const handleToggleFollowup = (id: string) => {
    dispatch(toggleFollowUp(id));
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case "High": return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "Medium": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default: return "bg-sky-500/10 text-sky-400 border-sky-500/20";
    }
  };

  return (
    <div id="dashboard-page" className="space-y-6">
      {/* Welcome Hero header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Territory Console <span className="text-emerald-400">Alex Mercer</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Manage medical relationships, log clinical engagements, and utilize smart AI assistance to capture field notes instantly.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/log-interaction"
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-500/10 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Log Interaction</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: "Logged Interactions",
            value: analytics?.totals.interactions ?? interactions.length,
            icon: MessageSquare,
            color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
          },
          {
            title: "Active HCP Panel",
            value: analytics?.totals.hcps ?? hcps.length,
            icon: Users,
            color: "text-blue-400 bg-blue-500/10 border-blue-500/20"
          },
          {
            title: "Urgent Follow-Ups",
            value: followUps.filter(f => f.status === "Pending").length,
            icon: CalendarDays,
            color: "text-rose-400 bg-rose-500/10 border-rose-500/20"
          },
          {
            title: "Formulary Products",
            value: analytics?.totals.products ?? 5,
            icon: FileCheck2,
            color: "text-purple-400 bg-purple-500/10 border-purple-500/20"
          }
        ].map((stat, i) => (
          <div key={i} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider block">{stat.title}</span>
              <span className="text-2xl font-bold text-white mt-1 block">{stat.value}</span>
            </div>
            <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid: Recent Logs & Next Tasks */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left 2 Columns: Recent Logged Interactions */}
        <div className="xl:col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Recent Engagements</h2>
              <p className="text-xs text-slate-500 mt-0.5">Chronological record of recent field visits</p>
            </div>
            <Link to="/history" className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              <span>View History</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {intLoading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-2">
              <span className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-500">Retrieving secure logs...</span>
            </div>
          ) : interactions.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
              <Inbox className="w-12 h-12 text-slate-700" />
              <div>
                <p className="text-xs text-slate-400">No medical interactions logged in database</p>
                <p className="text-[10px] text-slate-500 mt-1">Use the Structured Form or AI Chat to log first contact.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {interactions.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/interactions/${item.id}`)}
                  className="group bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 cursor-pointer transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-3"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-white">{item.hcpName}</span>
                      <span className="text-[10px] text-slate-400">• {item.hospital}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded border ${getPriorityColor(item.priority)}`}>
                        {item.priority}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1">{item.summary}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.productsDiscussed.map((prod, pidx) => (
                        <span key={pidx} className="text-[9px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                          {prod}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex md:flex-col items-end gap-2 shrink-0 self-stretch md:self-auto pt-2 md:pt-0 border-t border-slate-800 md:border-none">
                    <span className="text-[10px] text-slate-400 font-mono">{item.date}</span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full font-medium">
                      {item.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Column: Pending Tasks & Urgent Follow-Ups */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 flex flex-col">
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Urgent Tasks</h2>
            <p className="text-xs text-slate-500 mt-0.5">Actionable follow-up reminders</p>
          </div>

          <div className="flex-1 space-y-3.5">
            {followUps.filter(f => f.status === "Pending").length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10 space-y-2">
                <AlertCircle className="w-10 h-10 text-emerald-500/20" />
                <div>
                  <p className="text-xs text-slate-400">All tasks completed successfully</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">New tasks will generate on doctor discussion summaries.</p>
                </div>
              </div>
            ) : (
              followUps.filter(f => f.status === "Pending").slice(0, 4).map((fup) => (
                <div key={fup.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={fup.status === "Completed"}
                    onChange={() => handleToggleFollowup(fup.id)}
                    className="mt-1 w-4 h-4 rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900 cursor-pointer"
                  />
                  <div className="space-y-1">
                    <p className="text-xs text-slate-200 leading-snug">{fup.actionItem}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-slate-400 font-medium">Dr. {fup.hcpName}</span>
                      <span className="text-[9px] text-slate-500">• Due: {fup.dueDate}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Recommendation box */}
          <div className="mt-6 bg-emerald-950/20 border border-emerald-500/10 rounded-xl p-4 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">System Recommendation</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                "You have scheduled visits pending. Use the AI Auto-Fill tool in the Log Engagement screen to instantly parse clinical voice dictations and update clinical deliverables."
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
