import { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Brain, Lightbulb } from 'lucide-react';
import type { DeckCard, GameCategory } from './types';
import { analyzeDeck } from './utils/deckAnalytics';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface DeckAIAssistantProps {
  deck: DeckCard[];
  game: GameCategory;
  onClose: () => void;
}

// Deep TCG Knowledge Base
const TCG_KNOWLEDGE = {
  mtg: {
    name: 'Magic: The Gathering',
    staples: {
      white: ['Swords to Plowshares', 'Path to Exile', 'Wrath of God', 'Smothering Tithe'],
      blue: ['Counterspell', 'Brainstorm', 'Ponder', 'Cyclonic Rift', 'Rhystic Study'],
      black: ['Demonic Tutor', 'Vampiric Tutor', 'Toxic Deluge', 'Necropotence'],
      red: ['Lightning Bolt', 'Chaos Warp', 'Blasphemous Act', 'Dockside Extortionist'],
      green: ['Birds of Paradise', 'Llanowar Elves', 'Beast Within', 'Sylvan Library'],
      colorless: ['Sol Ring', 'Arcane Signet', 'Lightning Greaves', 'Swiftfoot Boots'],
    },
  },
  yugioh: {
    name: 'Yu-Gi-Oh!',
    handTraps: ['Ash Blossom & Joyous Spring', 'Maxx "C"', 'Effect Veiler', 'Nibiru'],
    boardBreakers: ['Dark Ruler No More', 'Forbidden Droplet', 'Lightning Storm'],
  },
  pokemon: {
    name: 'Pokémon',
    staples: ['Professor\'s Research', 'Boss\'s Orders', 'Ultra Ball', 'Rare Candy'],
  },
};

// Rule-based AI analysis engine
function analyzeWithRules(deck: DeckCard[], game: GameCategory, userQuestion: string): string {
  const stats = analyzeDeck(deck);
  const knowledge = TCG_KNOWLEDGE[game as keyof typeof TCG_KNOWLEDGE] || TCG_KNOWLEDGE.mtg;
  const lowerQuestion = userQuestion.toLowerCase();
  
  // Question intent detection
  if (lowerQuestion.includes('power') || lowerQuestion.includes('score') || lowerQuestion.includes('strong')) {
    return analyzePowerLevel(stats);
  }
  
  if (lowerQuestion.includes('curve') || lowerQuestion.includes('cmc') || lowerQuestion.includes('mana')) {
    return analyzeManaCurve(stats);
  }
  
  if (lowerQuestion.includes('cut') || lowerQuestion.includes('remove')) {
    return suggestCuts(deck, stats);
  }
  
  if (lowerQuestion.includes('add') || lowerQuestion.includes('include') || lowerQuestion.includes('missing')) {
    return suggestAdditions(deck, stats, knowledge, game);
  }
  
  if (lowerQuestion.includes('land') || lowerQuestion.includes('mana base')) {
    return analyzeLands(stats);
  }
  
  if (lowerQuestion.includes('budget') || lowerQuestion.includes('cheap')) {
    return analyzeBudget(deck, stats);
  }
  
  if (lowerQuestion.includes('improve') || lowerQuestion.includes('better')) {
    return comprehensiveAnalysis(deck, stats, knowledge, game);
  }
  
  // Default: comprehensive overview
  return comprehensiveAnalysis(deck, stats, knowledge, game);
}

function analyzePowerLevel(stats: any): string {
  const score = stats.powerScore;
  let analysis = `**Power Score: ${score}/100**\n\n`;
  
  if (score >= 80) {
    analysis += `🏆 **Competitive Tier**\nYour deck is tournament-ready! Excellent consistency and power.\n\n`;
  } else if (score >= 60) {
    analysis += `⚡ **Strong Casual**\nSolid deck that can compete at FNM or casual tables.\n\n`;
  } else if (score >= 40) {
    analysis += `🔧 **Needs Optimization**\nHas potential but needs improvements.\n\n`;
  } else {
    analysis += `⚠️ **Requires Major Work**\nNeeds substantial changes to strategy and card quality.\n\n`;
  }
  
  analysis += `**Key Stats:**\n`;
  analysis += `- Total Cards: ${stats.totalCards}\n`;
  analysis += `- Average CMC: ${stats.avgCMC}\n`;
  analysis += `- Deck Value: $${stats.totalValue}\n`;
  analysis += `- Deck Type: ${stats.deckType}\n\n`;
  
  if (stats.suggestions.length > 0) {
    analysis += `**Top Suggestions:**\n`;
    stats.suggestions.slice(0, 3).forEach((s: string) => analysis += `• ${s}\n`);
  }
  
  return analysis;
}

