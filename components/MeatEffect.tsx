
import React, { useEffect, useState, useRef } from 'react';

interface Unit {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  delay: number;
  isLoss?: boolean;
}

interface MeatEffectProps {
  targetIndex: number | null; 
  amount: number;            
  playSfx: (sound: any) => void; 
  onComplete: () => void;    
  onCentralAnimationComplete: () => void; 
}

const MeatEffect: React.FC<MeatEffectProps> = ({ targetIndex, amount, playSfx, onComplete, onCentralAnimationComplete }) => {
  const [showCentralStage, setShowCentralStage] = useState(false); 
  const [units, setUnits] = useState<Unit[]>([]);
  const timeoutRef = useRef<number | null>(null);
  const sfxTimeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    sfxTimeoutsRef.current.forEach(t => window.clearTimeout(t));
    sfxTimeoutsRef.current = [];
    
    setShowCentralStage(false);
    setUnits([]);

    if (targetIndex !== null && amount !== 0) {
      const isLoss = amount < 0;
      const absAmount = Math.abs(amount);

      if (!isLoss) {
        // 獲得祭肉：先中央出現，再飛向玩家
        setShowCentralStage(true);
        playSfx('getMeat');
        
        timeoutRef.current = window.setTimeout(() => {
          onCentralAnimationComplete();
          const targetEl = document.getElementById(`player-info-${targetIndex}`);
          if (!targetEl) { setShowCentralStage(false); onComplete(); return; }

          const rect = targetEl.getBoundingClientRect();
          const endX = rect.left + rect.width / 2;
          const endY = rect.top + rect.height / 2;
          const startX = window.innerWidth / 2;
          const startY = window.innerHeight / 2;

          setShowCentralStage(false);
          const newUnits = Array.from({ length: absAmount }).map((_, i) => ({
            id: Date.now() + i,
            startX, startY, endX, endY, delay: i * 0.15, isLoss: false
          }));
          setUnits(newUnits);

          newUnits.forEach(u => {
            const hitTimeout = window.setTimeout(() => playSfx('click'), (u.delay + 0.6) * 1000);
            sfxTimeoutsRef.current.push(hitTimeout);
          });

          timeoutRef.current = window.setTimeout(() => { setUnits([]); onComplete(); }, (absAmount * 150) + 1000);
        }, 1400);
      } else {
        // 失去祭肉：先從玩家飛出，再在中央消失
        const targetEl = document.getElementById(`player-info-${targetIndex}`);
        if (!targetEl) { onComplete(); return; }

        const rect = targetEl.getBoundingClientRect();
        const startX = rect.left + rect.width / 2;
        const startY = rect.top + rect.height / 2;
        const endX = window.innerWidth / 2;
        const endY = window.innerHeight / 2;

        const newUnits = Array.from({ length: absAmount }).map((_, i) => ({
          id: Date.now() + i,
          startX, startY, endX, endY, delay: i * 0.15, isLoss: true
        }));
        setUnits(newUnits);

        newUnits.forEach(u => {
          const hitTimeout = window.setTimeout(() => playSfx('incorrectAnswer'), (u.delay + 0.6) * 1000);
          sfxTimeoutsRef.current.push(hitTimeout);
        });

        timeoutRef.current = window.setTimeout(() => {
          setUnits([]);
          setShowCentralStage(true); // 最後在中央顯示「失去」提示
          timeoutRef.current = window.setTimeout(() => {
            setShowCentralStage(false);
            onComplete();
          }, 1200);
        }, (absAmount * 150) + 800);
      }
    }

    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      sfxTimeoutsRef.current.forEach(t => window.clearTimeout(t));
    };
  }, [targetIndex, amount]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden flex items-center justify-center">
      {showCentralStage && (
        <div className="flex flex-col items-center animate-meat-pop">
          <div className={`text-9xl mb-4 filter ${amount < 0 ? 'grayscale opacity-50' : 'drop-shadow-[0_15px_30px_rgba(139,0,0,0.5)]'}`}>
            🍖
          </div>
          <div className={`${amount < 0 ? 'bg-stone-800' : 'bg-red-900/90'} text-white px-10 py-3 rounded-full border-4 ${amount < 0 ? 'border-stone-500' : 'border-amber-200'} shadow-2xl`}>
             <span className="text-3xl font-black italic tracking-widest">{amount > 0 ? `獲得 ${amount} 塊祭肉！` : `失去 ${Math.abs(amount)} 塊祭肉...`}</span>
          </div>
        </div>
      )}

      {units.map((u) => (
        <div
          key={u.id}
          className="absolute text-6xl select-none"
          style={{
            left: 0, top: 0,
            animation: `meat-travel-${u.id} 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${u.delay}s forwards`,
          }}
        >
          <style>{`
            @keyframes meat-travel-${u.id} {
              0% { transform: translate(${u.startX - 48}px, ${u.startY - 48}px) scale(${u.isLoss ? 0.3 : 1.5}) rotate(0deg); opacity: 0; }
              15% { opacity: 1; transform: translate(${u.startX - 48}px, ${u.startY - 48}px) scale(${u.isLoss ? 0.6 : 1.2}) rotate(-10deg); }
              100% { transform: translate(${u.endX - 16}px, ${u.endY - 16}px) scale(${u.isLoss ? 1.5 : 0.3}) rotate(360deg); opacity: 0; }
            }
          `}</style>
          🍖
        </div>
      ))}
      <style>{`
        @keyframes meat-pop { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        .animate-meat-pop { animation: meat-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
      `}</style>
    </div>
  );
};

export default MeatEffect;
