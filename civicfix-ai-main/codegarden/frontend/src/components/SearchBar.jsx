import { useState } from 'react';
export default function SearchBar({ onGrow, loading }) {
  const [value, setValue] = useState('');
  return (
    <div className="search">
      <input value={value} placeholder="github.com/facebook/react"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onGrow(value)} />
      <button onClick={() => onGrow(value)} disabled={loading}>{loading ? 'Growing…' : '🌱 Grow Garden'}</button>
    </div>
  );
}
