export type Resolution = "empty" | "low" | "mid" | "high";

export interface Mutation {
  block: number;
  from: Resolution;
  to: Resolution;
  delta_rank: number;
  quote: string;
}

export interface Turn {
  turn: number;
  user: string;
  signals: string[];
  thinking: string;
  next_question: string;
  signal_mutations: Array<{ block: number; new_resolution: Resolution; quote: string }>;
}

export interface BlockState {
  resolution: Resolution;
  quotes: string[];
}

export type Snapshot = Record<string, BlockState>;

export interface CostRecord {
  cost_usd: number;
  input_tokens: number;
  cache_read_tokens: number;
  output_tokens: number;
}

export interface SessionData {
  turns: Turn[];
  snapshots: Snapshot[];
  promotions: Mutation[][];
  costs: Record<string, CostRecord>;
  goal_blocks: Array<number | null>;
  algedonic: Resolution[];
  block_names: Record<string, string>;
  block_full: Record<string, string>;
  block_icons: Record<string, string>;
}
