import { useEffect, useRef, useState } from 'react';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function useTypewriter(text: string, speed = 38, startDelay = 600, reduced = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    if (reduced) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      let next = 0;
      interval = setInterval(() => {
        next += 1;
        setCount(next);
        if (next >= text.length) clearInterval(interval);
      }, speed);
    }, startDelay);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [text, speed, startDelay, reduced]);
  return { displayed: reduced ? text : text.slice(0, count), done: reduced || count >= text.length };
}

export function useMouseScrub(disabled: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || disabled) return;
    if (video.readyState === 0) video.load();
    let previousX: number | null = null;
    let targetTime = 0;
    let seeking = false;
    const seek = () => {
      if (seeking || video.readyState < 1 || !Number.isFinite(video.duration)) return;
      if (Math.abs(video.currentTime - targetTime) < 0.035) return;
      seeking = true;
      video.currentTime = Math.min(targetTime, Math.max(0, video.duration - 0.02));
    };
    const onSeeked = () => { seeking = false; seek(); };
    const move = (event: MouseEvent) => {
      if (previousX === null) { previousX = event.clientX; return; }
      const delta = event.clientX - previousX;
      previousX = event.clientX;
      if (!Number.isFinite(video.duration)) return;
      targetTime = Math.min(Math.max(0, video.duration - 0.02), Math.max(0, targetTime + (delta / window.innerWidth) * 0.8 * video.duration));
      seek();
    };
    const leave = () => { previousX = null; };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('loadedmetadata', seek);
    window.addEventListener('mousemove', move, { passive: true });
    window.addEventListener('blur', leave);
    return () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('loadedmetadata', seek);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('blur', leave);
    };
  }, [disabled]);
  return videoRef;
}
