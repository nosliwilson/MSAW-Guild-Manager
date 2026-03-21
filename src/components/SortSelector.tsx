import React from 'react';
import { SortCriteria } from '../utils/sorting';

interface SortSelectorProps {
  criteria: SortCriteria;
  onChange: (criteria: SortCriteria) => void;
}

export default function SortSelector({ criteria, onChange }: SortSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-zinc-400">Ordenar:</label>
      <select
        value={criteria}
        onChange={(e) => onChange(e.target.value as SortCriteria)}
        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <option value="role">Cargo + Poder</option>
        <option value="nick">Nick</option>
        <option value="power">Poder</option>
      </select>
    </div>
  );
}
