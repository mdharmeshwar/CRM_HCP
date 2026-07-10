/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchHCPs, createHCP, RootState, AppDispatch } from "../redux/store.ts";
import { Search, UserPlus, X, Mail, Phone, MapPin, Building2, Stethoscope, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function HCPList() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { list: hcps, loading } = useSelector((state: RootState) => state.hcp);

  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // New HCP Form state
  const [formData, setFormData] = useState({
    name: "",
    hospital: "",
    speciality: "Cardiology",
    email: "",
    phone: "",
    address: ""
  });

  const [formError, setFormError] = useState("");

  useEffect(() => {
    dispatch(fetchHCPs(undefined));
  }, [dispatch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    dispatch(fetchHCPs(val));
  };

  const handleCreateHCP = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.hospital || !formData.speciality) {
      setFormError("Doctor Name, Hospital, and Specialty are strictly required.");
      return;
    }
    setFormError("");
    
    const emailToSubmit = formData.email || `${formData.name.toLowerCase().replace(/\s+/g, ".")}@hospital.com`;
    const phoneToSubmit = formData.phone || "+1 (555) 010-0000";
    const addressToSubmit = formData.address || `Near ${formData.hospital}`;

    dispatch(createHCP({
      name: formData.name.startsWith("Dr.") ? formData.name : `Dr. ${formData.name}`,
      hospital: formData.hospital,
      speciality: formData.speciality,
      email: emailToSubmit,
      phone: phoneToSubmit,
      address: addressToSubmit
    })).then(() => {
      setShowAddModal(false);
      setFormData({ name: "", hospital: "", speciality: "Cardiology", email: "", phone: "", address: "" });
    });
  };

  return (
    <div id="hcp-list-page" className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">HCP Directory</h1>
          <p className="text-xs text-slate-400 mt-1">Registry of medical experts and clinical specialists</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-500/10 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Register New HCP</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          value={search}
          onChange={handleSearchChange}
          placeholder="Search doctors by name, hospital, or specialty..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
        />
      </div>

      {/* HCP Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-2">
          <span className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500">Searching active roster...</span>
        </div>
      ) : hcps.length === 0 ? (
        <div className="py-20 text-center bg-slate-950 border border-slate-800 rounded-xl">
          <Stethoscope className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">No healthcare professionals found</p>
          <p className="text-xs text-slate-500 mt-1">Try refining your search keyword or register a new physician.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hcps.map((hcp) => (
            <motion.div
              layout
              key={hcp.id}
              className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-sm font-bold text-white leading-tight">{hcp.name}</h2>
                    <span className="inline-block mt-1 text-[10px] uppercase tracking-wider font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                      {hcp.speciality}
                    </span>
                  </div>
                  <Stethoscope className="w-5 h-5 text-slate-600" />
                </div>

                <div className="space-y-2.5 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>{hcp.hospital}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span className="truncate">{hcp.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>{hcp.phone}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <span>{hcp.address}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-900 flex justify-end gap-2">
                <button
                  onClick={() => navigate(`/log-interaction?hcpId=${hcp.id}`)}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Log Interaction</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add HCP Slideover Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black"
            />

            {/* Slide content */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md bg-slate-950 border-l border-slate-800 h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-emerald-400" />
                    <span>Register Physician</span>
                  </h2>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {formError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 text-xs text-rose-400">
                    {formError}
                  </div>
                )}

                <form className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Physician Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Medical Specialty *
                    </label>
                    <select
                      value={formData.speciality}
                      onChange={(e) => setFormData({ ...formData, speciality: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Cardiology">Cardiology</option>
                      <option value="Oncology">Oncology</option>
                      <option value="Endocrinology">Endocrinology</option>
                      <option value="Pediatrics">Pediatrics</option>
                      <option value="Infectious Diseases">Infectious Diseases</option>
                      <option value="General Medicine">General Medicine</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Hospital/Clinic Affiliation *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Metro Health General"
                      value={formData.hospital}
                      onChange={(e) => setFormData({ ...formData, hospital: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Secure Email Contact
                    </label>
                    <input
                      type="email"
                      placeholder="johndoe@clinic.org (optional)"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="+1 (555) 000-0000 (optional)"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Office Address
                    </label>
                    <textarea
                      placeholder="Room, Wing, Block, City (optional)"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      rows={2}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                    />
                  </div>
                </form>
              </div>

              <div className="pt-6 border-t border-slate-900 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 rounded-lg text-xs font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateHCP}
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-semibold transition-all shadow-lg shadow-emerald-500/10"
                >
                  Register Expert
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
