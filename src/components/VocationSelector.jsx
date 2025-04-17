import React from "react";

const VocationSelector = ({ selectedVocation, setSelectedVocation }) => {
  return (
    <div className="mb-6">
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
    </div>
  );
};

export default VocationSelector;
