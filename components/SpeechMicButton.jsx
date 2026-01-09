'use client';

import { useEffect, useRef, useState } from 'react';

import useSpeechRecognition from '@/lib/useSpeechRecognition';

export default function SpeechMicButton({
  onText,
  className = '',
  style,
}) {
  const restartTimeoutRef = useRef(null);
  const wasListeningRef = useRef(false);
  const [isOn, setIsOn] = useState(false);

  const { supported, listening, error, start, stop } = useSpeechRecognition({
    onFinalText: (text) => onText?.(text),
  });

  useEffect(() => {
    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!supported && isOn) {
      setIsOn(false);
    }
  }, [supported, isOn]);

  useEffect(() => {
    if (!isOn) {
      wasListeningRef.current = false;
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      return;
    }

    const wasListening = wasListeningRef.current;
    wasListeningRef.current = listening;

    if (!wasListening || listening || error) {
      return;
    }

    if (restartTimeoutRef.current) {
      return;
    }

    restartTimeoutRef.current = setTimeout(() => {
      restartTimeoutRef.current = null;
      start();
    }, 250);
  }, [isOn, listening, error, start]);

  const toggle = () => {
    if (!supported) {
      return;
    }
    if (isOn) {
      setIsOn(false);
      stop();
      return;
    }
    setIsOn(true);
    start();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isOn}
      aria-label={supported ? (isOn ? 'Stop recording' : 'Start recording') : 'Speech not supported'}
      className={`micBtn ${listening ? 'isOn' : ''} ${!supported ? 'isOff' : ''} ${className}`}
      disabled={!supported}
      style={style}
    >
      {isOn ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M8 8h8v8H8z" fill="currentColor" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" stroke="currentColor" strokeWidth="2"/>
          <path d="M19 11a7 7 0 0 1-14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      )}
    </button>
  );
}
