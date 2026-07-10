/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { configureStore, createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { User, HCP, Interaction, Product, FollowUp, AgentState, AnalyticsData } from "../types.ts";

// --- ASYNC THUNKS FOR BACKEND API FETCHES ---

export const fetchCurrentUser = createAsyncThunk("auth/fetchUser", async () => {
  const res = await fetch("/api/auth/me");
  return (await res.json()) as User;
});

export const fetchHCPs = createAsyncThunk<HCP[], string | void>("hcp/fetchHCPs", async (query) => {
  const url = query ? `/api/hcps?q=${encodeURIComponent(query)}` : "/api/hcps";
  const res = await fetch(url);
  return (await res.json()) as HCP[];
});

export const createHCP = createAsyncThunk("hcp/createHCP", async (newHCP: Omit<HCP, "id">) => {
  const res = await fetch("/api/hcps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newHCP),
  });
  return (await res.json()) as HCP;
});

export const fetchInteractions = createAsyncThunk("interaction/fetchInteractions", async () => {
  const res = await fetch("/api/interactions");
  return (await res.json()) as Interaction[];
});

export const logStructuredInteraction = createAsyncThunk(
  "interaction/logInteraction",
  async (newInt: Omit<Interaction, "id" | "hcpId" | "hospital" | "speciality"> & { hcpId?: string }) => {
    // If hcpId is provided, we can fetch that HCP details to fill out the payload
    let hcpName = newInt.hcpName;
    let hospital = "";
    let speciality = "";

    if (newInt.hcpId) {
      const hcpRes = await fetch(`/api/hcps`);
      const hcps = (await hcpRes.json()) as HCP[];
      const hcp = hcps.find((h) => h.id === newInt.hcpId);
      if (hcp) {
        hcpName = hcp.name;
        hospital = hcp.hospital;
        speciality = hcp.speciality;
      }
    }

    const payload = {
      ...newInt,
      hcpName,
      hospital,
      speciality,
    };

    const res = await fetch("/api/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return (await res.json()) as Interaction;
  }
);

export const editLoggedInteraction = createAsyncThunk(
  "interaction/editInteraction",
  async ({ id, updates }: { id: string; updates: Partial<Interaction> }) => {
    const res = await fetch(`/api/interactions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    return (await res.json()) as Interaction;
  }
);

export const fetchFollowUps = createAsyncThunk("interaction/fetchFollowUps", async () => {
  const res = await fetch("/api/followups");
  return (await res.json()) as FollowUp[];
});

export const toggleFollowUp = createAsyncThunk("interaction/toggleFollowUp", async (id: string) => {
  const res = await fetch(`/api/followups/${id}/toggle`, { method: "POST" });
  return (await res.json()) as FollowUp;
});

export const fetchAnalytics = createAsyncThunk("analytics/fetchAnalytics", async () => {
  const res = await fetch("/api/analytics");
  return (await res.json()) as AnalyticsData;
});

export const sendChatMessage = createAsyncThunk(
  "chat/sendMessage",
  async (message: string, { dispatch }) => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    
    const result = (await res.json()) as AgentState;
    
    // Refresh lists and analytics automatically if changes were written to database
    if (result.intent === "log_interaction" || result.intent === "edit_interaction" || result.intent === "generate_followup") {
      dispatch(fetchInteractions());
      dispatch(fetchHCPs());
      dispatch(fetchFollowUps());
      dispatch(fetchAnalytics());
    }
    
    return result;
  }
);


// --- REDUX SLICES ---

// 1. Auth Slice
const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null as User | null,
    isAuthenticated: true, // Auto login for seamless CRM rep experience
    loading: false,
  },
  reducers: {
    logout(state) {
      state.user = null;
      state.isAuthenticated = false;
    },
    loginDemoUser(state) {
      state.user = {
        id: "u-1",
        name: "Alex Mercer",
        role: "Senior Specialty Care Representative",
        territory: "Pacific Northwest Division",
      };
      state.isAuthenticated = true;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.loading = false;
      });
  },
});

// 2. HCP Slice
const hcpSlice = createSlice({
  name: "hcp",
  initialState: {
    list: [] as HCP[],
    searchQuery: "",
    loading: false,
    products: [] as Product[],
  },
  reducers: {
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHCPs.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchHCPs.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(fetchHCPs.rejected, (state) => {
        state.loading = false;
      })
      .addCase(createHCP.fulfilled, (state, action) => {
        state.list.push(action.payload);
      });
  },
});

// 3. Interaction Slice
const interactionSlice = createSlice({
  name: "interaction",
  initialState: {
    list: [] as Interaction[],
    followUps: [] as FollowUp[],
    loading: false,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchInteractions.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchInteractions.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(fetchInteractions.rejected, (state) => {
        state.loading = false;
      })
      .addCase(logStructuredInteraction.fulfilled, (state, action) => {
        state.list.unshift(action.payload);
      })
      .addCase(editLoggedInteraction.fulfilled, (state, action) => {
        const idx = state.list.findIndex((i) => i.id === action.payload.id);
        if (idx !== -1) {
          state.list[idx] = action.payload;
        }
      })
      .addCase(fetchFollowUps.fulfilled, (state, action) => {
        state.followUps = action.payload;
      })
      .addCase(toggleFollowUp.fulfilled, (state, action) => {
        const idx = state.followUps.findIndex((f) => f.id === action.payload.id);
        if (idx !== -1) {
          state.followUps[idx] = action.payload;
        }
      });
  },
});

// 4. Chat Slice
export interface ChatMessage {
  id: string;
  sender: "user" | "agent";
  text: string;
  timestamp: string;
  langGraphState?: AgentState; // Trace object detailing current Agent node traversal
}

const chatSlice = createSlice({
  name: "chat",
  initialState: {
    messages: [
      {
        id: "m-welcome",
        sender: "agent",
        text: "Welcome back, Rep Alex. I am your **HCP LangGraph agent**. You can speak to me in plain english to automatically log medical meetings, request physician searches, schedule followups, edit medical logs, or request commercial territory analyses.\n\n*Try typing: 'I spoke with Dr. Sarah Jenkins today, we discussed CardioProtect. I gave her 5 starter packs and scheduled a follow up next Thursday.'*",
        timestamp: new Date().toISOString(),
      },
    ] as ChatMessage[],
    activeTrace: null as AgentState | null, // Currently executing or last completed LangGraph execution state
    sending: false,
    error: null as string | null,
  },
  reducers: {
    clearChat(state) {
      state.messages = [
        {
          id: "m-welcome",
          sender: "agent",
          text: "Active workspace cleared. Let's start a new CRM session. How can I assist you with your physicians today?",
          timestamp: new Date().toISOString(),
        }
      ];
      state.activeTrace = null;
    },
    setActiveTrace(state, action: PayloadAction<AgentState | null>) {
      state.activeTrace = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendChatMessage.pending, (state, action) => {
        state.sending = true;
        state.error = null;
        state.messages.push({
          id: `m-user-${Date.now()}`,
          sender: "user",
          text: action.meta.arg,
          timestamp: new Date().toISOString(),
        });
      })
      .addCase(sendChatMessage.fulfilled, (state, action) => {
        state.sending = false;
        state.activeTrace = action.payload;
        state.messages.push({
          id: `m-agent-${Date.now()}`,
          sender: "agent",
          text: action.payload.responseText,
          timestamp: new Date().toISOString(),
          langGraphState: action.payload,
        });
      })
      .addCase(sendChatMessage.rejected, (state, action) => {
        state.sending = false;
        state.error = action.error.message || "Something went wrong";
        state.messages.push({
          id: `m-err-${Date.now()}`,
          sender: "agent",
          text: "I apologize, but my LangGraph connection encountered a compile latency issue. Please check your API secrets and try again.",
          timestamp: new Date().toISOString(),
        });
      });
  },
});

// 5. Analytics Slice
const analyticsSlice = createSlice({
  name: "analytics",
  initialState: {
    data: null as AnalyticsData | null,
    loading: false,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAnalytics.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAnalytics.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchAnalytics.rejected, (state) => {
        state.loading = false;
      });
  },
});

// --- EXPORT ACTIONS ---
export const { logout, loginDemoUser } = authSlice.actions;
export const { setSearchQuery } = hcpSlice.actions;
export const { clearChat, setActiveTrace } = chatSlice.actions;

// --- STORE SETUP ---
export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    hcp: hcpSlice.reducer,
    interaction: interactionSlice.reducer,
    chat: chatSlice.reducer,
    analytics: analyticsSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
