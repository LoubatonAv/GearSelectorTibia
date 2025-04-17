import React from "react";

const EquipmentCard = ({
  type,
  item,
  index,
  totalItems,
  onPrevClick,
  onNextClick,
}) => (
  <div className="bg-gray-700 p-4 rounded-lg shadow-lg w-full mx-auto mb-4">
    <div className="flex justify-between items-center mb-2">
      <h2 className="text-lg font-semibold text-center">
        Best {type.charAt(0).toUpperCase() + type.slice(1)}
      </h2>
      <div className="text-sm text-gray-300">
        {index + 1} of {totalItems}
      </div>
    </div>

    <h3 className="text-md font-medium text-center mb-3 text-blue-300">
      {item.name}
    </h3>

    <div className="flex justify-center mb-3">
      <img
        className="w-20 h-20 object-contain"
        src={item.local_image}
        alt={item.name}
      />
    </div>

    <ul className="mt-3 text-xs space-y-1">
      {item.stats &&
        Object.entries(item.stats).map(([k, v]) => (
          <li key={k} className="bg-gray-800 p-1 rounded-md">
            <span className="font-semibold">{k}:</span> {v}
          </li>
        ))}
      {item.buffs &&
        Object.entries(item.buffs).map(([k, v]) => (
          <li key={k} className="bg-gray-800 p-1 rounded-md">
            <span className="font-semibold">{k}:</span> {v}
          </li>
        ))}
      {item.resistances &&
        Object.entries(item.resistances).map(([k, v]) => (
          <li key={k} className="bg-gray-800 p-1 rounded-md">
            <span className="font-semibold">{k}:</span> {v}
          </li>
        ))}
      {item.totalDamageReduction !== undefined && (
        <li className="bg-blue-900 p-1 rounded-md">
          <span className="font-semibold">Damage Reduction:</span>{" "}
          {item.totalDamageReduction.toFixed(2)}
        </li>
      )}
    </ul>

    <div className="flex justify-between mt-4">
      <button
        className={`px-3 py-1 rounded-md ${
          index > 0
            ? "bg-blue-600 hover:bg-blue-700"
            : "bg-gray-600 cursor-not-allowed"
        }`}
        onClick={onPrevClick}
        disabled={index === 0}
      >
        ← Prev
      </button>

      <button
        className={`px-3 py-1 rounded-md ${
          index < totalItems - 1
            ? "bg-blue-600 hover:bg-blue-700"
            : "bg-gray-600 cursor-not-allowed"
        }`}
        onClick={onNextClick}
        disabled={index === totalItems - 1}
      >
        Next →
      </button>
    </div>
  </div>
);

export default EquipmentCard;
