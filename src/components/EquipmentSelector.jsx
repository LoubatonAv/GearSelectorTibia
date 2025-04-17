import React from "react";

const EquipmentSelector = ({
  selectedVocation,
  setSelectedVocation,
  level,
  setLevel,
}) => (
  <div className="mb-6 flex gap-4 items-center">
    <select
      value={selectedVocation}
      onChange={(e) => setSelectedVocation(e.target.value)}
      className="px-4 py-2 bg-gray-800 text-white rounded-md border border-gray-600"
    >
      <option value="Sorcerer">Sorcerer</option>
      <option value="Druid">Druid</option>
      <option value="Knight">Knight</option>
      <option value="Paladin">Paladin</option>
    </select>

    <input
      type="number"
      value={level}
      onChange={(e) => setLevel(Number(e.target.value))}
      className="px-4 py-2 bg-gray-800 text-white rounded-md border border-gray-600 w-28"
      placeholder="Level"
      min="1"
    />
  </div>
);

export default EquipmentSelector;
