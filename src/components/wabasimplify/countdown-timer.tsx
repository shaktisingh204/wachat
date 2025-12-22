
'use client';

import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetDate: string;
}

const TimeCard = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
        <div className="text-xl font-bold text-white">
            {String(value).padStart(2, '0')}
        </div>
        <div className="mt-1 text-xs text-white/70 uppercase tracking-widest">{label}</div>
    </div>
);


const CountdownTimer = ({ targetDate }: CountdownTimerProps) => {
  const calculateTimeLeft = () => {
    const difference = +new Date(targetDate) - +new Date();
    let timeLeft = {};

    if (difference > 0) {
      timeLeft = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    }

    return timeLeft;
  };

  const [timeLeft, setTimeLeft] = useState<{days?: number, hours?: number, minutes?: number, seconds?: number}>({});
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate]);

  if (!isClient) {
      return (
        <div className="grid grid-cols-4 gap-2 md:gap-4 max-w-xs mx-auto py-2">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="flex flex-col items-center">
                    <div className="w-12 h-8 bg-black/20 rounded-md"></div>
                    <div className="mt-2 h-3 w-8 bg-black/20 rounded-md"></div>
                </div>
            ))}
        </div>
      );
  }

  const timerComponents: JSX.Element[] = [];
  Object.keys(timeLeft).forEach((interval) => {
    // @ts-ignore
    if (timeLeft[interval] !== undefined) {
        timerComponents.push(
            // @ts-ignore
            <TimeCard key={interval} value={timeLeft[interval]} label={interval} />
        );
    }
  });

  return (
    <div className="grid grid-cols-4 gap-2 md:gap-4 max-w-xs mx-auto py-2">
      {timerComponents.length ? timerComponents : <span className="col-span-4 text-center font-bold">Offer Expired!</span>}
    </div>
  );
};

export default CountdownTimer;
