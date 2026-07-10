/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getMySQLPool, bootstrapMySQLSchema } from "./mysql";

export interface User {
  id: string;
  name: string;
  role: string;
  territory: string;
}

export interface HCP {
  id: string;
  name: string;
  hospital: string;
  speciality: string;
  email: string;
  phone: string;
  address: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
}

export interface Interaction {
  id: string;
  hcpId: string;
  hcpName: string;
  hospital: string;
  speciality: string;
  date: string;
  type: 'Meeting' | 'Call' | 'Email' | 'Conference';
  summary: string;
  productsDiscussed: string[];
  samplesGiven: string;
  followUpRequired: boolean;
  nextMeetingDate: string | null;
  priority: 'Low' | 'Medium' | 'High';
  notes: string;
}

export interface FollowUp {
  id: string;
  interactionId: string;
  hcpId: string;
  hcpName: string;
  actionItem: string;
  dueDate: string;
  status: 'Pending' | 'Completed';
}

export interface ActivityLog {
  id: string;
  action: string;
  timestamp: string;
  details: string;
  user: string;
}

// Relational In-Memory Database Class representing PostgreSQL tables
class Database {
  users: User[] = [];
  hcps: HCP[] = [];
  products: Product[] = [];
  interactions: Interaction[] = [];
  followUps: FollowUp[] = [];
  activityLogs: ActivityLog[] = [];

  constructor() {
    this.init();
  }

  async init() {
    this.seed();
    try {
      const active = await bootstrapMySQLSchema();
      if (active) {
        await this.loadFromMySQL();
      }
    } catch (err) {
      console.error("[MySQL] Init failed, running on in-memory fallback:", err);
    }
  }

  async loadFromMySQL() {
    const pool = getMySQLPool();
    if (!pool) return;

    try {
      // Check if tables are empty
      const [hcpRows] = await pool.query("SELECT * FROM hcps") as any[];
      if (hcpRows.length === 0) {
        console.log("[MySQL] DB is empty, persisting seeded data...");
        for (const h of this.hcps) {
          await pool.query(
            "INSERT INTO hcps (id, name, hospital, speciality, email, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [h.id, h.name, h.hospital, h.speciality, h.email, h.phone, h.address]
          );
        }
        for (const p of this.products) {
          await pool.query(
            "INSERT INTO products (id, name, category, description) VALUES (?, ?, ?, ?)",
            [p.id, p.name, p.category, p.description]
          );
        }
        for (const i of this.interactions) {
          await pool.query(
            "INSERT INTO interactions (id, hcpId, hcpName, hospital, speciality, date, type, summary, productsDiscussed, samplesGiven, followUpRequired, nextMeetingDate, priority, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [i.id, i.hcpId, i.hcpName, i.hospital, i.speciality, i.date, i.type, i.summary, JSON.stringify(i.productsDiscussed), i.samplesGiven, i.followUpRequired ? 1 : 0, i.nextMeetingDate, i.priority, i.notes]
          );
        }
        for (const f of this.followUps) {
          await pool.query(
            "INSERT INTO follow_ups (id, interactionId, hcpId, hcpName, actionItem, dueDate, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [f.id, f.interactionId, f.hcpId, f.hcpName, f.actionItem, f.dueDate, f.status]
          );
        }
        for (const log of this.activityLogs) {
          await pool.query(
            "INSERT INTO activity_logs (id, action, timestamp, details, user) VALUES (?, ?, ?, ?, ?)",
            [log.id, log.action, log.timestamp, log.details, log.user]
          );
        }
        console.log("[MySQL] Seeded data written to MySQL successfully!");
      } else {
        console.log("[MySQL] Loading existing data from MySQL...");
        this.hcps = hcpRows.map((r: any) => ({
          id: r.id,
          name: r.name,
          hospital: r.hospital,
          speciality: r.speciality,
          email: r.email,
          phone: r.phone,
          address: r.address
        }));

        const [prodRows] = await pool.query("SELECT * FROM products") as any[];
        this.products = prodRows.map((r: any) => ({
          id: r.id,
          name: r.name,
          category: r.category,
          description: r.description
        }));

        const [intRows] = await pool.query("SELECT * FROM interactions") as any[];
        this.interactions = intRows.map((r: any) => {
          let prods = [];
          try {
            prods = JSON.parse(r.productsDiscussed);
            if (!Array.isArray(prods)) prods = [r.productsDiscussed];
          } catch {
            prods = r.productsDiscussed ? r.productsDiscussed.split(",").map((s: string) => s.trim()) : [];
          }
          return {
            id: r.id,
            hcpId: r.hcpId,
            hcpName: r.hcpName,
            hospital: r.hospital,
            speciality: r.speciality,
            date: r.date,
            type: r.type,
            summary: r.summary,
            productsDiscussed: prods,
            samplesGiven: r.samplesGiven,
            followUpRequired: !!r.followUpRequired,
            nextMeetingDate: r.nextMeetingDate,
            priority: r.priority,
            notes: r.notes
          };
        });

        const [fupRows] = await pool.query("SELECT * FROM follow_ups") as any[];
        this.followUps = fupRows.map((r: any) => ({
          id: r.id,
          interactionId: r.interactionId,
          hcpId: r.hcpId,
          hcpName: r.hcpName,
          actionItem: r.actionItem,
          dueDate: r.dueDate,
          status: r.status
        }));

        const [logRows] = await pool.query("SELECT * FROM activity_logs") as any[];
        this.activityLogs = logRows.map((r: any) => ({
          id: r.id,
          action: r.action,
          timestamp: r.timestamp,
          details: r.details,
          user: r.user
        }));
        
        console.log(`[MySQL] Loaded ${this.hcps.length} HCPs, ${this.interactions.length} Interactions, ${this.followUps.length} Follow-ups from MySQL.`);
      }
    } catch (err) {
      console.error("[MySQL] Error loading database tables:", err);
    }
  }

