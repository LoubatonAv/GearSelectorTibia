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
  const [selectedWeaponType, setSelectedWeaponType] = useState("");

  useEffect(() => {
    fetch("/data/equipment.json")
      .then((res) => res.json())
      .then((data) => setEquipmentData(data))
      .catch((err) => console.error("Failed to load equipment data:", err));
  }, []);

  const calculateBestEquipment = () => {
    const damageTypes = parseDamageData(textInput);
    const totalDamage = Object.values(damageTypes).reduce(
      (sum, val) => sum + val,
      0
    );
    const rankedByType = {};
    const newCurrentItemIndex = { ...currentItemIndex };
    const currentVocationLower = selectedVocation.toLowerCase();
    const currentWeaponLower = selectedWeaponType.toLowerCase() + "s";

    const filteredEquipmentData = equipmentData.filter((item) => {
      const vocations = item.vocation?.toLowerCase().split(" and ");
      const isAllowedForVocation =
        !item.vocation ||
        vocations.some((v) => v.includes(currentVocationLower));
      const equipmentTypeLower = item.equipmentType?.toLowerCase();

      const isWeapon = ["swords", "axes", "clubs", "wands"].includes(
        equipmentTypeLower
      );

      let shouldInclude = true;

      if (item.level && item.level > level) {
        shouldInclude = false;
      } else if (!isAllowedForVocation) {
        shouldInclude = false;
      } else if (currentVocationLower === "knight" && isWeapon) {
        if (!currentWeaponLower) {
          shouldInclude = false;
        } else {
          shouldInclude = equipmentTypeLower === currentWeaponLower;
        }
      } else if (
        equipmentTypeLower === "wand" &&
        currentVocationLower !== "sorcerer"
      ) {
        shouldInclude = false;
      }

      return shouldInclude;
    });

    const equipmentTypes = [
      ...new Set(filteredEquipmentData.map((item) => item.equipmentType)),
    ];

    equipmentTypes.forEach((type) => {
      const itemsOfType = filteredEquipmentData.filter(
        (item) => item.equipmentType === type
      );

      if (calculationType === "defense") {
        const itemsWithScores = itemsOfType.map((item) => {
          const armor = parseFloat(item.stats?.Arm) || 0;
          const shield = parseFloat(item.shield) || 0;
          let totalDamageReductionScore = armor * 2; // Give base armor a base weight

          for (const damageTypeName in damageTypes) {
            const damageAmount = damageTypes[damageTypeName] || 0;
            const resistanceKey = damageTypeName.toLowerCase();
            const resistancePercent =
              parseFloat(item.resistances?.[resistanceKey]?.replace("%", "")) ||
              0;
            const damagePercentage =
              totalDamage > 0 ? damageAmount / totalDamage : 0;
            totalDamageReductionScore +=
              resistancePercent * damagePercentage * 100; // Weight resistance by damage share
          }
          return { ...item, score: totalDamageReductionScore };
        });
        const sortedItems = itemsWithScores.sort((a, b) => b.score - a.score);
        if (sortedItems.length > 0) {
          rankedByType[type] = sortedItems;
          if (newCurrentItemIndex[type] === undefined) {
            newCurrentItemIndex[type] = 0;
          }
        }
      } else if (calculationType === "balanced") {
        const getWeaponScore = (item) => {
          let score = 0;
          const stats = item.stats || {};
          const buffs = item.buffs || {};
          const augments = item.augments || {};

          if (selectedVocation === "Sorcerer" || selectedVocation === "Druid") {
            score += parseFloat(stats["Magic Level"] || 0) * 100;
          } else if (selectedVocation === "Paladin") {
            score += parseFloat(stats["Distance Fighting"] || 0) * 100;
          } else if (selectedVocation === "Knight") {
            const fightingSkill = item.equipmentType
              ?.toLowerCase()
              .replace(/s$/, "_fighting");
            score += parseFloat(stats[fightingSkill] || 0) * 100;
          }

          const numBuffs = Object.keys(buffs).length;
          const numAugments = Object.keys(augments).length;
          score += (numBuffs + numAugments) * 50;

          for (const damageTypeName in damageTypes) {
            const resistanceKey = damageTypeName.toLowerCase();
            const resistanceValue =
              parseFloat(item.resistances?.[resistanceKey]?.replace("%", "")) ||
              0;
            score += resistanceValue * 10;
          }

          return score;
        };

        const getGenericScore = (item) => {
          let score = 0;
          const stats = item.stats || {};
          const buffs = item.buffs || {};
          const augments = item.augments || {};

          const significantDamageTypes = Object.entries(damageTypes)
            .sort(([, a], [, b]) => b - a)
            .map(([type]) => type);

          if (selectedVocation === "Sorcerer" || selectedVocation === "Druid") {
            score += parseFloat(buffs.magic_level || 0) * 250;
            score += parseFloat(stats["Magic Level"] || 0) * 75;
          } else if (selectedVocation === "Paladin") {
            score += parseFloat(buffs["distance_fighting"] || 0) * 250;
            score += parseFloat(stats["Distance Fighting"] || 0) * 75;
          } else if (selectedVocation === "Knight") {
            const fightingSkillBuff = Object.keys(buffs).find((key) =>
              ["axe_fighting", "sword_fighting", "club_fighting"].includes(key)
            );
            score += parseFloat(buffs[fightingSkillBuff] || 0) * 250;
            const fightingSkillStat = item.equipmentType
              ?.toLowerCase()
              .replace(/s$/, "_fighting");
            score += parseFloat(stats[fightingSkillStat] || 0) * 75;
          }

          score += parseFloat(stats["Arm"] || 0) * 5;

          if (selectedVocation === "Sorcerer" || selectedVocation === "Druid") {
            score += parseFloat(buffs.fire_magic_level || 0) * 15;
            score += parseFloat(buffs.energy_magic_level || 0) * 15;
            score += parseFloat(buffs.earth_magic_level || 0) * 15;
            score += parseFloat(buffs.ice_magic_level || 0) * 15;
            score += parseFloat(buffs.death_magic_level || 0) * 15;
          }
          const critChance = parseFloat(
            String(buffs.critical_hit_chance || "0").replace("%", "")
          );
          const critDamage = parseFloat(
            String(buffs.critical_extra_damage || "0").replace(/[^0-9.]/g, "")
          );
          score += ((critChance * critDamage) / 100) * 10;
          if (selectedVocation === "Paladin" && buffs.perfect_shot) {
            score +=
              parseFloat(String(buffs.perfect_shot).replace(/[^0-9.]/g, "")) *
              10;
          }
          score +=
            parseFloat(
              String(buffs.life_leech || "0").replace(/[^0-9.]/g, "")
            ) * 8;
          score +=
            parseFloat(
              String(buffs.mana_leech || "0").replace(/[^0-9.]/g, "")
            ) * 12;

          let augmentsScore = 0;
          for (const spell in augments) {
            const augmentValue = parseFloat(
              String(augments[spell]).replace(/[^0-9.]/g, "")
            );
            let augmentWeight = 12;
            if (
              selectedVocation === "Sorcerer" ||
              selectedVocation === "Druid"
            ) {
              augmentWeight = augments[spell].includes("damage") ? 18 : 10;
            }
            augmentsScore += augmentValue * augmentWeight;
          }
          score += augmentsScore;

          let resistanceScore = 0;
          for (const damageType of significantDamageTypes.slice(0, 3)) {
            const resistanceKey = damageType.toLowerCase().replace(" ", "_");
            const resistanceValue =
              parseFloat(item.resistances?.[resistanceKey]?.replace("%", "")) ||
              0;
            const damagePercentage =
              totalDamage > 0 ? damageTypes[damageType] / totalDamage : 0;
            resistanceScore += resistanceValue * (damagePercentage * 100);
          }
          score += resistanceScore * 0.7; // Slightly reduce weight of resistances in balanced

          return score;
        };

        const itemsWithScores = itemsOfType.map((item) => {
          if (item.equipmentType?.toLowerCase().includes("wand")) {
            return { ...item, score: getWeaponScore(item) };
          } else {
            return { ...item, score: getGenericScore(item) };
          }
        });

        const sortedItems = itemsWithScores.sort((a, b) => b.score - a.score);

        if (sortedItems.length > 0) {
          rankedByType[type] = sortedItems;
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
      {selectedVocation === "Knight" && (
        <div className="mb-4">
          <label className="block mb-2 font-semibold">Weapon Preference:</label>
          <div className="flex gap-4">
            {["Sword", "Axe", "Club"].map((weapon) => (
              <label key={weapon} className="flex items-center space-x-2">
                <input
                  type="radio"
                  value={weapon}
                  checked={selectedWeaponType === weapon}
                  onChange={() => setSelectedWeaponType(weapon)}
                  className="form-radio"
                />
                <span>{weapon}</span>
              </label>
            ))}
          </div>
        </div>
      )}

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
