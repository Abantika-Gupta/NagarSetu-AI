import { useMemo } from 'react';
import { seeded } from '../utils/gardenScore';

export default function Garden({ stats, total, progress = 1 }) {
  const dormant = total < 35;
  const art = useMemo(() => {
    const r = seeded(stats.commits + stats.stars + 11);
    const blob = (n) => Array.from({ length: n }, () => {
      const a = r() * Math.PI * 2, d = Math.sqrt(r());
      return { x: 300 + Math.cos(a) * d * 190, y: 150 + Math.sin(a) * d * 105, s: 4 + r() * 6, c: r() };
    });
    const branches = Math.max(3, Math.min(9, Math.round(Math.log2(stats.contributors + 1))));
    return {
      leaves: blob(150), flowers: blob(45), flies: blob(32),
      branches: Array.from({ length: branches }, (_, i) => {
        const t = i / (branches - 1);
        return { x: 300 + (t - 0.5) * 340, y: 130 + Math.abs(t - 0.5) * 90 };
      }),
    };
  }, [stats.commits, stats.stars, stats.contributors]);

  const nLeaves = Math.round(Math.min(150, Math.sqrt(stats.commits) * 3) * progress);
  const nFlowers = Math.round(Math.min(45, Math.sqrt(stats.mergedPRs) * 1.4) * progress);
  const nFlies = Math.round(Math.min(32, Math.log10(stats.stars + 1) * 7) * progress);
  const greens = dormant ? ['#b08d57', '#c9a66b', '#a0703c'] : ['#2f9e44', '#51cf66', '#69db7c', '#8ce99a'];
  const petals = ['#ff8fab', '#ffd166', '#f78fb3', '#ffa94d'];
  const trunkH = 60 + 100 * Math.max(0.3, progress);

  return (
    <svg viewBox="0 0 600 400" className="garden" role="img" aria-label="Repository garden">
      <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={dormant ? '#e9d8c4' : '#cdeffd'} /><stop offset="1" stopColor={dormant ? '#f6ead9' : '#f1fbe9'} />
      </linearGradient></defs>
      <rect width="600" height="400" fill="url(#sky)" />
      <ellipse cx="300" cy="372" rx="320" ry="52" fill={dormant ? '#a98a5b' : '#6ab04c'} />
      <path d={`M292 350 Q296 ${350 - trunkH / 2} 300 ${350 - trunkH} Q304 ${350 - trunkH / 2} 308 350Z`} fill="#7b5233" />
      {art.branches.map((b, i) => (
        <line key={i} x1="300" y1={350 - trunkH} x2={b.x} y2={b.y + (160 - trunkH) * 0.4} stroke="#7b5233" strokeWidth="3" strokeLinecap="round" opacity={Math.min(1, progress * 2)} />
      ))}
      {art.leaves.slice(0, nLeaves).map((l, i) => (
        <ellipse key={i} cx={l.x} cy={l.y + (dormant ? l.c * 40 : 0)} rx={l.s} ry={l.s * 0.6} fill={greens[Math.floor(l.c * greens.length)]} opacity="0.85" transform={`rotate(${l.c * 180} ${l.x} ${l.y})`} />
      ))}
      {art.flowers.slice(0, nFlowers).map((f, i) => (
        <g key={i}><circle cx={f.x} cy={f.y} r={f.s * 0.8} fill={petals[Math.floor(f.c * petals.length)]} /><circle cx={f.x} cy={f.y} r="1.8" fill="#fff3bf" /></g>
      ))}
      {art.flies.slice(0, nFlies).map((f, i) => (
        <circle key={i} className="fly" style={{ animationDelay: `${(i % 7) * 0.4}s` }} cx={f.x + (f.c - 0.5) * 120} cy={f.y + 60} r="2.5" fill="#ffe066" />
      ))}
      {dormant && Array.from({ length: 10 }, (_, i) => (
        <text key={i} className="fall" style={{ animationDelay: `${i * 0.7}s` }} x={90 + i * 48} y="60" fontSize="16">🍂</text>
      ))}
    </svg>
  );
}
