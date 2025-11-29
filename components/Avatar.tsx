
import React, { useMemo } from 'react';
import { createAvatar } from '@dicebear/core';
import { botttsNeutral } from '@dicebear/collection';

interface AvatarProps {
  seed: string;
  size?: number;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ seed, size = 40, className = '' }) => {
  const svg = useMemo(() => {
    return createAvatar(botttsNeutral, {
      seed,
      size,
      radius: 50, // Garante que seja um círculo perfeito
      // Removidas as opções fixas (eyes, color, background) para garantir variedade total baseada na seed
    }).toString();
  }, [seed, size]);

  return (
    <div 
      className={`inline-block overflow-hidden rounded-full bg-dark-700 ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }} 
      style={{ width: size, height: size }}
    />
  );
};
