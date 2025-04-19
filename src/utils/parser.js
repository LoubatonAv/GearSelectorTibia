export const parseDamageData = (text) => {
  const damageTypes = {};
  const lines = text.split('\n');

  let inDamageTypesSection = false;

  for (let line of lines) {
    if (line.toLowerCase().includes('damage types')) {
      inDamageTypesSection = true;
      continue;
    }
    if (line.toLowerCase().includes('damage sources')) {
      break; // stop when Damage Sources section starts
    }

    if (inDamageTypesSection && line.trim()) {
      const match = line.match(/^\s*(.+?)\s+([\d,]+)\s\(([\d.]+)%\)/);
      if (match) {
        const type = match[1].trim();
        const value = parseInt(match[2].replace(/,/g, ''), 10);
        damageTypes[type] = value;
      }
    }
  }

  console.log('text:', text);
  console.log('lines:', damageTypes);
  return damageTypes;
};
