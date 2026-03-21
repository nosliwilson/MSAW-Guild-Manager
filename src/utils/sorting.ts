export const ROLE_PRIORITY: Record<string, number> = {
  'Presidente': 1,
  'Vice-Presidente': 2,
  'Membro Elite': 3,
  'Oficial': 4,
  'Membro': 5,
};

export type SortCriteria = 'nick' | 'power' | 'role';

export const sortMembers = (a: any, b: any, criteria: SortCriteria = 'role') => {
  if (criteria === 'nick') {
    return (a.nick || a.username || '').localeCompare(b.nick || b.username || '');
  }
  
  if (criteria === 'power') {
    const powerA = Number(a.power || a.current_power || 0);
    const powerB = Number(b.power || b.current_power || 0);
    if (powerA !== powerB) return powerB - powerA; // Higher power first
    return (a.nick || a.username || '').localeCompare(b.nick || b.username || '');
  }

  // Default: Role + Power
  const roleA = a.role || 'Membro';
  const roleB = b.role || 'Membro';
  
  const priorityA = ROLE_PRIORITY[roleA] || 6;
  const priorityB = ROLE_PRIORITY[roleB] || 6;
  
  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }
  
  // If roles are equal, sort by power
  const powerA = Number(a.power || a.current_power || 0);
  const powerB = Number(b.power || b.current_power || 0);
  if (powerA !== powerB) return powerB - powerA;

  return (a.nick || a.username || '').localeCompare(b.nick || b.username || '');
};
