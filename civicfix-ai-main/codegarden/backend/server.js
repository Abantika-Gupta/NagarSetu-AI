import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();
app.use(cors());

const HEADERS = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'codegarden',
  ...(process.env.GITHUB_TOKEN && { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }),
};

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers: HEADERS });
  if (!res.ok) {
    const err = new Error(
      res.status === 404 ? 'Repository not found'
      : res.status === 403 ? 'GitHub rate limit reached - set GITHUB_TOKEN in backend/.env'
      : `GitHub error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

// Count items cheaply: request 1 per page and read the last page number from the Link header
async function count(path) {
  const res = await gh(`${path}${path.includes('?') ? '&' : '?'}per_page=1`);
  const m = (res.headers.get('link') || '').match(/[&?]page=(\d+)>; rel="last"/);
  return m ? Number(m[1]) : (await res.json()).length;
}

const cache = new Map(); // simple 10-minute in-memory cache
const TTL = 10 * 60 * 1000;

app.get('/api/garden', async (req, res) => {
  const repo = String(req.query.repo || '').trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return res.status(400).json({ error: 'Use the format owner/repository' });

  const hit = cache.get(repo);
  if (hit && Date.now() - hit.t < TTL) return res.json(hit.data);

  try {
    const since = new Date(Date.now() - 90 * 864e5).toISOString();
    const [info, contributors, commits, recentCommits, releases, merged, latest, activity] = await Promise.all([
      gh(`/repos/${repo}`).then(r => r.json()),
      count(`/repos/${repo}/contributors?anon=1`),
      count(`/repos/${repo}/commits`),
      count(`/repos/${repo}/commits?since=${since}`),
      count(`/repos/${repo}/releases`),
      gh(`/search/issues?q=repo:${repo}+type:pr+is:merged&per_page=1`).then(r => r.json()),
      gh(`/repos/${repo}/commits?per_page=1`).then(r => r.json()),
      fetch(`https://api.github.com/repos/${repo}/stats/commit_activity`, { headers: HEADERS })
        .then(r => (r.status === 200 ? r.json() : [])).catch(() => []),
    ]);

    const data = {
      repository: info.full_name,
      description: info.description,
      stars: info.stargazers_count,
      contributors,
      commits,
      mergedPRs: merged.total_count,
      releases,
      recentCommits,
      lastCommit: latest[0]?.commit?.committer?.date ?? null,
      weekly: Array.isArray(activity) ? activity.map(w => w.total) : [], // last 52 weeks
    };
    cache.set(repo, { t: Date.now(), data });
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 4000, () => console.log('CodeGarden API on :' + (process.env.PORT || 4000)));