function analyzeManaCurve(stats: any): string {
  let analysis = `**Mana Curve Analysis**\n\n`;
  analysis += `Average CMC: **${stats.avgCMC}**\n`;
  analysis += `Deck Type: **${stats.deckType}**\n\n`;
  
  analysis += `**Distribution:**\n`;
  for (let i = 0; i <= 7; i++) {
    const count = stats.manaCurve[i] || 0;
    const bar = '█'.repeat(Math.ceil(count / 2));
    const label = i === 7 ? '7+' : String(i);
    analysis += `${label} CMC: ${bar} (${count} cards)\n`;
  }
  
  analysis += `\n`;
  
  if (stats.deckType === 'aggro' && stats.avgCMC > 2.5) {
    analysis += `⚠️ Curve too high for aggro. Aim for 1.5-2.5 average CMC.\n`;
  } else if (stats.deckType === 'control' && stats.avgCMC < 3) {
    analysis += `⚠️ Control wants more expensive spells (3-5 CMC).\n`;
  } else if (stats.deckType === 'midrange') {
    if (stats.avgCMC < 2.5 || stats.avgCMC > 3.5) {
      analysis += `⚠️ Midrange wants 2.5-3.5 average CMC.\n`;
    } else {
      analysis += `✅ Perfect midrange curve!\n`;
    }
  } else {
    analysis += `✅ Curve looks good for your strategy!\n`;
  }
  
  return analysis;
}

function suggestCuts(deck: DeckCard[], stats: any): string {
  const mainboard = deck.filter(c => c.board === 'main');
  let analysis = `**Cards to Consider Cutting**\n\n`;
  
  const cuts: Array<{ card: DeckCard; reason: string }> = [];
  
  mainboard.forEach(card => {
    if (stats.deckType === 'aggro' && card.cmc > 4) {
      cuts.push({ card, reason: 'Too expensive for aggro' });
    }
    
    if ((card.cmc < stats.avgCMC - 2 || card.cmc > stats.avgCMC + 2) && card.cmc > 0) {
      cuts.push({ card, reason: 'Off-curve for your strategy' });
    }
  });
  
  if (cuts.length === 0) {
    analysis += `✅ Deck looks tight! All cards serve a purpose.\n\n`;
    analysis += `If you need to make room:\n`;
    analysis += `• Look at highest CMC cards\n`;
    analysis += `• Consider cards that underperform\n`;
    analysis += `• Cut redundant effects\n`;
  } else {
    cuts.slice(0, 5).forEach((cut, idx) => {
      analysis += `${idx + 1}. **${cut.card.name}** (${cut.card.cmc} CMC)\n`;
      analysis += `   ${cut.reason}\n\n`;
    });
  }
  
  return analysis;
}

