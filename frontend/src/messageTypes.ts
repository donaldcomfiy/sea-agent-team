export type Msg =
  | { id: string; role: 'user'; text: string; time: string }
  | { id: string; role: 'handoff'; target: string; time: string }
  | { id: string; role: 'agent'; key: string; author: string; text: string; streaming: boolean; time: string }
  // Tool-use trace shown inline so the user sees the agent talking to an
  // external system (currently only the MongoDB MCP).
  | { id: string; role: 'tool'; provider: 'mongodb'; tool: string; label: string; time: string };
