"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const getRecognitionConstructor = () => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

export default function useSpeechRecognition(options = {}) {
  const onFinalText =
    typeof options === "function" ? options : options.onFinalText;
  const onFinalTextRef = useRef(onFinalText);
  const recognitionRef = useRef(null);
  const startingRef = useRef(false);

  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    onFinalTextRef.current = onFinalText;
  }, [onFinalText]);

  useEffect(() => {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      setSupported(false);
      return;
    }
    setSupported(true);
    if (recognitionRef.current) {
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      startingRef.current = false;
      setListening(true);
      setError(null);
    };

    recognition.onend = () => {
      startingRef.current = false;
      setListening(false);
    };

    recognition.onerror = (event) => {
      startingRef.current = false;
      setListening(false);
      setError(event?.error || "speech-error");
    };

    recognition.onresult = (event) => {
      const callback = onFinalTextRef.current;
      if (!callback) {
        return;
      }
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result.isFinal) {
          continue;
        }
        const transcript = result[0]?.transcript?.trim();
        if (transcript) {
          callback(transcript);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      try {
        recognition.stop();
      } catch (stopError) {
        // ignore stop errors during cleanup
      }
      recognitionRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    if (!supported || listening || startingRef.current) {
      return;
    }
    const recognition = recognitionRef.current;
    if (!recognition) {
      return;
    }
    startingRef.current = true;
    setError(null);
    try {
      recognition.start();
    } catch (startError) {
      startingRef.current = false;
      setError(startError?.message || "speech-start-failed");
    }
  }, [supported, listening]);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      return;
    }
    startingRef.current = false;
    try {
      recognition.stop();
    } catch (stopError) {
      setError(stopError?.message || "speech-stop-failed");
    }
  }, []);

  return { supported, listening, error, start, stop };
}
