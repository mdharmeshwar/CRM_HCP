/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch, fetchInteractions, fetchFollowUps, toggleFollowUp } from "../redux/store.ts";
import {
  ArrowLeft,
  Building2,
  Stethoscope,
  BriefcaseMedical,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function InteractionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const { list: interactions } = useSelector((state: RootState) => state.interaction);
  const { followUps } = useSelector((state: RootState) => state.interaction);

  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPlan, setAiPlan] = useState<{
    actionItem: string;
    suggestedDate: string;
    justification: string;
    clinicalValue: string;
  } | null>(null);

  const interaction = interactions.find((i) => i.id === id);

  useEffect(() => {
    if (interactions.length === 0) {
      dispatch(fetchInteractions());
    }
    dispatch(fetchFollowUps());
  }, [dispatch, interactions.length]);

  if (!interaction) {
    return (
      <div className="py-20 text-center bg-slate-950 border border-slate-800 rounded-xl max-w-2xl mx-auto space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-md font-bold text-white">Record Not Found</h2>
        <p className="text-xs text-slate-500">The requested communication log ID does not exist or has been archived.</p>
        <button
          onClick={() => navigate("/history")}
          className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 rounded-lg text-xs"
        >
          Return to History
        </button>
      </div>
    );
  }

  // Related follow ups
  const relatedFollowups = followUps.filter((f) => f.interactionId === interaction.id);

  const handleGenerateFollowupPlan = async () => {
    setIsGenerating(true);
    setAiPlan(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `Generate follow up plan for interaction ${interaction.id}` }),
      });
      const data = await res.json();
      if (data.toolResult?.success && data.toolResult?.suggestions) {
        setAiPlan(data.toolResult.suggestions);
        dispatch(fetchFollowUps()); // refresh follow ups list
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleFup = (fupId: string) => {
    dispatch(toggleFollowUp(fupId));
  };

  return (
    <div id="details-page" className="space-y-6 max-w-6xl mx-auto">
      {/* Back Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/history")}
          className="p-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-mono">Ledger Inspection ID: {interaction.id}</span>
          <h1 className="text-lg md:text-xl font-bold text-white tracking-tight">Physician Communication Audit</h1>
        </div>
      </div>

      {/* Main Grid: Details Form + AI Followup Generator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Card: Structural Record (7 Columns) */}
        <div className="lg:col-span-7 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[24px] p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-white/5">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white">{interaction.hcpName}</h2>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span>{interaction.hospital}</span>
                <span>•</span>
                <Stethoscope className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-emerald-400 font-medium">{interaction.speciality}</span>
              </div>
            </div>

            <span className="self-start sm:self-auto px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-xs font-semibold">
              {interaction.type}
            </span>
          </div>

          {/* Record Details Layout */}
          <div className="space-y-5 text-xs text-slate-350">
            {/* Summary Block */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Executive Discussion Summary</span>
              <p className="bg-black/20 p-4 rounded-xl border border-white/5 text-slate-200 leading-relaxed font-sans">
                {interaction.summary}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Engagement Date */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Engagement Date</span>
                <span className="block font-mono bg-slate-900/40 border border-white/5 p-3 rounded-lg text-white">
                  {interaction.date}
                </span>
              </div>

              {/* Priority */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Priority Classification</span>
                <span className="block font-semibold bg-slate-900/40 border border-white/5 p-3 rounded-lg text-white">
                  {interaction.priority}
                </span>
              </div>
            </div>

            {/* Products Discussed */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Formulary Topics & Products</span>
              <div className="flex flex-wrap gap-2">
                {interaction.productsDiscussed.map((prod) => (
                  <span key={prod} className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 rounded-lg text-[11px] font-medium flex items-center gap-1.5">
                    <BriefcaseMedical className="w-3.5 h-3.5 text-indigo-400" />
                    {prod}
                  </span>
                ))}
              </div>
            </div>

            {/* Samples given */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Clinical Samples Distributed</span>
              <span className="block bg-slate-900/40 border border-white/5 p-3.5 rounded-lg text-slate-250 font-sans">
                {interaction.samplesGiven || "No starter kits or brochures distributed."}
              </span>
            </div>

            {/* Internal rep notes */}
            {interaction.notes && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Representative Notes</span>
                <p className="italic text-slate-400 leading-relaxed">
                  "{interaction.notes}"
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Card: AI Follow-up Strategy & Actions (5 Columns) */}
        <div className="lg:col-span-5 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[24px] p-6 flex flex-col justify-between">
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>AI Follow-Up Strategy</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Use LangGraph to generate clinical trial targets</p>
            </div>

            {/* Button to run followup strategy tool */}
            <button
              onClick={handleGenerateFollowupPlan}
              disabled={isGenerating}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-900 text-slate-950 disabled:text-slate-500 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Synthesizing Strategy Graph...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>Generate Strategic Action Items</span>
                </>
              )}
            </button>

            {/* Display Generated Strategy */}
            <AnimatePresence>
              {aiPlan && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-4 text-xs"
                >
                  <div className="space-y-1 border-b border-white/5 pb-3">
                    <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold block">Generated Action Item</span>
                    <p className="text-white font-medium">{aiPlan.actionItem}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block mb-0.5">Suggested Date</span>
                      <span className="text-white bg-slate-950 border border-white/5 px-2.5 py-1 rounded font-mono text-[10px]">
                        {aiPlan.suggestedDate}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block mb-0.5">Medical Value</span>
                      <span className="text-white text-[10px]">
                        {aiPlan.clinicalValue}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 pt-2 border-t border-white/5">
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Strategic Justification</span>
                    <p className="text-slate-400 italic leading-relaxed">
                      "{aiPlan.justification}"
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Commited Action Items in DB */}
            <div className="space-y-3 pt-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Committed Planner Tasks</span>
              {relatedFollowups.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">No tasks active. Generate above to schedule action items.</p>
              ) : (
                <div className="space-y-2.5">
                  {relatedFollowups.map((fup) => (
                    <div key={fup.id} className="bg-slate-900 border border-white/5 rounded-lg p-3 flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={fup.status === "Completed"}
                        onChange={() => handleToggleFup(fup.id)}
                        className="mt-1 w-3.5 h-3.5 rounded border-slate-800 bg-slate-950 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div className="space-y-0.5 text-[11px]">
                        <p className={`font-medium ${fup.status === "Completed" ? "line-through text-slate-500" : "text-white"}`}>
                          {fup.actionItem}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span>Due: {fup.dueDate}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-white/5 text-[10px] text-slate-500 flex items-center justify-between font-mono">
            <span>Security Isolation Validated</span>
            <span>PORTAL: 83159b3d</span>
          </div>
        </div>
      </div>
    </div>
  );
}
