/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { db } from "./backend/db.ts";
import { CRMStateGraph } from "./backend/langgraph.ts";
import { logInteractionTool, editInteractionTool } from "./backend/tools.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Express body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // --- API ROUTES ---

  // Auth
  app.get("/api/auth/me", (req, res) => {
    res.json(db.users[0]);
  });

  // HCPs Directory
  app.get("/api/hcps", (req, res) => {
    const q = req.query.q as string;
    if (q) {
      return res.json(db.searchHCPs(q));
    }
    res.json(db.getAllHCPs());
  });

  app.post("/api/hcps", (req, res) => {
    try {
      const { name, hospital, speciality, email, phone, address } = req.body;
      if (!name || !hospital || !speciality) {
        return res.status(400).json({ error: "Missing required fields: name, hospital, speciality" });
      }
      const newHcp = db.addHCP({ name, hospital, speciality, email, phone, address });
      res.status(210).json(newHcp);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Products
  app.get("/api/products", (req, res) => {
    res.json(db.getAllProducts());
  });

  // Interactions (Structured Log)
  app.get("/api/interactions", (req, res) => {
    res.json(db.getAllInteractions());
  });

  app.post("/api/interactions", async (req, res) => {
    try {
      const {
        hcpId,
        hcpName,
        hospital,
        speciality,
        date,
        type,
        summary,
        productsDiscussed,
        samplesGiven,
        followUpRequired,
        nextMeetingDate,
        priority,
        notes,
      } = req.body;

      if (!hcpName || !summary) {
        return res.status(400).json({ error: "Missing required fields: hcpName and summary" });
      }

      // Log interaction using the verified tool wrapper to align with LangGraph tools
      const result = await logInteractionTool({
        hcpName,
        hospital,
        speciality,
        date,
        type,
        summary,
        productsDiscussed,
        samplesGiven,
        followUpRequired,
        nextMeetingDate,
        priority,
        notes,
      });

      res.status(201).json(result.interaction);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update Interaction
  app.put("/api/interactions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await editInteractionTool(id, req.body);
      if (!result.success || !result.interaction) {
        return res.status(404).json({ error: "Interaction not found" });
      }
      res.json(result.interaction);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Follow Ups
  app.get("/api/followups", (req, res) => {
    res.json(db.getAllFollowUps());
  });

  app.post("/api/followups/:id/toggle", (req, res) => {
    const { id } = req.params;
    const fup = db.toggleFollowUpStatus(id);
    if (!fup) {
      return res.status(404).json({ error: "Follow-up record not found" });
    }
    res.json(fup);
  });

  // Logs
  app.get("/api/logs", (req, res) => {
    res.json(db.getAllLogs());
  });

  // Analytics API
  app.get("/api/analytics", (req, res) => {
    res.json(db.getAnalytics());
  });

  // Database Connection Diagnostics
  app.get("/api/db-status", async (req, res) => {
    try {
      const { getMySQLPool, isMySQLActive } = await import("./backend/mysql.ts");
      const active = isMySQLActive();
      const pool = getMySQLPool();

      let connectionDetails = {
        configured: !!(process.env.MYSQL_HOST && process.env.MYSQL_USER && process.env.MYSQL_DATABASE),
        host: process.env.MYSQL_HOST || null,
        database: process.env.MYSQL_DATABASE || null,
        port: process.env.MYSQL_PORT || "3306",
        status: active ? "Connected" : "In-Memory Fallback",
      };

      let tableCounts = {
        hcps: db.hcps.length,
        products: db.products.length,
        interactions: db.interactions.length,
        followUps: db.followUps.length,
        activityLogs: db.activityLogs.length,
      };

      let mysqlCounts: any = null;

      if (active && pool) {
        try {
          const [hcpRes] = await pool.query("SELECT COUNT(*) as count FROM hcps") as any[];
          const [prodRes] = await pool.query("SELECT COUNT(*) as count FROM products") as any[];
          const [intRes] = await pool.query("SELECT COUNT(*) as count FROM interactions") as any[];
          const [fupRes] = await pool.query("SELECT COUNT(*) as count FROM follow_ups") as any[];
          const [logRes] = await pool.query("SELECT COUNT(*) as count FROM activity_logs") as any[];

          mysqlCounts = {
            hcps: hcpRes[0]?.count ?? 0,
            products: prodRes[0]?.count ?? 0,
            interactions: intRes[0]?.count ?? 0,
            followUps: fupRes[0]?.count ?? 0,
            activityLogs: logRes[0]?.count ?? 0,
          };
        } catch (queryErr: any) {
          console.error("MySQL live query counts failed:", queryErr);
        }
      }

      res.json({
        connectionDetails,
        tableCounts,
        mysqlCounts,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Conversational AI Chat / LangGraph Pipeline
  app.post("/api/chat", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message || message.trim() === "") {
        return res.status(400).json({ error: "User message cannot be empty" });
      }

      // Execute actual LangGraph node flow
      const graph = new CRMStateGraph(message);
      const finalState = await graph.execute();

      res.json({
        userInput: finalState.userInput,
        intent: finalState.intent,
        toolToExecute: finalState.toolToExecute,
        extractedFields: finalState.extractedFields,
        toolResult: finalState.toolResult,
        validationStatus: finalState.validationStatus,
        responseText: finalState.responseText,
        history: finalState.history, // Trace of state traversal for real-time visual nodes
        databaseState: {
          interactionsCount: db.interactions.length,
          hcpsCount: db.hcps.length,
          followupsCount: db.followUps.length,
        },
      });
    } catch (err: any) {
      console.error("Express Chat API Route error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- FRONTEND INTEGRATION & MIDDLEWARE ---

  // Vite middleware for development HMR serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving static files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI-First CRM Fullstack Server running on http://localhost:${PORT}`);
  });
}

startServer();
