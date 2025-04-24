import React, { useState, useEffect } from "react";
import { parseDamageData } from "./utils/parser";
import EquipmentSelector from "./components/EquipmentSelector";
import InputPanel from "./components/InputPanel";
import EquipmentCard from "./components/EquipmentCard";
import "./App.css"; // or "./index.css" if using Tailwind

const DEFAULT_DAMAGE_PROFILE = {
  physical: 400000,
  fire: 200000,
  energy: 150000,
  ice: 100000,
  earth: 150000,
  death: 100000,
  holy: 100000,
};

const BALANCED_WEIGHTS = {
  // Core combat skills
  magic_level: 100,
  distance_fighting: 100,
  sword_fighting: 100,
  axe_fighting: 100,
  club_fighting: 100,
  fist_fighting: 100,

  // Elemental magic bonuses
  fire_magic_level: 100,
  energy_magic_level: 100,
  earth_magic_level: 100,
  ice_magic_level: 100,
  death_magic_level: 100,
  holy_magic_level: 100,
  physical_magic_level: 100,

  // Critical
  critical_hit_chance: 20,
  critical_extra_damage: 15,

  // Sustain
  life_leech: 25,
  mana_leech: 20,

  // Additional
  buffs: 50,
  augments: 50,

  // Defensive factors in balanced
  resistance: 2,
};

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
  const [bestGearSet, setBestGearSet] = useState([]);

  useEffect(() => {
    fetch("/data/equipment.json")
      .then((res) => res.json())
      .then((data) => {
        const processedData = data.map((item) => {
          if (!item.stats) item.stats = {};
          if (item.atk && !item.stats.Atk) item.stats.Atk = item.atk;
          if (item.def && !item.stats.Arm) item.stats.Arm = item.def;

          // Process attributes to always be a string
          if (!item.attributes || !Array.isArray(item.attributes)) {
            item.attributes = [];
          }

          // Ensure buffs is an object (as discussed before)
          if (Array.isArray(item.buffs)) {
            const buffsObject = {};
            item.buffs.forEach((buff) => {
              const name = buff.name?.toLowerCase().replace(/ /g, "_");
              if (name && buff.value) {
                buffsObject[name] = buff.value;
              }
            });
            item.buffs = buffsObject;
          } else if (!item.buffs) {
            item.buffs = {};
          }

          // Ensure resistances is an object (if you have this data later)
          if (Array.isArray(item.resistances)) {
            const resistancesObject = {};
            item.resistances.forEach((res) => {
              const type = res.type?.toLowerCase();
              if (type && res.value) {
                resistancesObject[type] = res.value;
              }
            });
            item.resistances = resistancesObject;
          } else if (!item.resistances) {
            item.resistances = {};
          }

          return item;
        });
        setEquipmentData(processedData);
      })
      .catch((err) => console.error("Failed to load equipment data:", err));
  }, []);

  // Helper function to extract skill bonus from attributes string
  const extractSkillBonus = (attributes, skillType) => {
    const normalized = skillType.toLowerCase().replace(/ /g, "_");
    const attr = attributes.find((a) => a.name?.toLowerCase() === normalized);
    return attr ? parseFloat(attr.value) || 0 : 0;
  };

  // Helper function to check if attributes contain critical hit bonuses
  const extractCriticalHitBonus = (attributes) => {
    let chance = 0;
    let damage = 0;

    for (const attr of attributes) {
      const name = attr.name?.toLowerCase();
      const value =
        typeof attr.value === "string" ? attr.value : `${attr.value}`;

      if (name === "critical_hit_chance") {
        chance = parseFloat(value.replace("%", "")) || 0;
      } else if (name === "critical_extra_damage") {
        damage = parseFloat(value.replace("%", "")) || 0;
      }
    }

    return { chance, damage };
  };

  const calculateBestEquipment = () => {
    const damageTypes = textInput.trim()
      ? parseDamageData(textInput)
      : DEFAULT_DAMAGE_PROFILE;
    const totalDamage = Object.values(damageTypes).reduce(
      (sum, val) => sum + val,
      0
    );
    const rankedByType = {};
    const newCurrentItemIndex = { ...currentItemIndex };
    const currentVocationLower = selectedVocation.toLowerCase();
    const currentWeaponLower = selectedWeaponType.toLowerCase() + "s";

    const filteredEquipmentData = equipmentData.filter((item) => {
      const vocations = item.vocation?.toLowerCase().split(" and ") || [];
      const isAllowedForVocation =
        !item.vocation ||
        vocations.some((v) => v.includes(currentVocationLower)) ||
        vocations.length === 0;
      const equipmentTypeLower = item.equipmentType?.toLowerCase();

      const isWeapon = [
        "swords",
        "axes",
        "clubs",
        "wands",
        "bows",
        "fist fighting",
      ].includes(equipmentTypeLower);

      let shouldInclude = true;

      if (
        (item.level && item.level > level) ||
        (item.lvl && parseInt(item.lvl) > level)
      ) {
        shouldInclude = false;
      } else if (!isAllowedForVocation) {
        shouldInclude = false;
      } // Weapon restrictions based on vocation
      const allowedWeaponTypesByVocation = {
        sorcerer: ["wands", "spellbooks"],
        druid: ["rods", "spellbooks"],
        knight: ["swords", "axes", "clubs", "spellbooks"],
        paladin: ["bows", "spellbooks"],
        monk: ["fist fighting", "spellbooks"],
      };

      const allowedTypes =
        allowedWeaponTypesByVocation[currentVocationLower] || [];
      const isEquipmentTypeAllowed =
        allowedTypes.includes(equipmentTypeLower) ||
        ![
          "wands",
          "rods",
          "bows",
          "swords",
          "axes",
          "clubs",
          "fist fighting",
          "spellbooks",
        ].includes(equipmentTypeLower);

      if (!isAllowedForVocation || !isEquipmentTypeAllowed) {
        shouldInclude = false;
      }
      const bestSet = Object.entries(rankedByType).map(
        ([type, items]) => items[0]
      );
      setBestGearSet(bestSet);

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
          const armor =
            parseFloat(item.stats?.Arm) || parseFloat(item.def) || 0;
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
          const stats = item.stats || {};
          const buffs = item.buffs || {};
          const augments = item.augments || {};
          const attributes = item.attributes || [];

          // Step 1: Identify the relevant core skill
          const type = item.equipmentType?.toLowerCase();
          let relevantSkill = "magic_level"; // default fallback

          if (["bows"].includes(type)) relevantSkill = "distance_fighting";
          else if (["swords"].includes(type)) relevantSkill = "sword_fighting";
          else if (["axes"].includes(type)) relevantSkill = "axe_fighting";
          else if (["clubs"].includes(type)) relevantSkill = "club_fighting";
          else if (["fist fighting"].includes(type))
            relevantSkill = "fist_fighting";

          const attrSkill = extractSkillBonus(attributes, relevantSkill);
          const statSkill = parseFloat(stats[relevantSkill] || 0);
          const mainSkillScore = attrSkill + statSkill;

          // Step 2: Compute secondary bonus score
          let secondaryScore = 0;

          // Elemental bonuses
          secondaryScore +=
            extractSkillBonus(attributes, "fire_magic_level") * 75;
          secondaryScore +=
            extractSkillBonus(attributes, "energy_magic_level") * 75;

          // Crit bonuses
          const crit = extractCriticalHitBonus(attributes);
          secondaryScore += crit.chance * 20;
          secondaryScore += crit.damage * 15;

          // Leech bonuses
          secondaryScore += extractSkillBonus(attributes, "life_leech") * 25;
          secondaryScore += extractSkillBonus(attributes, "mana_leech") * 20;

          // Buffs & augments
          secondaryScore += Object.keys(buffs).length * 50;
          secondaryScore += Object.keys(augments).length * 50;

          // Resistances (minimal weight)
          for (const damageType in item.resistances || {}) {
            const val =
              parseFloat(item.resistances[damageType]?.replace("%", "")) || 0;
            secondaryScore += val * 2;
          }

          // Step 3: Combine into a composite score that prioritizes core skill
          return mainSkillScore * 10000 + secondaryScore;
        };

        const getGenericScore = (item) => {
          let score = 0;
          const stats = item.stats || {};
          const buffs = item.buffs || {};
          const augments = item.augments || {};
          const attributes = item.attributes || "";

          // Base stats
          score += parseFloat(stats.Arm || item.def || 0) * 10;
          score += parseFloat(stats.Atk || item.atk || 0) * 20;

          // Extract skill bonuses from attributes
          if (selectedVocation === "Knight") {
            score += extractSkillBonus(attributes, "sword fighting") * 75;
            score += extractSkillBonus(attributes, "axe fighting") * 75;
            score += extractSkillBonus(attributes, "club fighting") * 75;
            score += extractSkillBonus(attributes, "fist fighting") * 75;
          } else if (selectedVocation === "Paladin") {
            score += extractSkillBonus(attributes, "distance fighting") * 75;
          } else {
            score += extractSkillBonus(attributes, "magic level") * 75;
          }

          // Check for critical hit bonuses
          const critBonus = extractCriticalHitBonus(attributes);
          score += ((critBonus.chance * critBonus.damage) / 100) * 15;

          // Check for leech bonuses
          if (attributes.includes("life leech")) {
            const lifeLeechMatch = attributes.match(/life leech\s*\((\d+)%\)/i);
            if (lifeLeechMatch && lifeLeechMatch[1]) {
              score += parseInt(lifeLeechMatch[1], 10) * 8;
            }
          }

          if (attributes.includes("mana leech")) {
            const manaLeechMatch = attributes.match(/mana leech\s*\((\d+)%\)/i);
            if (manaLeechMatch && manaLeechMatch[1]) {
              score += parseInt(manaLeechMatch[1], 10) * 12;
            }
          }

          // Check for augments
          if (attributes.includes("Augments:")) {
            score += 50; // Base bonus for having augments

            // Try to extract augment damage bonus
            const augmentMatch = attributes.match(
              /\+(\d+)%\s*(?:base)?\s*damage/i
            );
            if (augmentMatch && augmentMatch[1]) {
              score += parseInt(augmentMatch[1], 10) * 8;
            }
          }

          // Score from buffs
          if (selectedVocation === "Sorcerer" || selectedVocation === "Druid") {
            score += parseFloat(buffs.magic_level || 0) * 250;
          } else if (selectedVocation === "Paladin") {
            score += parseFloat(buffs.distance_fighting || 0) * 250;
          } else if (selectedVocation === "Knight") {
            const fightingSkillBuff = Object.keys(buffs).find((key) =>
              [
                "axe_fighting",
                "sword_fighting",
                "club_fighting",
                "fist_fighting",
              ].includes(key)
            );
            score += parseFloat(buffs[fightingSkillBuff] || 0) * 250;
          }

          // Add resistance scoring
          let resistanceScore = 0;
          for (const damageType in damageTypes) {
            const resistanceKey = damageType.toLowerCase().replace(" ", "_");
            const resistanceValue =
              parseFloat(item.resistances?.[resistanceKey]?.replace("%", "")) ||
              0;
            const damagePercentage =
              totalDamage > 0 ? damageTypes[damageType] / totalDamage : 0;
            resistanceScore += resistanceValue * (damagePercentage * 100);
          }
          score += resistanceScore * 0.7;

          return score;
        };

        const weaponTypes = [
          "wands",
          "rods",
          "bows",
          "swords",
          "axes",
          "clubs",
          "fist fighting",
        ];

        const itemsWithScores = itemsOfType.map((item) => {
          const equipmentTypeLower = item.equipmentType?.toLowerCase();
          const isWeapon = weaponTypes.includes(equipmentTypeLower);

          return {
            ...item,
            score: isWeapon ? getWeaponScore(item) : getGenericScore(item),
          };
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
            {["Sword", "Axe", "Club", "Fist"].map((weapon) => (
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
      {!textInput.trim() && (
        <p className="text-sm text-gray-400 mt-2">
          Using default damage profile for calculation.
        </p>
      )}

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
