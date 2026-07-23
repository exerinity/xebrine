import { useEffect, useRef } from 'react';

interface VisualizerProps {
  analyser: AnalyserNode | null;
}

export function Visualizer({ analyser }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const bufferLength = analyser.frequencyBinCount;
    const data = new Uint8Array(bufferLength);
    let raf = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;

      analyser.getByteFrequencyData(data);
      ctx2d.clearRect(0, 0, width, height);

      const color = getComputedStyle(canvas).getPropertyValue('--accent-bright').trim() || '#6d4aef';
      ctx2d.fillStyle = color;

      const gap = 2;
      const barWidth = width / bufferLength - gap;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (data[i] / 255) * height;
        ctx2d.fillRect(x, height - barHeight, Math.max(barWidth, 1), barHeight);
        x += barWidth + gap;
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyser]);

  return <canvas ref={canvasRef} className="xe_player-bar__visualizer" aria-hidden="true" />;
}
