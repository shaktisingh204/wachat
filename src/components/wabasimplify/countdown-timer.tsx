'use client';

import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetDate: string;
}

const TimeCard = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
        <div className="text-4xl md:text-6xl font-bold text-yellow-300 bg-black/20 p-4 rounded-lg w-20 md:w-28 text-center">
            {String(value).padStart(2, '0')}
        </div>
        <div className="mt-2 text-sm md:text-base text-gray-300 uppercase tracking-widest">{label}</div>
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
    // Set initial time on client mount to avoid hydration mismatch
    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  if (!isClient) {
      return (
        <div className="grid grid-cols-4 gap-2 md:gap-8 max-w-2xl mx-auto mt-12 animate-pulse">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="flex flex-col items-center">
                    <div className="w-20 md:w-28 h-20 md:h-28 bg-black/20 rounded-lg"></div>
                    <div className="mt-2 h-4 w-12 bg-black/20 rounded-md"></div>
                </div>
            ))}
        </div>
      );
  }

  const timerComponents: JSX.Element[] = [];
  Object.keys(timeLeft).forEach((interval) => {
    // @ts-ignore
    if (!timeLeft[interval] && timeLeft[interval] !== 0) {
      return;
    }

    timerComponents.push(
        // @ts-ignore
      <TimeCard key={interval} value={timeLeft[interval]} label={interval} />
    );
  });

  return (
    <div className="grid grid-cols-4 gap-2 md:gap-8 max-w-2xl mx-auto mt-12">
      {timerComponents.length ? timerComponents : <span>Time's up!</span>}
    </div>
  );
};

export default CountdownTimer;
