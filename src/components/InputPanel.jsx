import React from "react";

const InputPanel = ({
  textInput,
  setTextInput,
  onCalculate,
  showDetails,
  setShowDetails,
}) => {
  return (
    <div className="flex flex-col items-center mb-6">
      <div className="mt-4 flex items-center gap-2">
        <input
          type="checkbox"
          id="detailsToggle"
          checked={showDetails}
          onChange={(e) => setShowDetails(e.target.checked)}
          className="form-checkbox accent-blue-500"
        />
        <label htmlFor="detailsToggle" className="text-sm">
          Show item details
        </label>
      </div>

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

export default InputPanel;
