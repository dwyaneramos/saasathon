import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useNavigate,
  useOutletContext,
  useSearchParams,
} from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import GraphView from "@/components/GraphView";
import { apiBaseUrl } from "@/lib/api";
import { fileIconFor } from "@/lib/file-icons";
import { fileTreeUpdatedEvent } from "@/components/app-sidebar";
import type {
  CategorySummary,
  DocumentSummary,
  GraphNode,
} from "@/types/graph";

type GraphMode = "categories" | "files";
type CategoriesResponse = { categories?: CategorySummary[]; error?: string };
type DocumentsResponse = { documents?: DocumentSummary[]; error?: string };

type AppLayoutContext = {
  activeSpaceId: number | null;
  activeSpaceName: string | null;
};

export default function Graph() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeSpaceId, activeSpaceName } =
    useOutletContext<AppLayoutContext>();
  const [is2D, setIs2D] = useState(true);
  const [mode, setMode] = useState<GraphMode>("categories");
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [graphRefreshKey, setGraphRefreshKey] = useState(0);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipFrameRef = useRef<HTMLDivElement>(null);
  const cursorPosRef = useRef({ x: 0, y: 0 });
  const hoveredNodeIdRef = useRef<string | null>(null);
  const tooltipHoveredRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipFrameSize, setTooltipFrameSize] = useState({
    width: 0,
    height: 0,
  });
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const requestedCategoryId = useMemo(() => {
    const rawValue = searchParams.get("categoryId");
    if (!rawValue) return null;

    const parsedValue = Number(rawValue);
    return Number.isInteger(parsedValue) && parsedValue > 0
      ? parsedValue
      : null;
  }, [searchParams]);

  const hideTooltip = useCallback(() => {
    setTooltipVisible(false);
    setHoveredNode(null);
    setTooltipFrameSize({ width: 0, height: 0 });
    hoveredNodeIdRef.current = null;
  }, []);

  useEffect(() => {
    const handleFileTreeUpdated = () => {
      setGraphRefreshKey((key) => key + 1);
      hideTooltip();
    };

    window.addEventListener(fileTreeUpdatedEvent, handleFileTreeUpdated);
    return () => {
      window.removeEventListener(fileTreeUpdatedEvent, handleFileTreeUpdated);
    };
  }, [hideTooltip]);

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
  }, [activeSpaceId, graphRefreshKey]);

  useEffect(() => {
    if (requestedCategoryId == null) {
      setActiveCategoryId(null);
      setMode("categories");
      return;
    }

    if (categories.length === 0) {
      return;
    }

    const matchingCategory = categories.find(
      (category) => category.id === requestedCategoryId,
    );

    if (matchingCategory) {
      setActiveCategoryId(matchingCategory.id);
      setMode("files");
      return;
    }

    setActiveCategoryId(null);
    setMode("categories");
  }, [categories, requestedCategoryId]);

  // Track viewport mouse position without re-rendering.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateViewportSize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    const resizeFrame = requestAnimationFrame(updateViewportSize);
    const handleMouseMove = (e: MouseEvent) => {
      cursorPosRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener("resize", updateViewportSize);
    container.addEventListener("mousemove", handleMouseMove);
    return () => {
      cancelAnimationFrame(resizeFrame);
      window.removeEventListener("resize", updateViewportSize);
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

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!tooltipHoveredRef.current) {
        hideTooltip();
      }
    }, 110);
  }, [hideTooltip]);

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const handleNodeHover = useCallback(
    (node: GraphNode | null, anchor?: { x: number; y: number }) => {
      if (node) {
        cancelHide();

        if (hoveredNodeIdRef.current !== node.id) {
          hoveredNodeIdRef.current = node.id;
          setTooltipFrameSize({ width: 0, height: 0 });
          setTooltipAnchor(anchor ?? cursorPosRef.current);
        }

        setHoveredNode(node);
        setTooltipVisible(true);
        return;
      }

      scheduleHide();
    },
    [cancelHide, scheduleHide],
  );

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
        fileSize: document.fileSize,
        summary: document.summary,
        mimeType: document.mimeType,
      }));
  }, [activeCategoryId, documents]);

  const currentNodes = mode === "categories" ? categoryNodes : fileNodes;
  const activeCategory = useMemo(
    () =>
      categories.find((category) => category.id === activeCategoryId) ?? null,
    [activeCategoryId, categories],
  );

  useEffect(() => {
    if (activeCategoryId == null) return;
    if (categories.some((category) => category.id === activeCategoryId)) return;

    hideTooltip();
    setActiveCategoryId(null);
    setMode("categories");
  }, [activeCategoryId, categories, hideTooltip]);

  const currentMatrix = useMemo(
    () => buildConnectedMatrix(currentNodes.length),
    [currentNodes.length],
  );

  const handleNodeClick = (node: GraphNode) => {
    if (mode === "categories" && node.categoryId) {
      hideTooltip();
      navigate(`/graph?categoryId=${node.categoryId}`);
      return;
    }

    if (mode === "files" && node.documentId) {
      navigate(`/file/${node.documentId}`);
    }
  };

  const handleTooltipAction = () => {
    if (!hoveredNode) return;
    handleNodeClick(hoveredNode);
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

  useEffect(() => {
    if (!showTooltip || !hoveredNode?.documentId || (!isImagePreview && !isPdfPreview)) {
      setPreviewObjectUrl(null);
      setIsPreviewLoading(false);
      return;
    }

    const abortController = new AbortController();
    let objectUrl: string | null = null;
    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    setIsPreviewLoading(true);
    setPreviewObjectUrl(null);

    async function loadPreview() {
      try {
        const response = await fetch(documentPreviewUrl, {
          headers,
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error("Could not load preview");
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setPreviewObjectUrl(objectUrl);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setPreviewObjectUrl(null);
      } finally {
        if (!abortController.signal.aborted) {
          setIsPreviewLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      abortController.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [
    documentPreviewUrl,
    hoveredNode?.documentId,
    isImagePreview,
    isPdfPreview,
    showTooltip,
  ]);

  // Tooltip positioning: anchor once per hovered node and keep the whole hover frame in the viewport.
  const TOOLTIP_WIDTH = 320;
  const TOOLTIP_OFFSET = 28;
  const TOOLTIP_BRIDGE = 8;
  const TOOLTIP_EDGE_GAP = 8;
  const tooltipStyle = useMemo(() => {
    const clamp = (value: number, min: number, max: number) =>
      Math.min(Math.max(value, min), max);
    const availableCardWidth = viewportSize.width
      ? viewportSize.width - TOOLTIP_EDGE_GAP * 2 - TOOLTIP_BRIDGE * 2
      : TOOLTIP_WIDTH;
    const width = viewportSize.width
      ? Math.max(0, Math.min(TOOLTIP_WIDTH, availableCardWidth))
      : TOOLTIP_WIDTH;
    const maxCardHeight = viewportSize.height
      ? Math.max(
          0,
          viewportSize.height - TOOLTIP_EDGE_GAP * 2 - TOOLTIP_BRIDGE * 2,
        )
      : undefined;
    const summaryLength = hoveredNode?.summary?.length ?? 0;
    const estimatedSummaryLines = Math.max(1, Math.ceil(summaryLength / 52));
    const estimatedCategoryHeight = Math.min(
      120 + estimatedSummaryLines * 20 + hoveredCategoryFiles.length * 36,
      520,
    );
    const estimatedCardHeight = Math.min(
      isDocumentTooltip ? 420 : estimatedCategoryHeight,
      maxCardHeight ?? Number.POSITIVE_INFINITY,
    );
    const measuredFrameWidth = tooltipFrameSize.width || 0;
    const measuredFrameHeight = tooltipFrameSize.height || 0;
    const frameWidth = measuredFrameWidth || width + TOOLTIP_BRIDGE * 2;
    const frameHeight =
      measuredFrameHeight || estimatedCardHeight + TOOLTIP_BRIDGE * 2;
    const cardHeight = measuredFrameHeight
      ? Math.max(0, measuredFrameHeight - TOOLTIP_BRIDGE * 2)
      : estimatedCardHeight;

    let cardX = tooltipAnchor.x + TOOLTIP_OFFSET;
    let cardY = tooltipAnchor.y + TOOLTIP_OFFSET;

    if (
      viewportSize.width &&
      cardX + width + TOOLTIP_BRIDGE > viewportSize.width - TOOLTIP_EDGE_GAP
    ) {
      cardX = tooltipAnchor.x - width - TOOLTIP_OFFSET;
    }

    if (
      viewportSize.height &&
      cardY + cardHeight + TOOLTIP_BRIDGE >
        viewportSize.height - TOOLTIP_EDGE_GAP
    ) {
      cardY = tooltipAnchor.y - cardHeight - TOOLTIP_OFFSET;
    }

    const frameX = viewportSize.width
      ? clamp(
          cardX - TOOLTIP_BRIDGE,
          TOOLTIP_EDGE_GAP,
          Math.max(
            TOOLTIP_EDGE_GAP,
            viewportSize.width - frameWidth - TOOLTIP_EDGE_GAP,
          ),
        )
      : cardX - TOOLTIP_BRIDGE;
    const frameY = viewportSize.height
      ? clamp(
          cardY - TOOLTIP_BRIDGE,
          TOOLTIP_EDGE_GAP,
          Math.max(
            TOOLTIP_EDGE_GAP,
            viewportSize.height - frameHeight - TOOLTIP_EDGE_GAP,
          ),
        )
      : cardY - TOOLTIP_BRIDGE;

    return { left: frameX, top: frameY, width, maxHeight: maxCardHeight };
  }, [
    hoveredCategoryFiles.length,
    hoveredNode?.summary,
    isDocumentTooltip,
    tooltipAnchor,
    tooltipFrameSize.height,
    tooltipFrameSize.width,
    viewportSize.height,
    viewportSize.width,
  ]);

  useLayoutEffect(() => {
    if (!showTooltip) return;

    const tooltipFrame = tooltipFrameRef.current;
    if (!tooltipFrame) return;

    const updateTooltipFrameSize = () => {
      const rect = tooltipFrame.getBoundingClientRect();
      setTooltipFrameSize((current) => {
        const nextWidth = Math.ceil(rect.width);
        const nextHeight = Math.ceil(rect.height);

        if (current.width === nextWidth && current.height === nextHeight) {
          return current;
        }

        return { width: nextWidth, height: nextHeight };
      });
    };
    updateTooltipFrameSize();

    const resizeObserver = new ResizeObserver(updateTooltipFrameSize);
    resizeObserver.observe(tooltipFrame);
    return () => resizeObserver.disconnect();
  }, [
    showTooltip,
    hoveredNode?.id,
    tooltipStyle.maxHeight,
    tooltipStyle.width,
  ]);

  return (
    <div
      ref={containerRef}
      className="graph-page relative h-[calc(100vh-var(--header-height)-1rem)] min-h-[calc(100vh-var(--header-height)-1rem)] overflow-hidden rounded-2xl border border-stone-200 bg-stone-50"
    >
      <div className="absolute left-5 top-5 z-20">
        <Breadcrumb>
          <BreadcrumbList className="rounded-lg border border-stone-200/80 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm">
            <BreadcrumbItem>
              {activeCategory ? (
                <BreadcrumbLink asChild>
                  <button
                    type="button"
                    onClick={() => {
                      hideTooltip();
                      navigate("/graph");
                    }}
                    className="cursor-pointer"
                  >
                    {activeSpaceName ?? "Space"}
                  </button>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{activeSpaceName ?? "Space"}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {activeCategory ? (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{activeCategory.name}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : null}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {mode === "files" ? (
        <div className="absolute bottom-5 left-5 z-20">
          <button
            onClick={() => {
              hideTooltip();
              navigate("/graph");
            }}
            className="rounded border border-stone-300 bg-white px-4 py-2 text-stone-700 shadow-sm transition hover:bg-stone-100"
          >
            Back
          </button>
        </div>
      ) : null}

      <div className="absolute right-5 bottom-5 z-20 flex gap-3">
        <button
          onClick={() => setIs2D((current) => !current)}
          className="rounded bg-accent px-4 py-2 text-black transition hover:bg-gray-700"
        >
          {is2D ? "Switch to 3D" : "Switch to 2D"}
        </button>

      </div>

      {/* Anchored tooltip with a hover bridge so the card can be entered. */}
      {showTooltip && (
        <div
          ref={tooltipFrameRef}
          className="pointer-events-none fixed z-50 p-2"
          style={{
            left: tooltipStyle.left,
            top: tooltipStyle.top,
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
          <div
            className="pointer-events-auto overflow-y-auto overflow-x-hidden rounded-xl border border-stone-200 bg-white/95 shadow-xl backdrop-blur-sm"
            style={{
              width: tooltipStyle.width,
              maxHeight: tooltipStyle.maxHeight,
            }}
          >
            {isCategoryTooltip ? (
              <>
                <div className="border-b border-stone-100 px-4 py-3">
                  <p className="text-sm font-semibold text-stone-900">
                    {hoveredNode!.label}
                  </p>
                  <p className="mt-1 break-words text-xs leading-5 text-stone-600">
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
                      const FileIcon = fileIconFor({
                        name,
                        filename: name,
                        mimeType: doc.mimeType,
                      });
                      return (
                        <li key={doc.id}>
                          <button
                            type="button"
                            onClick={() => navigate(`/file/${doc.id}`)}
                            className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-stone-50"
                            title={name}
                          >
                            <span className="flex size-6 flex-shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-500">
                              <FileIcon className="size-3.5" />
                            </span>
                            <span className="truncate text-xs text-stone-700">
                              {name}
                            </span>
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>

                <div className="border-t border-stone-100 px-4 py-2">
                  <button
                    type="button"
                    onClick={handleTooltipAction}
                    className="w-full rounded-md bg-stone-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-stone-700"
                  >
                    Explore files
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="border-b border-stone-100 px-4 py-3">
                  <p className="text-sm font-semibold text-stone-900">
                    {hoveredNode!.label}
                  </p>
                  <p className="mt-1 break-words text-xs leading-5 text-stone-600">
                    {hoveredNode!.summary || "No document summary yet."}
                  </p>
                </div>

                <div className="border-b border-stone-100 bg-stone-100/70 p-3">
                  <div className="flex h-[180px] items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-white">
                    {isPreviewLoading ? (
                      <p className="px-4 text-center text-xs leading-5 text-stone-500">
                        Loading preview...
                      </p>
                    ) : isImagePreview && previewObjectUrl ? (
                      <img
                        src={previewObjectUrl}
                        alt={`${hoveredNode!.label} preview`}
                        className="h-full w-full object-cover"
                      />
                    ) : isPdfPreview && previewObjectUrl ? (
                      <iframe
                        src={`${previewObjectUrl}#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0`}
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
                  <button
                    type="button"
                    onClick={handleTooltipAction}
                    className="w-full rounded-md bg-stone-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-stone-700"
                  >
                    Open file page
                  </button>
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
        ) : mode === "files" ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div className="max-w-sm">
              <p className="text-sm font-semibold text-stone-900">
                No documents in {activeCategory?.name ?? "this category"}
              </p>
              <p className="mt-2 text-xs leading-5 text-stone-500">
                Add documents to this category to build its file graph.
              </p>
            </div>
          </div>
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