function suggestAdditions(deck: DeckCard[], stats: any, knowledge: any, game: GameCategory): string {
  let analysis = `**Suggested Additions**\n\n`;
  
  const mainboard = deck.filter(c => c.board === 'main');
  const colors = new Set(mainboard.flatMap(c => c.colors));
  
  if (game === 'mtg') {
    const mtgKnowledge = knowledge as typeof TCG_KNOWLEDGE.mtg;
    
    if (colors.has('W') || colors.has('U') || colors.has('B') || colors.has('R') || colors.has('G')) {
      analysis += `**Staples for Your Colors:**\n\n`;
      
      if (colors.has('W')) {
        analysis += `*White:* ${mtgKnowledge.staples.white.slice(0, 3).join(', ')}\n`;
      }
      if (colors.has('U')) {
        analysis += `*Blue:* ${mtgKnowledge.staples.blue.slice(0, 3).join(', ')}\n`;
      }
      if (colors.has('B')) {
        analysis += `*Black:* ${mtgKnowledge.staples.black.slice(0, 3).join(', ')}\n`;
      }
      if (colors.has('R')) {
        analysis += `*Red:* ${mtgKnowledge.staples.red.slice(0, 3).join(', ')}\n`;
      }
      if (colors.has('G')) {
        analysis += `*Green:* ${mtgKnowledge.staples.green.slice(0, 3).join(', ')}\n`;
      }
      
      analysis += `\n*Colorless:* ${mtgKnowledge.staples.colorless.slice(0, 3).join(', ')}\n\n`;
    }
  } else if (game === 'yugioh') {
    const yugKnowledge = knowledge as typeof TCG_KNOWLEDGE.yugioh;
    analysis += `**Must-Have Hand Traps:**\n${yugKnowledge.handTraps.join(', ')}\n\n`;
    analysis += `**Board Breakers:**\n${yugKnowledge.boardBreakers.join(', ')}\n\n`;
  } else if (game === 'pokemon') {
    const pokeKnowledge = knowledge as typeof TCG_KNOWLEDGE.pokemon;
    analysis += `**Staple Trainers:**\n${pokeKnowledge.staples.join(', ')}\n\n`;
  }
  
  if (stats.typeDistribution.Creature < 15 && stats.deckType !== 'control') {
    analysis += `• Add 4-6 more creatures\n`;
  }
  
  if ((stats.typeDistribution.Instant + stats.typeDistribution.Sorcery) < 10) {
    analysis += `• Add 4-6 removal/interaction spells\n`;
  }
  
  if (stats.typeDistribution.Land < 20 && stats.totalCards >= 60) {
    analysis += `• Add ${20 - stats.typeDistribution.Land} more lands\n`;
  }
  
  return analysis;
}

function analyzeLands(stats: any): string {
  const landCount = stats.typeDistribution.Land;
  const totalCards = stats.totalCards;
  
  let analysis = `**Mana Base Analysis**\n\n`;
  analysis += `Current Lands: **${landCount}**\n`;
  analysis += `Total Cards: **${totalCards}**\n`;
  analysis += `Ratio: **${((landCount / totalCards) * 100).toFixed(1)}%**\n\n`;
  
  let targetLands = 24;
  
  if (totalCards === 100) {
    targetLands = 36;
  } else if (totalCards === 60) {
    if (stats.deckType === 'aggro') targetLands = 20;
    else if (stats.deckType === 'midrange') targetLands = 24;
    else if (stats.deckType === 'control') targetLands = 26;
  }
  
  analysis += `**Recommended:** ${targetLands} lands for ${stats.deckType}\n\n`;
  
  if (landCount < targetLands) {
    analysis += `⚠️ Add ${targetLands - landCount} more lands\n`;
    analysis += `You'll frequently miss land drops.\n`;
  } else if (landCount > targetLands + 3) {
    analysis += `⚠️ Cut ${landCount - targetLands} lands\n`;
    analysis += `Too many lands leads to flooding.\n`;
  } else {
    analysis += `✅ Land count looks good!\n`;
  }
  
  analysis += `\n**Tips:**\n`;
  analysis += `• Include dual lands for consistency\n`;
  analysis += `• Add utility lands\n`;
  analysis += `• Consider mana rocks\n`;
  
  return analysis;
}

function analyzeBudget(deck: DeckCard[], stats: any): string {
  const mainboard = deck.filter(c => c.board === 'main');
  
  let analysis = `**Budget Analysis**\n\n`;
  analysis += `Total Deck Value: **$${stats.totalValue}**\n`;
  analysis += `Average Card: **$${stats.avgCardValue.toFixed(2)}**\n\n`;
  
  const expensiveCards = mainboard
    .map(c => ({ ...c, price: parseFloat(c.priceUsd || '0') }))
    .filter(c => c.price > 20)
    .sort((a, b) => b.price - a.price);
  
  if (expensiveCards.length > 0) {
    analysis += `**Most Expensive:**\n`;
    expensiveCards.slice(0, 5).forEach((card, idx) => {
      analysis += `${idx + 1}. ${card.name} - $${card.price.toFixed(2)}\n`;
    });
    analysis += `\nThese are first to replace when cutting costs.\n`;
  } else {
    analysis += `✅ **Budget-Friendly!**\nMost cards under $20.\n`;
  }
  
  if (stats.totalValue < 100) {
    analysis += `\n💰 Excellent budget deck!\n`;
  } else if (stats.totalValue < 300) {
    analysis += `\n💵 Moderate investment.\n`;
  } else {
    analysis += `\n💎 High-value premium deck.\n`;
  }
  
  return analysis;
}

