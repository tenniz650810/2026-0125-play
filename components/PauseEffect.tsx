
import React from 'react';

interface PauseEffectProps {
  character: string;
}

const PauseEffect: React.FC<PauseEffectProps> = ({ character }) => {
  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center pointer-events-none overflow-hidden font-serif">
      <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-[2px] animate-fade-in"></div>
      
      <div className="relative flex flex-col items-center animate-pause-pop">
        <div className="text-9xl mb-6 filter drop-shadow-[0_0_20px_rgba(139,0,0,0.4)]">🧘</div>
        <div className="bg-stone-800 text-white px-12 py-4 rounded-full border-4 border-stone-400 shadow-[0_0_40px_rgba(0,0,0,0.4)]">
          <span className="text-4xl font-black tracking-[0.5em]">{character} 暫停行動</span>
        </div>
        <div className="mt-4 text-stone-900 font-bold text-xl italic tracking-widest bg-white/80 px-4 py-1 rounded shadow-sm">
          「窮則獨善其身，感悟修身」
        </div>
      </div>

      <style>{`
        @keyframes pause-pop {
          0% { transform: scale(0.5) translateY(50px); opacity: 0; }
          60% { transform: scale(1.1) translateY(-10px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .animate-pause-pop {
          animation: pause-pop 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>
    </div>
  );
};

export default PauseEffect;
