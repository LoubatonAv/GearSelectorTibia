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
  magic_level: 1000, // was fine, but not dominant anymore
  distance_fighting: 1000,
  sword_fighting: 1000,
  axe_fighting: 1000,
  club_fighting: 1000,
  fist_fighting: 1000,

  // Elemental magic bonuses (boosted significantly)
  fire_magic_level: 200,
  energy_magic_level: 200,
  earth_magic_level: 180,
  ice_magic_level: 180,
  death_magic_level: 180,
  holy_magic_level: 180,
  physical_magic_level: 150,

  // Critical
  critical_hit_chance: 25, // previously 20
  critical_extra_damage: 20, // previously 15

  // Sustain
  life_leech: 10, // previously 100–120
  mana_leech: 5, // previously 100–120

  // Special effects
  augments: 200, // if still fallback to count-based
  buffs: 50,

  // Defensive contributions (light since it’s "balanced" mode)
  resistance: 5,
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
          const armor = parseFloat(
            item.stats?.Arm || item.arm || item.def || 0
          );
          const shield = parseFloat(item.shield || 0);
          const resistances = item.resistances || {};
          let totalMitigationScore = 0;
          let totalIncomingDamage = totalDamage; // Start with the initial total damage

          for (const [damageType, incomingDamage] of Object.entries(
            damageTypes
          )) {
            const damageTypeLower = damageType.toLowerCase();
            let resistanceMultiplier = 1;
            let resistancePercent = 0;

            if (resistances[damageTypeLower]) {
              resistancePercent =
                parseFloat(resistances[damageTypeLower].replace("%", "")) || 0;
              resistanceMultiplier -= resistancePercent / 100;
            } else if (resistances[damageTypeLower + "_resistance"]) {
              resistancePercent =
                parseFloat(
                  resistances[damageTypeLower + "_resistance"].replace("%", "")
                ) || 0;
              resistanceMultiplier -= resistancePercent / 100;
            }

            // Calculate damage after resistance
            const damageAfterResistance = incomingDamage * resistanceMultiplier;

            // Apply armor reduction (you can adjust this formula)
            const armorMitigation = Math.min(
              armor + shield,
              damageAfterResistance
            ); // Example: Armor fully mitigates up to its value
            const finalDamageTaken = Math.max(
              0,
              damageAfterResistance - armorMitigation
            );

            // Calculate mitigation score for this damage type
            const initialDamageForType = damageTypes[damageType] || 0;
            const mitigatedAmount = initialDamageForType - finalDamageTaken;
            const mitigationPercentage =
              initialDamageForType > 0
                ? (mitigatedAmount / initialDamageForType) * 100
                : 0;

            // Weight the mitigation score by the proportion of damage
            const damageProportion = initialDamageForType / totalDamage;
            totalMitigationScore += mitigationPercentage * damageProportion;
          }

          // Add a bonus for relevant resistances (especially physical)
          let relevantResistanceBonus = 0;
          if (resistances.physical || resistances.physical_resistance) {
            const physicalResist =
              parseFloat(
                (
                  resistances.physical ||
                  resistances.physical_resistance ||
                  "0"
                ).replace("%", "")
              ) || 0;
            relevantResistanceBonus += physicalResist * 200; // Adjust multiplier as needed
          }

          // Slightly reduce the direct impact of base armor in the score
          const armorScore = (armor + shield) * 10; // Lower multiplier

          return {
            ...item,
            score: totalMitigationScore + relevantResistanceBonus + armorScore,
            // ... (other debug info if needed)
          };
        });

        const sortedItems = itemsWithScores.sort((a, b) => b.score - a.score);
        if (sortedItems.length > 0) {
          rankedByType[type] = sortedItems;
          if (newCurrentItemIndex[type] === undefined) {
            newCurrentItemIndex[type] = 0;
          }
        }
      } else if (calculationType === "balanced") {
        // Enhanced implementation of getGenericScore that considers the damage profile
        const getGenericScoreImproved = (item) => {
          let score = 0;
          const stats = item.stats || {};
          const attrs = Array.isArray(item.attributes) ? item.attributes : [];
          const resists = item.resistances || {};
          const totalDmg = Object.values(damageTypes).reduce(
            (a, b) => a + b,
            0
          );

          // 1) Armor & shield
          const armor = parseFloat(stats.Arm || item.arm || item.def || 0);
          const shield = parseFloat(item.shield || 0);
          score += armor * 10;
          score += shield * 25;

          // 2) Resistances
          for (const [type, dmg] of Object.entries(damageTypes)) {
            const key = type.toLowerCase();
            let pct = 0;
            if (resists[key])
              pct = parseFloat(resists[key].replace("%", "")) || 0;
            else if (resists[key + "_resistance"])
              pct =
                parseFloat(resists[key + "_resistance"].replace("%", "")) || 0;
            score += pct * (dmg / totalDmg) * 200;
          }

          // 3) Mage skills (only Sorcerer/Druid)
          if (["Sorcerer", "Druid"].includes(selectedVocation)) {
            const ml = extractSkillBonus(attrs, "magic_level");
            score += ml * BALANCED_WEIGHTS.magic_level;
            for (const el of [
              "fire",
              "energy",
              "earth",
              "ice",
              "death",
              "holy",
            ]) {
              const eb = extractSkillBonus(attrs, `${el}_magic_level`);
              const pct = (damageTypes[el] || 0) / totalDmg;
              score +=
                eb * BALANCED_WEIGHTS[`${el}_magic_level`] * (1 + pct / 25);
            }
          }

          // 4) Crit & leech
          const crit = extractCriticalHitBonus(attrs);
          score += crit.chance * BALANCED_WEIGHTS.critical_hit_chance;
          score += crit.damage * BALANCED_WEIGHTS.critical_extra_damage;
          score +=
            extractSkillBonus(attrs, "life_leech") *
            BALANCED_WEIGHTS.life_leech;
          score +=
            extractSkillBonus(attrs, "mana_leech") *
            BALANCED_WEIGHTS.mana_leech;

          // 5) Augments & buffs (count only)
          score +=
            (item.augments ? Object.keys(item.augments).length : 0) *
            BALANCED_WEIGHTS.augments;
          score +=
            (item.buffs ? Object.keys(item.buffs).length : 0) *
            BALANCED_WEIGHTS.buffs;

          return score;
        };

        // Enhanced weapon scoring that considers the damage profile
        const getWeaponScoreImproved = (item) => {
          let score = 0;
          const stats = item.stats || {};
          const attrs = Array.isArray(item.attributes) ? item.attributes : [];
          const resists = item.resistances || {};
          const totalDmg = Object.values(damageTypes).reduce(
            (a, b) => a + b,
            0
          );
          const type = item.equipmentType?.toLowerCase();

          // 1) Main skill (weighted at 800)
          const skillMap = {
            bows: "distance_fighting",
            swords: "sword_fighting",
            axes: "axe_fighting",
            clubs: "club_fighting",
            "fist fighting": "fist_fighting",
          };
          const mainSkill = skillMap[type] || "magic_level";
          const bonus = extractSkillBonus(attrs, mainSkill);
          const stat = parseFloat(stats[mainSkill] || 0);
          score += (bonus + stat) * 800;

          // 2) ATK: only for non–wand/rod weapons
          if (!["wands", "rods"].includes(type)) {
            const atk = parseFloat(stats.Atk || item.atk || 0) || 0;
            score += atk * 20;
          }

          // 3) Resistances (light)
          for (const [dt, dmg] of Object.entries(damageTypes)) {
            const key = dt.toLowerCase();
            let pct = 0;
            if (resists[key])
              pct = parseFloat(resists[key].replace("%", "")) || 0;
            else if (resists[key + "_resistance"])
              pct =
                parseFloat(resists[key + "_resistance"].replace("%", "")) || 0;
            score += pct * (dmg / totalDmg) * 2;
          }

          // 4) Elemental ML for wands/rods
          if (
            ["wands", "rods"].includes(type) &&
            ["Sorcerer", "Druid"].includes(selectedVocation)
          ) {
            for (const el of [
              "fire",
              "energy",
              "earth",
              "ice",
              "death",
              "holy",
            ]) {
              const eb = extractSkillBonus(attrs, `${el}_magic_level`);
              const pct = (damageTypes[el] || 0) / totalDmg;
              score += eb * 200 * (1 + pct / 50);
            }
          }

          // 5) Crit & leech
          const crit = extractCriticalHitBonus(attrs);
          score += crit.chance * BALANCED_WEIGHTS.critical_hit_chance;
          score += crit.damage * BALANCED_WEIGHTS.critical_extra_damage;
          score +=
            extractSkillBonus(attrs, "life_leech") *
            BALANCED_WEIGHTS.life_leech;
          score +=
            extractSkillBonus(attrs, "mana_leech") *
            BALANCED_WEIGHTS.mana_leech;

          // 6) Augments & buffs (count only)
          score +=
            (item.augments ? Object.keys(item.augments).length : 0) *
            BALANCED_WEIGHTS.augments;
          score +=
            (item.buffs ? Object.keys(item.buffs).length : 0) *
            BALANCED_WEIGHTS.buffs;

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
            score: isWeapon
              ? getWeaponScoreImproved(item)
              : getGenericScoreImproved(item),
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

    // ✅ Move this outside the filter loop — now ranking is complete
    const bestSet = Object.entries(rankedByType).map(
      ([type, items]) => items[0]
    );
    setBestGearSet(bestSet);
  };

  console.log("Ranked Equipment:", rankedEquipment);
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