  async saveHCPToMySQL(hcp: HCP) {
    const pool = getMySQLPool();
    if (!pool) return;
    try {
      await pool.query(
        "INSERT INTO hcps (id, name, hospital, speciality, email, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=?, hospital=?, speciality=?, email=?, phone=?, address=?",
        [hcp.id, hcp.name, hcp.hospital, hcp.speciality, hcp.email, hcp.phone, hcp.address, hcp.name, hcp.hospital, hcp.speciality, hcp.email, hcp.phone, hcp.address]
      );
    } catch (err) {
      console.error("[MySQL] Error saving HCP:", err);
    }
  }

  async saveInteractionToMySQL(int: Interaction) {
    const pool = getMySQLPool();
    if (!pool) return;
    try {
      await pool.query(
        "INSERT INTO interactions (id, hcpId, hcpName, hospital, speciality, date, type, summary, productsDiscussed, samplesGiven, followUpRequired, nextMeetingDate, priority, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE hcpId=?, hcpName=?, hospital=?, speciality=?, date=?, type=?, summary=?, productsDiscussed=?, samplesGiven=?, followUpRequired=?, nextMeetingDate=?, priority=?, notes=?",
        [
          int.id, int.hcpId, int.hcpName, int.hospital, int.speciality, int.date, int.type, int.summary, JSON.stringify(int.productsDiscussed), int.samplesGiven, int.followUpRequired ? 1 : 0, int.nextMeetingDate, int.priority, int.notes,
          int.hcpId, int.hcpName, int.hospital, int.speciality, int.date, int.type, int.summary, JSON.stringify(int.productsDiscussed), int.samplesGiven, int.followUpRequired ? 1 : 0, int.nextMeetingDate, int.priority, int.notes
        ]
      );
    } catch (err) {
      console.error("[MySQL] Error saving Interaction:", err);
    }
  }

