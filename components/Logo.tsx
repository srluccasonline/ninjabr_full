import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <style>
        {`
          @keyframes shine {
            from {
              background-position: -200% center, 0 0;
            }
            to {
              background-position: 200% center, 0 0;
            }
          }
          .metallic-logo {
            /* 
               Layer 1: Brilho (Móvel) - Transparente -> Branco -> Transparente
               Layer 2: Cores (Fixo) - Prata (0-71%) e Laranja (71-100%) 
               * 71% é aproximadamente onde termina o "NINJA" e começa o "BR"
            */
            background-image: 
              linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.9) 50%, transparent 60%),
              linear-gradient(to right, #9ca3af 0%, #ffffff 35%, #9ca3af 71%, #ea580c 71%, #fdba74 85%, #c2410c 100%);
            
            background-size: 200% auto, 100% auto;
            background-clip: text;
            -webkit-background-clip: text;
            color: transparent;
            animation: shine 4s linear infinite;
          }
        `}
      </style>
      <span className="metallic-logo font-black text-3xl tracking-tighter select-none drop-shadow-sm">
        NINJABR
      </span>
    </div>
  );
};