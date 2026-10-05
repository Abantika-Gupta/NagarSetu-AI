export const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

export function computeScore(s) {
  const activity = Math.min(s.recentCommits / 100, 1) * 40;
  const community = Math.min(s.contributors / 100, 1) * 25;
  const release = Math.min(s.releases / 30, 1) * 20;
  const popularity = Math.min(s.stars / 10000, 1) * 15;
  return { activity, community, release, popularity, total: Math.round(activity + community + release + popularity) };
}

export function healthOf(total) {
  if (total >= 65) return { label: 'Thriving', emoji: '🌻' };
  if (total >= 35) return { label: 'Growing', emoji: '🌱' };
  return { label: 'Dormant', emoji: '🍂' };
}

export const level = (v, max) => (v / max >= 0.66 ? 'High' : v / max >= 0.33 ? 'Moderate' : 'Low');
