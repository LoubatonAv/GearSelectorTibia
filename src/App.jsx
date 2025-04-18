import React, { useState, useEffect } from 'react';
import { parseDamageData } from './utils/parser';
import EquipmentSelector from './components/EquipmentSelector';
import InputPanel from './components/InputPanel';
import EquipmentCard from './components/EquipmentCard';
import './App.css'; // or "./index.css" if using Tailwind

export const calculateHitsTaken = (armor) => {
  return 0.0783 * Math.pow(armor, 2) - 1.8156 * armor + 102.29;
};

const App = () => {
  const [equipmentData, setEquipmentData] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [rankedEquipment, setRankedEquipment] = useState({});
  const [selectedVocation, setSelectedVocation] = useState('Sorcerer');
  const [level, setLevel] = useState(600);
  const [calculationType, setCalculationType] = useState('defense'); // Default to best defense
  const [currentItemIndex, setCurrentItemIndex] = useState({});
  const [selectedWeaponType, setSelectedWeaponType] = useState('');

  useEffect(() => {
    fetch('/data/equipment.json')
      .then((res) => res.json())
      .then((data) => setEquipmentData(data))
      .catch((err) => console.error('Failed to load equipment data:', err));
  }, []);

  const calculateBestEquipment = () => {
    const damageTypes = parseDamageData(textInput);
    const rankedByType = {};
    const newCurrentItemIndex = { ...currentItemIndex };
    const currentVocationLower = selectedVocation.toLowerCase();
    const currentWeaponLower = selectedWeaponType.toLowerCase();

    const filteredEquipmentData = equipmentData.filter((item) => {
      const vocations = item.vocation?.toLowerCase().split(' and ');
      const isAllowedForVocation = !item.vocation || vocations.some((v) => v.includes(currentVocationLower));
      const equipmentTypeLower = item.equipmentType?.toLowerCase();
      const isWeapon =
        equipmentTypeLower?.includes('weapon') ||
        ['sword', 'axe', 'club', 'wand'].includes(equipmentTypeLower?.replace('s', ''));

      let shouldInclude = true;
      if (item.level && item.level > level) {
        shouldInclude = false;
      } else if (isAllowedForVocation) {
        if (currentVocationLower === 'knight' && isWeapon) {
          shouldInclude = equipmentTypeLower === `${currentWeaponLower}s` || equipmentTypeLower === currentWeaponLower;
        } else if (equipmentTypeLower === 'wand' && currentVocationLower !== 'sorcerer') {
          shouldInclude = false;
        }
      } else {
        shouldInclude = false;
      }
      return shouldInclude;
    });

    const equipmentTypes = [...new Set(filteredEquipmentData.map((item) => item.equipmentType))];

    equipmentTypes.forEach((type) => {
      const itemsOfType = filteredEquipmentData.filter((item) => item.equipmentType === type);

      if (calculationType === 'defense') {
        const itemsWithScores = itemsOfType.map((item) => {
          const armor = parseFloat(item.stats?.Arm) || 0;
          const shield = parseFloat(item.shield) || 0;
          let totalDamageReduction = 0;
          for (const damageTypeName in damageTypes) {
            const damageAmount = damageTypes[damageTypeName] || 0;
            const resistanceKey = damageTypeName.toLowerCase();
            const resistancePercent = parseFloat(item.resistances?.[resistanceKey]?.replace('%', '')) || 0;
            let damageAfterShield = Math.max(0, damageAmount - shield);
            let damageReduction = damageAfterShield * (resistancePercent / 100);
            if (damageTypeName === 'Physical') {
              damageReduction += Math.floor((5 * armor + 5) / 3);
            }
            totalDamageReduction += damageReduction;
          }
          return { ...item, score: totalDamageReduction };
        });
        const sortedItems = itemsWithScores.sort((a, b) => b.score - a.score);
        if (sortedItems.length > 0) {
          rankedByType[type] = sortedItems;
          if (newCurrentItemIndex[type] === undefined) {
            newCurrentItemIndex[type] = 0;
          }
        }
      } else if (calculationType === 'balanced') {
        const getOffensiveScore = (item) => {
          const stats = item.stats || {};
          let offensiveScore = 0;
          if (selectedVocation === 'Sorcerer' || selectedVocation === 'Druid')
            offensiveScore += parseFloat(stats['Magic Level'] || 0) * 10;
          if (selectedVocation === 'Paladin') offensiveScore += parseFloat(stats['Distance Fighting'] || 0) * 10;
          if (selectedVocation === 'Knight')
            offensiveScore += parseFloat(stats[`${selectedWeaponType} Fighting`] || 0) * 10;
          offensiveScore += parseFloat(stats['Attack'] || 0) * 5;
          if (item.buffs) offensiveScore += Object.values(item.buffs).length * 8;
          return offensiveScore;
        };
        const itemsWithOffensiveScores = itemsOfType.map((item) => ({
          ...item,
          offensiveScore: getOffensiveScore(item),
        }));
        const sortedByOffensive = [...itemsWithOffensiveScores].sort((a, b) => b.offensiveScore - a.offensiveScore);
        const topTierCount = Math.max(3, Math.ceil(sortedByOffensive.length * 0.25));
        const topTierItems = sortedByOffensive.slice(0, topTierCount);
        const topTierWithDefensiveScores = topTierItems.map((item) => {
          const armor = parseFloat(item.stats?.Arm) || 0;
          const shield = parseFloat(item.shield) || 0;
          let totalDamageReduction = 0;
          for (const damageTypeName in damageTypes) {
            const damageAmount = damageTypes[damageTypeName] || 0;
            const resistanceKey = damageTypeName.toLowerCase();
            const resistancePercent = parseFloat(item.resistances?.[resistanceKey]?.replace('%', '')) || 0;
            let damageAfterShield = Math.max(0, damageAmount - shield);
            let damageReduction = damageAfterShield * (resistancePercent / 100);
            if (damageTypeName === 'Physical') {
              damageReduction += Math.floor((5 * armor + 5) / 3);
            }
            totalDamageReduction += damageReduction;
          }
          const combinedScore = item.offensiveScore * 0.7 + totalDamageReduction * 0.3;
          return { ...item, score: combinedScore };
        });
        const finalRanked = topTierWithDefensiveScores.sort((a, b) => b.score - a.score);
        if (finalRanked.length > 0) {
          rankedByType[type] = finalRanked;
          if (newCurrentItemIndex[type] === undefined) {
            newCurrentItemIndex[type] = 0;
          }
        }
      }

      if (itemsOfType.length > 0 && !rankedByType[type]) {
        rankedByType[type] = itemsOfType;
        if (newCurrentItemIndex[type] === undefined) {
          newCurrentItemIndex[type] = 0;
        }
      }
    });

    setRankedEquipment(rankedByType);
    setCurrentItemIndex(newCurrentItemIndex);
  };

  const handlePrevClick = (type) => {
    setCurrentItemIndex((prev) => ({
      ...prev,
      [type]: Math.max(0, prev[type] - 1),
    }));
  };

  // blabla shceck
  const handleNextClick = (type) => {
    setCurrentItemIndex((prev) => ({
      ...prev,
      [type]: Math.min((rankedEquipment[type]?.length || 1) - 1, prev[type] + 1),
    }));
  };

  return (
    <div className='min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6'>
      <h1 className='text-2xl font-bold mb-6'>Equipment Selector</h1>

      <EquipmentSelector
        selectedVocation={selectedVocation}
        setSelectedVocation={setSelectedVocation}
        level={level}
        setLevel={setLevel}
      />
      {selectedVocation === 'Knight' && (
        <div className='mb-4'>
          <label className='block mb-2 font-semibold'>Weapon Preference:</label>
          <div className='flex gap-4'>
            {['Sword', 'Axe', 'Club'].map((weapon) => (
              <label key={weapon} className='flex items-center space-x-2'>
                <input
                  type='radio'
                  value={weapon}
                  checked={selectedWeaponType === weapon}
                  onChange={() => setSelectedWeaponType(weapon)}
                  className='form-radio'
                />
                <span>{weapon}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className='flex items-center justify-center space-x-4 mb-4'>
        <div className='flex items-center'>
          <input
            type='radio'
            id='defense'
            name='calculationType'
            value='defense'
            checked={calculationType === 'defense'}
            onChange={() => setCalculationType('defense')}
            className='mr-2'
          />
          <label htmlFor='defense'>Best Def</label>
        </div>
        <div className='flex items-center'>
          <input
            type='radio'
            id='balanced'
            name='calculationType'
            value='balanced'
            checked={calculationType === 'balanced'}
            onChange={() => setCalculationType('balanced')}
            className='mr-2'
          />
          <label htmlFor='balanced'>Balanced</label>
        </div>
      </div>

      <InputPanel textInput={textInput} setTextInput={setTextInput} onCalculate={calculateBestEquipment} />

      <div className='mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
        {rankedEquipment &&
          Object.entries(rankedEquipment).map(([type, items]) => {
            const currentIndex = currentItemIndex[type] || 0;
            const currentItem = items[currentIndex];

            return (
              <EquipmentCard
                key={type}
                type={type}
                item={currentItem}
                index={currentIndex}
                totalItems={items.length}
                onPrevClick={() => handlePrevClick(type)}
                onNextClick={() => handleNextClick(type)}
                calculationType={calculationType}
              />
            );
          })}
      </div>
    </div>
  );
};

export default App;
