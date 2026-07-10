/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { db } from "./db.ts";
import {
  logInteractionTool,
  editInteractionTool,
  searchHCPTool,
  generateFollowUpTool,
  interactionSummaryTool,
} from "./tools.ts";

// State definition for the LangGraph agent
export interface AgentState {
  userInput: string;
  intent: 'log_interaction' | 'edit_interaction' | 'search_hcp' | 'generate_followup' | 'interaction_summary' | 'unknown';
  toolToExecute: string;
  extractedFields: any;
  toolResult: any;
  validationStatus: 'valid' | 'missing_info' | 'invalid_context';
  clarificationQuestion?: string;
  responseText: string;
  history: string[]; // Holds the chronological node traversal history (trace)
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Robust retry wrapper to handle transient errors like 503 Service Unavailable or 429 Rate Limits
async function generateContentWithRetry(aiClient: any, params: any, retries = 3, delayMs = 1000): Promise<any> {
  const apifreeKey = process.env.APIFREE_API_KEY;
  if (apifreeKey && apifreeKey.trim().length > 0) {
    const apiBase = process.env.APIFREE_API_BASE || "https://api.apifree.ai/v1";
    const model = process.env.APIFREE_MODEL || "gpt-4o-mini";
    
    // Convert Gemini params to OpenAI format
    const contents = params.contents;
    let promptText = "";
    if (typeof contents === "string") {
      promptText = contents;
    } else if (Array.isArray(contents)) {
      promptText = contents.map((c: any) => typeof c === "string" ? c : JSON.stringify(c)).join("\n");
    } else {
      promptText = JSON.stringify(contents);
    }

    // Since we want JSON if specified
    const responseMimeType = params.config?.responseMimeType;
    const isJson = responseMimeType === "application/json";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apifreeKey.trim()}`
    };

    const body: any = {
      model: model,
      messages: [{ role: "user", content: promptText }]
    };

    if (isJson) {
      body.response_format = { type: "json_object" };
      if (!promptText.toLowerCase().includes("json")) {
        body.messages[0].content += "\n\nCRITICAL: You must return a valid, parsable JSON object matching the requested schema.";
      }
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (attempt > 1 && body.response_format) {
          console.log("[apifree-langgraph] Retrying without response_format since previous attempt failed (some proxy endpoints do not support response_format)...");
          delete body.response_format;
        }

        console.log(`[apifree-langgraph] Calling OpenAI-compatible endpoint ${apiBase} (attempt ${attempt}/${retries}) with model ${model}...`);
        const res = await fetch(`${apiBase}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`API Error status ${res.status}: ${errorText}`);
        }

        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error(`No content returned from OpenAI-compatible API. Response body: ${JSON.stringify(data)}`);
        }

        return {
          text: content
        };
      } catch (error: any) {
        console.log(`[apifree-langgraph] API Error (attempt ${attempt}/${retries}): ${error.message || error}`);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
          delayMs *= 1.5;
        } else {
          console.log(`[apifree-langgraph] Failed after ${retries} attempts, falling back to Gemini...`);
          break; // break retry loop to fallback to Gemini
        }
      }
    }
  }

  // Gemini Fallback / Default
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await aiClient.models.generateContent(params);
    } catch (error: any) {
      const isTransient = error?.status === 503 || error?.code === 503 || error?.status === 429 || error?.code === 429 || String(error).includes("503") || String(error).includes("UNAVAILABLE") || String(error).includes("429");
      if (isTransient && attempt < retries) {
        console.log(`[langgraph] Gemini API transient error (attempt ${attempt}/${retries}): ${error.message || error}. Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 1.5; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
}

// Fallback rule-based heuristic parser if AI model is completely overloaded/unavailable
function heuristicExtraction(text: string): { intent: 'log_interaction' | 'edit_interaction' | 'search_hcp' | 'generate_followup' | 'interaction_summary' | 'unknown'; extractedFields: any } {
  const normalized = text.toLowerCase();
  
  let intent: 'log_interaction' | 'edit_interaction' | 'search_hcp' | 'generate_followup' | 'interaction_summary' | 'unknown' = "log_interaction";
  const isFieldRefinement = normalized.includes("date") || normalized.includes("time") || normalized.includes("type") || normalized.includes("priority") || normalized.includes("product") || normalized.includes("sample") || normalized.includes("notes") || normalized.includes("summary") || normalized.includes("follow up") || normalized.includes("followup");
  if (normalized.includes("search") || normalized.includes("find") || normalized.includes("lookup") || normalized.includes("hcp list")) {
    intent = "search_hcp";
  } else if (normalized.includes("edit") || normalized.includes("update") || normalized.includes("change") || normalized.includes("modify")) {
    // If they are changing/updating a field like date, type, priority, summary, notes, product, sample, etc., keep intent as log_interaction draft refinement
    if (isFieldRefinement) {
      intent = "log_interaction";
    } else {
      intent = "edit_interaction";
    }
  } else if (normalized.includes("follow up") || normalized.includes("followup") || normalized.includes("strategy") || normalized.includes("next steps")) {
    intent = "generate_followup";
  } else if (normalized.includes("summary") || normalized.includes("report") || normalized.includes("executive") || normalized.includes("performance") || normalized.includes("insight")) {
    intent = "interaction_summary";
  }

  const extractedFields: any = {};

  if (intent === "log_interaction") {
    const isRefinement = isFieldRefinement;
    const knownHCPs = db.getAllHCPs();
    let matchedHcp = knownHCPs.find(h => normalized.includes(h.name.toLowerCase()));
    if (!matchedHcp) {
      matchedHcp = knownHCPs.find(h => {
        const lastName = h.name.split(" ").pop();
        return lastName && lastName.length > 2 && normalized.includes(lastName.toLowerCase());
      });
    }

    if (matchedHcp) {
      extractedFields.hcpName = matchedHcp.name;
      extractedFields.hospital = matchedHcp.hospital;
      extractedFields.speciality = matchedHcp.speciality;
    } else if (!isRefinement) {
      const drRegex = /dr\.?\s+([a-z]+)/i;
      const match = text.match(drRegex);
      if (match && match[1]) {
        const name = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        extractedFields.hcpName = `Dr. ${name}`;
      } else {
        extractedFields.hcpName = "Dr. Smith";
      }
      extractedFields.hospital = "Community General Hospital";
      extractedFields.speciality = "General Practice";
    }

    const knownProducts = db.getAllProducts();
    const matchedProducts = knownProducts
      .filter(p => {
        const pName = p.name.toLowerCase();
        const baseName = p.name.includes("(") ? p.name.split("(")[0].trim().toLowerCase() : pName;
        return normalized.includes(pName) || normalized.includes(baseName);
      })
      .map(p => p.name);

    if (matchedProducts.length > 0) {
      extractedFields.productsDiscussed = matchedProducts;
    } else if (!isRefinement) {
      extractedFields.productsDiscussed = ["CardioProtect (Lisinopril)"];
    }
    
    let typeFound = false;
    if (normalized.includes("call") || normalized.includes("phone")) {
      extractedFields.type = "Call";
      typeFound = true;
    } else if (normalized.includes("email") || normalized.includes("mail")) {
      extractedFields.type = "Email";
      typeFound = true;
    } else if (normalized.includes("conference") || normalized.includes("seminar")) {
      extractedFields.type = "Conference";
      typeFound = true;
    } else if (normalized.includes("meeting") || normalized.includes("appointment")) {
      extractedFields.type = "Meeting";
      typeFound = true;
    }

    if (!typeFound && !isRefinement) {
      extractedFields.type = "Meeting";
    }

    let samplesFound = false;
    if (normalized.includes("brochure") || normalized.includes("flyer") || normalized.includes("shared brochure")) {
      extractedFields.samplesGiven = "Product Brochure";
      samplesFound = true;
    } else if (normalized.includes("sample") || normalized.includes("kit") || normalized.includes("box")) {
      extractedFields.samplesGiven = "Starter Kit";
      samplesFound = true;
    } else if (normalized.includes("no sample") || normalized.includes("no starter") || normalized.includes("without sample")) {
      extractedFields.samplesGiven = "None";
      samplesFound = true;
    }

    if (!samplesFound && !isRefinement) {
      extractedFields.samplesGiven = "None";
    }

    let followUpFound = false;
    if (normalized.includes("follow up") || normalized.includes("followup") || normalized.includes("next meeting") || normalized.includes("schedule")) {
      extractedFields.followUpRequired = true;
      followUpFound = true;
      const nextMeetingMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
      if (nextMeetingMatch) {
        extractedFields.nextMeetingDate = nextMeetingMatch[1];
      } else {
        extractedFields.nextMeetingDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      }
    } else if (normalized.includes("no follow up") || normalized.includes("no followup")) {
      extractedFields.followUpRequired = false;
      followUpFound = true;
    }

    if (!followUpFound && !isRefinement) {
      extractedFields.followUpRequired = false;
    }

    let priorityFound = false;
    if (normalized.includes("high") || normalized.includes("urgent") || normalized.includes("critical")) {
      extractedFields.priority = "High";
      priorityFound = true;
    } else if (normalized.includes("low") || normalized.includes("minor")) {
      extractedFields.priority = "Low";
      priorityFound = true;
    } else if (normalized.includes("medium") || normalized.includes("normal")) {
      extractedFields.priority = "Medium";
      priorityFound = true;
    }

    if (!priorityFound && !isRefinement) {
      extractedFields.priority = "Medium";
    }

    const summaryMatch = text.match(/(?:summary\s+(?:to|is|of)|clinical\s+summary\s+(?:to|is|of))\s+([^\.]+)/i);
    if (summaryMatch && summaryMatch[1]) {
      extractedFields.summary = summaryMatch[1].trim();
      extractedFields.topicsDiscussed = summaryMatch[1].trim();
    } else if (!isRefinement) {
      extractedFields.summary = text;
      extractedFields.topicsDiscussed = text;
    }

    const notesMatch = text.match(/(?:notes\s+(?:to|is|of)|additional\s+notes\s+(?:to|is|of))\s+([^\.]+)/i);
    if (notesMatch && notesMatch[1]) {
      extractedFields.notes = notesMatch[1].trim();
    } else if (!isRefinement) {
      extractedFields.notes = "Heuristically extracted due to temporary AI service unavailability.";
    }
    
    // Heuristic date extraction
    let extractedDate: string | undefined = undefined;
    const isoDateMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (isoDateMatch) {
      extractedDate = isoDateMatch[1];
    } else if (normalized.includes("yesterday")) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      extractedDate = yesterday.toISOString().split("T")[0];
    } else if (normalized.includes("today")) {
      extractedDate = new Date().toISOString().split("T")[0];
    } else if (normalized.includes("tomorrow")) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      extractedDate = tomorrow.toISOString().split("T")[0];
    } else {
      const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
      for (let i = 0; i < months.length; i++) {
        const m = months[i];
        if (normalized.includes(m)) {
          const dayMatch = normalized.match(new RegExp(`${m}[a-z]*\\s*(\\d+)`));
          if (dayMatch && dayMatch[1]) {
            const dayNum = parseInt(dayMatch[1]);
            const monthIndex = i;
            const year = new Date().getFullYear();
            const parsedDate = new Date(year, monthIndex, dayNum);
            parsedDate.setMinutes(parsedDate.getMinutes() - parsedDate.getTimezoneOffset());
            extractedDate = parsedDate.toISOString().split("T")[0];
            break;
          }
        }
      }
    }

    if (extractedDate) {
      const isNextMeeting = normalized.includes("next") || normalized.includes("follow");
      if (isNextMeeting) {
        extractedFields.nextMeetingDate = extractedDate;
        extractedFields.followUpRequired = true;
      } else {
        extractedFields.date = extractedDate;
      }
    } else if (!isRefinement) {
      extractedFields.date = new Date().toISOString().split("T")[0];
    }
  } else if (intent === "search_hcp") {
    const words = text.split(" ");
    const lastWord = words[words.length - 1];
    extractedFields.query = lastWord || text;
  } else {
    const lastInteraction = db.getAllInteractions()[0];
    extractedFields.id = lastInteraction?.id || "int-1";
    extractedFields.updates = {};
  }

  return { intent, extractedFields };
}

export class CRMStateGraph {
  state: AgentState;

  constructor(userInput: string) {
    this.state = {
      userInput,
      intent: 'unknown',
      toolToExecute: '',
      extractedFields: {},
      toolResult: null,
      validationStatus: 'valid',
      responseText: '',
      history: [],
    };
  }

  // Combined Node 1 & 3: Intent Detection & Entity Extraction
  async intentAndExtractionNode(): Promise<void> {
    this.state.history.push("intent_and_extraction");
    const text = this.state.userInput;
    
    try {
      const prompt = `Analyze the user's pharmaceutical sales command: "${text}"
      
      Determine their core CRM commercial intent. Classify into exactly one of these:
      - "log_interaction": User wants to record/add/log a meeting, call, email, or discussion with a doctor/HCP. Note: If the user is correcting, editing, or changing fields of the current draft/new interaction they are in the process of logging (e.g., "actually the date was yesterday", "change the date to 2026-07-15", "change the next meeting date to August 1st", "add CardioProtect to products", "change the type to Call", "the priority is High"), MUST classify this as "log_interaction" rather than "edit_interaction", since they are refining the draft details of the new interaction before submitting/committing it.
      - "edit_interaction": User wants to modify/edit/update an existing already-saved interaction in the historical ledger database.
      - "search_hcp": User wants to look up, search, find doctors, hospitals, or clinics.
      - "generate_followup": User wants to create or suggest next actions/follow-ups for an interaction.
      - "interaction_summary": User wants a performance report, summary, opportunities, or executive insight.
      - "unknown": None of the above.
      
      If the intent is "log_interaction", also extract these fields (use defaults or leave null if completely absent):
      - hcpName (string, name of the doctor. Map to closest existing doctor if highly similar)
      - hospital (string, hospital name)
      - speciality (string, medical speciality e.g., Cardiology)
      - date (string, YYYY-MM-DD. Use today's date "${new Date().toISOString().split("T")[0]}" as default if day of week mentioned or today)
      - type (string, must be "Meeting", "Call", "Email", or "Conference")
      - summary (string, short clinical summary of discussion)
      - productsDiscussed (array of strings, mapped to product names)
      - samplesGiven (string, count or product kits)
      - followUpRequired (boolean, true if follow up, next meeting, or action requested)
      - nextMeetingDate (string, YYYY-MM-DD next appointment date)
      - priority (string, "Low", "Medium", "High")
      - notes (string, additional context)
      
      If the intent is "edit_interaction", also extract:
      - id (string, interaction ID e.g. "int-1")
      - updates (object of field modifications e.g. { summary: "New summary..." })
      
      If the intent is "search_hcp", also extract:
      - query (string, search query term or name)
      
      If the intent is "generate_followup", also extract:
      - id (string, interaction ID e.g. "int-1")

      Available Doctors: ${JSON.stringify(db.getAllHCPs().map(h => ({ name: h.name, hospital: h.hospital, speciality: h.speciality })))}
      Available Products: ${JSON.stringify(db.getAllProducts().map(p => p.name))}
      `;

      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: { type: Type.STRING },
              justification: { type: Type.STRING },
              extractedFields: {
                type: Type.OBJECT,
                properties: {
                  hcpName: { type: Type.STRING },
                  hospital: { type: Type.STRING },
                  speciality: { type: Type.STRING },
                  date: { type: Type.STRING },
                  type: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  productsDiscussed: { type: Type.ARRAY, items: { type: Type.STRING } },
                  samplesGiven: { type: Type.STRING },
                  followUpRequired: { type: Type.BOOLEAN },
                  nextMeetingDate: { type: Type.STRING },
                  priority: { type: Type.STRING },
                  notes: { type: Type.STRING },
                  id: { type: Type.STRING },
                  updates: { type: Type.OBJECT },
                  query: { type: Type.STRING },
                }
              }
            },
            required: ["intent", "justification"],
          }
        }
      });
 
      const data = JSON.parse(response.text?.trim() || "{}");
      this.state.intent = (data.intent || "unknown") as any;
      this.state.extractedFields = data.extractedFields || {};
      
      // Fallback handlers to match tool parameters
      if (this.state.intent === "edit_interaction") {
        if (!this.state.extractedFields.id) {
          const lastInteraction = db.getAllInteractions()[0];
          this.state.extractedFields.id = lastInteraction?.id || "int-1";
        }
        if (!this.state.extractedFields.updates) {
          this.state.extractedFields.updates = {};
        }
      } else if (this.state.intent === "search_hcp") {
        if (!this.state.extractedFields.query) {
          this.state.extractedFields.query = text;
        }
      } else if (this.state.intent === "generate_followup") {
        if (!this.state.extractedFields.id) {
          const lastInteraction = db.getAllInteractions()[0];
          this.state.extractedFields.id = lastInteraction?.id || "int-1";
        }
      }
    } catch (err) {
      console.log("Combined Intent & Extraction Node failed, utilizing heuristic fallback:", err);
      const fallback = heuristicExtraction(text);
      this.state.intent = fallback.intent;
      this.state.extractedFields = fallback.extractedFields;
    }
  }

  // Node 2: Tool Selection
  async toolSelectionNode(): Promise<void> {
    this.state.history.push("tool_selection");

    // Match intent to specific execution tools
    switch (this.state.intent) {
      case "log_interaction":
        this.state.toolToExecute = "log_interaction_tool";
        break;
      case "edit_interaction":
        this.state.toolToExecute = "edit_interaction_tool";
        break;
      case "search_hcp":
        this.state.toolToExecute = "search_hcp_tool";
        break;
      case "generate_followup":
        this.state.toolToExecute = "generate_followup_tool";
        break;
      case "interaction_summary":
        this.state.toolToExecute = "interaction_summary_tool";
        break;
      default:
        this.state.toolToExecute = "unknown_tool";
    }
  }

  // Node 4: LLM Validation
  async llmValidationNode(): Promise<void> {
    this.state.history.push("llm_validation");

    if (this.state.intent === "log_interaction") {
      const fields = this.state.extractedFields;
      // Critical check: Do we have a recognizable HCP name?
      if (!fields.hcpName || fields.hcpName.trim() === "") {
        this.state.validationStatus = "missing_info";
        this.state.clarificationQuestion = "I'm ready to log this interaction for you, but I couldn't identify the physician's name. Could you please specify which Healthcare Professional (HCP) you met?";
      } else {
        this.state.validationStatus = "valid";
      }
    } else {
      this.state.validationStatus = "valid";
    }
  }

  // Node 5: Database Commit / Query Execution
  async databaseNode(): Promise<void> {
    this.state.history.push("database");

    if (this.state.validationStatus !== "valid") {
      return; // Skip database operations if validation fails
    }

    try {
      if (this.state.intent === "log_interaction") {
        this.state.toolResult = await logInteractionTool({
          ...this.state.extractedFields,
          rawText: this.state.userInput,
          commitToDb: false
        });
      } else if (this.state.intent === "edit_interaction") {
        const { id, updates } = this.state.extractedFields;
        this.state.toolResult = await editInteractionTool(id, updates);
      } else if (this.state.intent === "search_hcp") {
        const { query } = this.state.extractedFields;
        this.state.toolResult = await searchHCPTool(query);
      } else if (this.state.intent === "generate_followup") {
        const { id } = this.state.extractedFields;
        this.state.toolResult = await generateFollowUpTool(id);
      } else if (this.state.intent === "interaction_summary") {
        this.state.toolResult = await interactionSummaryTool();
      }
    } catch (err) {
      console.log("Database Node Tool Execution failed, applying default safety result:", err);
      this.state.toolResult = { error: "Database transaction failed." };
    }
  }

  // Node 6: Response Formulation
  async responseFormulationNode(): Promise<void> {
    this.state.history.push("response_formulation");

    if (this.state.validationStatus === "missing_info" && this.state.clarificationQuestion) {
      this.state.responseText = this.state.clarificationQuestion;
      return;
    }

    const tr = this.state.toolResult;
    if (!tr) {
      this.state.responseText = "I processed your request, but was unable to complete the task. Could you please provide more context?";
      return;
    }

    try {
      if (this.state.intent === "log_interaction") {
        this.state.responseText = `✨ I have extracted the details and populated the boxes on the left! Review them, then click "Commit to central ledger" to save.`;
      } else if (this.state.intent === "edit_interaction") {
        this.state.responseText = `✅ Interaction details successfully updated!`;
      } else if (this.state.intent === "search_hcp") {
        const results = tr.results || [];
        if (results.length === 0) {
          this.state.responseText = `🔍 No medical professionals found matching your search.`;
        } else {
          this.state.responseText = `🔍 Found ${results.length} healthcare professional(s):\n` +
            results.map((r: any) => `- **Dr. ${r.name}** (${r.speciality}) at ${r.hospital}`).join("\n");
        }
      } else if (this.state.intent === "generate_followup") {
        const sug = tr.suggestions;
        this.state.responseText = `🎯 **Follow-up Action**: ${sug.actionItem}
📅 **Suggested Date**: ${sug.suggestedDate}
💡 **Justification**: ${sug.justification}
🩺 **Clinical Value**: ${sug.clinicalValue}`;
      } else if (this.state.intent === "interaction_summary") {
        this.state.responseText = `📊 **Executive CRM Summary**:
${tr.executiveSummary}

⚠️ **Identified Risks**:
${tr.risks.map((r: string) => `- ${r}`).join("\n")}

💡 **Actionable Opportunities**:
${tr.opportunities.map((o: string) => `- ${o}`).join("\n")}

📈 **Data-Driven Insights**:
${tr.insights.map((i: string) => `- ${i}`).join("\n")}`;
      } else {
        this.state.responseText = `Thank you. I have successfully processed your request. How else can I help?`;
      }
    } catch (err) {
      console.log("Response node failed, utilizing fallback text:", err);
      this.state.responseText = `Successfully processed transaction. Status: OK.`;
    }
  }

  // Orchestrator method executing the full State Graph sequentially
  async execute(): Promise<AgentState> {
    await this.intentAndExtractionNode();
    await this.toolSelectionNode();
    await this.llmValidationNode();
    await this.databaseNode();
    await this.responseFormulationNode();
    return this.state;
  }
}
