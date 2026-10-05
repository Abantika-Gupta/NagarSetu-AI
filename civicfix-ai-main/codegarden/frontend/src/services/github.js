const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function parseRepo(input) {
  const m = input.trim().replace(/\.git$/, '').match(/(?:github\.com\/)?([\w.-]+)\/([\w.-]+)\/?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

export async function fetchGarden(input) {
  const repo = parseRepo(input);
  if (!repo) throw new Error('Enter a URL like github.com/facebook/react');
  const res = await fetch(`${API}/api/garden?repo=${encodeURIComponent(repo)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Something went wrong');
  return body;
}
