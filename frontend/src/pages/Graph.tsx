import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import GraphView from "@/components/GraphView";
import type {
	CategorySummary,
	DocumentSummary,
	GraphNode,
} from "@/types/graph";

type GraphMode = "categories" | "files";
type CategoriesResponse = { categories?: CategorySummary[]; error?: string };
type DocumentsResponse = { documents?: DocumentSummary[]; error?: string };

const apiBaseUrl = "http://localhost:3000/api/v1";

type AppLayoutContext = {
	activeSpaceId: number | null;
};

export default function Graph() {
  const navigate = useNavigate();
  const { activeSpaceId } = useOutletContext<AppLayoutContext>();
  const [is2D, setIs2D] = useState(true);
  const [mode, setMode] = useState<GraphMode>("categories");
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorPosRef = useRef({ x: 0, y: 0 });
  const hoveredNodeIdRef = useRef<string | null>(null);
  const tooltipHoveredRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  useEffect(() => {
    let ignore = false;
    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    if (!activeSpaceId) {
      setCategories([]);
      setDocuments([]);
      return () => {
        ignore = true;
      };
    }

    async function loadGraphData() {
      const query = `?spaceId=${activeSpaceId}`;
      const [categoriesResponse, documentsResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/categories${query}`, { headers }),
        fetch(`${apiBaseUrl}/documents${query}`, { headers }),
      ]);

      const categoriesPayload = (await categoriesResponse
        .json()
        .catch(() => null)) as CategoriesResponse | null;
      const documentsPayload = (await documentsResponse
        .json()
        .catch(() => null)) as DocumentsResponse | null;

      if (!categoriesResponse.ok || !documentsResponse.ok) {
        return;
      }

      if (!ignore) {
        setCategories(categoriesPayload?.categories ?? []);
        setDocuments(documentsPayload?.documents ?? []);
      }
    }

    loadGraphData();

    return () => {
      ignore = true;
    };
  }, [activeSpaceId]);

  // Track mouse position relative to the container without re-rendering.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateContainerSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };
    const resizeFrame = requestAnimationFrame(updateContainerSize);
    const resizeObserver = new ResizeObserver(updateContainerSize);
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      cursorPosRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    resizeObserver.observe(container);
    container.addEventListener("mousemove", handleMouseMove);
    return () => {
      cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      container.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  const scheduleHide = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!tooltipHoveredRef.current) {
        setTooltipVisible(false);
        setHoveredNode(null);
        hoveredNodeIdRef.current = null;
      }
    }, 200);
  };

  const cancelHide = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const handleNodeHover = (node: GraphNode | null) => {
    if (node) {
      cancelHide();

      if (hoveredNodeIdRef.current !== node.id) {
        hoveredNodeIdRef.current = node.id;
        setTooltipAnchor(cursorPosRef.current);
      }

      setHoveredNode(node);
      setTooltipVisible(true);
      return;
    }

    scheduleHide();
  };

  const categoryNodes = useMemo<GraphNode[]>(() => {
    return categories.map((category) => ({
      id: `category-${category.id}`,
      label: category.name,
      categoryId: category.id,
      fileCount: documents.filter(
        (document) => document.categoryId === category.id,
      ).length,
      summary: category.summary,
    }));
  }, [categories, documents]);

  const fileNodes = useMemo<GraphNode[]>(() => {
    return documents
      .filter((document) => document.categoryId === activeCategoryId)
      .map((document) => ({
        id: `document-${document.id}`,
        label:
          document.originalFileName || document.fileName || document.filename,
        documentId: document.id,
        summary: document.summary,
        mimeType: document.mimeType,
      }));
  }, [activeCategoryId, documents]);

  const currentNodes = mode === "categories" ? categoryNodes : fileNodes;
  const currentMatrix = useMemo(
    () => buildConnectedMatrix(currentNodes.length),
    [currentNodes.length],
  );

  const handleNodeClick = (node: GraphNode) => {
    if (mode === "categories" && node.categoryId) {
      setTooltipVisible(false);
      setHoveredNode(null);
      hoveredNodeIdRef.current = null;
      setActiveCategoryId(node.categoryId);
      setMode("files");
      return;
    }

    if (mode === "files" && node.documentId) {
      navigate(`/file/${node.documentId}`);
    }
  };

  // Files belonging to the hovered category
  const hoveredCategoryFiles = useMemo(() => {
    if (mode !== "categories" || !hoveredNode?.categoryId) return [];
    return documents.filter((doc) => doc.categoryId === hoveredNode.categoryId);
  }, [hoveredNode, documents, mode]);

  const isDocumentTooltip = mode === "files" && hoveredNode?.documentId != null;
  const isCategoryTooltip =
    mode === "categories" && hoveredNode?.categoryId != null;
  const showTooltip =
    tooltipVisible && (isCategoryTooltip || isDocumentTooltip);
  const documentPreviewUrl = hoveredNode?.documentId
    ? `${apiBaseUrl}/documents/${hoveredNode.documentId}/file`
    : "";
  const isImagePreview = Boolean(hoveredNode?.mimeType?.startsWith("image/"));
  const isPdfPreview = hoveredNode?.mimeType === "application/pdf";

  // Tooltip positioning: anchor once per hovered node and keep it on screen.
  const TOOLTIP_WIDTH = 320;
  const TOOLTIP_OFFSET = 16;
  const TOOLTIP_BRIDGE = 18;
  const tooltipStyle = useMemo(() => {
    let x = tooltipAnchor.x + TOOLTIP_OFFSET;
    let y = tooltipAnchor.y + TOOLTIP_OFFSET;

    if (containerSize.width && x + TOOLTIP_WIDTH > containerSize.width - 8) {
      x = tooltipAnchor.x - TOOLTIP_WIDTH - TOOLTIP_OFFSET;
    }

    const estimatedHeight = isDocumentTooltip
      ? 420
      : Math.min(120 + hoveredCategoryFiles.length * 36, 360);
    if (containerSize.height && y + estimatedHeight > containerSize.height - 8) {
      y = containerSize.height - estimatedHeight - 8;
    }

    return { left: x, top: y };
  }, [
    containerSize.height,
    containerSize.width,
    hoveredCategoryFiles.length,
    isDocumentTooltip,
    tooltipAnchor,
  ]);

  return (
    <div
      ref={containerRef}
      className="graph-page relative flex-1 overflow-hidden rounded-2xl border border-stone-200 bg-stone-50"
    >
      <div className="absolute left-5 top-5 z-20 flex gap-3">
        <button
          onClick={() => setIs2D((current) => !current)}
          className="rounded bg-gray-900 px-4 py-2 text-white transition hover:bg-gray-700"
        >
          {is2D ? "Switch to 3D" : "Switch to 2D"}
        </button>

        {mode === "files" ? (
          <button
            onClick={() => {
              setTooltipVisible(false);
              setHoveredNode(null);
              hoveredNodeIdRef.current = null;
              setMode("categories");
              setActiveCategoryId(null);
            }}
            className="rounded border border-stone-300 bg-white px-4 py-2 text-stone-700 transition hover:bg-stone-100"
          >
            Back
          </button>
        ) : null}
      </div>

      {/* Anchored tooltip with a hover bridge so the card can be entered. */}
      {showTooltip && (
        <div
          className="absolute z-30 p-[18px]"
          style={{
            left: tooltipStyle.left - TOOLTIP_BRIDGE,
            top: tooltipStyle.top - TOOLTIP_BRIDGE,
          }}
          onMouseEnter={() => {
            tooltipHoveredRef.current = true;
            cancelHide();
          }}
          onMouseLeave={() => {
            tooltipHoveredRef.current = false;
            scheduleHide();
          }}
        >
          <div className="w-[320px] overflow-hidden rounded-xl border border-stone-200 bg-white/95 shadow-xl backdrop-blur-sm">
            {isCategoryTooltip ? (
            <>
              <div className="border-b border-stone-100 px-4 py-3">
                <p className="text-sm font-semibold text-stone-900">
                  {hoveredNode!.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-stone-600">
                  {hoveredNode!.summary || "No category summary yet."}
                </p>
                <p className="mt-2 text-xs text-stone-500">
                  {hoveredCategoryFiles.length} file
                  {hoveredCategoryFiles.length === 1 ? "" : "s"}
                </p>
              </div>

              <ul className="max-h-[260px] overflow-y-auto py-1">
                {hoveredCategoryFiles.length === 0 ? (
                  <li className="px-4 py-3 text-xs text-stone-400 italic">
                    No files in this category
                  </li>
                ) : (
                  hoveredCategoryFiles.map((doc) => {
                    const name =
                      doc.originalFileName || doc.fileName || doc.filename;
                    const ext = name.split(".").pop()?.toUpperCase() ?? "";
                    return (
                      <li
                        key={doc.id}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-stone-50"
                      >
                        <span className="flex-shrink-0 rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-stone-500">
                          {ext || "—"}
                        </span>
                        <span
                          className="truncate text-xs text-stone-700"
                          title={name}
                        >
                          {name}
                        </span>
                      </li>
                    );
                  })
                )}
              </ul>

              <div className="border-t border-stone-100 px-4 py-2">
                <p className="text-[10px] text-stone-400">
                  Click to explore files
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="border-b border-stone-100 px-4 py-3">
                <p className="text-sm font-semibold text-stone-900">
                  {hoveredNode!.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-stone-600">
                  {hoveredNode!.summary || "No document summary yet."}
                </p>
              </div>

              <div className="border-b border-stone-100 bg-stone-100/70 p-3">
                <div className="flex h-[180px] items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-white">
                  {isImagePreview ? (
                    <img
                      src={documentPreviewUrl}
                      alt={`${hoveredNode!.label} preview`}
                      className="h-full w-full object-cover"
                    />
                  ) : isPdfPreview ? (
                    <iframe
                      src={`${documentPreviewUrl}#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0`}
                      title={`${hoveredNode!.label} preview`}
                      className="h-full w-full border-0"
                    />
                  ) : (
                    <p className="px-4 text-center text-xs leading-5 text-stone-500">
                      Preview unavailable for this file type.
                    </p>
                  )}
                </div>
              </div>

              <div className="px-4 py-2">
                <p className="text-[10px] text-stone-400">
                  Click to open file page
                </p>
              </div>
            </>
            )}
          </div>
        </div>
      )}

      <div className="absolute inset-0 z-0">
        {currentNodes.length > 0 ? (
          <GraphView
            is2D={is2D}
            nodes={currentNodes}
            weightMatrix={currentMatrix}
            threshold={0.16}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
          />
        ) : null}
      </div>
    </div>
  );
}

function buildConnectedMatrix(nodeCount: number) {
	const matrix: number[][] = Array.from({ length: nodeCount }, () =>
		Array.from({ length: nodeCount }, () => 0),
	);

	for (let i = 0; i < nodeCount; i++) {
		for (let j = i + 1; j < nodeCount; j++) {
			let weight = 0.08;

			if (Math.abs(i - j) === 1) {
				weight = 0.42;
			}

			if (
				(i === 0 && j === nodeCount - 1) ||
				(j === 0 && i === nodeCount - 1)
			) {
				weight = Math.max(weight, 0.28);
			}

			matrix[i][j] = weight;
			matrix[j][i] = weight;
		}
	}

	return matrix;
}
