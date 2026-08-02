import type { BBox, LngLat, ViewState } from './geo';

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export type AiIntent =
  | 'explain_country'
  | 'explain_city'
  | 'travel_plan'
  | 'compare_locations'
  | 'generate_report'
  | 'geography_question'
  | 'environmental_analysis'
  | 'population_analysis'
  | 'economic_analysis'
  | 'climate_explanation'
  | 'recommend_location'
  | 'summarise_area'
  | 'suggest_features'
  | 'navigate_map'
  | 'small_talk'
  | 'unknown';

/** Snapshot of what the user is currently looking at, injected into every prompt. */
export interface MapContext {
  view: ViewState;
  bbox: BBox | null;
  activeLayers: string[];
  basemap: string;
  focus: {
    kind: 'country' | 'city' | 'coordinate' | 'area' | 'none';
    label: string | null;
    countryCode: string | null;
    cityId: string | null;
    center: LngLat | null;
  };
  visibleHazardCount: number;
  localTime: string | null;
  units: 'metric' | 'imperial';
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  intent?: AiIntent;
  citations?: AiCitation[];
  actions?: AiAction[];
  toolCalls?: AiToolCall[];
  tokensUsed?: number;
  latencyMs?: number;
  createdAt: string;
  error?: string | null;
}

export interface AiCitation {
  label: string;
  source: string;
  url?: string;
}

/** Structured side effect the client can execute, e.g. fly the camera somewhere. */
export interface AiAction {
  kind:
    | 'fly_to'
    | 'toggle_layer'
    | 'open_panel'
    | 'create_bookmark'
    | 'create_report'
    | 'compare'
    | 'set_time';
  label: string;
  payload: Record<string, unknown>;
}

export interface AiToolCall {
  name: string;
  arguments: Record<string, unknown>;
  durationMs?: number;
  ok: boolean;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  messageCount: number;
  pinned: boolean;
  lastMessagePreview: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiChatRequest {
  conversationId?: string;
  message: string;
  context?: MapContext | null;
  /** Ask the model to stream tokens over SSE. */
  stream?: boolean;
  intentHint?: AiIntent;
}

export interface AiChatResponse {
  conversationId: string;
  message: ChatMessage;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  model: string;
}

export interface AiComparisonRequest {
  targets: { kind: 'country' | 'city'; id: string }[];
  dimensions?: string[];
}

export interface AiComparisonResult {
  narrative: string;
  table: { dimension: string; values: Record<string, string> }[];
  winnerByDimension: Record<string, string>;
  citations: AiCitation[];
}

export interface AiInsight {
  id: string;
  title: string;
  body: string;
  kind: 'trend' | 'anomaly' | 'risk' | 'opportunity' | 'fact';
  confidence: number;
  center?: LngLat;
  createdAt: string;
}