  async saveFollowUpToMySQL(fup: FollowUp) {
    const pool = getMySQLPool();
    if (!pool) return;
    try {
      await pool.query(
        "INSERT INTO follow_ups (id, interactionId, hcpId, hcpName, actionItem, dueDate, status) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE interactionId=?, hcpId=?, hcpName=?, actionItem=?, dueDate=?, status=?",
        [
          fup.id, fup.interactionId, fup.hcpId, fup.hcpName, fup.actionItem, fup.dueDate, fup.status,
          fup.interactionId, fup.hcpId, fup.hcpName, fup.actionItem, fup.dueDate, fup.status
        ]
      );
    } catch (err) {
      console.error("[MySQL] Error saving Follow-up:", err);
    }
  }

  async deleteFollowUpFromMySQL(id: string) {
    const pool = getMySQLPool();
    if (!pool) return;
    try {
      await pool.query("DELETE FROM follow_ups WHERE id = ?", [id]);
    } catch (err) {
      console.error("[MySQL] Error deleting Follow-up:", err);
    }
  }

  async saveActivityLogToMySQL(log: ActivityLog) {
    const pool = getMySQLPool();
    if (!pool) return;
    try {
      await pool.query(
        "INSERT INTO activity_logs (id, action, timestamp, details, user) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE action=?, timestamp=?, details=?, user=?",
        [log.id, log.action, log.timestamp, log.details, log.user, log.action, log.timestamp, log.details, log.user]
      );
    } catch (err) {
      console.error("[MySQL] Error saving Activity Log:", err);
    }
  }

