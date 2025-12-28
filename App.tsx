
import React, { useState, useEffect } from 'react';
import { 
  LLMConfig, 
  KnowledgeNode, 
  NodeStatus, 
  QuizQuestion, 
} from './types';
import { STORAGE_KEY_CONFIG, DEFAULT_LLM_CONFIG } from './constants';
import { LLMGateway } from './services/llm';
import { Search, Brain, Sparkles, Loader2, Settings as SettingsIcon, AlertCircle, Trophy, CheckCircle2 } from 'lucide-react';
import KnowledgeGraph from './components/KnowledgeGraph';
import QuizModule from './components/QuizModule';
import Settings from './components/Settings';

const App: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [currentLevel, setCurrentLevel] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [config, setConfig] = useState<LLMConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
    return saved ? JSON.parse(saved) : DEFAULT_LLM_CONFIG;
  });
  
  const [activeView, setActiveView] = useState<'home' | 'graph' | 'quiz' | 'summary' | 'levelup'>('home');
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [activeNode, setActiveNode] = useState<KnowledgeNode | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [summary, setSummary] = useState('');

  const gateway = new LLMGateway(config);

  const startJourney = async (level = 1) => {
    if (!topic.trim()) return;
    setLoading(true);
    setErrorMessage(null);
    setLoadingText(level === 1 ? 'AI 正在构建第一阶段地图...' : `正在生成第 ${level} 阶段高级挑战...`);
    
    try {
      const graphNodes = await gateway.generateGraph(topic, level);
      if (graphNodes.length === 0) throw new Error("未能生成知识图谱");
      setNodes(graphNodes);
      setCurrentLevel(level);
      setActiveView('graph');
    } catch (err: any) {
      setErrorMessage(err.message || '连接 AI 服务失败');
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = async (node: KnowledgeNode) => {
    setLoading(true);
    setLoadingText(`正在分析「${node.label}」...`);
    try {
      const questions = await gateway.generateQuiz(node, topic);
      setActiveQuestions(questions);
      setActiveNode(node);
      setActiveView('quiz');
    } catch (err: any) {
      setErrorMessage('题目生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleQuizFinish = async (correctCount: number) => {
    if (!activeNode) return;
    setLoading(true);
    setLoadingText('评估表现中...');
    
    try {
      const stars = Math.min(3, Math.ceil((correctCount / activeQuestions.length) * 3));
      const summaryMsg = await gateway.generateSummary(correctCount, activeQuestions.length, activeNode.label);
      setSummary(summaryMsg);

      setNodes(prev => {
        const updated = prev.map(n => n.id === activeNode.id ? { ...n, status: NodeStatus.COMPLETED, stars } : n);
        
        // Find next locked leaf to unlock
        const leaves = updated.filter(n => n.type === 'leaf');
        const currentIndex = leaves.findIndex(n => n.id === activeNode.id);
        
        if (currentIndex !== -1 && currentIndex + 1 < leaves.length) {
          const nextNode = updated.find(n => n.id === leaves[currentIndex + 1].id);
          if (nextNode) nextNode.status = NodeStatus.AVAILABLE;
        }
        
        return [...updated];
      });

      // Check if all leaves are completed to trigger LEVEL UP
      const allDone = nodes.filter(n => n.type === 'leaf').every(n => n.status === NodeStatus.COMPLETED || n.id === activeNode.id);
      
      if (allDone) {
        setActiveView('levelup');
      } else {
        setActiveView('summary');
      }
    } catch (err: any) {
      setActiveView('summary');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#fcfdfe] overflow-hidden select-none">
      {/* Navbar */}
      <nav className="h-16 bg-white border-b px-6 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
            <Brain className="text-white" size={20} />
          </div>
          <span className="text-xl font-black text-gray-800 tracking-tight">智图流</span>
        </div>
        <button onClick={() => setShowSettings(true)} className="p-2.5 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
          <SettingsIcon size={22} />
        </button>
      </nav>

      <main className="flex-1 relative overflow-hidden flex flex-col bg-white">
        {activeView === 'home' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-xl w-full space-y-10 animate-in fade-in slide-in-from-bottom duration-1000">
              <div className="relative inline-block">
                <Sparkles size={72} className="text-blue-600 mx-auto" />
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-orange-400 rounded-full animate-ping" />
              </div>
              <div className="space-y-3">
                <h1 className="text-5xl md:text-6xl font-black text-gray-900 leading-tight">开启你的知识闯关</h1>
                <p className="text-xl text-gray-400 font-bold uppercase tracking-[0.2em]">由 AI 实时驱动的个性化学习地图</p>
              </div>
              <div className="relative group">
                <input 
                  type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && startJourney(1)}
                  placeholder="Python、量子物理、世界历史..."
                  className="w-full p-7 text-2xl bg-white border-4 border-gray-100 rounded-[2.5rem] shadow-2xl outline-none focus:border-blue-500 transition-all font-bold placeholder:text-gray-200"
                />
              </div>
              {errorMessage && <div className="p-5 bg-red-50 text-red-700 rounded-3xl flex items-center gap-3 font-bold border-2 border-red-100 animate-bounce"><AlertCircle size={24}/>{errorMessage}</div>}
              <button 
                disabled={!topic || loading} 
                onClick={() => startJourney(1)} 
                className="group relative w-full py-6 bg-blue-600 text-white text-2xl font-black rounded-[2.5rem] shadow-2xl active:scale-[0.97] transition-all overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <div className="relative flex items-center justify-center gap-3">
                  {loading ? <Loader2 className="animate-spin" size={28} /> : <>立即开始 <ArrowRight size={28} /></>}
                </div>
              </button>
            </div>
          </div>
        )}

        {activeView === 'graph' && (
          <KnowledgeGraph topic={topic} nodes={nodes} onNodeClick={startQuiz} currentLevel={currentLevel} />
        )}

        {activeView === 'summary' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in duration-300">
            <div className="max-w-lg w-full bg-white p-12 rounded-[4rem] shadow-2xl space-y-10 border-4 border-blue-50">
              <div className="w-28 h-28 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-green-100">
                <CheckCircle2 className="text-white" size={56} />
              </div>
              <div className="space-y-4">
                <h2 className="text-4xl font-black text-gray-900">闯关成功</h2>
                <div className="p-8 bg-gray-50 rounded-[2.5rem] text-left font-bold italic text-gray-700 leading-relaxed text-lg">"{summary}"</div>
              </div>
              <button onClick={() => setActiveView('graph')} className="w-full py-5 bg-blue-600 text-white text-xl font-black rounded-3xl shadow-xl active:scale-[0.98] transition-all">返回地图继续探险</button>
            </div>
          </div>
        )}

        {activeView === 'levelup' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-blue-700 to-indigo-900 animate-in fade-in duration-1000">
            <div className="max-w-lg w-full space-y-10 text-white">
              <div className="relative">
                <Trophy size={120} className="mx-auto text-yellow-400 animate-bounce" />
                <div className="absolute inset-0 bg-yellow-400 blur-3xl opacity-20" />
              </div>
              <div className="space-y-3">
                <h2 className="text-5xl md:text-6xl font-black tracking-tight">完成 STAGE {currentLevel}!</h2>
                <p className="text-2xl font-bold opacity-80">你已经征服了本阶段的所有核心关卡</p>
              </div>
              <div className="p-10 bg-white/10 backdrop-blur-xl rounded-[3rem] border-2 border-white/20 shadow-2xl">
                <p className="text-xs font-black uppercase tracking-[0.4em] opacity-60 mb-2">前方高能</p>
                <p className="text-5xl font-black tabular-nums">STAGE {currentLevel + 1}</p>
              </div>
              <button onClick={() => startJourney(currentLevel + 1)} className="group relative w-full py-6 bg-yellow-400 text-blue-900 text-2xl font-black rounded-[2.5rem] shadow-[0_20px_50px_-10px_rgba(250,204,21,0.5)] active:scale-[0.97] transition-all">
                开启下一阶段地图
              </button>
            </div>
          </div>
        )}
      </main>

      {loading && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-xl z-[100] flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in duration-300">
          <div className="relative">
            <div className="w-24 h-24 border-[8px] border-blue-600 border-t-transparent rounded-full animate-spin" />
            <Brain className="absolute inset-0 m-auto text-blue-600" size={32} />
          </div>
          <div className="space-y-2">
            <p className="text-3xl font-black text-gray-900 animate-pulse">{loadingText}</p>
            <p className="text-gray-400 font-bold tracking-widest uppercase text-xs">AI 正在努力思考中...</p>
          </div>
        </div>
      )}

      {activeView === 'quiz' && activeNode && (
        <QuizModule node={activeNode} questions={activeQuestions} onFinish={handleQuizFinish} onClose={() => setActiveView('graph')} />
      )}

      {showSettings && <Settings config={config} onUpdate={(c) => { setConfig(c); localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(c)); }} onClose={() => setShowSettings(false)} />}
    </div>
  );
};

const ArrowRight = ({ size, ...props }: any) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M5 12h14M12 5l7 7-7 7"/></svg>;

export default App;
