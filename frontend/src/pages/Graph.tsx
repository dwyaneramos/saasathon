import { useEffect, useState } from "react";
import GraphView from "@/components/GraphView";

export default function Graph() {
  const [is2D, setIs2D] = useState(true);

  useEffect(() => {
    console.log(`Graph mode changed: ${is2D ? "2D" : "3D"}`);
  }, [is2D]);

  return (
    <div className="graph-page p-4 relative w-full h-screen overflow-hidden">
      <button
        onClick={() => setIs2D(!is2D)}
        className="absolute top-5 left-10 z-20 px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-700 transition"
      >
        {is2D ? "Switch to 3D" : "Switch to 2D"}
      </button>

      <div className="absolute inset-0 left-32 z-0">
        <GraphView is2D={is2D} />
      </div>
    </div>
  );
}