/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchInteractions, RootState, AppDispatch } from "../redux/store.ts";
import {
  Search,
  SlidersHorizontal,
  Download,
  ArrowUpDown,
  Filter,
  Eye,
  Edit,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function InteractionHistory() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { list: interactions, loading } = useSelector((state: RootState) => state.interaction);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const [sortBy, setSortBy] = useState<"date" | "priority">("date");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    dispatch(fetchInteractions());
  }, [dispatch]);

  const getPriorityWeight = (p: string) => {
    if (p === "High") return 3;
    if (p === "Medium") return 2;
    return 1;
  };

  // Filter and Sort interactions
  const filteredList = interactions
    .filter((item) => {
      const matchSearch =
        item.hcpName.toLowerCase().includes(search.toLowerCase()) ||
        item.hospital.toLowerCase().includes(search.toLowerCase()) ||
        item.summary.toLowerCase().includes(search.toLowerCase());
      
      const matchType = filterType === "All" || item.type === filterType;
      const matchPriority = filterPriority === "All" || item.priority === filterPriority;

      return matchSearch && matchType && matchPriority;
    })
    .sort((a, b) => {
      if (sortBy === "date") {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      } else {
        return getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
      }
    });

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "High": return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "Medium": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default: return "bg-sky-500/10 text-sky-400 border-sky-500/20";
    }
  };

  // CSV Export helper
  const handleExportCSV = () => {
    const headers = ["ID", "HCP Name", "Hospital", "Specialty", "Date", "Channel Type", "Priority", "Summary", "Products Discussed", "Samples Given"];
    const rows = filteredList.map((item) => [
      item.id,
      item.hcpName,
      item.hospital,
      item.speciality,
      item.date,
      item.type,
      item.priority,
      item.summary.replace(/"/g, '""'),
      item.productsDiscussed.join("; "),
      item.samplesGiven
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `HCP_Interaction_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="interaction-history-page" className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Interaction History</h1>
          <p className="text-xs text-slate-400 mt-1">Audit-ready pharmaceutical touchpoint registries</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-white/5 border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/10 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Control panel: Search, filters, sorting */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by physician, clinic or products..."
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-2 border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                showFilters ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-slate-900 border-slate-800 text-slate-300"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Filters</span>
            </button>

            <button
              onClick={() => setSortBy(sortBy === "date" ? "priority" : "date")}
              className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-semibold text-slate-300 flex items-center gap-1.5 hover:border-slate-700 transition-all cursor-pointer"
            >
              <ArrowUpDown className="w-4 h-4" />
              <span>Sort: {sortBy === "date" ? "Chronological" : "Priority"}</span>
            </button>
          </div>
        </div>

        {/* Extended Filters Drawer */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-900 overflow-hidden"
            >
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Interaction Channel
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                >
                  <option value="All">All Channels</option>
                  <option value="Meeting">Meeting (In-person)</option>
                  <option value="Call">Call (Telephonic)</option>
                  <option value="Email">Email (Digital)</option>
                  <option value="Conference">Conference (Symposium)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Interaction Priority
                </label>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                >
                  <option value="All">All Priorities</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Interactions list layout */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-2">
          <span className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500">Retrieving audit log trail...</span>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="py-20 text-center bg-slate-950 border border-slate-800 rounded-xl">
          <Filter className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">No interactions match criteria</p>
          <p className="text-xs text-slate-500 mt-1">Try resetting your filters or search keywords.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredList.map((item) => (
            <motion.div
              layout
              key={item.id}
              className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
            >
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-white">{item.hcpName}</span>
                  <span className="text-xs text-slate-400">• {item.hospital}</span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-medium">
                    {item.speciality}
                  </span>
                  <span className={`text-[9px] px-2 py-0.5 rounded border ${getPriorityBadge(item.priority)}`}>
                    {item.priority}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed max-w-4xl line-clamp-2">{item.summary}</p>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {item.productsDiscussed.map((prod, idx) => (
                    <span key={idx} className="text-[9.5px] bg-slate-900 text-slate-300 border border-slate-800 px-2.5 py-0.5 rounded">
                      {prod}
                    </span>
                  ))}
                  {item.samplesGiven !== "None" && (
                    <span className="text-[9.5px] bg-slate-900 text-slate-400 border border-slate-800/50 px-2.5 py-0.5 rounded">
                      Samples: {item.samplesGiven}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex md:flex-col items-end gap-3 shrink-0 self-stretch md:self-auto pt-4 md:pt-0 border-t border-slate-900 md:border-none justify-between md:justify-center">
                <div className="space-y-0.5 text-right">
                  <span className="text-[11px] text-slate-400 font-mono block">{item.date}</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{item.type}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/interactions/${item.id}`)}
                    className="p-2 bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-lg"
                    title="View details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => navigate(`/log-interaction?editId=${item.id}`)}
                    className="p-2 bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-lg"
                    title="Edit entry"
                  >
                    <Edit className="w-4 h-4 text-emerald-400" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
