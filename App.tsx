
import React, { useState, useEffect, useCallback } from 'react';
import { 
  LLMConfig, 
  KnowledgeNode, 
  NodeStatus, 
  QuizQuestion, 
} from './types';
import { STORAGE_KEY_CONFIG, DEFAULT_LLM_CONFIG } from './constants';
import { LLMGateway } from './services/llm';
import { Search, Compass, User, Brain, Sparkles, Loader2, Settings as SettingsIcon, LayoutGrid, AlertCircle } from 'lucide-react';
import KnowledgeGraph from './components/KnowledgeGraph';
import QuizModule from './components/QuizModule';
import Settings from './components/Settings';

const App: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [config, setConfig] = useState<LLMConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
    return saved ? JSON.parse(saved) : DEFAULT_LLM_CONFIG;
  });
  
  const [activeView, setActiveView] = useState<'home' | 'graph' | 'quiz' | 'summary'>('home');
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [activeNode, setActiveNode] = useState<KnowledgeNode | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [iceBreaker, setIceBreaker] = useState('');
  const [background, setBackground] = useState('');
  const [summary, setSummary] = useState('');

  const gateway = new LLMGateway(config);

  const startJourney = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setErrorMessage(null);
    setLoadingText('AI 正在规划专属技能树...');
    
    try {
      const msg = await gateway.generateIceBreaker(topic);
      setIceBreaker(msg);
      // Generate the graph immediately for this flow
      const graphNodes = await gateway.generateGraph(topic, background);
      if (graphNodes.length === 0) throw new Error("未能生成知识图谱，请重试或检查配置。");
      setNodes(graphNodes);
      setActiveView('graph');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || '连接 AI 服务时出现问题。请检查网络或配置。');
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = async (node: KnowledgeNode) => {
    setLoading(true);
    setErrorMessage(null);
    setLoadingText(`正在为「${node.label}」生成考题...`);
    try {
      const questions = await gateway.generateQuiz(node, topic);
      if (questions.length === 0) throw new Error("未能生成题目，请重试。");
      setActiveQuestions(questions);
      setActiveNode(node);
      setActiveView('quiz');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || '生成题目失败。');
    } finally {
      setLoading(false);
    }
  };

  const handleQuizFinish = async (correctCount: number) => {
    if (!activeNode) return;
    setLoading(true);
    setLoadingText('正在分析你的学习成果...');
    
    try {
      const stars = Math.min(3, Math.ceil((correctCount / activeQuestions.length) * 3));
      const summaryMsg = await gateway.generateSummary(correctCount, activeQuestions.length, activeNode.label);
      setSummary(summaryMsg);

      setNodes(prev => {
        const updated = prev.map(n => {
          if (n.id === activeNode.id) {
            return { ...n, status: NodeStatus.COMPLETED, stars };
          }
          return n;
        });

        const currentIndex = updated.findIndex(n => n.id === activeNode.id);
        if (currentIndex !== -1 && currentIndex + 1 < updated.length) {
          const nextNode = updated[currentIndex + 1];
          if (nextNode.status === NodeStatus.LOCKED) {
            nextNode.status = NodeStatus.AVAILABLE;
          }
        }
        return [...updated];
      });

      setActiveView('summary');
    } catch (err: any) {
      console.error(err);
      setSummary("完成了！非常精彩的表现。");
      setActiveView('summary');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigUpdate = (newConfig: LLMConfig) => {
    setConfig(newConfig);
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(newConfig));
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden select-none">
      {/* Top Navbar */}
      <nav className="h-16 bg-white border-b px-6 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-100">
            <Brain className="text-white" size={18} />
          </div>
          <span className="text-xl font-black text-gray-800 tracking-tight">智图流</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <SettingsIcon size={20} />
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        {activeView === 'home' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in slide-in-from-bottom duration-700">
            <div className="max-w-xl w-full space-y-8">
              <div className="relative inline-block">
                <div className="absolute -inset-4 bg-blue-100 rounded-full blur-2xl opacity-50 animate-pulse" />
                <Sparkles size={64} className="text-blue-600 relative" />
              </div>
              <div className="space-y-2">
                <h1 className="text-4xl md:text-5xl font-black text-gray-900 leading-tight">你想学习什么？</h1>
                <p className="text-lg text-gray-500 font-medium">输入任何主题，AI 将为你构建专属关卡图谱</p>
              </div>
              
              <div className="relative group">
                <input 
                  type="text" 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && startJourney()}
                  placeholder="Python、古罗马、量子物理..."
                  className="w-full p-6 pl-14 text-xl bg-white border-2 border-gray-100 rounded-3xl shadow-xl shadow-gray-100 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all group-hover:border-blue-200"
                />
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-blue-500 transition-colors" size={24} />
              </div>

              {errorMessage && (
                <div className="p-4 bg-red-50 border-2 border-red-100 rounded-2xl flex items-center gap-3 text-red-700 text-sm font-bold animate-in shake duration-300">
                  <AlertCircle size={20} />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-2">
                {['JavaScript 入门', '文艺复兴史', '深度学习', '摄影基础'].map(t => (
                  <button 
                    key={t}
                    onClick={() => { setTopic(t); }}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-bold text-gray-600 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-600 transition-all"
                  >
                    {t}
                  </button>
                ))}
              </div>

              <button 
                disabled={!topic || loading}
                onClick={startJourney}
                className="w-full py-4 bg-blue-600 text-white text-lg font-black rounded-3xl shadow-2xl shadow-blue-200 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
                立即开始探索
              </button>
            </div>
          </div>
        )}

        {activeView === 'graph' && (
          <div className="flex-1 p-4 md:p-8 animate-in fade-in duration-500">
            <KnowledgeGraph 
              topic={topic} 
              nodes={nodes} 
              onNodeClick={startQuiz}
            />
          </div>
        )}

        {activeView === 'summary' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in duration-500">
            <div className="max-w-lg w-full bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl space-y-8 border-4 border-blue-50">
              <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-blue-200">
                <TrophyIcon className="text-white" size={48} />
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-black text-gray-900">关卡结算</h2>
                <div className="p-6 bg-gray-50 rounded-3xl text-left font-medium leading-relaxed text-gray-700 italic border border-gray-100">
                  "{summary}"
                </div>
              </div>
              <button 
                onClick={() => setActiveView('graph')}
                className="w-full py-4 bg-blue-600 text-white text-lg font-black rounded-3xl shadow-xl shadow-blue-100 active:scale-[0.98] transition-all"
              >
                返回地图，继续下一关
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Tab Bar (Mobile) */}
      <footer className="h-20 bg-white border-t px-8 flex items-center justify-around shrink-0 md:hidden">
        <button 
          onClick={() => { setActiveView('home'); setNodes([]); setTopic(''); }}
          className={`flex flex-col items-center gap-1 ${activeView === 'home' ? 'text-blue-600' : 'text-gray-400'}`}
        >
          <Search size={24} />
          <span className="text-[10px] font-bold">发现</span>
        </button>
        <button 
          onClick={() => nodes.length > 0 && setActiveView('graph')}
          className={`flex flex-col items-center gap-1 ${activeView === 'graph' ? 'text-blue-600' : (nodes.length > 0 ? 'text-gray-400' : 'text-gray-200')}`}
          disabled={nodes.length === 0}
        >
          <Compass size={24} />
          <span className="text-[10px] font-bold">地图</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-gray-200">
          <User size={24} />
          <span className="text-[10px] font-bold">我的</span>
        </button>
      </footer>

      {/* Global Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-8 text-center space-y-6">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
            <Brain className="absolute inset-0 m-auto text-blue-600 animate-pulse" size={24} />
          </div>
          <div className="space-y-2">
            <p className="text-xl font-black text-gray-800 animate-bounce">{loadingText}</p>
            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">AI 正在飞速运转中</p>
          </div>
        </div>
      )}

      {/* Quiz Overlay */}
      {activeView === 'quiz' && activeNode && (
        <QuizModule 
          node={activeNode} 
          questions={activeQuestions} 
          onFinish={handleQuizFinish}
          onClose={() => setActiveView('graph')}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <Settings 
          config={config} 
          onUpdate={handleConfigUpdate} 
          onClose={() => setShowSettings(false)} 
        />
      )}
    </div>
  );
};

// Helper Icons
const TrophyIcon = ({ className, size }: { className?: string, size?: number }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

export default App;