  private seed() {
    // Current User
    this.users.push({
      id: "u-1",
      name: "Alex Mercer",
      role: "Senior Specialty Care Representative",
      territory: "Pacific Northwest Division"
    });

    // Healthcare Professionals
    this.hcps.push(
      {
        id: "hcp-1",
        name: "Dr. Sarah Jenkins",
        hospital: "Metro Cardiology Center",
        speciality: "Cardiology",
        email: "sjenkins@metrocardio.org",
        phone: "+1 (555) 019-2834",
        address: "742 Evergreen Terrace, Suite 300, Portland, OR"
      },
      {
        id: "hcp-2",
        name: "Dr. Robert Chen",
        hospital: "City Cancer Institute",
        speciality: "Oncology",
        email: "r.chen@citycancer.org",
        phone: "+1 (555) 014-9821",
        address: "910 Cancer Care Blvd, Wing B, Seattle, WA"
      },
      {
        id: "hcp-3",
        name: "Dr. Michael Patel",
        hospital: "Summit Endocrinology Clinic",
        speciality: "Endocrinology",
        email: "mpatel@summitendo.com",
        phone: "+1 (555) 023-8833",
        address: "1200 Summit View Dr, Seattle, WA"
      },
      {
        id: "hcp-4",
        name: "Dr. Emily Vance",
        hospital: "St. Jude Children's Research Annex",
        speciality: "Pediatrics",
        email: "evance@stjude-annex.org",
        phone: "+1 (555) 018-4422",
        address: "450 Hope Lane, Portland, OR"
      },
      {
        id: "hcp-5",
        name: "Dr. Gregory House",
        hospital: "Princeton-Plainsboro Teaching Hospital",
        speciality: "Infectious Diseases",
        email: "ghouse@ppth.edu",
        phone: "+1 (555) 031-1004",
        address: "100 Hospital Drive, Princeton, NJ"
      },
      {
        id: "hcp-6",
        name: "Dr. Alan Grant",
        hospital: "Metro Health Pediatrics",
        speciality: "Pediatrics",
        email: "agrant@metrohealth.org",
        phone: "+1 (555) 017-5511",
        address: "100 Health Way, Portland, OR"
      }
    );

    // Products Catalog
    this.products.push(
      {
        id: "p-1",
        name: "CardioProtect (Lisinopril)",
        category: "Cardiovascular",
        description: "Advanced ACE inhibitor indicated for treatment of hypertension and heart failure."
      },
      {
        id: "p-2",
        name: "GlycaStop (Metformin XR)",
        category: "Diabetes/Endocrinology",
        description: "Extended-release oral hypoglycemic drug for Type 2 diabetes management."
      },
      {
        id: "p-3",
        name: "OncoShield (Trastuzumab)",
        category: "Oncology",
        description: "Monoclonal antibody targeted therapy for HER2-positive cancer treatment."
      },
      {
        id: "p-4",
        name: "LipidDown (Atorvastatin)",
        category: "Cardiovascular",
        description: "High-efficacy statin for hypercholesterolemia and cardiovascular risk reduction."
      },
      {
        id: "p-5",
        name: "PulmoClear (Albuterol)",
        category: "Pulmonology",
        description: "Rapid-acting bronchodilator for asthma and COPD acute bronchospasms."
      }
    );

    // Initial interactions history to populate analytics beautifully
    this.interactions.push(
      {
        id: "int-1",
        hcpId: "hcp-1",
        hcpName: "Dr. Sarah Jenkins",
        hospital: "Metro Cardiology Center",
        speciality: "Cardiology",
        date: "2026-07-01",
        type: "Meeting",
        summary: "Met with Dr. Jenkins to review the newly released clinical data on CardioProtect. Discussed efficacy curves and renal safety outcomes. She expressed great interest in the low-dose pediatric trials.",
        productsDiscussed: ["CardioProtect (Lisinopril)", "LipidDown (Atorvastatin)"],
        samplesGiven: "CardioProtect Starter Kits (x10), LipidDown 20mg Samples (x5)",
        followUpRequired: true,
        nextMeetingDate: "2026-07-15",
        priority: "High",
        notes: "Requested pediatric clinical study PDF files. Seems highly likely to transition 15 existing patients."
      },
      {
        id: "int-2",
        hcpId: "hcp-2",
        hcpName: "Dr. Robert Chen",
        hospital: "City Cancer Institute",
        speciality: "Oncology",
        date: "2026-07-03",
        type: "Call",
        summary: "Brief phone call regarding OncoShield availability in the central outpatient pharmacy. Resolved hospital formulary status updates.",
        productsDiscussed: ["OncoShield (Trastuzumab)"],
        samplesGiven: "None",
        followUpRequired: false,
        nextMeetingDate: null,
        priority: "Medium",
        notes: "Chen confirmed that the local pharmacy board approved the formulary addition. Great news."
      },
      {
        id: "int-3",
        hcpId: "hcp-3",
        hcpName: "Dr. Michael Patel",
        hospital: "Summit Endocrinology Clinic",
        speciality: "Endocrinology",
        date: "2026-07-05",
        type: "Email",
        summary: "Shared digital brochures for GlycaStop XR and the patient-assistance program documentation. Dr. Patel had requested these for low-income patients.",
        productsDiscussed: ["GlycaStop (Metformin XR)"],
        samplesGiven: "None",
        followUpRequired: true,
        nextMeetingDate: "2026-07-20",
        priority: "Low",
        notes: "Email sent. Will call next week to check if he has questions on the co-pay voucher guidelines."
      },
      {
        id: "int-4",
        hcpId: "hcp-4",
        hcpName: "Dr. Emily Vance",
        hospital: "St. Jude Children's Research Annex",
        speciality: "Pediatrics",
        date: "2026-07-06",
        type: "Conference",
        summary: "Spoke briefly with Dr. Vance at the Regional Pediatric Summit. Discussed pulmo-safety data and pediatric nebulizer delivery profiles.",
        productsDiscussed: ["PulmoClear (Albuterol)"],
        samplesGiven: "PulmoClear Pediatric Mask Adapters (x20)",
        followUpRequired: false,
        nextMeetingDate: null,
        priority: "Medium",
        notes: "Amiable talk. She requested standard product leaflets for her primary care residents."
      }
    );

    // Initial follow ups
    this.followUps.push(
      {
        id: "fup-1",
        interactionId: "int-1",
        hcpId: "hcp-1",
        hcpName: "Dr. Sarah Jenkins",
        actionItem: "Send Pediatric Clinical Trial PDF and deliver 10 additional starter kits.",
        dueDate: "2026-07-15",
        status: "Pending"
      },
      {
        id: "fup-2",
        interactionId: "int-3",
        hcpId: "hcp-3",
        hcpName: "Dr. Michael Patel",
        actionItem: "Follow up via telephone to review GlycaStop co-pay voucher instructions.",
        dueDate: "2026-07-20",
        status: "Pending"
      }
    );

    // Activity Logs
    this.activityLogs.push(
      {
        id: "log-1",
        action: "Logged Interaction",
        timestamp: "2026-07-01T14:30:00.000Z",
        details: "Representative logged an in-person meeting with Dr. Sarah Jenkins.",
        user: "Alex Mercer"
      },
      {
        id: "log-2",
        action: "Formulary Approved",
        timestamp: "2026-07-03T11:15:00.000Z",
        details: "Formulary status of OncoShield updated to Approved after discussion with Dr. Robert Chen.",
        user: "Alex Mercer"
      },
      {
        id: "log-3",
        action: "Follow-up Created",
        timestamp: "2026-07-05T09:45:00.000Z",
        details: "Scheduled follow-up reminder for Dr. Michael Patel.",
        user: "Alex Mercer"
      }
    );
  }

