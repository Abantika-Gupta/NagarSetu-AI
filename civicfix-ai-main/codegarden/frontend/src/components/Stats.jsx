import { healthOf, level } from '../utils/gardenScore';

export default function Stats({ stats, score }) {
  const h = healthOf(score.total);
  const rows = [
    ['Recent activity', level(score.activity, 40)],
    ['Community', level(score.community, 25)],
    ['Release activity', level(score.release, 20)],
    ['Popularity', level(score.popularity, 15)],
  ];
  return (
    <div className="stats">
      <h2>{h.emoji} {h.label}</h2>
      <div className="bar"><div style={{ width: `${score.total}%` }} /></div>
      <p className="muted">Repository health · {score.total}%</p>
      <ul className="rows">{rows.map(([k, v]) => <li key={k}><span>{k}</span><b>{v}</b></li>)}</ul>
      <div className="chips">
        <span>🌿 {stats.contributors.toLocaleString()} contributors</span>
        <span>🍃 {stats.commits.toLocaleString()} commits</span>
        <span>🌸 {stats.mergedPRs.toLocaleString()} merged PRs</span>
        <span>🌻 {stats.releases.toLocaleString()} releases</span>
        <span>✨ {stats.stars.toLocaleString()} stars</span>
      </div>
    </div>
  );
}
