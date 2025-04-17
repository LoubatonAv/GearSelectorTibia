import React from "react";
import EquipmentCard from "./EquipmentCard";

const EquipmentGrid = ({ bestEquipment }) => {
  if (!bestEquipment) return null;

  return (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Object.entries(bestEquipment).map(([type, item]) => (
        <EquipmentCard key={type} type={type} item={item} />
      ))}
    </div>
  );
};

export default EquipmentGrid;