  // --- HCP Methods ---
  getAllHCPs(): HCP[] {
    return this.hcps;
  }

  searchHCPs(query: string): HCP[] {
    const q = query.toLowerCase();
    return this.hcps.filter(
      (hcp) =>
        hcp.name.toLowerCase().includes(q) ||
        hcp.hospital.toLowerCase().includes(q) ||
        hcp.speciality.toLowerCase().includes(q)
    );
  }

  getHCPById(id: string): HCP | undefined {
    return this.hcps.find((hcp) => hcp.id === id);
  }

  addHCP(hcp: Omit<HCP, "id">): HCP {
    const newHCP: HCP = {
      ...hcp,
      id: `hcp-${this.hcps.length + 1}`
    };
    this.hcps.push(newHCP);
    this.logActivity("HCP Registered", `New HCP Dr. ${hcp.name} registered into active database.`);
    this.saveHCPToMySQL(newHCP);
    return newHCP;
  }

  // --- Interactions Methods ---
  getAllInteractions(): Interaction[] {
    return this.interactions;
  }

  getInteractionById(id: string): Interaction | undefined {
    return this.interactions.find((int) => int.id === id);
  }

  addInteraction(interaction: Omit<Interaction, "id">): Interaction {
    const newInt: Interaction = {
      ...interaction,
      id: `int-${this.interactions.length + 1}`
    };
    this.interactions.unshift(newInt); // Newest first
    this.logActivity("Logged Interaction", `Logged ${newInt.type} with ${newInt.hcpName} (${newInt.hospital}).`);
    this.saveInteractionToMySQL(newInt);

    // Automatically create a follow-up if required
    if (newInt.followUpRequired && newInt.nextMeetingDate) {
      this.addFollowUp({
        interactionId: newInt.id,
        hcpId: newInt.hcpId,
        hcpName: newInt.hcpName,
        actionItem: `Scheduled follow-up after interaction: ${newInt.summary.substring(0, 60)}...`,
        dueDate: newInt.nextMeetingDate,
        status: "Pending"
      });
    }

    return newInt;
  }

  updateInteraction(id: string, updates: Partial<Interaction>): Interaction | undefined {
    const index = this.interactions.findIndex((int) => int.id === id);
    if (index === -1) return undefined;

    const existing = this.interactions[index];
    const updated: Interaction = {
      ...existing,
      ...updates
    };

    this.interactions[index] = updated;
    this.logActivity("Edited Interaction", `Modified logged details of interaction with ${updated.hcpName}.`);
    this.saveInteractionToMySQL(updated);

    // Check if we need to sync followups
    if (updates.followUpRequired !== undefined || updates.nextMeetingDate !== undefined) {
      // Find or adjust follow-ups
      const fupIndex = this.followUps.findIndex((f) => f.interactionId === id);
      if (updated.followUpRequired && updated.nextMeetingDate) {
        if (fupIndex !== -1) {
          this.followUps[fupIndex].dueDate = updated.nextMeetingDate;
          this.saveFollowUpToMySQL(this.followUps[fupIndex]);
        } else {
          this.addFollowUp({
            interactionId: updated.id,
            hcpId: updated.hcpId,
            hcpName: updated.hcpName,
            actionItem: `Scheduled follow-up (edited) after interaction: ${updated.summary.substring(0, 60)}...`,
            dueDate: updated.nextMeetingDate,
            status: "Pending"
          });
        }
      } else if (!updated.followUpRequired && fupIndex !== -1) {
        // Remove follow-up if no longer required
        const deletedFup = this.followUps.splice(fupIndex, 1)[0];
        if (deletedFup) {
          this.deleteFollowUpFromMySQL(deletedFup.id);
        }
      }
    }

    return updated;
  }

