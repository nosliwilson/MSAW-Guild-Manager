export const ROLE_PRIORITY: Record<string, number> = {
  'Presidente': 1,
  'Vice-Presidente': 2,
  'Membro Elite': 3,
  'Oficial': 4,
  'Membro': 5,
};

export const sortMembers = (a: any, b: any) => {
  const roleA = a.role || 'Membro';
  const roleB = b.role || 'Membro';
  
  const priorityA = ROLE_PRIORITY[roleA] || 6;
  const priorityB = ROLE_PRIORITY[roleB] || 6;
  
  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }
  
  return (a.nick || a.username || '').localeCompare(b.nick || b.username || '');
};
