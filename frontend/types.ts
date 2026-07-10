/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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

export interface AgentState {
  userInput: string;
  intent: 'log_interaction' | 'edit_interaction' | 'search_hcp' | 'generate_followup' | 'interaction_summary' | 'reset_demo_data' | 'unknown';
  toolToExecute: string;
  extractedFields: any;
  toolResult: any;
  validationStatus: 'valid' | 'missing_info' | 'invalid_context';
  responseText: string;
  history: string[]; // State nodes execution history
  databaseState?: {
    interactionsCount: number;
    hcpsCount: number;
    followupsCount: number;
  };
}

export interface Totals {
  interactions: number;
  hcps: number;
  pendingFollowups: number;
  products: number;
}

export interface TypesDistribution {
  name: string;
  value: number;
}

export interface SpecialtyDistribution {
  name: string;
  count: number;
}

export interface WeeklyTrend {
  date: string;
  fullDate: string;
  Interactions: number;
}

export interface ProductDiscussedData {
  name: string;
  fullName: string;
  count: number;
}

export interface AnalyticsData {
  totals: Totals;
  typesDistribution: TypesDistribution[];
  specialtyDistribution: SpecialtyDistribution[];
  weeklyTrend: WeeklyTrend[];
  productsDiscussed: ProductDiscussedData[];
}
