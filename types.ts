
export enum NodeStatus {
  LOCKED = 'LOCKED',
  AVAILABLE = 'AVAILABLE',
  COMPLETED = 'COMPLETED',
}

export interface KnowledgeNode {
  id: string;
  label: string;
  description: string;
  status: NodeStatus;
  stars: number;
  parentId?: string;
  type: 'root' | 'branch' | 'leaf';
  level: number;
  dependencies: string[];
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

// Fix: Changed interface to type as LLMProvider is a union of string literals
export type LLMProvider = 'gemini' | 'openai' | 'ollama' | 'deepseek' | 'lmstudio';

export interface LLMConfig {
  provider: LLMProvider;
  baseUrl?: string;
  apiKey?: string;
  model: string;
  temperature: number;
}
