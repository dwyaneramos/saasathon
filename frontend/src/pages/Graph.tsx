import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import GraphView from "@/components/GraphView";
import UploadPanel from "@/components/UploadPanel";
import { useSidebar } from "@/components/ui/sidebar";

export default function Graph() {
  const [is2D, setIs2D] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isMobile, state } = useSidebar();
  const isUploadOpen = useMemo(
    () => searchParams.get("upload") === "1",
    [searchParams],
  );
  const toggleButtonLeft = isMobile
    ? "1rem"
    : state === "expanded"
      ? "calc(var(--sidebar-width) + 1.5rem)"
      : "calc(var(--sidebar-width-icon) + 1.5rem)";

  useEffect(() => {
    console.log(`Graph mode changed: ${is2D ? "2D" : "3D"}`);
  }, [is2D]);

  const closeUploadModal = () => {
    navigate("/graph", { replace: true });
  };

  return (
    <div className="graph-page relative h-[calc(100svh-var(--header-height))] w-full overflow-hidden bg-transparent">
      <button
        onClick={() => setIs2D(!is2D)}
        className="absolute top-6 z-20 rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-700 transition"
        style={{ left: toggleButtonLeft }}
      >
        {is2D ? "Switch to 3D" : "Switch to 2D"}
      </button>

      <div className="absolute inset-0 z-0">
        <GraphView is2D={is2D} />
      </div>

      {isUploadOpen && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/35 p-6 backdrop-blur-sm"
          onClick={closeUploadModal}
        >
          <div
            className="relative h-[min(860px,calc(100%-3rem))] w-[min(980px,calc(100%-3rem))] overflow-y-auto rounded-3xl border border-white/70 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-modal-title"
          >
            <button
              type="button"
              onClick={closeUploadModal}
              className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900"
              aria-label="Close upload modal"
            >
              <X size={18} />
            </button>

            <UploadPanel
              title="Upload files"
              description="Drop files into the graph from this centered upload modal."
              className="h-full p-6 md:p-8"
            />
          </div>
        </div>
      )}
    </div>
  );
}
