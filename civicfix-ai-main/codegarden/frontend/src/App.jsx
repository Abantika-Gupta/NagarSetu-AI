import { useState } from 'react';
import SearchBar from './components/SearchBar';
import Garden from './components/Garden';
import Stats from './components/Stats';
import { fetchGarden } from './services/github';
import { computeScore } from './utils/gardenScore';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [time, setTime] = useState(100); // time-travel slider, 0-100

  async function grow(input) {
    setLoading(true); setError('');
    try { setData(await fetchGarden(input)); setTime(100); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  // Time travel: scale cumulative counts by progress (uses weekly commits when available)
  let view = null, score = null;
  const progress = time / 100;
  if (data) {
    const weeks = Math.round(progress * data.weekly.length);
    const recent = data.weekly.length
      ? data.weekly.slice(Math.max(0, weeks - 13), weeks).reduce((a, b) => a + b, 0)
      : data.recentCommits;
    const f = (n) => Math.round(n * progress);
    view = { ...data, commits: f(data.commits), contributors: Math.max(1, f(data.contributors)),
      mergedPRs: f(data.mergedPRs), releases: f(data.releases), stars: f(data.stars),
      recentCommits: progress === 1 ? data.recentCommits : recent };
    score = computeScore(view);
  }

  return (
    <main>
      <header><h1>🌱 CodeGarden</h1><p>Grow your repository.</p></header>
      <SearchBar onGrow={grow} loading={loading} />
      {error && <p className="error">{error}</p>}
      {view && (
        <section className="result">
          <h3>{view.repository}</h3>
          {view.description && <p className="muted">{view.description}</p>}
          <Garden stats={view} total={score.total} progress={progress} />
          <label className="slider">⏳ Time travel
            <input type="range" min="1" max="100" value={time} onChange={(e) => setTime(+e.target.value)} />
          </label>
          <Stats stats={view} score={score} />
        </section>
      )}
    </main>
  );
}