function comprehensiveAnalysis(deck: DeckCard[], stats: any, knowledge: any, game: GameCategory): string {
  let analysis = `**Comprehensive Deck Analysis**\n\n`;
  
  analysis += `🎯 **Power Score: ${stats.powerScore}/100**\n`;
  analysis += `📊 **Type: ${stats.deckType.charAt(0).toUpperCase() + stats.deckType.slice(1)}**\n`;
  analysis += `⚡ **Avg CMC: ${stats.avgCMC}**\n`;
  analysis += `💰 **Value: $${stats.totalValue}**\n\n`;
  
  analysis += `✅ **Strengths:**\n`;
  if (stats.avgCMC >= 2.3 && stats.avgCMC <= 3.5) analysis += `• Excellent mana curve\n`;
  if (stats.typeDistribution.Land >= 20 && stats.typeDistribution.Land <= 26) analysis += `• Proper land count\n`;
  if (stats.totalCards === 60 || stats.totalCards === 100) analysis += `• Optimal deck size\n`;
  
  if (stats.suggestions.length > 0) {
    analysis += `\n⚠️ **Improvements:**\n`;
    stats.suggestions.slice(0, 3).forEach((s: string) => analysis += `• ${s}\n`);
  }
  
  analysis += `\n🎯 **Quick Wins:**\n`;
  analysis += `• Test and track underperforming cards\n`;
  analysis += `• Watch gameplay videos for ideas\n`;
  analysis += `• Goldfishing practice to test consistency\n`;
  
  return analysis;
}

export function DeckAIAssistant({ deck, game, onClose }: DeckAIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `👋 Hi! I'm your deck building assistant. I can help you:\n\n• Analyze power level & score\n• Optimize mana curve\n• Suggest cards to add or cut\n• Review mana base\n• Provide budget alternatives\n\nJust ask me anything about your deck!`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isAnalyzing) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsAnalyzing(true);
    
    // Simulate thinking time
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const response = analyzeWithRules(deck, game, input);
    
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, assistantMessage]);
    setIsAnalyzing(false);
  };
  
  const quickQuestions = [
    'How strong is my deck?',
    'What should I cut?',
    'Analyze my curve',
    'What should I add?',
    'Check my lands',
    'How to improve?',
  ];
  
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-3xl h-[80vh] glass-strong rounded-2xl flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-primary)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl accent-gradient flex items-center justify-center">
              <Brain className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Deck Coach</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Instant analysis • No API needed
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map(message => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg accent-gradient flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-black" />
                </div>
              )}
              <div
                className={`max-w-[80%] p-4 rounded-xl ${
                  message.role === 'user' ? 'bg-[var(--accent)] text-black' : 'glass'
                }`}
              >
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content}
                </div>
              </div>
              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold">You</span>
                </div>
              )}
            </div>
          ))}
          
          {isAnalyzing && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg accent-gradient flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-black animate-pulse" />
              </div>
              <div className="glass p-4 rounded-xl">
                <div className="flex gap-2 items-center">
                  <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" style={{ animationDelay: '0.4s' }} />
                  <span className="text-sm text-[var(--text-secondary)] ml-2">Analyzing...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Quick Questions */}
        {messages.length <= 2 && (
          <div className="px-6 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <span className="text-sm font-semibold">Quick Questions:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickQuestions.map((question, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(question)}
                  className="px-3 py-1.5 rounded-lg text-sm btn-ghost hover:glow-border transition"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Input */}
        <form onSubmit={handleSubmit} className="p-6 border-t border-[var(--border-primary)]">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your deck..."
              className="flex-1 px-4 py-3 rounded-xl input-dark"
              disabled={isAnalyzing}
            />
            <button
              type="submit"
              disabled={!input.trim() || isAnalyzing}
              className="px-6 py-3 rounded-xl btn-accent disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
