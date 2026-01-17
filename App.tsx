
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player, TileType, TrialCard, FateCard, ChanceCard, Character } from './types';
import { BOARD_TILES, TRIAL_CARDS, FATE_CARDS, CHANCE_CARDS } from './constants';
import Board from './components/Board';
import PlayerInfo from './components/PlayerInfo';
// Changed import of CardModal from default to named export
import { CardModal } from './components/CardModal';
import AudioSettings from './components/AudioSettings';
import StartScreen from './components/StartScreen';
import MeatEffect from './components/MeatEffect';
import VictoryOverlay from './components/VictoryOverlay';
import RecoveryEffect from './components/RecoveryEffect';
import PauseEffect from './components/PauseEffect';
import { GoogleGenAI } from "@google/genai"; // Removed Modality import

// Removed CHARACTER_VOICE_CONFIG as it's only for voice narration

const audioSources = {
  bgm: '/audio/bgm.mp3',
  diceRoll: '/audio/dice_roll.mp3',
  move: '/audio/move.mp3',
  getMeat: '/audio/get_meat.mp3',
  cardFlip: '/audio/card_flip.mp3',
  correctAnswer: '/audio/correct_answer.mp3',
  incorrectAnswer: '/audio/incorrect_answer.mp3',
  winGame: '/audio/win_game.mp3',
  click: '/audio/click.mp3',
  turnStart: '/audio/turn_start.mp3',
};

