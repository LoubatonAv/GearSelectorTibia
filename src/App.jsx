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
