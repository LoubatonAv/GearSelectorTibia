export const parseDamageData = (text) => {
    const damageTypes = {};
    const lines = text.split("\n");
  
    lines.forEach((line) => {
      const match = line.match(/(.*?)\s(\d+,\d{1,3})(.*?)%/);
      if (match) {
        const damageType = match[1].trim();
        const damageValue = parseFloat(match[2].replace(/,/g, ""));
        damageTypes[damageType] = damageValue;
      }
    });
  
    return damageTypes;
  };
  