const App: React.FC = () => {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameMode, setGameMode] = useState<'quick' | 'normal'>('normal'); // New: game mode
  const [players, setPlayers] = useState<Player[]>([]);
  const [winCondition, setWinCondition] = useState(10);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [diceRolls, setDiceRolls] = useState<[number, number]>([1, 1]);
  const [isRolling, setIsRolling] = useState(false);
  const [isPlayerMoving, setIsPlayerMoving] = useState(false);
  const [activeModal, setActiveModal] = useState<'TRIAL' | 'FATE' | 'CHANCE' | 'WIN' | 'EVENT_DETAIL' | null>(null);
  const [activeTrial, setActiveTrial] = useState<TrialCard | null>(null);
  const [activeFate, setActiveFate] = useState<FateCard | null>(null);
  const [activeChance, setActiveChance] = useState<ChanceCard | null>(null);
  const [activeEventData, setActiveEventData] = useState<{title: string, content: string, effectLabel: string, effectType?: 'PAUSE' | 'LOSE_MEAT' | 'GAIN_MEAT'} | null>(null);
  const [gameLog, setGameLog] = useState<string[]>(['【公告】歡迎來到孔子周遊列國遊戲！請各位賢士各就各位。']);

  const [showBigIcon, setShowBigIcon] = useState<'CHANCE' | 'FATE' | null>(null);
  const [trialSelection, setTrialSelection] = useState<{ selected: number | null, isRevealed: boolean }>({ selected: null, isRevealed: false });
  const [showRecovery, setShowRecovery] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [waitingForHumanConfirmation, setWaitingForHumanConfirmation] = useState(false); // New: for AI actions in normal mode
  const [aiDecisionMadeInModal, setAiDecisionMadeInModal] = useState<any>(null); // Stores AI's decision data for human confirmation

  const [isBgmPlaying, setIsBgmPlaying] = useState(false);
  const [bgmVolume, setBgmVolume] = useState(0.3);
  const [sfxVolume, setSfxVolume] = useState(0.7);
  // Removed isVoiceEnabled state
  // Removed isAiThrottled state
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  
  const [meatAnimationTarget, setMeatAnimationTarget] = useState<number | null>(null);
  const [meatAnimationAmount, setMeatAnimationAmount] = useState(0);
  const [meatAnimationCallback, setMeatAnimationCallback] = useState<(() => void) | null>(null);
  const [isBoardCelebrating, setIsBoardCelebrating] = useState(false);
  // Removed aiSpeakingText state

  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const rollTimeoutRef = useRef<number | null>(null); 
  const aiRollTimeoutRef = useRef<number | null>(null); 
  const aiModalDecisionTimeoutRef = useRef<number | null>(null);
  // Removed audioContextRef
  
  // Removed aiRequestQueue, lastAiRequestTimestamp, MIN_AI_REQUEST_INTERVAL

  const handleTileActionRef = useRef<((tileIndex: number) => Promise<void>) | null>(null);
  const movePlayerRef = useRef<((steps: number, targetPlayerId?: number) => Promise<void>) | null>(null);
  const resolveTrialRef = useRef<((correct: boolean, aiChosenIndex?: number) => void) | null>(null);
  const onFateResolveRef = useRef<(() => void) | null>(null);
  const onChanceResolveRef = useRef<(() => void) | null>(null);
  const onEventResolveRef = useRef<(() => void) | null>(null);
  
  const log = useCallback((msg: string) => {
    setGameLog(prev => [msg, ...prev].slice(0, 15));
  }, []);

  useEffect(() => {
    bgmAudioRef.current = new Audio(audioSources.bgm);
    bgmAudioRef.current.loop = true;
    bgmAudioRef.current.volume = bgmVolume;
    return () => {
      bgmAudioRef.current?.pause();
      bgmAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (bgmAudioRef.current) {
      bgmAudioRef.current.volume = bgmVolume;
      if (isBgmPlaying) {
        bgmAudioRef.current.play().catch(() => {});
      } else {
        bgmAudioRef.current.pause();
      }
    }
  }, [isBgmPlaying, bgmVolume]);

  const playSfx = useCallback((soundName: keyof typeof audioSources) => {
    const sfx = new Audio(audioSources[soundName]);
    sfx.volume = sfxVolume;
    sfx.play().catch(() => {});
  }, [sfxVolume]);

  // Removed decodeBase64, decodeAudioData, callGeminiWithRetry functions
  // Removed playCharacterVoice and generateDynamicCommentary functions

  const currentPlayer = players[currentPlayerIndex];

  const checkWin = useCallback((updatedPlayers: Player[]) => {
    const winner = updatedPlayers.find(p => p.meat >= winCondition);
    if (winner) {
      log(`【終局】${winner.character} 率先獲得 ${winner.meat} 塊祭肉，完成教化旅程！`);
      playSfx('winGame');
      setActiveModal('WIN');
      // 清除所有可能還在背景跑的定時器
      if (rollTimeoutRef.current) window.clearTimeout(rollTimeoutRef.current);
      if (aiRollTimeoutRef.current) window.clearTimeout(aiRollTimeoutRef.current);
      if (aiModalDecisionTimeoutRef.current) window.clearTimeout(aiModalDecisionTimeoutRef.current);
      return true;
    }
    return false;
  }, [playSfx, winCondition, log, setActiveModal]);

  const handleCentralMeatAnimationComplete = useCallback(() => {
    setIsBoardCelebrating(false);
  }, []);

  const showVictoryEffect = useCallback((playerIndex: number, amount: number, callback: () => void) => {
    if (activeModal === 'WIN') return; // Do not show effects if game is already won
    setMeatAnimationTarget(playerIndex);
    setMeatAnimationAmount(amount);
    setMeatAnimationCallback(() => callback);
    if (amount > 0) setIsBoardCelebrating(true);
  }, [activeModal, setMeatAnimationTarget, setMeatAnimationAmount, setMeatAnimationCallback, setIsBoardCelebrating]);

  const nextTurn = useCallback(() => {
    if (activeModal === 'WIN') return;

    // Clear all pending timeouts for the previous player's actions
    if (rollTimeoutRef.current) window.clearTimeout(rollTimeoutRef.current);
    if (aiRollTimeoutRef.current) window.clearTimeout(aiRollTimeoutRef.current);
    if (aiModalDecisionTimeoutRef.current) window.clearTimeout(aiModalDecisionTimeoutRef.current);
    rollTimeoutRef.current = null;
    aiRollTimeoutRef.current = null;
    aiModalDecisionTimeoutRef.current = null;

    setIsRolling(false);
    setIsPlayerMoving(false);
    setActiveModal(null);
    setShowBigIcon(null);
    setShowPause(false);
    setShowRecovery(false);
    setTrialSelection({ selected: null, isRevealed: false });
    setWaitingForHumanConfirmation(false); // Reset human confirmation state
    setAiDecisionMadeInModal(null); // Clear AI decision

    const nextIndex = (currentPlayerIndex + 1) % players.length;
    setCurrentPlayerIndex(nextIndex);
    playSfx('turnStart');
    
    const nextP = players[nextIndex];

    if (nextP.isPaused && nextP.turnsToSkip > 0) {
      log(`【跳過】${nextP.isAI ? '[電腦] ' : ''}${nextP.character} 因修身養性，本回合暫停行動，尚餘 ${nextP.turnsToSkip} 回合。`);
      setShowPause(true); // Show pause effect for the skipped player
      setPlayers(prev => prev.map((p, i) => 
        i === nextIndex ? { ...p, turnsToSkip: p.turnsToSkip - 1, isPaused: p.turnsToSkip - 1 > 0 } : p
      ));
      
      setTimeout(() => {
        setShowPause(false); // Hide pause effect
        nextTurn(); // Recursively call nextTurn for the player after the paused one
      }, 2000);
    } else {
      log(`【輪值】${nextP.isAI ? '[電腦] ' : ''}${nextP.character} 開始回合。`);
      // Removed generateDynamicCommentary call here
    }
  }, [players, currentPlayerIndex, playSfx, activeModal, log, setPlayers, setCurrentPlayerIndex, setShowPause, setTrialSelection, setIsRolling, setIsPlayerMoving, setShowBigIcon, setShowRecovery, setActiveModal, setWaitingForHumanConfirmation, setAiDecisionMadeInModal]);

  // --- Resolver Functions ---
  const onEventResolve = useCallback(() => {
    const effect = activeEventData?.effectType;

    if (effect === 'GAIN_MEAT' || effect === 'LOSE_MEAT') {
        const amount = effect === 'GAIN_MEAT' ? 1 : -1;
        setActiveModal(null);
        log(`【事件】${currentPlayer?.character} 在 ${activeEventData?.title} 中${amount > 0 ? '獲贈' : '失去'}祭肉一份。`);
        showVictoryEffect(currentPlayerIndex, amount, () => {
            setPlayers(prev => {
                const updated = prev.map((p, i) => i === currentPlayerIndex ? { ...p, meat: Math.max(0, p.meat + amount) } : p);
                if (!checkWin(updated)) nextTurn();
                return updated;
            });
        });
        return;
    }
    
    setActiveModal(null);
    if (effect === 'PAUSE') {
        log(`【事件】${currentPlayer?.character} 在 ${activeEventData?.title} 中感悟修身，本回合後需暫停行動一回合。`);
        setPlayers(prev => prev.map((p, i) => {
            if (i !== currentPlayerIndex) return p;
            return { ...p, isPaused: true, turnsToSkip: p.turnsToSkip + 1 };
        }));
        setTimeout(nextTurn, 500);
    } else {
        setTimeout(nextTurn, 500);
    }
  }, [currentPlayerIndex, activeEventData, nextTurn, playSfx, showVictoryEffect, checkWin, currentPlayer, activeModal, log, setActiveModal, setPlayers]);
  onEventResolveRef.current = onEventResolve;

  const resolveTrial = useCallback((correct: boolean, aiChosenIndex?: number) => {
    if (activeModal === 'WIN') return;
    const chosenIndex = aiChosenIndex !== undefined ? aiChosenIndex : trialSelection.selected;
    const choiceLetter = chosenIndex !== null ? String.fromCharCode(65 + chosenIndex) : '未選擇';
    if (correct) {
      log(`【試煉】${currentPlayer?.character} 選擇 ${choiceLetter}，回答正確！獲贈祭肉一份。`);
      setActiveModal(null); 
      setTimeout(() => { 
        showVictoryEffect(currentPlayerIndex, 1, () => {
          setPlayers(prev => {
            const updated = prev.map((p, i) => i === currentPlayerIndex ? { ...p, meat: p.meat + 1 } : p);
            if (!checkWin(updated)) {
                playSfx('correctAnswer');
                setTimeout(nextTurn, 500);
            }
            return updated;
          });
        });
      }, 400);
    } else {
      log(`【試煉】${currentPlayer?.character} 選擇 ${choiceLetter}，可惜回答錯誤，需多加鑽研。`);
      playSfx('incorrectAnswer');
      setActiveModal(null);
      setTimeout(nextTurn, 500);
    }
  }, [trialSelection.selected, currentPlayerIndex, checkWin, playSfx, nextTurn, currentPlayer, activeModal, showVictoryEffect, log, setActiveModal, setPlayers]);
  resolveTrialRef.current = resolveTrial;

  const onFateResolve = useCallback(() => {
    if (activeModal === 'WIN') return;
    playSfx('click');
    const fate = activeFate;
    if (!fate) { setActiveModal(null); nextTurn(); return; }
    
    log(`【命運】${currentPlayer?.character} 遭遇「${fate.title}」：${fate.description}`);

    const meatChange = fate.effect.meat || 0;
    const isPausedEffect = fate.effect.isPaused || false;
    const positionEffect = fate.effect.position;
    const specialEffect = fate.effect.special;
    let shouldCallNextTurn = true;

    const finalizeFateEffects = (actualMeatChange: number = 0) => {
        setPlayers(prevPlayers => {
            let currentPlayersCopy = [...prevPlayers];
            let newCurrentPlayer = { ...currentPlayersCopy[currentPlayerIndex] };
            newCurrentPlayer.meat = Math.max(0, newCurrentPlayer.meat + actualMeatChange);
            if (isPausedEffect) {
                newCurrentPlayer.isPaused = true;
                newCurrentPlayer.turnsToSkip = newCurrentPlayer.turnsToSkip + 1;
            }
            if (specialEffect === 'HAS_PROTECTION') newCurrentPlayer.hasProtection = true;
            currentPlayersCopy[currentPlayerIndex] = newCurrentPlayer;
            
            if (specialEffect === 'SWAP_ZILU_OR_START') {
                const zilouIdx = currentPlayersCopy.findIndex(p => p.character === '子路');
                if (zilouIdx !== -1) {
                    const zilouPos = currentPlayersCopy[zilouIdx].position;
                    const myPos = newCurrentPlayer.position;
                    currentPlayersCopy[currentPlayerIndex].position = zilouPos;
                    currentPlayersCopy[zilouIdx].position = myPos;
                } else {
                    currentPlayersCopy[currentPlayerIndex].position = 0;
                    setTimeout(() => handleTileActionRef.current?.(0), 100);
                    shouldCallNextTurn = false;
                }
            } else if (positionEffect !== undefined) {
                currentPlayersCopy[currentPlayerIndex].position = positionEffect;
                setTimeout(() => handleTileActionRef.current?.(positionEffect), 100);
                shouldCallNextTurn = false;
            }
            if (!checkWin(currentPlayersCopy)) {
                if (shouldCallNextTurn) {
                    nextTurn();
                }
            }
            return currentPlayersCopy;
        });
    };

    setActiveModal(null);
    if (meatChange !== 0) {
        showVictoryEffect(currentPlayerIndex, meatChange, () => finalizeFateEffects(meatChange));
    } else {
        finalizeFateEffects(0);
    }
  }, [activeFate, currentPlayerIndex, checkWin, nextTurn, showVictoryEffect, playSfx, currentPlayer, activeModal, log, handleTileActionRef, setActiveModal, setPlayers]);
  onFateResolveRef.current = onFateResolve;

  const onChanceResolve = useCallback(() => {
    if (activeModal === 'WIN') return;
    playSfx('click');
    const chance = activeChance;
    if (!chance) { setActiveModal(null); nextTurn(); return; }

    log(`【機緣】${currentPlayer?.character} 遇見「${chance.title}」：${chance.challenge}`);

    const { effect } = chance;
    let meatChange = effect?.meat || 0;
    let positionChange = effect?.position;
    let isPausedEffect = effect?.isPaused || false;
    setActiveModal(null);

    const finalizeChanceEffects = (finalMeat: number = 0, finalPos?: number) => {
      let actualPaused = isPausedEffect;
      setPlayers(prev => {
        let copy = [...prev];
        let me = { ...copy[currentPlayerIndex] };
        me.meat = Math.max(0, me.meat + finalMeat);
        if (actualPaused) {
            me.isPaused = true;
            me.turnsToSkip = me.turnsToSkip + 1;
        }
        if (finalPos !== undefined) {
          me.position = finalPos;
          copy[currentPlayerIndex] = me;
          setTimeout(() => handleTileActionRef.current?.(finalPos), 100);
          return copy;
        }
        copy[currentPlayerIndex] = me;
        if (!checkWin(copy)) {
            if (positionChange === undefined) {
                nextTurn();
            }
        }
        return copy;
      });
    };

    if (effect?.special === 'ROLL_DICE_ODD_EVEN') {
        const roll = Math.floor(Math.random() * 6) + 1;
        log(`【機緣決策】擲出 ${roll}，${roll % 2 !== 0 ? '不幸遭遇刁難。' : '順利把握機緣！'}`);
        if (roll % 2 !== 0) { isPausedEffect = true; meatChange = -1; }
        else { 
          meatChange = 1; 
          showVictoryEffect(currentPlayerIndex, 1, () => {
             finalizeChanceEffects(1); 
             setTimeout(() => movePlayerRef.current?.(3), 600);
          });
          return; 
        }
    }
    
    if (meatChange !== 0) {
        showVictoryEffect(currentPlayerIndex, meatChange, () => finalizeChanceEffects(meatChange, positionChange));
    } else {
        finalizeChanceEffects(0, positionChange);
    }
  }, [activeChance, currentPlayer, currentPlayerIndex, nextTurn, checkWin, showVictoryEffect, playSfx, activeModal, log, handleTileActionRef, movePlayerRef, setActiveModal, setPlayers]);
  onChanceResolveRef.current = onChanceResolve;

  const movePlayer = useCallback(async (steps: number, targetPlayerId?: number) => {
    setIsPlayerMoving(true);
    const actualTargetPlayerId = targetPlayerId ?? currentPlayerIndex;
    let tempPos = players[actualTargetPlayerId].position;
    let passCount = 0;

    for (let i = 0; i < steps; i++) {
      await new Promise(r => setTimeout(r, 500));
      const nextPos = (tempPos + 1) % BOARD_TILES.length;
      if (tempPos !== 0 && nextPos === 0) passCount++;
      tempPos = nextPos;
      playSfx('move'); 
      setPlayers(prev => prev.map((p, idx) => idx === actualTargetPlayerId ? { ...p, position: nextPos } : p));
    }

    const finishMove = () => {
      setIsPlayerMoving(false);
      if (actualTargetPlayerId === currentPlayerIndex) {
        handleTileActionRef.current?.(tempPos);
      } else {
        nextTurn(); 
      }
    };

    if (passCount > 0 && actualTargetPlayerId === currentPlayerIndex) {
      log(`【福報】${players[currentPlayerIndex].character} 經過魯國起點，領取家鄉祭肉 ${passCount} 塊。`);
      showVictoryEffect(currentPlayerIndex, passCount, () => {
        setPlayers(prev => {
          const updated = prev.map((p, idx) => idx === currentPlayerIndex ? { ...p, meat: p.meat + passCount } : p);
          if (!checkWin(updated)) finishMove();
          else setIsPlayerMoving(false);
          return updated;
        });
      });
    } else {
      setTimeout(finishMove, 500);
    }
  }, [players, currentPlayerIndex, showVictoryEffect, checkWin, nextTurn, playSfx, log, handleTileActionRef, setIsPlayerMoving, setPlayers]);
  movePlayerRef.current = movePlayer;

  const handleTileAction = useCallback(async (tileIndex: number) => {
    const tile = BOARD_TILES[tileIndex];
    if (!currentPlayer) return;
    
    playSfx('cardFlip');
    setActiveTrial(null);
    setActiveFate(null);
    setActiveChance(null);
    setActiveEventData(null);
    setTrialSelection({ selected: null, isRevealed: false });

    log(`【停留】${currentPlayer.character} 抵達了 ${tile.name}。`);

    switch (tile.type) {
      case TileType.STATE:
        setActiveModal('TRIAL');
        const randomTrial = TRIAL_CARDS[Math.floor(Math.random() * TRIAL_CARDS.length)];
        setActiveTrial(randomTrial);
        break;

      case TileType.FATE:
        setShowBigIcon('FATE');
        setTimeout(() => {
          if (activeModal === 'WIN') return;
          setShowBigIcon(null);
          setActiveModal('FATE');
          const randomFate = FATE_CARDS[Math.floor(Math.random() * FATE_CARDS.length)];
          setActiveFate(randomFate);
        }, 1200);
        break;

      case TileType.CHANCE:
        setShowBigIcon('CHANCE');
        setTimeout(() => {
          if (activeModal === 'WIN') return;
          setShowBigIcon(null);
          setActiveModal('CHANCE');
          const randomChance = CHANCE_CARDS[Math.floor(Math.random() * CHANCE_CARDS.length)];
          setActiveChance(randomChance);
        }, 1200);
        break;

      case TileType.EVENT:
        if (tile.name === '受困匡地') {
            setActiveEventData({
                title: "史料解讀：受困於匡",
                content: "發生於西元前495年，孔子57歲時。因孔子長相酷似曾粗暴對待當地的陽虎，引發圍圍困。孔子於危難中坦言：『天之未喪斯文也，匡人其如予何！』展現無畏天命的精神。",
                effectLabel: "誤解圍困中，暫停一回合",
                effectType: 'PAUSE'
            });
            setActiveModal('EVENT_DETAIL');
        } else if (tile.name === '鄭國城門') {
            setActiveEventData({
                title: "史料解讀：喪家之犬",
                content: "出自《史記》，描述孔子在鄭國與弟子失散，獨自站在東門等候。鄭人形容孔子『累累若喪家之狗』。孔子欣然自嘲：『然哉！內。』，體現了身處困厄中的豁達。",
                effectLabel: "失魂落魄，扣除祭肉一份",
                effectType: 'LOSE_MEAT'
            });
            setActiveModal('EVENT_DETAIL');
        } else if (tile.name === '陳蔡之間') {
            setActiveEventData({
                title: "史料解讀：陳蔡絕糧",
                content: "孔子師徒在陳、蔡之間遭遇斷糧，從者病倒。孔子即便在絕境中依然講誦弦歌不衰，教導弟子『君子固窮』，展現了高尚意志。",
                effectLabel: "絕糧受困，暫停一回合",
                effectType: 'PAUSE'
            });
            setActiveModal('EVENT_DETAIL');
        } else if (tile.name === '葉公問政') {
            setActiveEventData({
                title: "史料解讀：葉公問政",
                content: "出自《論語·子路》。楚國大夫葉公詢問為政之道，孔子答：『近者說，遠者來。』強調治國應以仁德為本，吸引遠方人民歸附。",
                effectLabel: "仁政感召，獲得祭肉一份",
                effectType: 'GAIN_MEAT'
            });
            setActiveModal('EVENT_DETAIL');
        } else {
            setTimeout(nextTurn, 1200);
        }
        break;

      default:
        setTimeout(nextTurn, 1000);
    }
  }, [currentPlayer, playSfx, nextTurn, activeModal, log, setActiveTrial, setActiveFate, setActiveChance, setActiveEventData, setTrialSelection, setShowBigIcon, setActiveModal]);
  handleTileActionRef.current = handleTileAction;

  const handleRestartGame = useCallback(() => {
    if (rollTimeoutRef.current) window.clearTimeout(rollTimeoutRef.current);
    if (aiRollTimeoutRef.current) window.clearTimeout(aiRollTimeoutRef.current);
    if (aiModalDecisionTimeoutRef.current) window.clearTimeout(aiModalDecisionTimeoutRef.current);
    rollTimeoutRef.current = null;
    aiRollTimeoutRef.current = null;
    aiModalDecisionTimeoutRef.current = null;
    
    setGameStarted(false); 
    setPlayers([]); 
    setCurrentPlayerIndex(0); 
    setDiceRolls([1, 1]);
    setIsRolling(false); 
    setIsPlayerMoving(false); 
    setActiveModal(null);
    setTrialSelection({ selected: null, isRevealed: false });
    setShowRecovery(false);
    setShowPause(false);
    setWaitingForHumanConfirmation(false);
    setAiDecisionMadeInModal(null);
    log('【公告】遊戲已重新開始。');
  }, [log, setGameStarted, setPlayers, setCurrentPlayerIndex, setDiceRolls, setIsRolling, setIsPlayerMoving, setActiveModal, setTrialSelection, setShowRecovery, setShowPause, setWaitingForHumanConfirmation, setAiDecisionMadeInModal]);

  const handleRoll = useCallback(() => {
    if (isRolling || isPlayerMoving || activeModal || showBigIcon || showRecovery || showPause || waitingForHumanConfirmation) return;
    
    const playerAttemptingRoll = players[currentPlayerIndex];
    if (!playerAttemptingRoll) return;

    if (playerAttemptingRoll.isPaused && playerAttemptingRoll.turnsToSkip > 0) {
        log(`【提示】${playerAttemptingRoll.character} 正在修身養性，本回合無法擲骰。`);
        return;
    }

    if (!playerAttemptingRoll.isAI) {
      playSfx('click');
    } else {
      // Removed generateDynamicCommentary call here for AI rolling.
    }

    playSfx('diceRoll');
    setIsRolling(true);
    rollTimeoutRef.current = window.setTimeout(() => {
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      setDiceRolls([d1, d2]);
      setIsRolling(false);
      rollTimeoutRef.current = null;
      log(`【擲骰】${playerAttemptingRoll.character} 擲出了 ${d1}+${d2}=${d1 + d2} 點，啟程出發。`);
      movePlayerRef.current?.(d1 + d2);
    }, 600);
  }, [isRolling, isPlayerMoving, activeModal, showBigIcon, showRecovery, showPause, waitingForHumanConfirmation, playSfx, currentPlayerIndex, players, log, setIsRolling, setDiceRolls, movePlayerRef]);

  // AI Roll Trigger useEffect
  useEffect(() => {
    if (aiRollTimeoutRef.current) {
        window.clearTimeout(aiRollTimeoutRef.current);
        aiRollTimeoutRef.current = null;
    }

    if (gameStarted && players[currentPlayerIndex] && !isRolling && !isPlayerMoving && !activeModal && !showBigIcon && !showRecovery && !showPause && !players[currentPlayerIndex].isPaused && !waitingForHumanConfirmation) {
        const currentActivePlayer = players[currentPlayerIndex];
        if (currentActivePlayer.isAI) {
            aiRollTimeoutRef.current = window.setTimeout(() => {
                if (players[currentPlayerIndex]?.id === currentActivePlayer.id) {
                    handleRoll();
                }
            }, 1500);
        }
    }

    return () => {
        if (aiRollTimeoutRef.current) {
            window.clearTimeout(aiRollTimeoutRef.current);
        }
    };
}, [
    gameStarted, currentPlayerIndex, isRolling, isPlayerMoving, activeModal,
    showBigIcon, showRecovery, showPause, players, handleRoll, waitingForHumanConfirmation
]);

  // AI Modal Decision useEffect
  useEffect(() => {
    if (aiModalDecisionTimeoutRef.current) {
        window.clearTimeout(aiModalDecisionTimeoutRef.current);
        aiModalDecisionTimeoutRef.current = null;
    }

    if (gameStarted && players[currentPlayerIndex]?.isAI && activeModal && activeModal !== 'WIN' && !showRecovery && !showPause && !trialSelection.isRevealed && !waitingForHumanConfirmation) {
        const currentActivePlayer = players[currentPlayerIndex];
        
        aiModalDecisionTimeoutRef.current = window.setTimeout(() => {
            if (players[currentPlayerIndex]?.id !== currentActivePlayer.id || !activeModal) return; 

            switch (activeModal) {
                case 'TRIAL':
                    if (activeTrial) {
                        const aiChoice = Math.floor(Math.random() * 4);
                        log(`【AI 決策】${currentActivePlayer.character} 正在審視選項，選中了 ${String.fromCharCode(65 + aiChoice)}。`);
                        setTrialSelection({ selected: aiChoice, isRevealed: true }); // Reveal AI's choice to human
                        setAiDecisionMadeInModal({ type: 'TRIAL', choice: aiChoice });
                        if (gameMode === 'normal') {
                            setWaitingForHumanConfirmation(true);
                        } else {
                            window.setTimeout(() => {
                                resolveTrialRef.current?.(aiChoice === activeTrial.answerIndex, aiChoice);
                            }, 2000);
                        }
                    }
                    break;
                case 'FATE':
                    log(`【AI 決策】${currentActivePlayer.character} 接受了命運之輪的安排。`);
                    setAiDecisionMadeInModal({ type: 'FATE' });
                    if (gameMode === 'normal') {
                        setWaitingForHumanConfirmation(true);
                    } else {
                        onFateResolveRef.current?.();
                    }
                    break;
                case 'CHANCE':
                    log(`【AI 決策】${currentActivePlayer.character} 決定把握眼前的機緣。`);
                    setAiDecisionMadeInModal({ type: 'CHANCE' });
                    if (gameMode === 'normal') {
                        setWaitingForHumanConfirmation(true);
                    } else {
                        onChanceResolveRef.current?.();
                    }
                    break;
                case 'EVENT_DETAIL':
                    log(`【AI 決策】${currentActivePlayer.character} 領悟史實事件。`);
                    setAiDecisionMadeInModal({ type: 'EVENT_DETAIL' });
                    if (gameMode === 'normal') {
                        setWaitingForHumanConfirmation(true);
                    } else {
                        onEventResolveRef.current?.();
                    }
                    break;
            }
        }, 2000);
    }

    return () => {
        if (aiModalDecisionTimeoutRef.current) {
            window.clearTimeout(aiModalDecisionTimeoutRef.current);
        }
    };
}, [
    activeModal, gameStarted, trialSelection.isRevealed, showRecovery, showPause,
    activeTrial, currentPlayerIndex, players, log, gameMode, waitingForHumanConfirmation,
    setTrialSelection, setAiDecisionMadeInModal, setWaitingForHumanConfirmation,
    resolveTrialRef, onFateResolveRef, onChanceResolveRef, onEventResolveRef
]);

  const handleHumanConfirmation = useCallback(() => {
    playSfx('click');
    if (!waitingForHumanConfirmation || !currentPlayer?.isAI || gameMode !== 'normal') return;

    setWaitingForHumanConfirmation(false);
    
    switch (activeModal) {
        case 'TRIAL':
            if (activeTrial && aiDecisionMadeInModal?.type === 'TRIAL') {
                resolveTrialRef.current?.(aiDecisionMadeInModal.choice === activeTrial.answerIndex, aiDecisionMadeInModal.choice);
            }
            break;
        case 'FATE':
            if (aiDecisionMadeInModal?.type === 'FATE') {
                onFateResolveRef.current?.();
            }
            break;
        case 'CHANCE':
            if (aiDecisionMadeInModal?.type === 'CHANCE') {
                onChanceResolveRef.current?.();
            }
            break;
        case 'EVENT_DETAIL':
            if (aiDecisionMadeInModal?.type === 'EVENT_DETAIL') {
                onEventResolveRef.current?.();
            }
            break;
    }
    setAiDecisionMadeInModal(null); // Clear decision after processing
  }, [waitingForHumanConfirmation, currentPlayer, gameMode, activeModal, activeTrial, aiDecisionMadeInModal, playSfx, resolveTrialRef, onFateResolveRef, onChanceResolveRef, onEventResolveRef, setWaitingForHumanConfirmation, setAiDecisionMadeInModal]);


  const handleStartGame = (configuredPlayers: Player[], goal: number, mode: 'quick' | 'normal') => {
    playSfx('click');
    setWinCondition(goal);
    setPlayers(configuredPlayers);
    setGameStarted(true);
    setGameMode(mode); // Set the game mode
    if (bgmAudioRef.current) { bgmAudioRef.current.play().catch(() => {}); setIsBgmPlaying(true); }
    log(`【啟程】遊戲開始！模式：${mode === 'quick' ? '快速遊戲' : '一般遊戲'}。目標是獲取 ${goal} 塊祭肉。首位玩家為 ${configuredPlayers[0].character}。`);
  };

  const winner = players.find(p => p.meat >= winCondition);
  if (!gameStarted) return <StartScreen onStartGame={handleStartGame} playSfx={playSfx} />;

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center justify-start bg-stone-100 overflow-x-hidden relative font-serif">
      {/* Removed isAiThrottled indicator */}

      <MeatEffect 
        targetIndex={meatAnimationTarget} amount={meatAnimationAmount} playSfx={playSfx}
        onComplete={() => { if (meatAnimationCallback) meatAnimationCallback(); setMeatAnimationTarget(null); setMeatAnimationAmount(0); setMeatAnimationCallback(null); }} 
        onCentralAnimationComplete={handleCentralMeatAnimationComplete}
      />
      {showRecovery && players[currentPlayerIndex] && <RecoveryEffect character={players[currentPlayerIndex].character} />}
      {showPause && players[currentPlayerIndex] && <PauseEffect character={players[currentPlayerIndex].character} />}
      {activeModal === 'WIN' && winner && <VictoryOverlay winner={winner} allPlayers={players} onRestart={handleRestartGame} />}
      <header className="mb-8 text-center animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-black text-stone-800 tracking-widest mb-2 border-b-4 border-stone-800 inline-block px-6 animate-title-glow">孔子周遊列國</h1>
        <div className="flex items-center justify-center gap-2 mt-2">
            <p className="text-stone-600 italic">聖賢之路 · 祭肉爭奪戰</p>
            {/* Removed AI voice narration indicator */}
        </div>
      </header>
      <button onClick={() => { playSfx('click'); setShowAudioSettings(true); }} className="absolute top-4 right-4 p-3 bg-white shadow-lg rounded-full z-40 transition-transform active:scale-90 hover:bg-stone-50">⚙️</button>
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        <div className="lg:col-span-1 space-y-4 order-2 lg:order-1">
          <PlayerInfo players={players} currentIndex={currentPlayerIndex} winCondition={winCondition} />
          <div className="bg-white p-4 rounded-xl shadow-md border border-stone-200">
            <h3 className="font-bold mb-2 border-b pb-1 text-stone-800 flex items-center gap-2">
                <span className="w-4 h-4 bg-stone-800 rounded-full flex items-center justify-center text-[8px] text-white">L</span>
                📜 遊記紀錄
            </h3>
            <div className="text-sm space-y-2 h-64 overflow-y-auto pr-2 scrollbar-thin">
              {gameLog.map((m, i) => ( <div key={i} className={`p-2 rounded-lg leading-relaxed shadow-sm border-l-2 ${i === 0 ? "text-stone-900 font-bold bg-amber-50 border-amber-500 animate-fade-in" : "text-stone-500 bg-stone-50 border-stone-200 opacity-80"}`}>{m}</div> ))}
            </div>
          </div>
        </div>
        <div className="lg:col-span-2 order-1 lg:order-2 flex flex-col items-center">
          <Board 
            tiles={BOARD_TILES} players={players} diceRolls={diceRolls} isRolling={isRolling} 
            handleRoll={handleRoll} isModalActive={!!activeModal} 
            isPlayerMoving={isPlayerMoving} currentPlayerIndex={currentPlayerIndex} 
            isBoardCelebrating={isBoardCelebrating} showBigIcon={showBigIcon} playSfx={playSfx} 
            // Removed aiSpeakingText, aiSpeakingCharacter props
            isWaitingForHumanConfirmation={waitingForHumanConfirmation} // Pass new prop
            handleHumanConfirmation={handleHumanConfirmation} // Pass new handler
            gameMode={gameMode}
          />
        </div>
        <div className="lg:col-span-1 order-3 space-y-4 text-xs bg-white p-6 rounded-xl shadow-md border border-stone-200 overflow-y-auto max-h-[80vh] scrollbar-thin">
          <h3 className="font-black mb-4 flex items-center text-lg border-b-2 border-amber-600 pb-2">
            <span className="w-4 h-4 bg-amber-600 mr-2 rounded-sm shadow-sm"></span> 📖 遊戲玩法說明
          </h3>
          
          <section className="mb-4">
            <h4 className="font-bold text-stone-800 mb-2 bg-stone-100 px-2 py-1 rounded flex items-center gap-1">📋 基本資訊</h4>
            <div className="space-y-1 text-stone-700">
                <p>👥 遊戲人數：2~6人</p>
                <p>📦 內容物：地圖(1)、骰子(2)、立牌(4)、命運(16)、機會(16)、試煉(40)</p>
            </div>
          </section>

          <section className="mb-4">
            <h4 className="font-bold text-stone-800 mb-2 bg-stone-100 px-2 py-1 rounded flex items-center gap-1">🕹️ 核心玩法</h4>
            <ul className="space-y-2 text-stone-700 list-none pl-1">
              <li className="flex gap-2"><span>1.</span><span>輪流投擲骰子，按點數前進並執行格內事項。</span></li>
              <li className="flex gap-2"><span>2.</span><span>經過起點<span className="font-bold text-red-800">魯國</span>時，可領取 🍖 祭肉一塊。</span></li>
              <li className="flex gap-2"><span>3.</span><span>行至<span className="font-bold text-blue-600">「機會」</span>或<span className="font-bold text-stone-600">「命運」</span>格，應按照卡片規定辦理。</span></li>
            </ul>
          </section>

          <section className="mb-4">
            <h4 className="font-bold text-stone-800 mb-2 bg-stone-100 px-2 py-1 rounded flex items-center gap-1">🏛️ 試煉規則</h4>
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 leading-relaxed">
              🧠 停留各國領土即進行<span className="font-black underline">試煉答題</span>。
              <div className="mt-2 text-xs">
                ✅ 正確：獲得 🍖 祭肉一塊。<br/>
                ❌ 錯誤：則無法領取，需待下回合重新努力。
              </div>
            </div>
          </section>

          <section>
            <h4 className="font-bold text-stone-800 mb-2 bg-stone-100 px-2 py-1 rounded flex items-center gap-1">👑 勝負關鍵</h4>
            <div className="p-4 bg-stone-900 text-white rounded-xl shadow-lg border-2 border-amber-500 animate-pulse-slow">
              <p className="text-sm font-bold leading-relaxed text-center">
                首位累積達 <span className="text-amber-400 text-xl font-black">{winCondition}</span> 塊 🍖 祭肉，<br/>即為最終贏家！
              </p>
            </div>
          </section>
        </div>
      </div>
      <CardModal 
        type={activeModal} 
        trial={activeTrial} 
        fate={activeFate} 
        chance={activeChance} 
        eventData={activeEventData} 
        winner={winner}
        currentPlayerName={currentPlayer?.character}
        onTrialResolve={(idx) => {
            setTrialSelection({ selected: idx, isRevealed: true });
        }} 
        onTrialConfirm={() => {
            if (trialSelection.selected !== null && activeTrial) {
                resolveTrialRef.current?.(trialSelection.selected === activeTrial.answerIndex);
            }
        }}
        onFateResolve={() => onFateResolveRef.current?.()} 
        onChanceResolve={() => onChanceResolveRef.current?.()} 
        onEventResolve={() => onEventResolveRef.current?.()} 
        onRestart={handleRestartGame} onClose={() => setActiveModal(null)} playSfx={playSfx} isAI={currentPlayer?.isAI || false} trialSelection={trialSelection} 
        gameMode={gameMode} // Pass gameMode
        waitingForHumanConfirmation={waitingForHumanConfirmation} // Pass waiting state
        aiDecisionMadeInModal={aiDecisionMadeInModal} // Pass AI's decision
      />
      <AudioSettings 
        show={showAudioSettings} 
        onClose={() => setShowAudioSettings(false)} 
        isBgmPlaying={isBgmPlaying} 
        toggleBgm={() => setIsBgmPlaying(!isBgmPlaying)} 
        bgmVolume={bgmVolume} 
        setBgmVolume={setBgmVolume} 
        sfxVolume={sfxVolume} 
        setSfxVolume={setSfxVolume} 
        // Removed isVoiceEnabled, setVoiceEnabled props
      />
      <style>{`
        @keyframes bounce-short {
            0%, 100% { transform: translate(-50%, 0); }
            50% { transform: translate(-50%, -10px); }
        }
        .animate-bounce-short { animation: bounce-short 2s ease-in-out infinite; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: #f1f1f1; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #888; border-radius: 10px; }
        @keyframes pulse-slow { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.95; transform: scale(1.02); } }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default App;