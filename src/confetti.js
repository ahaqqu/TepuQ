// Full-screen confetti burst rendered on a shared canvas (#confetti).
// Canvas-based, no external library. The burst originates at the tap/click
// point; keyboard actions pass no point and burst from the center of the
// screen. The canvas sits above the game boards (z-index 40) but has
// pointer-events: none, so the celebration never blocks gameplay. Shared by
// TepuQ Kata (word/victory celebrations) and TepuQ Target (every successful
// tap + milestone waves).
export function fireConfetti(x = null, y = null) {
  const canvas = document.getElementById('confetti');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  const cx = x ?? canvas.width / 2;
  const cy = y ?? canvas.height / 2;
  const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#ec4899'];
  const pieces = Array.from({ length: 80 }, () => ({
    x: cx,
    y: cy,
    vx: (Math.random() - 0.5) * 12,
    vy: (Math.random() - 1) * 10,
    size: 6 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
  }));
  let frame = 0;
  const maxFrames = 90;
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach((p) => {
      p.vy += 0.3;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });
    frame++;
    if (frame < maxFrames) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  draw();
}