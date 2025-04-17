export const calculateHitsTaken = (armor) => {
    return 0.0783 * Math.pow(armor, 2) - 1.8156 * armor + 102.29;
  };
  