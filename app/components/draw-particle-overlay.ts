import type { Particle } from '../lib/types';

export function drawParticleOverlay(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  color: string = '#00ff00',
  showLabels: boolean = true,
  scaleX: number = 1,
  scaleY: number = 1
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.font = '12px monospace';
  ctx.fillStyle = color;
  ctx.lineJoin = 'round';

  for (const particle of particles) {
    const { boundingBox, diameter } = particle;

    const x = boundingBox.x * scaleX;
    const y = boundingBox.y * scaleY;
    const w = boundingBox.width * scaleX;
    const h = boundingBox.height * scaleY;

    ctx.beginPath();
    ctx.strokeRect(x, y, w, h);

    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();

    if (showLabels) {
      const label = `${diameter.toFixed(2)} mm`;
      const padding = 4;
      const metrics = ctx.measureText(label);
      const labelW = metrics.width + padding * 2;
      const labelH = 16;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, y - labelH - 6, labelW, labelH);
      ctx.fillStyle = color;
      ctx.fillText(label, x + padding, y - 6);
    }
  }

  ctx.restore();
}
