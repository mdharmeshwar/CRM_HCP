/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  RootState,
  AppDispatch,
  logStructuredInteraction,
  fetchHCPs,
  fetchInteractions,
} from "../redux/store.ts";
import {
  Sparkles,
  Loader2,
  CheckCircle,
  Stethoscope,
  ChevronRight,
  ClipboardList,
  RotateCcw,
  Plus,
  Mic,
  MicOff,
  Search,
  PlusCircle,
  Paperclip,
  Clock,
  Calendar,
  Users,
  Bot,
  Send,
  Smile,
  Meh,
  Frown,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function LogInteraction() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedHcpId = searchParams.get("hcpId");

  const { list: hcps } = useSelector((state: RootState) => state.hcp);

  // Core Form State
  const [formState, setFormState] = useState({
    hcpName: "",
    hospital: "",
    speciality: "Cardiology",
    date: new Date().toISOString().split("T")[0],
    time: "19:36",
    type: "Meeting" as "Meeting" | "Call" | "Email" | "Conference",
    summary: "",
    productsDiscussed: [] as string[],
    samplesGiven: "",
    followUpRequired: false,
    nextMeetingDate: "",
    priority: "Medium" as "Low" | "Medium" | "High",
    notes: "",
    
    // Additional alignment-specific fields
    attendees: "",
    topicsDiscussed: "",
    outcomes: "",
    followUpActions: "",
    sentiment: "Neutral" as "Positive" | "Neutral" | "Negative",
  });

  // Dynamic Lists for Materials and Samples
  const [materialsSharedList, setMaterialsSharedList] = useState<string[]>([]);
  const [samplesDistributedList, setSamplesDistributedList] = useState<string[]>([]);
  
  // Quick Add Inputs
  const [newMaterial, setNewMaterial] = useState("");
  const [newSample, setNewSample] = useState("");
  const [showMaterialInput, setShowMaterialInput] = useState(false);
  const [showSampleInput, setShowSampleInput] = useState(false);

  // Recording State (Demo Feature)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTimer, setRecordingTimer] = useState(0);
  const recordingIntervalRef = useRef<any>(null);

  // Track fields updated by AI for visual highlight feedback (glowing borders)
  const [aiUpdatedFields, setAiUpdatedFields] = useState<Record<string, boolean>>({});

  // Chatbot Sidebar States
  const [chatInput, setChatInput] = useState("");
  const [isChatSending, setIsChatSending] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "assistant"; text: string }>>([
    {
      sender: "assistant",
      text: "Log interaction details here (e.g., \"Met Dr. Smith, discussed Product X efficacy, positive sentiment, shared brochure\") or ask for help.",
    },
  ]);

  // Overall status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dispatch(fetchHCPs(undefined));
  }, [dispatch]);

  // Pre-fill form if redirected with a specific HCP
  useEffect(() => {
    if (preselectedHcpId && hcps.length > 0) {
      const selected = hcps.find((h) => h.id === preselectedHcpId);
      if (selected) {
        setFormState((prev) => ({
          ...prev,
          hcpName: selected.name,
          hospital: selected.hospital,
          speciality: selected.speciality,
        }));
      }
    }
  }, [preselectedHcpId, hcps]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Handle topics dictation / recording demo
  const startRecordingDemo = () => {
    if (isRecording) {
      // Stop recording
      clearInterval(recordingIntervalRef.current);
      setIsRecording(false);
      setRecordingTimer(0);
      
      // Auto-type transcription
      const transcript = "Reviewed clinical efficacy outcomes of CardioProtect with the cardiology lead. Shared the latest peer-reviewed clinical brochure. Dr. Sarah Jenkins showed positive interest and scheduled next week follow-up.";
      setFormState(prev => ({
        ...prev,
        topicsDiscussed: transcript,
        summary: transcript
      }));
      setAiUpdatedFields(prev => ({ ...prev, topicsDiscussed: true, summary: true }));
      setTimeout(() => setAiUpdatedFields({}), 4000);
    } else {
      // Start recording
      setIsRecording(true);
      setRecordingTimer(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTimer(prev => prev + 1);
      }, 1000);
    }
  };

  // Cleanup interval
  useEffect(() => {
    return () => clearInterval(recordingIntervalRef.current);
  }, []);

  const handleProductToggle = (prod: string) => {
    setFormState((prev) => {
      const exists = prev.productsDiscussed.includes(prod);
      return {
        ...prev,
        productsDiscussed: exists
          ? prev.productsDiscussed.filter((p) => p !== prod)
          : [...prev.productsDiscussed, prod],
      };
    });
  };

  const addMaterial = () => {
    if (newMaterial.trim()) {
      setMaterialsSharedList(prev => [...prev, newMaterial.trim()]);
      setNewMaterial("");
      setShowMaterialInput(false);
    }
  };

  const addSample = () => {
    if (newSample.trim()) {
      setSamplesDistributedList(prev => [...prev, newSample.trim()]);
      setNewSample("");
      setShowSampleInput(false);
    }
  };

  const removeMaterial = (index: number) => {
    setMaterialsSharedList(prev => prev.filter((_, i) => i !== index));
  };

  const removeSample = (index: number) => {
    setSamplesDistributedList(prev => prev.filter((_, i) => i !== index));
  };

  // Run AI extraction from Chat Assistant or raw notes
  const handleChatSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { sender: "user", text: userText }]);
    setIsChatSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, draftState: formState }),
      });
      const data = await res.json();

      const interaction = data.toolResult?.interaction || data.extractedFields;
      if (interaction) {
        // Flatten any nested "updates" key (used by edit_interaction intent)
        const updates = interaction.updates || {};
        const target = { ...interaction, ...updates };

        // ─── CRITICAL FIX: Compute all updates SYNCHRONOUSLY before any setState call ───
        // In React 18, functional setState updaters run lazily (after awaits they are batched).
        // Mutating `updated` inside setFormState callback means it's always {} when read after.
        // We must pre-compute both the next form values and the highlight map before any setState.
        const nextFields: Partial<typeof formState> = {};
        const updated: Record<string, boolean> = {};

        if (target.hcpName) {
          nextFields.hcpName = target.hcpName;
          updated.hcpName = true;
        }
        if (target.hospital) {
          nextFields.hospital = target.hospital;
          updated.hospital = true;
        }
        if (target.speciality) {
          nextFields.speciality = target.speciality;
          updated.speciality = true;
        }
        if (target.date) {
          if (typeof target.date === "string" && target.date.includes("T")) {
            const [datePart, timePart] = target.date.split("T");
            nextFields.date = datePart;
            updated.date = true;
            if (timePart) {
              nextFields.time = timePart.slice(0, 5);
              updated.time = true;
            }
          } else {
            nextFields.date = target.date;
            updated.date = true;
          }
        }
        if (target.time) {
          nextFields.time = target.time;
          updated.time = true;
        }
        if (target.type) {
          nextFields.type = target.type;
          updated.type = true;
        }
        if (target.summary) {
          nextFields.summary = target.summary;
          nextFields.topicsDiscussed = target.summary;
          updated.summary = true;
          updated.topicsDiscussed = true;
        }
        if (target.productsDiscussed && Array.isArray(target.productsDiscussed) && target.productsDiscussed.length > 0) {
          nextFields.productsDiscussed = target.productsDiscussed;
          updated.productsDiscussed = true;
        }
        // BUG FIX: backend returns "None" (string) when no samples given — "None" is truthy!
        if (target.samplesGiven && target.samplesGiven !== "None") {
          nextFields.samplesGiven = target.samplesGiven;
          updated.samplesGiven = true;
        }
        if (target.followUpRequired !== undefined) {
          nextFields.followUpRequired = target.followUpRequired;
          updated.followUpRequired = true;
        }
        if (target.nextMeetingDate) {
          nextFields.nextMeetingDate = target.nextMeetingDate;
          updated.nextMeetingDate = true;
        }
        if (target.priority) {
          nextFields.priority = target.priority;
          updated.priority = true;
        }
        if (target.notes) {
          nextFields.notes = target.notes;
          updated.notes = true;
        }

        // Infer sentiment from user's message text
        if (
          userText.toLowerCase().includes("positive") ||
          userText.toLowerCase().includes("great") ||
          userText.toLowerCase().includes("favorable")
        ) {
          nextFields.sentiment = "Positive";
          updated.sentiment = true;
        }

        // Now apply all field changes in a single setState (no mutations inside updater)
        setFormState(prev => ({ ...prev, ...nextFields }));

        // BUG FIX: setSamplesDistributedList was inside setFormState callback (anti-pattern).
        // Call it here after pre-computation is done.
        if (nextFields.samplesGiven) {
          setSamplesDistributedList([nextFields.samplesGiven]);
        }

        // setAiUpdatedFields now receives a fully-populated `updated` object (not {})
        setAiUpdatedFields(updated);
        setTimeout(() => setAiUpdatedFields({}), 4000);

        setChatMessages(prev => [
          ...prev,
          {
            sender: "assistant",
            text: data.responseText || "I updated the interaction draft and synced the form fields for you.",
          },
        ]);

        if (data.intent === "edit_interaction") {
          dispatch(fetchInteractions());
        }
      } else if (data.responseText) {
        if (data.intent === "edit_interaction" && data.toolResult?.success) {
          dispatch(fetchInteractions());
        }
        setChatMessages(prev => [
          ...prev,
          {
            sender: "assistant",
            text: data.responseText,
          },
        ]);
      } else {
        setChatMessages(prev => [
          ...prev,
          {
            sender: "assistant",
            text: "I couldn't extract structured fields from that note. Please fill in the details manually.",
          },
        ]);
      }
    } catch (err) {
      console.error("AI chat failed:", err);
      setChatMessages(prev => [
        ...prev,
        {
          sender: "assistant",
          text: "Connection error. Please try again or fill in the ledger manually.",
        },
      ]);
    } finally {
      setIsChatSending(false);
    }
  };

  // Demo loader for clicking AI Suggested followups
  const handleSuggestedFollowUp = (type: string) => {
    const updated: Record<string, boolean> = {};
    if (type === "meeting") {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);
      setFormState(prev => ({
        ...prev,
        followUpRequired: true,
        nextMeetingDate: futureDate.toISOString().split("T")[0],
        followUpActions: "Schedule formal follow-up advisory board presentation"
      }));
      updated.followUpRequired = true;
      updated.nextMeetingDate = true;
      updated.followUpActions = true;
    } else if (type === "pdf") {
      setMaterialsSharedList(prev => {
        if (!prev.includes("OncoBoost Phase III Trial PDF")) {
          return [...prev, "OncoBoost Phase III Trial PDF"];
        }
        return prev;
      });
      setFormState(prev => ({
        ...prev,
        topicsDiscussed: prev.topicsDiscussed + " agreed to send clinical PDF document."
      }));
      updated.topicsDiscussed = true;
    } else if (type === "advisory") {
      setFormState(prev => ({
        ...prev,
        outcomes: "Flagged Dr. Sharma for the clinical advisory board invitation list",
        priority: "High"
      }));
      updated.outcomes = true;
      updated.priority = true;
    }
    setAiUpdatedFields(updated);
    setTimeout(() => setAiUpdatedFields({}), 4000);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.hcpName.trim()) {
      alert("Physician name is required to log an interaction.");
      return;
    }
    setIsSubmitting(true);

    const consolidatedNotes = [
      formState.attendees ? `Attendees: ${formState.attendees}` : "",
      formState.sentiment ? `Observed Sentiment: ${formState.sentiment}` : "",
      materialsSharedList.length > 0 ? `Materials: ${materialsSharedList.join(", ")}` : "",
      samplesDistributedList.length > 0 ? `Samples: ${samplesDistributedList.join(", ")}` : "",
      formState.outcomes ? `Outcomes: ${formState.outcomes}` : "",
      formState.followUpActions ? `Follow-up Action Plan: ${formState.followUpActions}` : "",
      formState.notes ? `Additional Notes: ${formState.notes}` : ""
    ].filter(Boolean).join(" | ");

    dispatch(
      logStructuredInteraction({
        hcpName: formState.hcpName,
        date: `${formState.date}T${formState.time}:00`,
        type: formState.type,
        summary: formState.topicsDiscussed || formState.summary || formState.outcomes || "Completed field meeting with physician",
        productsDiscussed: formState.productsDiscussed,
        samplesGiven: samplesDistributedList.join(", ") || formState.samplesGiven || "None",
        followUpRequired: formState.followUpRequired,
        nextMeetingDate: formState.followUpRequired ? formState.nextMeetingDate : null,
        priority: formState.priority,
        notes: consolidatedNotes,
      })
    )
      .then(() => {
        dispatch(fetchInteractions());
        setSubmitSuccess(true);
        setIsSubmitting(false);
      })
      .catch((err) => {
        console.error("Failed to save:", err);
        setIsSubmitting(false);
      });
  };

  const resetForm = () => {
    setFormState({
      hcpName: "",
      hospital: "",
      speciality: "Cardiology",
      date: new Date().toISOString().split("T")[0],
      time: "19:36",
      type: "Meeting",
      summary: "",
      productsDiscussed: [],
      samplesGiven: "",
      followUpRequired: false,
      nextMeetingDate: "",
      priority: "Medium",
      notes: "",
      attendees: "",
      topicsDiscussed: "",
      outcomes: "",
      followUpActions: "",
      sentiment: "Neutral",
    });
    setMaterialsSharedList([]);
    setSamplesDistributedList([]);
    setAiUpdatedFields({});
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-emerald-400" />
          <span>Log HCP Interaction</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Record specialized field conversations, materials, and clinical samples on the therapeutic ledger
        </p>
      </div>

      {submitSuccess ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-8 text-center space-y-6 shadow-xl max-w-2xl mx-auto"
        >
          <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white">Engagement Saved Successfully!</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Your session notes with {formState.hcpName} have been committed to the secure ledger.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setSubmitSuccess(false);
                resetForm();
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              Log Another Engagement
            </button>
            <button
              onClick={() => navigate("/history")}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-semibold shadow-lg shadow-emerald-500/10 transition-all cursor-pointer flex items-center gap-1"
            >
              <span>View Ledger History</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT SIDE: Interaction Details Form */}
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-emerald-400" />
                <span>Interaction Details</span>
              </h2>
              <span className="text-[10px] text-slate-500 bg-slate-950 px-2.5 py-1 rounded-md font-mono">
                FORM SYNCED
              </span>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-5">
              {/* Row 1: HCP Name & Interaction Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    HCP Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Search or select HCP..."
                      value={formState.hcpName}
                      onChange={(e) => setFormState({ ...formState, hcpName: e.target.value })}
                      className={`w-full bg-slate-950 border rounded-xl pl-3 pr-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all ${
                        aiUpdatedFields.hcpName ? "border-emerald-500 ring-2 ring-emerald-500/15" : "border-slate-800"
                      }`}
                    />
                    <Search className="absolute right-3.5 top-3 w-4 h-4 text-slate-600 pointer-events-none" />
                    
                    {/* Tiny select assist for easy input */}
                    {hcps.length > 0 && !formState.hcpName && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-800 rounded-xl max-h-32 overflow-y-auto shadow-xl p-1">
                        {hcps.map((h) => (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => setFormState(prev => ({
                              ...prev,
                              hcpName: h.name,
                              hospital: h.hospital,
                              speciality: h.speciality
                            }))}
                            className="w-full text-left px-3 py-1.5 text-[11px] text-slate-300 hover:bg-slate-900 rounded-lg transition-colors truncate"
                          >
                            {h.name} ({h.speciality})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Interaction Type
                  </label>
                  <select
                    value={formState.type}
                    onChange={(e) => setFormState({ ...formState, type: e.target.value as any })}
                    className={`w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-all ${
                      aiUpdatedFields.type ? "border-emerald-500 ring-2 ring-emerald-500/15" : "border-slate-800"
                    }`}
                  >
                    <option value="Meeting">Meeting</option>
                    <option value="Call">Call</option>
                    <option value="Email">Email</option>
                    <option value="Conference">Conference</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Date & Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Date</span>
                  </label>
                  <input
                    type="date"
                    value={formState.date}
                    onChange={(e) => setFormState({ ...formState, date: e.target.value })}
                    className={`w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-all ${
                      aiUpdatedFields.date ? "border-emerald-500 ring-2 ring-emerald-500/15" : "border-slate-800"
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Time</span>
                  </label>
                  <input
                    type="time"
                    value={formState.time}
                    onChange={(e) => setFormState({ ...formState, time: e.target.value })}
                    className={`w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-all ${
                      aiUpdatedFields.time ? "border-emerald-500 ring-2 ring-emerald-500/15" : "border-slate-800"
                    }`}
                  />
                </div>
              </div>

              {/* Row 3: Attendees */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>Attendees</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter names or search..."
                  value={formState.attendees}
                  onChange={(e) => setFormState({ ...formState, attendees: e.target.value })}
                  className={`w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all ${
                    aiUpdatedFields.attendees ? "border-emerald-500 ring-2 ring-emerald-500/15" : "border-slate-800"
                  }`}
                />
              </div>

              {/* Row 4: Topics Discussed & Audio Trigger */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Topics Discussed
                </label>
                <div className="relative">
                  <textarea
                    placeholder="Enter key discussion points..."
                    value={formState.topicsDiscussed}
                    onChange={(e) => setFormState({ ...formState, topicsDiscussed: e.target.value, summary: e.target.value })}
                    rows={3}
                    className={`w-full bg-slate-950 border rounded-xl pl-3 pr-10 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all resize-none ${
                      aiUpdatedFields.topicsDiscussed ? "border-emerald-500 ring-2 ring-emerald-500/15" : "border-slate-800"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={startRecordingDemo}
                    title={isRecording ? "Stop dictation" : "Record voice notes"}
                    className={`absolute right-3.5 bottom-3.5 p-1.5 rounded-lg border transition-all ${
                      isRecording
                        ? "bg-rose-500 border-rose-400 text-white animate-pulse"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {isRecording && (
                  <div className="flex items-center gap-2 px-1 text-[11px] text-rose-400 animate-pulse font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    <span>Live Audio Dictation: Recording ({recordingTimer}s)...</span>
                  </div>
                )}

                {/* Summarize from Voice Note Button */}
                <button
                  type="button"
                  onClick={startRecordingDemo}
                  className="w-full py-2.5 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Summarize from Voice Note (Requires Consent)</span>
                </button>
              </div>

              {/* Products Discussed Checkboxes */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Products Discussed
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    "CardioProtect (Lisinopril)",
                    "GlycaStop (Metformin XR)",
                    "OncoShield (Trastuzumab)",
                    "LipidDown (Atorvastatin)",
                    "PulmoClear (Albuterol)",
                  ].map((p) => {
                    const isActive = formState.productsDiscussed.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleProductToggle(p)}
                        className={`text-[10px] px-3.5 py-2 rounded-full border transition-all cursor-pointer ${
                          isActive
                            ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-300 font-bold"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 5: Materials Shared & Samples Distributed Panel */}
              <div className="space-y-1.5">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Materials Shared / Samples Distributed
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Materials Shared Card */}
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                      <span className="text-[11px] font-bold text-slate-300">Materials Shared</span>
                      <button
                        type="button"
                        onClick={() => setShowMaterialInput(!showMaterialInput)}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Search className="w-3 h-3" />
                        <span>Search/Add</span>
                      </button>
                    </div>

                    <div className="space-y-1.5 min-h-12 flex flex-col justify-center">
                      {materialsSharedList.length === 0 ? (
                        <span className="text-[11px] text-slate-500 italic text-center">No materials added.</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {materialsSharedList.map((m, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-slate-300">
                              <Paperclip className="w-3 h-3 text-slate-500" />
                              <span className="truncate max-w-32">{m}</span>
                              <button
                                type="button"
                                onClick={() => removeMaterial(i)}
                                className="text-slate-500 hover:text-rose-400 font-bold cursor-pointer"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {showMaterialInput && (
                      <div className="flex gap-1 pt-1.5">
                        <input
                          type="text"
                          placeholder="e.g. Lipids Starter Brochure"
                          value={newMaterial}
                          onChange={(e) => setNewMaterial(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMaterial())}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={addMaterial}
                          className="px-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Samples Distributed Card */}
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                      <span className="text-[11px] font-bold text-slate-300">Samples Distributed</span>
                      <button
                        type="button"
                        onClick={() => setShowSampleInput(!showSampleInput)}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <PlusCircle className="w-3 h-3" />
                        <span>Add Sample</span>
                      </button>
                    </div>

                    <div className="space-y-1.5 min-h-12 flex flex-col justify-center">
                      {samplesDistributedList.length === 0 ? (
                        <span className="text-[11px] text-slate-500 italic text-center">No samples added.</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {samplesDistributedList.map((s, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-emerald-400 font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>{s}</span>
                              <button
                                type="button"
                                onClick={() => removeSample(i)}
                                className="text-slate-500 hover:text-rose-400 font-bold cursor-pointer ml-1"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {showSampleInput && (
                      <div className="flex gap-1 pt-1.5">
                        <input
                          type="text"
                          placeholder="e.g. 10 co-pay starter cards"
                          value={newSample}
                          onChange={(e) => setNewSample(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSample())}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={addSample}
                          className="px-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 6: Observed/Inferred HCP Sentiment */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Observed/Inferred HCP Sentiment
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: "Positive", emoji: Smile, label: "Positive", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
                    { value: "Neutral", emoji: Meh, label: "Neutral", color: "text-slate-300 bg-slate-950 border-slate-800" },
                    { value: "Negative", emoji: Frown, label: "Negative", color: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
                  ].map((s) => {
                    const isSelected = formState.sentiment === s.value;
                    const IconComp = s.emoji;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setFormState({ ...formState, sentiment: s.value })}
                        className={`flex items-center justify-center gap-2 py-3 px-4 border rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                          isSelected
                            ? s.color + " ring-2 ring-indigo-500/15 font-bold"
                            : "bg-slate-950/60 border-slate-850 text-slate-400 hover:border-slate-800"
                        }`}
                      >
                        <IconComp className="w-4 h-4 shrink-0" />
                        <span>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 7: Outcomes */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Outcomes
                </label>
                <textarea
                  placeholder="Key outcomes or agreements..."
                  value={formState.outcomes}
                  onChange={(e) => setFormState({ ...formState, outcomes: e.target.value })}
                  rows={2}
                  className={`w-full bg-slate-950 border rounded-xl px-3.5 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all resize-none ${
                    aiUpdatedFields.outcomes ? "border-emerald-500 ring-2 ring-emerald-500/15" : "border-slate-800"
                  }`}
                />
              </div>

              {/* Row 8: Follow-up Actions & Toggle */}
              <div className="space-y-3 bg-slate-950/30 border border-slate-850 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-white">Create Urgent Follow-up Task</span>
                    <p className="text-[10px] text-slate-500">
                      Schedules a pending action item automatically in your task tracker
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={formState.followUpRequired}
                      onChange={(e) => setFormState({ ...formState, followUpRequired: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Follow-up Actions
                    </label>
                    <textarea
                      placeholder="Enter next steps or tasks..."
                      value={formState.followUpActions}
                      onChange={(e) => setFormState({ ...formState, followUpActions: e.target.value })}
                      rows={2}
                      className={`w-full bg-slate-950 border rounded-xl px-3.5 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all resize-none ${
                        aiUpdatedFields.followUpActions ? "border-emerald-500 ring-2 ring-emerald-500/15" : "border-slate-800"
                      }`}
                    />
                  </div>

                  <AnimatePresence>
                    {formState.followUpRequired && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-1.5 pt-1.5"
                      >
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Next Scheduled Visit / Follow-up Date
                        </label>
                        <input
                          type="date"
                          required={formState.followUpRequired}
                          value={formState.nextMeetingDate}
                          onChange={(e) => setFormState({ ...formState, nextMeetingDate: e.target.value })}
                          className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-all ${
                            aiUpdatedFields.nextMeetingDate ? "border-emerald-500 ring-2 ring-emerald-500/15" : ""
                          }`}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Row 9: AI Suggested Follow-ups */}
              <div className="space-y-2 pt-1 border-t border-slate-800">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  AI Suggested Follow-ups:
                </span>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleSuggestedFollowUp("meeting")}
                    className="w-full text-left text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>+ Schedule follow-up meeting in 2 weeks</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSuggestedFollowUp("pdf")}
                    className="w-full text-left text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>+ Send OncoBoost Phase III PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSuggestedFollowUp("advisory")}
                    className="w-full text-left text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>+ Add Dr. Sharma to advisory board invite list</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-3 bg-slate-950 hover:bg-slate-800 border border-slate-850 text-slate-400 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset Form</span>
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving to CRM Ledger...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Commit to central ledger</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* RIGHT SIDE: AI Assistant Sidebar Panel */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col h-[700px] lg:sticky lg:top-6 overflow-hidden">
            {/* Sidebar Header */}
            <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">AI Assistant</h3>
                <span className="text-[9px] text-slate-500 font-medium tracking-wide">Log interaction via chat</span>
              </div>
            </div>

            {/* Chat Bubble Container */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 flex flex-col bg-slate-950/20">
              <AnimatePresence initial={false}>
                {chatMessages.map((msg, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-md ${
                        msg.sender === "user"
                          ? "bg-indigo-600 text-white rounded-tr-none"
                          : "bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-none"
                      }`}
                    >
                      <span>{msg.text}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={chatEndRef} />
            </div>

            {/* Chat input form */}
            <form onSubmit={handleChatSubmit} className="p-4 bg-slate-950 border-t border-slate-800 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Describe interaction..."
                  disabled={isChatSending}
                  className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                />
                <button
                  type="submit"
                  disabled={isChatSending || !chatInput.trim()}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  {isChatSending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Log</span>
                    </>
                  )}
                </button>
              </div>
              <span className="block text-[9px] text-slate-500 text-center">
                Press Enter to submit and auto-fill the form on the left.
              </span>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