  // --- Follow Ups Methods ---
  getAllFollowUps(): FollowUp[] {
    return this.followUps;
  }

  addFollowUp(fup: Omit<FollowUp, "id">): FollowUp {
    const newFup: FollowUp = {
      ...fup,
      id: `fup-${this.followUps.length + 1}`
    };
    this.followUps.push(newFup);
    this.logActivity("Follow-up Created", `Created a follow-up action for Dr. ${fup.hcpName} due on ${fup.dueDate}.`);
    this.saveFollowUpToMySQL(newFup);
    return newFup;
  }

  toggleFollowUpStatus(id: string): FollowUp | undefined {
    const fup = this.followUps.find((f) => f.id === id);
    if (fup) {
      fup.status = fup.status === "Pending" ? "Completed" : "Pending";
      this.logActivity("Follow-up Status Updated", `Follow-up action ID ${id} set to ${fup.status}.`);
      this.saveFollowUpToMySQL(fup);
    }
    return fup;
  }

  // --- Products Methods ---
  getAllProducts(): Product[] {
    return this.products;
  }

  // --- Logs & Analytics ---
  getAllLogs(): ActivityLog[] {
    return this.activityLogs;
  }

  logActivity(action: string, details: string) {
    const newLog: ActivityLog = {
      id: `log-${this.activityLogs.length + 1}`,
      action,
      timestamp: new Date().toISOString(),
      details,
      user: "Alex Mercer"
    };
    this.activityLogs.unshift(newLog);
    this.saveActivityLogToMySQL(newLog);
  }

  getAnalytics() {
    // 1. Interactions by Type
    const typeCounts: Record<string, number> = {};
    // 2. Specialty Counts
    const specialtyCounts: Record<string, number> = {};
    // 3. Interactions by Date (Trend)
    const dateCounts: Record<string, number> = {};
    // 4. Products discussed counts
    const productCounts: Record<string, number> = {};

    this.interactions.forEach((int) => {
      typeCounts[int.type] = (typeCounts[int.type] || 0) + 1;
      specialtyCounts[int.speciality] = (specialtyCounts[int.speciality] || 0) + 1;
      dateCounts[int.date] = (dateCounts[int.date] || 0) + 1;
      int.productsDiscussed.forEach((p) => {
        productCounts[p] = (productCounts[p] || 0) + 1;
      });
    });

    const productsDiscussedData = Object.keys(productCounts).map((name) => ({
      name: name.split(" ")[0], // short name
      fullName: name,
      count: productCounts[name]
    }));

    const typesData = Object.keys(typeCounts).map((type) => ({
      name: type,
      value: typeCounts[type]
    }));

    const specialtiesData = Object.keys(specialtyCounts).map((spec) => ({
      name: spec,
      count: specialtyCounts[spec]
    }));

    // Generate last 7 days timeline to show trends
    const trendData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      trendData.push({
        date: dateStr.substring(5), // MM-DD
        fullDate: dateStr,
        Interactions: dateCounts[dateStr] || 0
      });
    }

    return {
      totals: {
        interactions: this.interactions.length,
        hcps: this.hcps.length,
        pendingFollowups: this.followUps.filter((f) => f.status === "Pending").length,
        products: this.products.length
      },
      typesDistribution: typesData,
      specialtyDistribution: specialtiesData,
      weeklyTrend: trendData,
      productsDiscussed: productsDiscussedData
    };
  }
}

export const db = new Database();
