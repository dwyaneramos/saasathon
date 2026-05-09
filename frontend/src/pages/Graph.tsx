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
import { ArrowLeft, Box, SquareStack } from "lucide-react";
import GraphView from "@/components/GraphView";
import { Button } from "@/components/ui/button";
import { fileIconFor } from "@/lib/file-icons";
import { fileTreeUpdatedEvent } from "@/components/app-sidebar";
import type {
	CategoryConnectionSummary,
	CategorySummary,
	DocumentSummary,
	GraphNode,
} from "@/types/graph";

type GraphMode = "categories" | "files";
type CategoriesResponse = {
	categories?: CategorySummary[];
	connections?: CategoryConnectionSummary[];
	error?: string;
};
type DocumentsResponse = { documents?: DocumentSummary[]; error?: string };

const apiBaseUrl = "http://localhost:3000/api/v1";

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
	const [categoryConnections, setCategoryConnections] = useState<
		CategoryConnectionSummary[]
	>([]);
	const [documents, setDocuments] = useState<DocumentSummary[]>([]);
	const [graphRefreshKey, setGraphRefreshKey] = useState(0);
	const [activeCategoryId, setActiveCategoryId] = useState<number | null>(
		null,
	);
	const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
	const [tooltipAnchor, setTooltipAnchor] = useState<{
		x: number;
		y: number;
	}>({
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
			window.removeEventListener(
				fileTreeUpdatedEvent,
				handleFileTreeUpdated,
			);
		};
	}, [hideTooltip]);

	useEffect(() => {
		let ignore = false;
		const token = localStorage.getItem("token");
		const headers = token
			? { Authorization: `Bearer ${token}` }
			: undefined;

		if (!activeSpaceId) {
			setCategories([]);
			setCategoryConnections([]);
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
				setCategoryConnections(categoriesPayload?.connections ?? []);
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
					document.originalFileName ||
					document.fileName ||
					document.filename,
				documentId: document.id,
				fileSize: document.fileSize,
				summary: document.summary,
				mimeType: document.mimeType,
			}));
	}, [activeCategoryId, documents]);

	const currentNodes = mode === "categories" ? categoryNodes : fileNodes;
	const activeCategory = useMemo(
		() =>
			categories.find((category) => category.id === activeCategoryId) ??
			null,
		[activeCategoryId, categories],
	);

	useEffect(() => {
		if (activeCategoryId == null) return;
		if (categories.some((category) => category.id === activeCategoryId))
			return;

		hideTooltip();
		setActiveCategoryId(null);
		setMode("categories");
	}, [activeCategoryId, categories, hideTooltip]);

	const categoryMatrix = useMemo(
		() => buildCategoryConnectionMatrix(categoryNodes, categoryConnections),
		[categoryConnections, categoryNodes],
	);
	const fileMatrix = useMemo(
		() => buildEmptyMatrix(fileNodes.length),
		[fileNodes.length],
	);
	const currentMatrix = mode === "categories" ? categoryMatrix : fileMatrix;

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
		return documents.filter(
			(doc) => doc.categoryId === hoveredNode.categoryId,
		);
	}, [hoveredNode, documents, mode]);

	const isDocumentTooltip =
		mode === "files" && hoveredNode?.documentId != null;
	const isCategoryTooltip =
		mode === "categories" && hoveredNode?.categoryId != null;
	const showTooltip =
		tooltipVisible && (isCategoryTooltip || isDocumentTooltip);
	const documentPreviewUrl = hoveredNode?.documentId
		? `${apiBaseUrl}/documents/${hoveredNode.documentId}/file`
		: "";
	const isImagePreview = Boolean(hoveredNode?.mimeType?.startsWith("image/"));
	const isPdfPreview = hoveredNode?.mimeType === "application/pdf";

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
					viewportSize.height -
						TOOLTIP_EDGE_GAP * 2 -
						TOOLTIP_BRIDGE * 2,
				)
			: undefined;
		const summaryLength = hoveredNode?.summary?.length ?? 0;
		const estimatedSummaryLines = Math.max(
			1,
			Math.ceil(summaryLength / 52),
		);
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
			cardX + width + TOOLTIP_BRIDGE >
				viewportSize.width - TOOLTIP_EDGE_GAP
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

				if (
					current.width === nextWidth &&
					current.height === nextHeight
				) {
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
			className="graph-page relative h-[calc(100vh-var(--header-height)-1rem)] min-h-[calc(100vh-var(--header-height)-1rem)] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50"
		>
			<div className="absolute top-5 left-5 z-20">
				<Breadcrumb>
					<BreadcrumbList className="rounded-lg border border-zinc-200/80 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm">
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
								<BreadcrumbPage>
									{activeSpaceName ?? "Space"}
								</BreadcrumbPage>
							)}
						</BreadcrumbItem>
						{activeCategory ? (
							<>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									<BreadcrumbPage>
										{activeCategory.name}
									</BreadcrumbPage>
								</BreadcrumbItem>
							</>
						) : null}
					</BreadcrumbList>
				</Breadcrumb>
			</div>

			<div className="absolute right-5 bottom-5 z-20 flex items-center gap-2 rounded-xl border border-zinc-200 bg-white/90 p-1.5 shadow-sm backdrop-blur-md">
				{mode === "files" ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => {
							hideTooltip();
							navigate("/graph");
						}}
						className="border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
					>
						<ArrowLeft className="size-3.5" />
						Back
					</Button>
				) : null}

				<Button
					type="button"
					variant="accent"
					size="sm"
					onClick={() => setIs2D((current) => !current)}
					className="min-w-28"
				>
					{is2D ? (
						<Box className="size-3.5" />
					) : (
						<SquareStack className="size-3.5" />
					)}
					{is2D ? "Switch to 3D" : "Switch to 2D"}
				</Button>
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
						className="pointer-events-auto overflow-y-auto overflow-x-hidden rounded-xl border border-zinc-200 bg-white/95 shadow-sm backdrop-blur-md"
						style={{
							width: tooltipStyle.width,
							maxHeight: tooltipStyle.maxHeight,
						}}
					>
						{isCategoryTooltip ? (
							<>
								<div className="border-b border-zinc-100 px-4 py-3">
									<div className="flex items-start justify-between gap-3">
										<p className="min-w-0 break-words text-sm font-semibold text-zinc-900">
											{hoveredNode!.label}
										</p>
										<span className="shrink-0 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-500">
											{hoveredCategoryFiles.length} file
											{hoveredCategoryFiles.length === 1
												? ""
												: "s"}
										</span>
									</div>
									<p className="mt-2 break-words text-xs leading-5 text-zinc-600">
										{hoveredNode!.summary ||
											"No category summary yet."}
									</p>
								</div>

								<ul className="max-h-[260px] overflow-y-auto py-1">
									{hoveredCategoryFiles.length === 0 ? (
										<li className="px-4 py-3 text-xs text-zinc-400 italic">
											No files in this category
										</li>
									) : (
										hoveredCategoryFiles.map((doc) => {
											const name =
												doc.originalFileName ||
												doc.fileName ||
												doc.filename;
											const FileIcon = fileIconFor({
												name,
												filename: name,
												mimeType: doc.mimeType,
											});
											return (
												<li key={doc.id}>
													<button
														type="button"
														onClick={() =>
															navigate(
																`/file/${doc.id}`,
															)
														}
														className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-zinc-50"
														title={name}
													>
														<span className="flex size-6 flex-shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-500">
															<FileIcon className="size-3.5" />
														</span>
														<span className="truncate text-xs text-zinc-700">
															{name}
														</span>
													</button>
												</li>
											);
										})
									)}
								</ul>

								<div className="border-t border-zinc-100 px-4 py-3">
									<Button
										type="button"
										variant="accent"
										size="sm"
										onClick={handleTooltipAction}
										className="w-full"
									>
										Explore files
									</Button>
								</div>
							</>
						) : (
							<>
								<div className="border-b border-zinc-100 px-4 py-3">
									<p className="text-sm font-semibold text-zinc-900">
										{hoveredNode!.label}
									</p>
									<p className="mt-2 break-words text-xs leading-5 text-zinc-600">
										{hoveredNode!.summary ||
											"No document summary yet."}
									</p>
								</div>

								<div className="border-b border-zinc-100 bg-zinc-50 p-3">
									<div className="flex h-[180px] items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-white">
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
											<p className="px-4 text-center text-xs leading-5 text-zinc-500">
												Preview unavailable for this
												file type.
											</p>
										)}
									</div>
								</div>

								<div className="px-4 py-3">
									<Button
										type="button"
										variant="accent"
										size="sm"
										onClick={handleTooltipAction}
										className="w-full"
									>
										Open file page
									</Button>
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
						threshold={mode === "categories" ? 0.08 : 0.16}
						onNodeClick={handleNodeClick}
						onNodeHover={handleNodeHover}
					/>
				) : mode === "files" ? (
					<div className="flex h-full items-center justify-center px-6 text-center">
						<div className="max-w-sm">
							<p className="text-sm font-semibold text-zinc-900">
								No documents in{" "}
								{activeCategory?.name ?? "this category"}
							</p>
							<p className="mt-2 text-xs leading-5 text-zinc-500">
								Add documents to this category to build its file
								graph.
							</p>
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}

function buildEmptyMatrix(nodeCount: number) {
	const matrix: number[][] = Array.from({ length: nodeCount }, () =>
		Array.from({ length: nodeCount }, () => 0),
	);

	return matrix;
}

function buildCategoryConnectionMatrix(
	nodes: GraphNode[],
	connections: CategoryConnectionSummary[],
) {
	const matrix = Array.from({ length: nodes.length }, () =>
		Array.from({ length: nodes.length }, () => 0),
	);
	const indexByCategoryId = new Map<number, number>();

	nodes.forEach((node, index) => {
		if (node.categoryId != null) {
			indexByCategoryId.set(node.categoryId, index);
		}
	});

	connections.forEach((connection) => {
		const sourceIndex = indexByCategoryId.get(connection.sourceCategoryId);
		const targetIndex = indexByCategoryId.get(connection.targetCategoryId);

		if (sourceIndex == null || targetIndex == null) {
			return;
		}

		const weight = Math.max(0, Math.min(1, connection.weight));
		matrix[sourceIndex][targetIndex] = weight;
		matrix[targetIndex][sourceIndex] = weight;
	});

	return matrix;
}
