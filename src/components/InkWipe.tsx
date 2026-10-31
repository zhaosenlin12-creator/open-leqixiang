import { useEffect, useRef } from 'react';

interface InkWipeProps {
  trigger: number;
}

const PARTICLE_COUNT = 18;
const DURATION_MS = 720;

export function InkWipe({ trigger }: InkWipeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    let frame = 0;
    let animationId = 0;
    const startedAt = performance.now();
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const rect = canvas.getBoundingClientRect();

    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const seeds = Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
      x: rect.width * (0.12 + (index / PARTICLE_COUNT) * 0.82),
      y: rect.height * (0.24 + ((index * 37) % 52) / 100),
      radius: rect.width * (0.05 + ((index * 19) % 32) / 500),
      delay: index * 18
    }));

    const draw = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / DURATION_MS);
      context.clearRect(0, 0, rect.width, rect.height);
      context.globalCompositeOperation = 'source-over';
      context.fillStyle = `rgba(1, 5, 12, ${0.4 * (1 - progress)})`;
      context.fillRect(0, 0, rect.width, rect.height);
      context.globalCompositeOperation = 'destination-out';

      seeds.forEach((seed) => {
        const local = Math.max(0, Math.min(1, (elapsed - seed.delay) / (DURATION_MS - seed.delay)));
        if (local <= 0) return;
        const eased = 1 - Math.pow(1 - local, 3);
        const wobble = Math.sin(frame * 0.05 + seed.x * 0.02) * 10;
        const gradient = context.createRadialGradient(seed.x + wobble, seed.y, 0, seed.x + wobble, seed.y, seed.radius * (0.2 + eased * 2.9));
        gradient.addColorStop(0, 'rgba(0,0,0,1)');
        gradient.addColorStop(0.72, 'rgba(0,0,0,.72)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(seed.x + wobble, seed.y, seed.radius * (0.2 + eased * 2.9), 0, Math.PI * 2);
        context.fill();
      });

      frame += 1;
      if (progress < 1) {
        animationId = requestAnimationFrame(draw);
      } else {
        context.clearRect(0, 0, rect.width, rect.height);
      }
    };

    animationId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationId);
  }, [trigger]);

  return <canvas ref={canvasRef} className="ink-wipe" aria-hidden="true" />;
}
