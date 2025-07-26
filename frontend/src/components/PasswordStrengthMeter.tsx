import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface PasswordStrengthMeterProps {
  password: string;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const strength = useMemo(() => {
    if (!password) return 0;
    
    let score = 0;
    
    // Length
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (password.length >= 16) score++;
    
    // Character variety
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    
    // No common patterns
    if (!/(.)\1{2,}/.test(password)) score++; // No repeated characters
    if (!/^[a-zA-Z]+$/.test(password) && !/^[0-9]+$/.test(password)) score++; // Not all letters or numbers
    
    return Math.min(Math.floor((score / 9) * 5), 5); // Scale to 0-5
  }, [password]);

  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const strengthColors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-blue-500',
    'bg-green-500',
    'bg-green-600'
  ];

  if (!password) return null;

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              i < strength ? strengthColors[strength] : 'bg-muted'
            )}
          />
        ))}
      </div>
      <p className={cn(
        'text-xs',
        strength < 2 ? 'text-red-500' : 
        strength < 3 ? 'text-yellow-500' : 
        'text-green-500'
      )}>
        {strengthLabels[strength]}
        {password.length < 12 && ' (12+ characters recommended)'}
      </p>
    </div>
  );
}