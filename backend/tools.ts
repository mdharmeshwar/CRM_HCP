/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { db, HCP, Interaction, FollowUp } from "./db.ts";

// Initialize the GoogleGenAI client according to official build SDK standards
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
          console.log("[apifree] Retrying without response_format since previous attempt failed (some proxy endpoints do not support response_format)...");
          delete body.response_format;
        }

        console.log(`[apifree] Calling OpenAI-compatible endpoint ${apiBase} (attempt ${attempt}/${retries}) with model ${model}...`);
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
        console.log(`[apifree] API Error (attempt ${attempt}/${retries}): ${error.message || error}`);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
          delayMs *= 1.5;
        } else {
          console.log(`[apifree] Failed after ${retries} attempts, falling back to Gemini...`);
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
        console.log(`[tools] Gemini API transient error (attempt ${attempt}/${retries}): ${error.message || error}. Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 1.5; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
}

// Tool 1: Log Interaction
export async function logInteractionTool(textData: {
  hcpName?: string;
  hospital?: string;
  speciality?: string;
  date?: string;
  type?: 'Meeting' | 'Call' | 'Email' | 'Conference';
  summary?: string;
  productsDiscussed?: string[];
  samplesGiven?: string;
  followUpRequired?: boolean;
  nextMeetingDate?: string | null;
  priority?: 'Low' | 'Medium' | 'High';
  notes?: string;
  rawText?: string;
  commitToDb?: boolean;
}): Promise<{ success: boolean; interaction: Interaction; isNewHCPCreated: boolean }> {
  
  let hcp: HCP | undefined;
  let isNewHCPCreated = false;

  // 1. Identify or create HCP
  if (textData.hcpName) {
    const matchedHCPs = db.searchHCPs(textData.hcpName);
    if (matchedHCPs.length > 0) {
      hcp = matchedHCPs[0];
    } else {
      // Create new HCP doctor automatically if none found
      hcp = db.addHCP({
        name: textData.hcpName,
        hospital: textData.hospital || "Community General Hospital",
        speciality: textData.speciality || "General Practice",
        email: `${textData.hcpName.toLowerCase().replace(/\s+/g, ".")}@hospital.org`,
        phone: "+1 (555) 010-0000",
        address: textData.hospital ? `Near ${textData.hospital}` : "Standard Territory Address"
      });
      isNewHCPCreated = true;
    }
  } else {
    // If no HCP provided, default to Dr. Jenkins
    hcp = db.getAllHCPs()[0];
  }

  // 2. Extrapolate missing data from raw text if present
  let summary = textData.summary || "";
  let products = textData.productsDiscussed || [];
  let notes = textData.notes || "";

  if (textData.rawText && (!summary || products.length === 0)) {
    try {
      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: `Analyze this pharmaceutical interaction log: "${textData.rawText}"\nExtract details in structured JSON. Include:
        1. "summary" (professional, life science standard rewrite of what was discussed)
        2. "productsDiscussed" (array of product names, mapping to: ${JSON.stringify(db.getAllProducts().map(p => p.name))})
        3. "samplesGiven" (string of what samples/brochures were given or requested)
        4. "priority" ("Low", "Medium", "High")`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              productsDiscussed: { type: Type.ARRAY, items: { type: Type.STRING } },
              samplesGiven: { type: Type.STRING },
              priority: { type: Type.STRING }
            },
            required: ["summary", "productsDiscussed", "samplesGiven", "priority"]
          }
        }
      });

      const extracted = JSON.parse(response.text?.trim() || "{}");
      summary = summary || extracted.summary || "Completed discussion on product catalog.";
      if (products.length === 0) {
        products = extracted.productsDiscussed || [];
      }
      if (!textData.samplesGiven) {
        textData.samplesGiven = extracted.samplesGiven || "None";
      }
      if (!textData.priority) {
        textData.priority = extracted.priority as any || "Medium";
      }
    } catch (err) {
      console.log("AI extraction error, using defaults (fallback active):", err);
      summary = summary || "Discussions held around medicinal therapeutic indications.";
      products = products.length > 0 ? products : ["CardioProtect (Lisinopril)"];
    }
  }

  // Validate properties
  const type = textData.type || "Meeting";
  const date = textData.date || new Date().toISOString().split("T")[0];
  const priority = textData.priority || "Medium";
  const samplesGiven = textData.samplesGiven || "None";
  const followUpRequired = textData.followUpRequired !== undefined ? textData.followUpRequired : false;
  const nextMeetingDate = textData.nextMeetingDate || null;

  const commitToDb = textData.commitToDb !== false;

  let interaction: Interaction;
  if (commitToDb) {
    // Save interaction to Relational DB
    interaction = db.addInteraction({
      hcpId: hcp.id,
      hcpName: hcp.name,
      hospital: hcp.hospital,
      speciality: hcp.speciality,
      date,
      type,
      summary,
      productsDiscussed: products.length > 0 ? products : ["CardioProtect (Lisinopril)"],
      samplesGiven,
      followUpRequired,
      nextMeetingDate,
      priority,
      notes
    });
  } else {
    // Return a transient, simulated interaction object for form auto-filling only
    interaction = {
      id: `temp-${Math.random().toString(36).substring(2, 9)}`,
      hcpId: hcp.id,
      hcpName: hcp.name,
      hospital: hcp.hospital,
      speciality: hcp.speciality,
      date,
      type,
      summary,
      productsDiscussed: products.length > 0 ? products : ["CardioProtect (Lisinopril)"],
      samplesGiven,
      followUpRequired,
      nextMeetingDate,
      priority,
      notes
    };
  }

  return {
    success: true,
    interaction,
    isNewHCPCreated: commitToDb ? isNewHCPCreated : false
  };
}

// Tool 2: Edit Interaction
export async function editInteractionTool(
  interactionId: string,
  updates: Partial<Interaction>
): Promise<{ success: boolean; interaction: Interaction | null }> {
  const updated = db.updateInteraction(interactionId, updates);
  return {
    success: !!updated,
    interaction: updated || null
  };
}

// Tool 3: Search HCP
export async function searchHCPTool(query: string): Promise<{ success: boolean; results: HCP[] }> {
  const results = db.searchHCPs(query);
  return {
    success: true,
    results
  };
}

// Tool 4: Generate Follow-up Action Items
export async function generateFollowUpTool(interactionId: string): Promise<{
  success: boolean;
  followUp: FollowUp | null;
  suggestions: {
    actionItem: string;
    suggestedDate: string;
    justification: string;
    clinicalValue: string;
  };
}> {
  const interaction = db.getInteractionById(interactionId);
  if (!interaction) {
    return { success: false, followUp: null, suggestions: null as any };
  }

  let suggestions = {
    actionItem: `Follow up with Dr. ${interaction.hcpName} regarding ${interaction.productsDiscussed.join(", ")}.`,
    suggestedDate: interaction.nextMeetingDate || new Date(Date.now() + 14*24*60*60*1000).toISOString().split("T")[0],
    justification: "Standard 2-week medical touchpoint interval.",
    clinicalValue: "Reinforces key therapeutic indications and addresses newly emerging patient queries."
  };

  try {
    const prompt = `Analyze this medical sales interaction:
    Doctor: Dr. ${interaction.hcpName} (${interaction.speciality})
    Hospital: ${interaction.hospital}
    Date: ${interaction.date}
    Discussion: ${interaction.summary}
    Products: ${interaction.productsDiscussed.join(", ")}
    Notes: ${interaction.notes}

    Generate a strategic, direct follow-up plan in JSON format.
    CRITICAL: Keep all text fields under 10 words. Concise output is essential.`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            actionItem: { type: Type.STRING, description: "Very short action item, max 8 words" },
            suggestedDate: { type: Type.STRING, description: "YYYY-MM-DD date" },
            justification: { type: Type.STRING, description: "Extremely short reason, max 10 words" },
            clinicalValue: { type: Type.STRING, description: "Extremely short medical value, max 10 words" }
          },
          required: ["actionItem", "suggestedDate", "justification", "clinicalValue"]
        }
      }
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    if (parsed.actionItem) suggestions = parsed;
  } catch (err) {
    console.log("AI Generate Followup failed, using default fallback:", err);
  }

  // Create active DB follow-up
  const followUp = db.addFollowUp({
    interactionId: interaction.id,
    hcpId: interaction.hcpId,
    hcpName: interaction.hcpName,
    actionItem: suggestions.actionItem,
    dueDate: suggestions.suggestedDate,
    status: "Pending"
  });

  return {
    success: true,
    followUp,
    suggestions
  };
}

// Tool 5: Interaction Summary and Executive CRM Insights
export async function interactionSummaryTool(): Promise<{
  success: boolean;
  executiveSummary: string;
  risks: string[];
  opportunities: string[];
  insights: string[];
}> {
  const interactions = db.getAllInteractions();
  const hcps = db.getAllHCPs();

  const formattedLogs = interactions.slice(0, 10).map(i => (
    `- HCP: Dr. ${i.hcpName} (${i.speciality}), Hosp: ${i.hospital}, Date: ${i.date}, Summary: ${i.summary}, Products: ${i.productsDiscussed.join(", ")}, Priority: ${i.priority}`
  )).join("\n");

  let result = {
    executiveSummary: "Highly active territory engagements centered on cardiovascular and oncology specialty units.",
    risks: ["Oncology adoption in outlying clinics is slow due to complex storage issues.", "Dr. Jenkins requires clinical reports which are currently in translation."],
    opportunities: ["Dr. Patel's patients can be placed on co-pay assistance immediately, driving high volume.", "Pediatric nebulizer support creates high hospital trust levels."],
    insights: ["Prioritizing physical medical conferences yields 45% higher engagement rates than email touchpoints."]
  };

  try {
    const prompt = `You are a Principal Life Sciences Commercial Excellence Director analyzing a representative's interaction history:
    
    RECENT DATABASE RECORDS:
    ${formattedLogs}
    
    Total Doctors Tracked: ${hcps.length}
    Total Logged Interactions: ${interactions.length}
    
    Generate an executive commercial dashboard brief in JSON format. Provide high-level, business-ready strategic analysis:
    1. "executiveSummary": A concise 2-3 sentence executive paragraph.
    2. "risks": A list of 3 concrete barriers or hurdles to conversion/adoption.
    3. "opportunities": A list of 3 actionable items to increase brand adoption.
    4. "insights": A list of 3 data-driven observations on representative performance.`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: { type: Type.STRING },
            risks: { type: Type.ARRAY, items: { type: Type.STRING } },
            opportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
            insights: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["executiveSummary", "risks", "opportunities", "insights"]
        }
      }
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    if (parsed.executiveSummary) result = parsed;
  } catch (err) {
    console.log("AI Insight summary tool failed, using fallback:", err);
  }

  return {
    success: true,
    ...result
  };
}
