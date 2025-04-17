import React from "react";

const TextInputArea = ({ textInput, setTextInput, onCalculate }) => {
  return (
    <div className="flex flex-col items-center mb-6">
      <textarea
        className="p-2 bg-gray-800 text-white rounded-md border border-gray-600 w-80 h-32"
        value={textInput}
        onChange={(e) => setTextInput(e.target.value)}
        placeholder="Paste damage data here..."
      ></textarea>
      <button
        className="mt-3 px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-700"
        onClick={onCalculate}
      >
        Calculate Best Equipment
      </button>
    </div>
  );
};

export default TextInputArea;
