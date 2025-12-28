
import { GoogleGenAI, Type } from "@google/genai";
import { LLMConfig, KnowledgeNode, NodeStatus } from "../types";

export class LLMGateway {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  private async callProvider(prompt: string, jsonMode: boolean = false): Promise<string> {
    if (this.config.provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: this.config.model,
        contents: prompt,
        config: {
          temperature: this.config.temperature,
          responseMimeType: jsonMode ? "application/json" : undefined,
        }
      });
      return response.text || "";
    }

    let baseUrl = this.config.baseUrl || "";
    if (this.config.provider === 'openai' && !baseUrl) baseUrl = "https://api.openai.com/v1";
    if (this.config.provider === 'deepseek' && !baseUrl) baseUrl = "https://api.deepseek.com/v1";
    if (this.config.provider === 'ollama' && !baseUrl) baseUrl = "http://localhost:11434/v1";
    if (this.config.provider === 'lmstudio' && !baseUrl) baseUrl = "http://localhost:1234/v1";

    const payload = {
      model: this.config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: this.config.temperature,
      response_format: jsonMode ? { type: 'json_object' } : undefined
    };

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey || ''}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }

  async generateIceBreaker(topic: string): Promise<string> {
    const prompt = `用户想要学习 "${topic}"。作为AI教育专家，请用一段亲切的话回应，询问他们当前的背景水平或具体学习目标。`;
    return await this.callProvider(prompt);
  }

  async generateGraph(topic: string, currentLevel: number): Promise<KnowledgeNode[]> {
    const prompt = `
      基于主题 "${topic}"，生成当前为 "第 ${currentLevel} 阶段" 的学习地图。
      结构必须严格按照以下三层逻辑（以实现思维导图可视化）：
      1. 一个中心节点 (id: "root_hub", type: 'root', parentId: null)。
      2. 2-3 个分类节点 (type: 'branch', parentId: "root_hub")。
      3. 每个分类节点下有 2-3 个具体任务节点 (type: 'leaf', parentId 为其所属的 branch 节点 id)。
      
      必须以纯 JSON 数组格式返回，包含字段: id, label, description, parentId, type, dependencies (前置解锁节点id列表)。
      确保第一个 leaf 节点状态标记为可开始。
      不要包含 Markdown 代码块标记。
    `;

    try {
      const text = await this.callProvider(prompt, true);
      const cleanText = text.replace(/```json|```/g, "").trim();
      const raw = JSON.parse(cleanText);
      
      let firstLeafFound = false;
      return raw.map((n: any) => {
        let status = NodeStatus.LOCKED;
        if (n.type === 'root' || n.type === 'branch') {
          status = NodeStatus.COMPLETED;
        } else if (n.type === 'leaf' && !firstLeafFound) {
          status = NodeStatus.AVAILABLE;
          firstLeafFound = true;
        }

        return {
          ...n,
          level: currentLevel,
          status,
          stars: 0
        };
      });
    } catch (e) {
      console.error("Graph Generation Failed:", e);
      throw e;
    }
  }

  async generateQuiz(node: KnowledgeNode, topic: string): Promise<any> {
    const prompt = `为 "${topic}" 中的 "${node.label}" 生成 3 道单选题。以纯 JSON 数组返回：[{text, options, correctIndex, explanation}]。`;
    try {
      const text = await this.callProvider(prompt, true);
      const cleanText = text.replace(/```json|```/g, "").trim();
      return JSON.parse(cleanText).map((q: any, idx: number) => ({ ...q, id: `q_${idx}` }));
    } catch (e) {
      throw e;
    }
  }

  async generateSummary(correctCount: number, total: number, nodeLabel: string): Promise<string> {
    const prompt = `用户在 "${nodeLabel}" 答对了 ${correctCount}/${total} 题。请给出一段鼓励性的总结。`;
    return await this.callProvider(prompt);
  }
}
