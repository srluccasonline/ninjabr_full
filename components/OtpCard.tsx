import React, { useEffect, useState } from 'react';
import * as OTPAuth from 'otpauth';
import { Copy, Trash2, Clock, Check } from 'lucide-react';
import { SharedToken } from '../types';

interface OtpCardProps {
  token: SharedToken;
  isAdmin: boolean;
  onDelete: (token: SharedToken) => void;
}

export const OtpCard: React.FC<OtpCardProps> = ({ token, isAdmin, onDelete }) => {
  const [code, setCode] = useState('--- ---');
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const updateOtp = () => {
      try {
        if (!token.otp_secret) return;

        // Remove spaces from secret just in case
        const cleanSecret = token.otp_secret.replace(/\s/g, '');

        const totp = new OTPAuth.TOTP({
          secret: OTPAuth.Secret.fromBase32(cleanSecret),
          algorithm: 'SHA1',
          digits: 6,
          period: 30
        });

        const generatedToken = totp.generate();
        const seconds = new Date().getTime() / 1000;
        const currentProgress = ((seconds % 30) / 30) * 100;
        
        // Invert progress for countdown effect (starts full, goes empty)
        setProgress(100 - currentProgress); 

        // Format: 123 456
        setCode(generatedToken.replace(/(\d{3})(\d{3})/, '$1 $2'));
      } catch (e) {
        console.error("Invalid Secret for", token.provider_name);
        setCode("ERROR");
      }
    };

    updateOtp();
    const interval = setInterval(updateOtp, 1000);
    return () => clearInterval(interval);
  }, [token.otp_secret]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code.replace(' ', ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 shadow-lg relative group overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <Clock size={80} />
      </div>

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-semibold text-gray-200 text-lg truncate pr-4" title={token.provider_name}>
            {token.provider_name}
          </h3>
          {isAdmin && (
            <button 
              onClick={() => onDelete(token)}
              className="text-gray-600 hover:text-red-500 transition-colors p-1"
              title="Excluir Token"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        <div className="flex flex-col items-center justify-center my-2 space-y-3">
          <div className="text-4xl font-mono font-bold text-white tracking-wider drop-shadow-md select-all">
            {code}
          </div>
          
          <button 
            onClick={handleCopy}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              copied 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-dark-700 text-gray-400 hover:bg-dark-600 hover:text-white'
            }`}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copiado!' : 'Copiar Código'}
          </button>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-[10px] text-gray-500 mb-1 uppercase tracking-wider">
            <span>Expira em</span>
            <span>{Math.ceil((progress / 100) * 30)}s</span>
          </div>
          <div className="w-full bg-dark-900 h-1.5 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ease-linear ${
                progress < 20 ? 'bg-red-500' : 'bg-ninja-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};