
import { GoogleGenAI, Type } from "@google/genai";
import { LLMConfig, KnowledgeNode, QuizQuestion, NodeStatus } from "../types";

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

    // OpenAI Compatible Routing (OpenAI, DeepSeek, Ollama, LM Studio)
    let baseUrl = this.config.baseUrl || "";
    if (this.config.provider === 'openai' && !baseUrl) baseUrl = "https://api.openai.com/v1";
    if (this.config.provider === 'deepseek' && !baseUrl) baseUrl = "https://api.deepseek.com/v1";
    if (this.config.provider === 'ollama' && !baseUrl) baseUrl = "http://localhost:11434/v1";
    if (this.config.provider === 'lmstudio' && !baseUrl) baseUrl = "http://localhost:1234/v1";

    // Standard OpenAI Chat Completion payload
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
    const prompt = `用户想要学习 "${topic}"。作为AI教育专家，请用一段亲切的话（约100字）回应，询问他们当前的背景水平或具体学习目标。语气要像游戏破冰，带有鼓励色彩。`;
    return await this.callProvider(prompt);
  }

  async generateGraph(topic: string, background: string): Promise<KnowledgeNode[]> {
    const prompt = `
      基于主题 "${topic}" 和用户背景 "${background}"，生成一个树状结构的知识图谱（思维导图格式）。
      必须以纯 JSON 数组格式返回，包含字段: id (字符串), label (名称), description (简述), parentId (父节点id，根节点为空), dependencies (前置解锁节点id列表)。
      生成 8-12 个节点，确保层级关系清晰（根节点 -> 子节点 -> 孙节点）。
      确保第一个根节点的 parentId 为 null，且 dependencies 为空。
      不要包含 Markdown 代码块标记。
    `;

    try {
      const text = await this.callProvider(prompt, true);
      const cleanText = text.replace(/```json|```/g, "").trim();
      const raw = JSON.parse(cleanText);
      return raw.map((n: any, idx: number) => ({
        ...n,
        id: n.id || `node_${idx}`,
        status: idx === 0 ? NodeStatus.AVAILABLE : NodeStatus.LOCKED,
        stars: 0
      }));
    } catch (e) {
      console.error("Graph Generation Failed:", e);
      throw e;
    }
  }

  async generateQuiz(node: KnowledgeNode, topic: string): Promise<QuizQuestion[]> {
    const prompt = `为 "${topic}" 中的 "${node.label}" 节点生成 3 道单选题。
    要求：难度适中，包含代码示例（如果适用）。
    必须以纯 JSON 数组格式返回，每个对象包含：text (题目内容), options (4个选项数组), correctIndex (0-3), explanation (详细的 Markdown 解析)。
    解析必须包含：解释为什么正确，以及错误选项的误区。
    不要包含 Markdown 代码块标记。`;

    try {
      const text = await this.callProvider(prompt, true);
      const cleanText = text.replace(/```json|```/g, "").trim();
      const raw = JSON.parse(cleanText);
      return raw.map((q: any, idx: number) => ({
        ...q,
        id: `q_${idx}`
      }));
    } catch (e) {
      console.error("Quiz Generation Failed:", e);
      throw e;
    }
  }

  async generateSummary(correctCount: number, total: number, nodeLabel: string): Promise<string> {
    const prompt = `用户在 "${nodeLabel}" 关卡中答对了 ${correctCount}/${total} 题。请给出一段简短、幽默且具有适应性建议的总结。如果全对，请疯狂赞美；如果表现一般，请指出可能需要复习的点。`;
    return await this.callProvider(prompt);
  }
}
