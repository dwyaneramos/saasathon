import * as React from "react";
import { Link } from "react-router-dom";
import {
	ChevronRight,
	Download,
	FolderClosed,
	FolderOpen,
	ListCollapse,
	ListTree,
	Settings,
	Trash2,
	X,
	Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { fileIconFor } from "@/lib/file-icons";
import { cn } from "@/lib/utils";
import { highlightSearchText } from "./search-highlight";
import type { Category } from "./types";

const documentDragMimeType = "application/x-kibi-document";

type DocumentDragPayload = {
	documentId?: number;
	categoryId?: number | null;
	name?: string;
	documents?: Array<{
		documentId: number;
		categoryId?: number | null;
		name?: string;
	}>;
};

type CategoryItemProps = {
	category: Category;
	open: boolean;
	searchQuery: string;
	hasNewCategory: boolean;
	hasNewFiles: boolean;
	isDownloading: boolean;
	newFileIds: Set<number>;
	selectedFileIds: Set<number>;
	selectedDocuments: Array<{
		documentId: number;
		categoryId?: number | null;
		name?: string;
	}>;
	onOpenChange: (categoryId: number, open: boolean) => void;
	onDownloadCategory: (category: Category) => void;
	onClearCategory: (category: Category) => void;
	onClearNewFile: (categoryId: number, fileId: number) => void;
	onSelectFile: (
		category: Category,
		file: Category["files"][number],
		event: React.MouseEvent,
	) => void;
	onMoveDocumentsToCategory: (
		documents: Array<{
			documentId: number;
			categoryId?: number | null;
			name?: string;
		}>,
		targetCategory: Category,
	) => void;
};

function CategoryItemBase({
	category,
	open,
	searchQuery,
	hasNewCategory,
	hasNewFiles,
	isDownloading,
	newFileIds,
	selectedFileIds,
	selectedDocuments,
	onOpenChange,
	onDownloadCategory,
	onClearCategory,
	onClearNewFile,
	onSelectFile,
	onMoveDocumentsToCategory,
}: CategoryItemProps) {
	const [allowCategoryWrap, setAllowCategoryWrap] = React.useState(false);
	const [isDragTarget, setIsDragTarget] = React.useState(false);
	const { state, setOpen: setSidebarOpen } = useSidebar();

	React.useEffect(() => {
		if (state !== "expanded") {
			const timeout = window.setTimeout(() => {
				setAllowCategoryWrap(false);
			}, 0);
			return () => window.clearTimeout(timeout);
		}

		const timeout = window.setTimeout(() => {
			setAllowCategoryWrap(true);
		}, 220);

		return () => window.clearTimeout(timeout);
	}, [state]);

	function handleOpenChange(nextOpen: boolean) {
		onOpenChange(category.id, nextOpen);
		setSidebarOpen(true);
	}

	const FolderIcon = open ? FolderOpen : FolderClosed;
	const showCategoryPip = hasNewCategory || hasNewFiles;
	const getDocumentDragPayload = (event: React.DragEvent) => {
		const rawPayload = event.dataTransfer.getData(documentDragMimeType);
		if (!rawPayload) return null;

		try {
			const payload = JSON.parse(rawPayload) as DocumentDragPayload;
			return typeof payload.documentId === "number" ? payload : null;
		} catch {
			return null;
		}
	};
	const handleCategoryDragOver = (event: React.DragEvent) => {
		if (!event.dataTransfer.types.includes(documentDragMimeType)) return;

		event.preventDefault();
		event.dataTransfer.dropEffect = "move";
		setIsDragTarget(true);
	};
	const handleCategoryDragLeave = (event: React.DragEvent) => {
		if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
			setIsDragTarget(false);
		}
	};
	const handleCategoryDrop = (event: React.DragEvent) => {
		const payload = getDocumentDragPayload(event);
		if (!payload?.documentId) return;

		event.preventDefault();
		event.stopPropagation();
		setIsDragTarget(false);
		onMoveDocumentsToCategory(
			payload.documents ??
				[
					{
						documentId: payload.documentId,
						categoryId: payload.categoryId,
						name: payload.name,
					},
				],
			category,
		);
	};
	const handleFileDragStart = (
		event: React.DragEvent<HTMLAnchorElement>,
		file: Category["files"][number],
	) => {
		event.dataTransfer.effectAllowed = "move";
		const draggedDocuments =
			selectedFileIds.has(file.id) && selectedFileIds.size > 1
				? selectedDocuments
				: [
						{
							documentId: file.id,
							categoryId: category.id,
							name: file.name,
						},
					];
		event.dataTransfer.setData(
			documentDragMimeType,
			JSON.stringify({
				documentId: file.id,
				categoryId: category.id,
				name: file.name,
				documents: draggedDocuments,
			}),
		);
		event.dataTransfer.setData(
			"text/plain",
			draggedDocuments.length === 1
				? file.name
				: `${draggedDocuments.length} selected files`,
		);
	};

	return (
		<Collapsible
			open={open}
			onOpenChange={handleOpenChange}
			className="group/collapsible"
		>
			<SidebarMenuItem>
				<CollapsibleTrigger asChild>
					<SidebarMenuButton
						tooltip={category.name}
						className={cn(
							"hover:bg-muted",
							isDragTarget &&
								"bg-(--color-accent)/15 ring-1 ring-(--color-accent)",
							allowCategoryWrap
								? "h-auto min-h-8 items-start"
								: undefined,
						)}
						style={{ transition: "none" }}
						onClick={() => onClearCategory(category)}
						onDragOver={handleCategoryDragOver}
						onDragLeave={handleCategoryDragLeave}
						onDrop={handleCategoryDrop}
					>
						<span
							className={
								allowCategoryWrap
									? "relative mt-0.5 flex shrink-0"
									: "relative flex shrink-0"
							}
						>
							<FolderIcon className="shrink-0" />
							{showCategoryPip && (
								<span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-rose-400" />
							)}
						</span>
						<span
							className={
								allowCategoryWrap
									? "min-w-0 whitespace-normal break-words leading-tight group-data-[collapsible=icon]:hidden"
									: "min-w-0 overflow-hidden whitespace-nowrap group-data-[collapsible=icon]:hidden"
							}
						>
							{highlightSearchText(category.name, searchQuery)}
						</span>
						<span
							className="ml-auto inline-flex h-4 min-w-4 shrink-0 items-center justify-center self-center rounded bg-zinc-100 px-1 text-[10px] font-medium leading-none tabular-nums text-muted-foreground ring-1 ring-border/60 group-data-[collapsible=icon]:hidden"
							aria-label={`${category.files.length} files`}
						>
							{category.files.length}
						</span>
						<ChevronRight
							className={
								allowCategoryWrap
									? "mt-0.5 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden"
									: "transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden"
							}
						/>
					</SidebarMenuButton>
				</CollapsibleTrigger>
				{category.files.length > 0 && (
					<SidebarMenuAction
						type="button"
						disabled={isDownloading}
						aria-label={`Download files in ${category.name}`}
						title={`Download files in ${category.name}`}
						onClick={(event) => {
							event.preventDefault();
							event.stopPropagation();
							onDownloadCategory(category);
						}}
						className="text-muted-foreground opacity-100 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
					>
						<Download
							className={cn(
								"size-3.5",
								isDownloading && "animate-pulse",
							)}
						/>
					</SidebarMenuAction>
				)}

				<CollapsibleContent>
					<SidebarMenuSub>
						{category.files.length > 0 ? (
							category.files.map((file) => (
								<SidebarMenuSubItem key={file.id}>
									<SidebarMenuSubButton
										asChild
										className={cn(
											"group/file-row h-auto hover:bg-muted",
											selectedFileIds.has(file.id) &&
												"bg-(--color-accent)/15 text-foreground ring-1 ring-(--color-accent)/40",
										)}
									>
										<Link
											to={`/file/${file.id}`}
											className="flex items-start gap-2 text-muted-foreground"
											draggable
											onDragStart={(event) =>
												handleFileDragStart(event, file)
											}
											onClick={(event) => {
												if (
													event.metaKey ||
													event.ctrlKey ||
													event.shiftKey
												) {
													event.preventDefault();
													onSelectFile(
														category,
														file,
														event,
													);
													return;
												}

												onClearNewFile(
													category.id,
													file.id,
												);
											}}
										>
											<span
												role="checkbox"
												aria-checked={selectedFileIds.has(
													file.id,
												)}
												tabIndex={0}
												onClick={(event) => {
													event.preventDefault();
													event.stopPropagation();
													onSelectFile(
														category,
														file,
														event,
													);
												}}
												onKeyDown={(event) => {
													if (
														event.key !== "Enter" &&
														event.key !== " "
													) {
														return;
													}

													event.preventDefault();
													event.currentTarget.click();
												}}
												className={cn(
													"mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-border bg-background opacity-0 transition-opacity group-hover/file-row:opacity-100",
													selectedFileIds.has(
														file.id,
													) &&
														"opacity-100",
												)}
												style={
													selectedFileIds.has(file.id)
														? {
																backgroundColor:
																	"var(--color-accent)",
																borderColor:
																	"var(--color-accent)",
															}
														: undefined
												}
											>
												{selectedFileIds.has(file.id) ? (
													<Check className="size-3.5 text-zinc-900" />
												) : null}
											</span>
											<span className="relative mt-0.5 flex shrink-0">
												{React.createElement(
													fileIconFor(file),
													{
														className:
															"size-3.5 shrink-0 text-muted-foreground/80",
													},
												)}
												{newFileIds.has(file.id) && (
													<span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-rose-400" />
												)}
											</span>
											<span className="min-w-0 overflow-hidden">
												<span className="block truncate">
													{highlightSearchText(
														file.name,
														searchQuery,
													)}
												</span>
												{file.searchSnippet ? (
													<span className="mt-0.5 line-clamp-2 block whitespace-normal text-[11px] leading-snug text-muted-foreground/80">
														{highlightSearchText(
															file.searchSnippet,
															searchQuery,
														)}
													</span>
												) : null}
											</span>
										</Link>
									</SidebarMenuSubButton>
								</SidebarMenuSubItem>
							))
						) : (
							<SidebarMenuSubItem>
								<span className="block truncate px-2 py-1 text-xs text-muted-foreground">
									No files
								</span>
							</SidebarMenuSubItem>
						)}
					</SidebarMenuSub>
				</CollapsibleContent>
			</SidebarMenuItem>
		</Collapsible>
	);
}

