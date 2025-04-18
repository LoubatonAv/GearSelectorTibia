import React, { useState, useEffect } from "react";
import { parseDamageData } from "./utils/parser";
import EquipmentSelector from "./components/EquipmentSelector";
import InputPanel from "./components/InputPanel";
import EquipmentCard from "./components/EquipmentCard";
import "./App.css"; // or "./index.css" if using Tailwind

export const calculateHitsTaken = (armor) => {
  return 0.0783 * Math.pow(armor, 2) - 1.8156 * armor + 102.29;
};

const App = () => {
  const [equipmentData, setEquipmentData] = useState([]);
  const [textInput, setTextInput] = useState("");
  const [rankedEquipment, setRankedEquipment] = useState({});
  const [selectedVocation, setSelectedVocation] = useState("Sorcerer");
  const [level, setLevel] = useState(600);
  const [calculationType, setCalculationType] = useState("defense"); // Default to best defense
  const [currentItemIndex, setCurrentItemIndex] = useState({});

  useEffect(() => {
    fetch("/data/equipment.json")
      .then((res) => res.json())
      .then((data) => setEquipmentData(data))
      .catch((err) => console.error("Failed to load equipment data:", err));
  }, []);

  const calculateBestEquipment = () => {
    const damageTypes = parseDamageData(textInput);

    const rankedByType = {};

    const filteredEquipmentData = equipmentData.filter((item) => {
      if (!item.level || item.level <= level) {
        const vocations = item.vocation?.toLowerCase().split(" and ");

        // Handle vocation filtering
        const isAllowedForVocation =
          !item.vocation ||
          vocations.some((v) => v.includes(selectedVocation.toLowerCase()));

        // If the item is a wand, only show it to Sorcerers
        const isWandAndBlocked =
          item.equipmentType?.toLowerCase() === "wand" &&
          selectedVocation.toLowerCase() !== "sorcerer";

        return isAllowedForVocation && !isWandAndBlocked;
      }
      return false;
    });

    const equipmentTypes = [
      ...new Set(filteredEquipmentData.map((item) => item.equipmentType)),
    ];

    // Initialize current index state if needed
    const newCurrentItemIndex = { ...currentItemIndex };

    equipmentTypes.forEach((type) => {
      const itemsOfType = filteredEquipmentData.filter(
        (item) => item.equipmentType === type
      );

      if (calculationType === "defense") {
        // Calculate damage reduction for each item
        const itemsWithScores = itemsOfType.map((item) => {
          const armor = parseFloat(item.stats?.Arm) || 0;
          const shield = parseFloat(item.shield) || 0;
          let totalDamageReduction = 0;
          let totalIncomingDamage = 0;

          for (const damageTypeName in damageTypes) {
            const damageAmount = damageTypes[damageTypeName] || 0;
            totalIncomingDamage += damageAmount;
            const resistanceKey = damageTypeName.toLowerCase();
            const resistancePercent =
              parseFloat(item.resistances?.[resistanceKey]?.replace("%", "")) ||
              0;

            let damageAfterShield = damageAmount - shield;
            if (damageAfterShield < 0) {
              damageAfterShield = 0;
            }

            let damageReduction = damageAfterShield * (resistancePercent / 100);

            if (damageTypeName === "Physical") {
              const minArmorReduction = Math.floor(armor / 3);
              const maxArmorReduction = Math.floor((5 * armor + 5) / 3);
              damageReduction += maxArmorReduction; // Consider best-case armor reduction
            }
            totalDamageReduction += damageReduction;
          }

          return {
            ...item,
            totalDamageReduction: totalDamageReduction,
            score: totalDamageReduction,
          };
        });

        // Sort items by score (descending)
        const sortedItems = itemsWithScores.sort((a, b) => b.score - a.score);

        // Store the sorted items
        if (sortedItems.length > 0) {
          rankedByType[type] = sortedItems;

          // Initialize current index if not already set
          if (newCurrentItemIndex[type] === undefined) {
            newCurrentItemIndex[type] = 0;
          }
        }
      } else if (calculationType === "balanced") {
        // For balanced mode: First rank items based on offensive stats, then find best resistances among top tier

        // Helper function to get offensive score
        const getOffensiveScore = (item) => {
          const stats = item.stats || {};

          // Extract offensive stats based on vocation
          let offensiveScore = 0;

          // Get magic level for magic users
          if (selectedVocation === "Sorcerer" || selectedVocation === "Druid") {
            offensiveScore += parseFloat(stats["Magic Level"] || 0) * 10;
          }

          // Get distance skill for distance fighters
          if (selectedVocation === "Paladin") {
            offensiveScore += parseFloat(stats["Distance Fighting"] || 0) * 10;
          }

          // Get melee skills for knights
          if (selectedVocation === "Knight") {
            offensiveScore +=
              Math.max(
                parseFloat(stats["Sword Fighting"] || 0),
                parseFloat(stats["Axe Fighting"] || 0),
                parseFloat(stats["Club Fighting"] || 0)
              ) * 10;
          }

          // Add general bonuses
          offensiveScore += parseFloat(stats["Attack"] || 0) * 5;

          // Consider special buffs/boosts
          if (item.buffs) {
            offensiveScore += Object.values(item.buffs).length * 8;
          }

          return offensiveScore;
        };

        // First pass: calculate offensive scores
        const itemsWithOffensiveScores = itemsOfType.map((item) => ({
          ...item,
          offensiveScore: getOffensiveScore(item),
        }));

        // Sort by offensive score
        const sortedByOffensive = [...itemsWithOffensiveScores].sort(
          (a, b) => b.offensiveScore - a.offensiveScore
        );

        // Find top tier (top 25% of the offensive gear or at least top 3)
        const topTierCount = Math.max(
          3,
          Math.ceil(sortedByOffensive.length * 0.25)
        );
        const topTierItems = sortedByOffensive.slice(0, topTierCount);

        // Now calculate defensive scores for top tier items
        const topTierWithDefensiveScores = topTierItems.map((item) => {
          const armor = parseFloat(item.stats?.Arm) || 0;
          const shield = parseFloat(item.shield) || 0;
          let totalDamageReduction = 0;

          for (const damageTypeName in damageTypes) {
            const damageAmount = damageTypes[damageTypeName] || 0;
            const resistanceKey = damageTypeName.toLowerCase();
            const resistancePercent =
              parseFloat(item.resistances?.[resistanceKey]?.replace("%", "")) ||
              0;

            let damageAfterShield = Math.max(0, damageAmount - shield);
            let damageReduction = damageAfterShield * (resistancePercent / 100);

            if (damageTypeName === "Physical") {
              const maxArmorReduction = Math.floor((5 * armor + 5) / 3);
              damageReduction += maxArmorReduction;
            }

            totalDamageReduction += damageReduction;
          }

          // Combined score that heavily weights offensive but still considers defense
          const combinedScore =
            item.offensiveScore * 0.7 + totalDamageReduction * 0.3;

          return {
            ...item,
            totalDamageReduction,
            offensiveScore: item.offensiveScore,
            score: combinedScore,
          };
        });

        // Sort top tier by combined score
        const finalRanked = topTierWithDefensiveScores.sort(
          (a, b) => b.score - a.score
        );

        // Store the sorted items
        if (finalRanked.length > 0) {
          rankedByType[type] = finalRanked;

          // Initialize current index if not already set
          if (newCurrentItemIndex[type] === undefined) {
            newCurrentItemIndex[type] = 0;
          }
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

  const handleNextClick = (type) => {
    setCurrentItemIndex((prev) => ({
      ...prev,
      [type]: Math.min(
        (rankedEquipment[type]?.length || 1) - 1,
        prev[type] + 1
      ),
    }));
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold mb-6">Equipment Selector</h1>

      <EquipmentSelector
        selectedVocation={selectedVocation}
        setSelectedVocation={setSelectedVocation}
        level={level}
        setLevel={setLevel}
      />

      <div className="flex items-center justify-center space-x-4 mb-4">
        <div className="flex items-center">
          <input
            type="radio"
            id="defense"
            name="calculationType"
            value="defense"
            checked={calculationType === "defense"}
            onChange={() => setCalculationType("defense")}
            className="mr-2"
          />
          <label htmlFor="defense">Best Def</label>
        </div>
        <div className="flex items-center">
          <input
            type="radio"
            id="balanced"
            name="calculationType"
            value="balanced"
            checked={calculationType === "balanced"}
            onChange={() => setCalculationType("balanced")}
            className="mr-2"
          />
          <label htmlFor="balanced">Balanced</label>
        </div>
      </div>

      <InputPanel
        textInput={textInput}
        setTextInput={setTextInput}
        onCalculate={calculateBestEquipment}
      />

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
