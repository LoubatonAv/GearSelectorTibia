import React from "react";

const EquipmentCard = ({
  type,
  item,
  index,
  totalItems,
  onPrevClick,
  onNextClick,
  calculationType,
}) => {
  if (!item) return null;

  const stats = item.stats || {};
  const resistances = item.resistances || {};
  const buffs = item.buffs || {};
  const attributes = item.attributes || [];

  const formatKey = (key) => {
    return key
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-4 flex flex-col h-full">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-200">
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </h3>
        <div className="text-sm text-gray-400">
          {index + 1} / {totalItems}
        </div>
      </div>

      <div className="flex items-center mb-4">
        {item.local_image && (
          <img
            src={item.local_image}
            alt={item.name}
            className="w-12 h-12 mr-4 object-contain bg-gray-700 p-1 rounded"
          />
        )}
        <div className="overflow-hidden">
          <h4 className="font-medium text-blue-300 truncate">{item.name}</h4>
          {(item.level || item.lvl) && (
            <p className="text-sm text-gray-400">
              Level: {item.level || item.lvl}
            </p>
          )}
        </div>
      </div>

      {/* Dynamic content section */}
      <div className="flex flex-col flex-grow overflow-y-auto max-h-64 text-sm space-y-3">
        {/* Attack */}
        {(stats.Atk || item.atk) && (
          <div className="bg-gray-700 px-2 py-1 rounded">
            <span className="font-semibold text-gray-300">Atk:</span>{" "}
            {stats.Atk || item.atk}
          </div>
        )}

        {/* Defense */}
        {/* Defense */}
        {(stats.arm || item.def || item.arm) && (
          <div className="bg-gray-700 px-2 py-1 rounded">
            <span className="font-semibold text-gray-300">Def:</span>{" "}
            {stats.arm || item.def || item.arm}
          </div>
        )}

        <ul className="text-green-300 text-xs space-y-1">
          {attributes.map((attr, idx) => (
            <li key={idx}>
              {formatKey(attr.name)}: {attr.value}
            </li>
          ))}
        </ul>

        {/* Buffs */}
        {Object.keys(buffs).length > 0 && (
          <div>
            <div className="font-semibold text-gray-300">Buffs:</div>
            {Object.entries(buffs).map(([key, value]) => (
              <div key={key} className="text-xs text-green-300">
                {formatKey(key)}: {value}
              </div>
            ))}
          </div>
        )}
        {/* Augments */}
        {item.augments && Object.keys(item.augments).length > 0 && (
          <div>
            <div className="font-semibold text-gray-300">Augments:</div>
            {Object.entries(item.augments).map(([key, value]) => (
              <div key={key} className="text-xs text-purple-300">
                {key}: {value}
              </div>
            ))}
          </div>
        )}

        {/* Score always at bottom of card */}
        {item.score !== undefined && (
          <div className="mt-auto bg-gray-700 p-2 rounded">
            <span className="font-semibold text-gray-300">Score:</span>{" "}
            <span className="text-yellow-300">
              {Math.round(item.score * 100) / 100}
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-4 pt-2 border-t border-gray-700">
        <button
          onClick={onPrevClick}
          disabled={index === 0}
          className={`px-3 py-1 rounded text-sm ${
            index === 0
              ? "bg-gray-700 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          Prev
        </button>
        <button
          onClick={onNextClick}
          disabled={index === totalItems - 1}
          className={`px-3 py-1 rounded text-sm ${
            index === totalItems - 1
              ? "bg-gray-700 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default EquipmentCard;
