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
          const armValue = item.arm || item.def;
          if (armValue && !item.stats.Arm) item.stats.Arm = armValue;

          // Process attributes to always be a string
          if (!item.attributes || !Array.isArray(item.attributes)) {
            item.attributes = [];
          }
          // Parse attributes if it's a string (e.g. "fist fighting +1Augments: ...")
          if (typeof item.attributes === "string") {
            const parsedAttributes = [];

            // Extract anything like: "fist fighting +1"
            const basicAttrs = item.attributes.match(
              /([\w\s]+?)\s*\+?([\d.%]+)/gi
            );
            if (basicAttrs) {
              basicAttrs.forEach((attr) => {
                const match = attr.match(/([\w\s]+?)\s*\+?([\d.%]+)/);
                if (match) {
                  const name = match[1].trim().toLowerCase().replace(/ /g, "_");
                  const value = match[2].trim();
                  parsedAttributes.push({ name, value });
                }
              });
            }

            item.attributes = parsedAttributes;
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
        monk: ["fists", "spellbooks"],
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
          "fists",
          "spellbooks",
        ].includes(equipmentTypeLower);

      if (!isAllowedForVocation || !isEquipmentTypeAllowed) {
        shouldInclude = false;
      }

      // 🔧 Prevent fist fighting for anyone except monks
      if (equipmentTypeLower === "fists" && currentVocationLower !== "monk") {
        shouldInclude = false;
      }

      // Filter based on specific weapon preference (e.g. Knight selected "Sword")
      if (
        selectedVocation === "Knight" &&
        ["swords", "axes", "clubs", "fist fighting"].includes(
          equipmentTypeLower
        )
      ) {
        const selected = selectedWeaponType.toLowerCase();
        if (selected && equipmentTypeLower !== selected + "s") {
          shouldInclude = false;
        }
      }

      setRankedEquipment(rankedByType);
      setCurrentItemIndex(newCurrentItemIndex);

      // ✅ Move this outside the filter loop — now ranking is complete
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
          // First properly parse the armor value from wherever it might be
          const armor = parseFloat(
            item.stats?.Arm || item.arm || item.def || 0
          );
          const shield = parseFloat(item.shield || 0);
          const resistances = item.resistances || {};

          // Simulate realistic reduction
          let simulatedDamage = 0;

          for (const [damageType, incomingDamage] of Object.entries(
            damageTypes
          )) {
            let reducedDamage = incomingDamage;

            // Check for resistance in a more flexible way
            let resistancePercent = 0;
            const damageTypeLower = damageType.toLowerCase();

            // Try different keys that might hold the resistance value
            if (resistances[damageTypeLower]) {
              resistancePercent =
                parseFloat(resistances[damageTypeLower].replace("%", "")) || 0;
            } else if (resistances[damageTypeLower + "_resistance"]) {
              resistancePercent =
                parseFloat(
                  resistances[damageTypeLower + "_resistance"].replace("%", "")
                ) || 0;
            }

            if (resistancePercent > 0) {
              reducedDamage = Math.floor(
                ((100 - resistancePercent) / 100) * reducedDamage
              );
            }

            // Apply armor reduction after resistances
            const minArmorReduction = Math.floor((armor + shield) / 2);
            const maxArmorReduction = minArmorReduction * 2 - 1;
            const avgArmorReduction = Math.floor(
              (minArmorReduction + maxArmorReduction) / 2
            );
            const finalDamage = Math.max(0, reducedDamage - avgArmorReduction);
            simulatedDamage += finalDamage;
          }

          // Use offensive stats as tiebreaker by adding a tiny fraction based on magic level or other offensive stats
          let tiebreaker = 0;
          if (item.attributes && Array.isArray(item.attributes)) {
            for (const attr of item.attributes) {
              if (attr.name === "magic_level") {
                tiebreaker += parseFloat(attr.value) * 0.001; // Small enough to not override defense difference
              }
            }
          }

          return { ...item, score: -simulatedDamage + tiebreaker }; // Lower damage = better (higher score)
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
          const attributes = item.attributes || [];
          const augments = item.augments || {};

          // Base stats
          score += parseFloat(stats.Arm || item.arm || item.def || 0) * 20;
          score += parseFloat(stats.Atk || item.atk || 0) * 20;

          // Extract skill bonuses from attributes properly
          if (selectedVocation === "Sorcerer" || selectedVocation === "Druid") {
            score += extractSkillBonus(attributes, "magic_level") * 100;
          } else if (selectedVocation === "Paladin") {
            score += extractSkillBonus(attributes, "distance_fighting") * 100;
          } else if (selectedVocation === "Knight") {
            score += extractSkillBonus(attributes, "sword_fighting") * 100;
            score += extractSkillBonus(attributes, "axe_fighting") * 100;
            score += extractSkillBonus(attributes, "club_fighting") * 100;
            score += extractSkillBonus(attributes, "fist_fighting") * 100;
          }

          // Properly evaluate augments
          Object.entries(augments || {}).forEach(([spellName, effect]) => {
            const critMatch = effect.match(
              /\+(\d+)%\s*critical\s*extra\s*damage/i
            );
            if (critMatch) {
              score += parseInt(critMatch[1], 10) * 15; // Use the BALANCED_WEIGHTS.critical_extra_damage value
            }
          });

          // Add resistance scoring - make sure to handle all resistance types correctly
          Object.entries(item.resistances || {}).forEach(([type, value]) => {
            const numValue = parseFloat(value.replace("%", "")) || 0;
            score += numValue * (BALANCED_WEIGHTS.resistance || 2);
          });

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
