
import React, { useEffect } from 'react';
import { TrialCard, FateCard, ChanceCard, Player } from '../types';

interface CardModalProps {
  type: 'TRIAL' | 'FATE' | 'CHANCE' | 'WIN' | 'EVENT_DETAIL' | null;
  trial: TrialCard | null;
  fate: FateCard | null;
  chance: ChanceCard | null;
  eventData?: { title: string, content: string, effectLabel: string } | null;
  winner?: Player;
  allPlayers?: Player[]; // Added for VictoryOverlay, though passed via App.tsx
  currentPlayerName?: string;
  onTrialResolve: (selectedIdx: number) => void;
  onTrialConfirm?: () => void;
  onFateResolve: () => void;
  onChanceResolve: () => void;
  onEventResolve?: () => void;
  onRestart?: () => void;
  onClose: () => void;
  playSfx: (soundName: string) => void;
  isAI?: boolean;
  trialSelection?: { selected: number | null, isRevealed: boolean };
  gameMode: 'quick' | 'normal'; // New: game mode
  waitingForHumanConfirmation: boolean; // New: indicates AI is waiting for human
  aiDecisionMadeInModal: any; // New: stores AI's specific decision
}

// Changed CardModal from default to named export
export const CardModal: React.FC<CardModalProps> = ({ 
  type, trial, fate, chance, eventData, winner, currentPlayerName,
  onTrialResolve, onTrialConfirm, onFateResolve, onChanceResolve, onEventResolve, onRestart, onClose, playSfx, isAI, trialSelection,
  gameMode, waitingForHumanConfirmation, aiDecisionMadeInModal // New props
}) => {

  useEffect(() => {
    if (type && type !== 'WIN') playSfx('cardFlip');
  }, [type, playSfx]);

  if (!type) return null;

  const handleOptionClick = (i: number) => {
    // Human players can select options if not AI or if not awaiting confirmation
    if (isAI || trialSelection?.isRevealed || (gameMode === 'normal' && waitingForHumanConfirmation)) return;
    playSfx('click');
    onTrialResolve(i);
  };

  const currentSelected = trialSelection?.selected ?? null;
  const isRevealed = trialSelection?.isRevealed ?? false;

  const getHighlightColor = (text: string) => {
    if (text.includes('失去') || text.includes('扣除') || text.includes('暫停') || text.includes('絕糧')) return 'text-red-700';
    if (text.includes('獲得') || text.includes('獲贈') || text.includes('領取')) return 'text-amber-600';
    return 'text-stone-800';
  };

  const isButtonDisabled = (isAIPlayer: boolean) => {
    if (isAIPlayer && gameMode === 'normal' && waitingForHumanConfirmation) {
      return true; // AI in normal mode is waiting for human confirmation
    }
    return false; // Otherwise, button is enabled for action
  }

  // AI 正在思考的視覺指示組件
  const AiIndicator = () => (
    <div className="absolute top-0 left-0 right-0 z-50 animate-fade-in">
        <div className="bg-amber-500 text-black px-4 py-2 flex items-center justify-center gap-3 shadow-lg border-b border-amber-600">
            <span className="text-xl animate-pulse">🤖</span>
            <span className="font-black tracking-widest text-sm md:text-base animate-pulse">
                電腦 AI [{currentPlayerName}] 正在思考中...
            </span>
            <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-black rounded-full animate-bounce" style={{animationDelay: '0s'}}></span>
                <span className="w-1.5 h-1.5 bg-black rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                <span className="w-1.5 h-1.5 bg-black rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
            </div>
        </div>
    </div>
  );

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 ${type === 'WIN' ? 'bg-transparent pointer-events-none' : 'bg-black/80 backdrop-blur-md'} animate-fade-in font-serif`}>
      <div className={`rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border-4 md:border-8 border-double border-stone-200 transition-all pointer-events-auto relative flex flex-col max-h-[96vh] ${type === 'WIN' ? 'mt-80 scale-110 border-amber-500 bg-stone-900 text-white' : 'bg-white'}`}>
        
        {isAI && type !== 'WIN' && <AiIndicator />}
        {isAI && gameMode === 'normal' && waitingForHumanConfirmation && type !== 'WIN' && (
             <div className="absolute top-0 left-0 right-0 z-50 bg-red-800 text-white px-4 py-2 text-center text-sm md:text-base font-black tracking-widest animate-pulse border-b-2 border-red-900">
                AI 已做出決定，請點擊「確認AI行動」繼續遊戲
             </div>
        )}

        <div className={`flex-1 overflow-y-auto ${isAI && type !== 'WIN' ? 'pt-12' : ''}`}>
            {type === 'TRIAL' && (trial && (
              <div className="p-4 md:p-8 flex flex-col h-full">
                <h2 className="text-xl font-bold mb-4 text-stone-800 border-b pb-2 flex items-center justify-between flex-shrink-0">
                    <span className="flex items-center gap-2">
                        <span className="w-8 h-8 bg-stone-800 text-white flex items-center justify-center rounded-sm text-sm">試</span>
                        文化試煉
                    </span>
                    {(isRevealed || (isAI && aiDecisionMadeInModal?.type === 'TRIAL' && waitingForHumanConfirmation)) && (
                        <span className={`text-sm font-black px-3 py-1 rounded-full animate-bounce ${
                            (aiDecisionMadeInModal?.choice ?? currentSelected) === trial.answerIndex ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'
                        }`}>
                            {(aiDecisionMadeInModal?.choice ?? currentSelected) === trial.answerIndex ? '✓ 答對了' : '✗ 答錯了'}
                        </span>
                    )}
                </h2>

                <div className="bg-stone-50 p-4 rounded-lg mb-4 italic text-sm md:text-base text-stone-700 border-l-4 border-stone-800 shadow-inner leading-relaxed flex-shrink-0">
                    「{trial.quote}」
                </div>
                
                {!(isRevealed || (isAI && aiDecisionMadeInModal?.type === 'TRIAL' && waitingForHumanConfirmation)) ? (
                    <div className="flex-1 flex flex-col">
                        <h3 className="text-base md:text-lg font-bold mb-4 text-stone-900 leading-tight">{trial.question}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4">
                            {trial.options.map((opt, i) => {
                                const isCurrentSelected = currentSelected === i;
                                return (
                                    <button
                                        key={i}
                                        disabled={isRevealed || isAI || (gameMode === 'normal' && waitingForHumanConfirmation)}
                                        onClick={() => handleOptionClick(i)}
                                        className={`w-full text-left p-3 md:p-4 rounded-xl border-2 transition-all duration-300 relative group
                                            ${isCurrentSelected 
                                                ? 'border-amber-500 bg-amber-50 ring-4 ring-amber-400/30 scale-[1.02] shadow-lg animate-pulse' 
                                                : 'border-stone-100 hover:border-stone-300 hover:bg-stone-50'}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-xs ${isCurrentSelected ? 'bg-amber-600 text-white' : 'bg-stone-200 text-stone-600'}`}>
                                                {opt[0]}
                                            </span>
                                            <span className="text-sm md:text-base leading-tight font-medium text-stone-800">{opt.substring(2)}</span>
                                        </div>
                                        {isAI && isCurrentSelected && !waitingForHumanConfirmation && gameMode === 'quick' && (
                                            <div className="absolute -top-2 -right-2 bg-amber-600 text-white text-[9px] px-2 py-0.5 rounded-full font-black shadow-md z-10">AI 選取中</div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="animate-fade-in space-y-4 pb-4">
                        <div className="p-4 bg-green-50 border-2 border-green-200 rounded-xl shadow-sm">
                            <h4 className="font-black text-green-900 mb-2 flex items-center text-sm md:text-base">
                                <span className="mr-2">💡</span> 正確答案：{trial.options[trial.answerIndex]}
                            </h4>
                            <p className="text-green-800 text-xs md:text-sm leading-relaxed indent-4">{trial.analysis}</p>
                        </div>
                        <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                            <h4 className="font-bold text-stone-500 mb-1 text-[10px] uppercase tracking-widest">【 出典與章句原文 】</h4>

                            <p className="text-stone-600 text-[11px] md:text-xs italic leading-relaxed">{trial.quote}</p>
                        </div>
                        <button 
                            disabled={isButtonDisabled(isAI || false)}
                            onClick={() => { playSfx('click'); onTrialConfirm?.(); }}
                            className="w-full py-4 bg-stone-900 text-white rounded-xl font-black tracking-[0.4em] hover:bg-black transition-all shadow-xl active:scale-95 disabled:bg-stone-400 disabled:cursor-not-allowed"
                        >
                            {isAI && gameMode === 'normal' && waitingForHumanConfirmation ? '等待確認' : '確認答案'}
                        </button>
                    </div>
                )}
              </div>
            ))}

            {type === 'FATE' && (fate && (
              <div className="p-4 md:p-8 flex flex-col h-full items-center justify-center text-center">
                <div className="text-7xl mb-6 animate-pulse">📜</div>
                <h2 className="text-3xl font-black text-stone-800 tracking-wider mb-4">{fate.title}</h2>
                <p className="text-stone-700 text-lg md:text-xl leading-relaxed mb-6 italic">「{fate.narrative || fate.description}」</p>
                <button 
                    disabled={isButtonDisabled(isAI || false)}
                    onClick={() => { playSfx('click'); onFateResolve(); }}
                    className="mt-4 px-12 py-4 bg-stone-900 text-white rounded-full font-black text-xl tracking-[0.4em] hover:bg-black transition-all shadow-xl active:scale-95 disabled:bg-stone-400 disabled:cursor-not-allowed"
                >
                    {isAI && gameMode === 'normal' && waitingForHumanConfirmation ? '等待確認' : '接受命運'}
                </button>
              </div>
            ))}

            {type === 'CHANCE' && (chance && (
              <div className="p-4 md:p-8 flex flex-col h-full items-center justify-center text-center">
                <div className="text-7xl mb-6 animate-bounce">💡</div>
                <h2 className="text-3xl font-black text-stone-800 tracking-wider mb-4">{chance.title}</h2>
                <p className="text-stone-700 text-lg md:text-xl leading-relaxed mb-6 italic">「{chance.narrative}」</p>
                <p className="text-red-700 font-bold text-xl md:text-2xl mb-6 animate-pulse-slow">挑戰：{chance.challenge}</p>
                <button 
                    disabled={isButtonDisabled(isAI || false)}
                    onClick={() => { playSfx('click'); onChanceResolve(); }}
                    className="mt-4 px-12 py-4 bg-amber-700 text-white rounded-full font-black text-xl tracking-[0.4em] hover:bg-amber-800 transition-all shadow-xl active:scale-95 disabled:bg-stone-400 disabled:cursor-not-allowed"
                >
                    {isAI && gameMode === 'normal' && waitingForHumanConfirmation ? '等待確認' : '把握機緣'}
                </button>
              </div>
            ))}

            {type === 'EVENT_DETAIL' && (eventData && (
              <div className="p-4 md:p-8 flex flex-col h-full">
                <h2 className="text-xl font-bold mb-4 text-stone-800 border-b pb-2 flex items-center gap-2 flex-shrink-0">
                    <span className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center rounded-sm text-sm">史</span>
                    史料記載：{eventData.title}
                </h2>
                <div className="bg-stone-50 p-4 rounded-lg mb-4 italic text-sm md:text-base text-stone-700 border-l-4 border-blue-800 shadow-inner leading-relaxed flex-shrink-0">
                    {eventData.content}
                </div>
                <div className="text-center mt-auto">
                    <p className={`text-2xl font-black tracking-widest ${getHighlightColor(eventData.effectLabel)} mb-6`}>
                        {eventData.effectLabel}
                    </p>
                    <button 
                        disabled={isButtonDisabled(isAI || false)}
                        onClick={() => { playSfx('click'); onEventResolve?.(); }}
                        className="px-12 py-4 bg-stone-900 text-white rounded-full font-black text-xl tracking-[0.4em] hover:bg-black transition-all shadow-xl active:scale-95 disabled:bg-stone-400 disabled:cursor-not-allowed"
                    >
                        {isAI && gameMode === 'normal' && waitingForHumanConfirmation ? '等待確認' : '領悟史實'}
                    </button>
                </div>
              </div>
            ))}
        </div>
        
        {/* Close Button - Only for non-WIN modals */}
        {type !== 'WIN' && (
          <button
            onClick={() => { playSfx('click'); onClose(); }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-stone-200 text-stone-700 p-2 rounded-full shadow-md hover:bg-stone-300 transition-colors z-20"
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