function hasSameNewFileMarkers(
	category: Category,
	currentIds: Set<number>,
	nextIds: Set<number>,
) {
	for (const file of category.files) {
		if (currentIds.has(file.id) !== nextIds.has(file.id)) {
			return false;
		}
	}

	return true;
}

const CategoryItem = React.memo(
	CategoryItemBase,
	(previous, next) =>
		previous.category === next.category &&
		previous.open === next.open &&
		previous.searchQuery === next.searchQuery &&
		previous.hasNewCategory === next.hasNewCategory &&
		previous.hasNewFiles === next.hasNewFiles &&
		previous.isDownloading === next.isDownloading &&
		previous.selectedFileIds === next.selectedFileIds &&
		previous.selectedDocuments === next.selectedDocuments &&
		previous.onOpenChange === next.onOpenChange &&
		previous.onDownloadCategory === next.onDownloadCategory &&
		previous.onMoveDocumentsToCategory === next.onMoveDocumentsToCategory &&
		previous.onSelectFile === next.onSelectFile &&
		previous.onClearCategory === next.onClearCategory &&
		previous.onClearNewFile === next.onClearNewFile &&
		hasSameNewFileMarkers(
			previous.category,
			previous.newFileIds,
			next.newFileIds,
		),
);

export function FileTree({
	categories,
	isLoading,
	error,
	isSearching,
	hasSearchQuery,
	searchQuery,
	newCategoryIds,
	newFileCategoryIds,
	newFileIds,
	expandedCategoryIds,
	onCategoryOpenChange,
	onManageCategories,
	onToggleAllCategories,
	onClearCategory,
	onClearNewFile,
	onDownloadCategory,
	onSelectFile,
	onClearSelection,
	onDeleteSelected,
	onDownloadSelected,
	onMoveDocumentsToCategory,
	selectedFileIds,
	downloadingCategoryId,
}: {
	categories: Category[];
	isLoading: boolean;
	error: string | null;
	isSearching: boolean;
	hasSearchQuery: boolean;
	searchQuery: string;
	newCategoryIds: Set<number>;
	newFileCategoryIds: Set<number>;
	newFileIds: Set<number>;
	expandedCategoryIds: Set<number>;
	onCategoryOpenChange: (categoryId: number, open: boolean) => void;
	onManageCategories: () => void;
	onToggleAllCategories: () => void;
	onClearCategory: (category: Category) => void;
	onClearNewFile: (categoryId: number, fileId: number) => void;
	onDownloadCategory: (category: Category) => void;
	onSelectFile: (
		category: Category,
		file: Category["files"][number],
		event: React.MouseEvent,
	) => void;
	onClearSelection: () => void;
	onDeleteSelected: () => void;
	onDownloadSelected: () => void;
	onMoveDocumentsToCategory: (
		documents: Array<{
			documentId: number;
			categoryId?: number | null;
			name?: string;
		}>,
		targetCategory: Category,
	) => void;
	selectedFileIds: Set<number>;
	downloadingCategoryId: number | null;
}) {
	const hasCategories = categories.length > 0;
	const allExpanded =
		hasCategories &&
		categories.every((category) => expandedCategoryIds.has(category.id));
	const ToggleIcon = allExpanded ? ListCollapse : ListTree;
	const selectedDocuments = React.useMemo(
		() =>
			categories.flatMap((category) =>
				category.files
					.filter((file) => selectedFileIds.has(file.id))
					.map((file) => ({
						documentId: file.id,
						categoryId: category.id,
						name: file.name,
					})),
			),
		[categories, selectedFileIds],
	);
	const selectedCount = selectedFileIds.size;

	return (
		<SidebarGroup>
			<div className="flex h-8 items-center justify-between gap-2 pr-1 group-data-[collapsible=icon]:hidden">
				<SidebarGroupLabel className="h-auto flex-1 px-0">
					CATEGORIES
				</SidebarGroupLabel>
				<div className="flex items-center gap-1">
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						onClick={onToggleAllCategories}
						disabled={!hasCategories}
						aria-label={
							allExpanded
								? "Collapse all categories"
								: "Expand all categories"
						}
						title={
							allExpanded
								? "Collapse all categories"
								: "Expand all categories"
						}
					>
						<ToggleIcon className="size-3.5" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						onClick={onManageCategories}
						aria-label="Manage categories"
						title="Manage categories"
					>
						<Settings className="size-3.5" />
					</Button>
				</div>
			</div>
			{selectedCount > 0 ? (
				<div className="mb-2 flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs group-data-[collapsible=icon]:hidden">
					<span className="min-w-0 flex-1 truncate text-muted-foreground">
						{selectedCount} selected
					</span>
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						onClick={onDownloadSelected}
						aria-label="Download selected files"
						title="Download selected files"
					>
						<Download className="size-3.5" />
					</Button>
					<Button
						type="button"
						variant="destructive"
						size="icon-xs"
						onClick={onDeleteSelected}
						aria-label="Delete selected files"
						title="Delete selected files"
					>
						<Trash2 className="size-3.5" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						onClick={onClearSelection}
						aria-label="Clear selected files"
						title="Clear selected files"
					>
						<X className="size-3.5" />
					</Button>
				</div>
			) : null}
			<SidebarMenu>
				{isLoading && (
					<SidebarMenuItem>
						<span className="block px-2 py-1 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
							Loading files...
						</span>
					</SidebarMenuItem>
				)}
				{!isLoading && error && (
					<SidebarMenuItem>
						<span className="block px-2 py-1 text-sm text-destructive group-data-[collapsible=icon]:hidden">
							{error}
						</span>
					</SidebarMenuItem>
				)}
				{!isLoading && !error && categories.length === 0 && (
					<SidebarMenuItem>
						<span className="block px-2 py-1 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
							{hasSearchQuery
								? isSearching
									? "Searching parsed content..."
									: "No matching files"
								: "No categories yet"}
						</span>
					</SidebarMenuItem>
				)}
				{!isLoading &&
					!error &&
					categories.map((category) => (
						<CategoryItem
							key={category.id}
							category={category}
							open={expandedCategoryIds.has(category.id)}
							searchQuery={searchQuery}
							hasNewCategory={newCategoryIds.has(category.id)}
							hasNewFiles={newFileCategoryIds.has(category.id)}
							isDownloading={downloadingCategoryId === category.id}
							newFileIds={newFileIds}
							selectedFileIds={selectedFileIds}
							selectedDocuments={selectedDocuments}
							onOpenChange={onCategoryOpenChange}
							onDownloadCategory={onDownloadCategory}
							onClearCategory={onClearCategory}
							onClearNewFile={onClearNewFile}
							onSelectFile={onSelectFile}
							onMoveDocumentsToCategory={
								onMoveDocumentsToCategory
							}
						/>
					))}
			</SidebarMenu>
		</SidebarGroup>
	);
}
