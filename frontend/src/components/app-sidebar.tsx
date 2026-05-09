"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
	ChevronRight,
	Edit3,
	FolderOpen,
	Layers,
	FolderClosed,
	ListCollapse,
	ListTree,
	Trash2,
	Search,
	Settings,
	SlidersHorizontal,
	X,
	FolderPlus,
	LayersPlus,
	UploadCloud,
} from "lucide-react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInput,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadWorkspace } from "@/components/upload-workspace";
import { apiBaseUrl } from "@/lib/api";
import { fileIconFor } from "@/lib/file-icons";
import { cn } from "@/lib/utils";

export const fileTreeUpdatedEvent = "kibi:file-tree-updated";
export const openUploadModalEvent = "kibi:open-upload-modal";

export type KibiFile = {
	id: number;
	name: string;
	filename: string;
	mimeType: string;
};
type Category = { id: number; name: string; files: KibiFile[] };
type Space = { id: number; name: string };

type ApiSpace = {
	id: number;
	name: string;
};

type ApiCategory = {
	id: number;
	name: string;
	spaceId: number | null;
};

type ApiDocument = {
	id: number;
	filename: string;
	fileName: string;
	originalFileName: string | null;
	mimeType: string;
	categoryId: number | null;
};

type FileTreeUpdatedEvent = CustomEvent<{
	documentIds?: number[];
}>;

function authHeaders() {
	const token = localStorage.getItem("token");
	return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function fileDisplayName(file: ApiDocument) {
	return file.originalFileName || file.fileName || file.filename;
}

// ── Space switcher (header) ───────────────────────────────────────────────────

function SpaceSwitcher({
	spaces,
	activeSpace,
	onSelect,
	onCreateSpace,
	onEditActiveSpace,
	onDeleteActiveSpace,
}: {
	spaces: Space[];
	activeSpace: Space | null;
	onSelect: (space: Space) => void;
	onCreateSpace?: () => void;
	onEditActiveSpace?: () => void;
	onDeleteActiveSpace?: () => void;
}) {
	const { isMobile } = useSidebar();
	const activeSpaceName = activeSpace?.name ?? "No spaces";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<SidebarMenuButton
					tooltip={activeSpaceName}
					className="hover:bg-muted py-6"
					style={{ transition: "none" }}
				>
					<div className="flex items-center gap-2 w-full">
						<Layers />
						<div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
							<span className="truncate font-semibold">
								{activeSpaceName}
							</span>
							<span className="truncate text-xs text-muted-foreground">
								Active space
							</span>
						</div>
						<div className="flex items-center gap-2">
							<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
						</div>
					</div>
				</SidebarMenuButton>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				side={isMobile ? "bottom" : "right"}
				align="start"
				className="min-w-48 rounded-lg"
			>
				{spaces.length > 0 ? (
					spaces.map((space) => (
						<DropdownMenuItem
							key={space.id}
							onSelect={() => onSelect(space)}
							className="gap-2"
						>
							<div className="flex size-6 items-center justify-center rounded-md">
								<Layers className="size-3.5 shrink-0" />
							</div>
							{space.name}
							{space.id === activeSpace?.id && (
								<span className="ml-auto text-xs text-muted-foreground">
									Active
								</span>
							)}
						</DropdownMenuItem>
					))
				) : (
					<DropdownMenuItem disabled>
						No spaces found
					</DropdownMenuItem>
				)}
				<DropdownMenuItem
					className="w-full mt-2 border border-dashed border-sidebar-border bg-sidebar text-muted-foreground transition-colors hover:border-sidebar-accent-foreground/30 hover:bg-sidebar-accent hover:text-foreground"
					onClick={onCreateSpace}
				>
					<LayersPlus className="size-4" />
					<span className="group-data-[collapsible=icon]:hidden">
						New space
					</span>
				</DropdownMenuItem>
				{activeSpace ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={onEditActiveSpace}>
							<Edit3 className="size-4" />
							Rename current space
						</DropdownMenuItem>
						<DropdownMenuItem
							variant="destructive"
							onClick={onDeleteActiveSpace}
						>
							<Trash2 className="size-4" />
							Delete current space
						</DropdownMenuItem>
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ── File tree (categories → files) ───────────────────────────────────────────

function CategoryItem({
	category,
	open,
	hasNewCategory,
	hasNewFiles,
	newFileIds,
	onOpenChange,
	onClearCategory,
	onClearNewFile,
}: {
	category: Category;
	open: boolean;
	hasNewCategory: boolean;
	hasNewFiles: boolean;
	newFileIds: Set<number>;
	onOpenChange: (categoryId: number, open: boolean) => void;
	onClearCategory: (category: Category) => void;
	onClearNewFile: (categoryId: number, fileId: number) => void;
}) {
	const [allowCategoryWrap, setAllowCategoryWrap] = React.useState(false);
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
							allowCategoryWrap
								? "h-auto min-h-8 items-start"
								: undefined,
						)}
						style={{ transition: "none" }}
						onClick={() => onClearCategory(category)}
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
							{category.name}
						</span>
						<span
							className="ml-auto inline-flex h-4 min-w-4 shrink-0 items-center justify-center self-center rounded bg-zinc-100 px-1 text-[10px] font-medium leading-none tabular-nums text-muted-foreground ring-1 ring-border/60 group-data-[collapsible=icon]:hidden"
							aria-label={`${category.files.length} files`}
						>
							{category.files.length}
						</span>
						<ChevronRight className="self-center transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
					</SidebarMenuButton>
				</CollapsibleTrigger>

				<CollapsibleContent>
					<SidebarMenuSub>
						{category.files.length > 0 ? (
							category.files.map((file) => (
								<SidebarMenuSubItem key={file.id}>
									<SidebarMenuSubButton
										asChild
										className="hover:bg-muted"
									>
										<Link
											to={`/file/${file.id}`}
											className="flex items-center gap-2 text-muted-foreground"
											onClick={() =>
												onClearNewFile(
													category.id,
													file.id,
												)
											}
										>
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
											<span className="min-w-0 overflow-hidden whitespace-nowrap">
												{file.name}
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

function FileTree({
	categories,
	isLoading,
	error,
	newCategoryIds,
	newFileCategoryIds,
	newFileIds,
	expandedCategoryIds,
	onCategoryOpenChange,
	onManageCategories,
	onToggleAllCategories,
	onClearCategory,
	onClearNewFile,
}: {
	categories: Category[];
	isLoading: boolean;
	error: string | null;
	newCategoryIds: Set<number>;
	newFileCategoryIds: Set<number>;
	newFileIds: Set<number>;
	expandedCategoryIds: Set<number>;
	onCategoryOpenChange: (categoryId: number, open: boolean) => void;
	onManageCategories: () => void;
	onToggleAllCategories: () => void;
	onClearCategory: (category: Category) => void;
	onClearNewFile: (categoryId: number, fileId: number) => void;
}) {
	const hasCategories = categories.length > 0;
	const allExpanded =
		hasCategories &&
		categories.every((category) => expandedCategoryIds.has(category.id));
	const ToggleIcon = allExpanded ? ListCollapse : ListTree;

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
							No categories yet
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
							hasNewCategory={newCategoryIds.has(category.id)}
							hasNewFiles={newFileCategoryIds.has(category.id)}
							newFileIds={newFileIds}
							onOpenChange={onCategoryOpenChange}
							onClearCategory={onClearCategory}
							onClearNewFile={onClearNewFile}
						/>
					))}
			</SidebarMenu>
		</SidebarGroup>
	);
}

function UploadModal({
	open,
	onOpenChange,
	spaceId,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	spaceId?: number | null;
}) {
	const [isUploadLocked, setIsUploadLocked] = React.useState(false);
	const [hasAnalysisStarted, setHasAnalysisStarted] = React.useState(false);

	const handleBusyChange = React.useCallback((isBusy: boolean) => {
		setIsUploadLocked(isBusy);
		if (isBusy) {
			setHasAnalysisStarted(true);
		}
	}, []);

	const requestClose = React.useCallback(() => {
		if (isUploadLocked) {
			return;
		}

		onOpenChange(false);
	}, [isUploadLocked, onOpenChange]);

	React.useEffect(() => {
		if (!open) {
			setIsUploadLocked(false);
			setHasAnalysisStarted(false);
		}
	}, [open]);

	React.useEffect(() => {
		if (!open) {
			return;
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !isUploadLocked) {
				onOpenChange(false);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isUploadLocked, onOpenChange, open]);

	if (!open) {
		return null;
	}

	return createPortal(
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="upload-files-title"
			className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/20 p-4 supports-backdrop-filter:backdrop-blur-sm"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget && !isUploadLocked) {
					onOpenChange(false);
				}
			}}
		>
			<Card
				className="relative z-[201] max-h-[88vh] w-full max-w-2xl gap-0 overflow-hidden rounded-xl bg-card py-0"
				style={{ padding: 0 }}
			>
				<CardHeader className="!flex !flex-row items-start justify-between gap-4 border-b border-border bg-muted/40 px-6 py-5">
					<div className="flex min-w-0 items-start gap-3">
						<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
							<UploadCloud className="size-5" />
						</span>
						<div className="min-w-0">
							<CardTitle
								id="upload-files-title"
								className="text-lg font-semibold text-foreground"
							>
								Upload files
							</CardTitle>
							<CardDescription className="mt-1 max-w-xl">
								Add PDFs or images to analyse and organize them
								into categories.
							</CardDescription>
						</div>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
						onClick={requestClose}
						disabled={isUploadLocked}
						aria-label="Close upload modal"
					>
						<X className="size-4" />
					</Button>
				</CardHeader>
				<CardContent className="max-h-[calc(88vh-9rem)] overflow-y-auto bg-card px-6 py-6">
					<UploadWorkspace
						detailMode="compact"
						showHeading={false}
						onBusyChange={handleBusyChange}
						spaceId={spaceId}
					/>
				</CardContent>
				{hasAnalysisStarted ? (
					<div className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-border bg-muted/50 px-6 py-3 text-muted-foreground">
						<span className="flex min-h-full items-center text-sm leading-relaxed">
							{isUploadLocked
								? "Analysis is running. Keep this window open until it finishes."
								: "Analysis complete. New files are ready in the sidebar."}
						</span>
						<Button
							type="button"
							variant="accent"
							className="shrink-0 self-end"
							size="default"
							onClick={requestClose}
							disabled={isUploadLocked}
						>
							Done
						</Button>
					</div>
				) : null}
			</Card>
		</div>,
		document.body,
	);
}

// ── AppSidebar ────────────────────────────────────────────────────────────────

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
	activeSpaceId?: number | null;
	onSpaceChange?: React.Dispatch<React.SetStateAction<number | null>>;
	onSpacesLoaded?: React.Dispatch<React.SetStateAction<Space[]>>;
};

export function AppSidebar({
	activeSpaceId: controlledActiveSpaceId,
	onSpaceChange,
	onSpacesLoaded,
	...props
}: AppSidebarProps) {
	const [spaces, setSpaces] = React.useState<Space[]>([]);
	const [uncontrolledActiveSpaceId, setUncontrolledActiveSpaceId] =
		React.useState<number | null>(null);
	const [categories, setCategories] = React.useState<Category[]>([]);
	const [isLoading, setIsLoading] = React.useState(true);
	const [spacesLoaded, setSpacesLoaded] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [isCreateCategoryOpen, setIsCreateCategoryOpen] =
		React.useState(false);
	const [newCategoryName, setNewCategoryName] = React.useState("");
	const [createCategoryError, setCreateCategoryError] = React.useState<
		string | null
	>(null);
	const [isCreatingCategory, setIsCreatingCategory] = React.useState(false);
	const [isManageCategoriesOpen, setIsManageCategoriesOpen] =
		React.useState(false);
	const [editingCategoryId, setEditingCategoryId] = React.useState<
		number | null
	>(null);
	const [editingCategoryName, setEditingCategoryName] = React.useState("");
	const [categoryActionError, setCategoryActionError] = React.useState<
		string | null
	>(null);
	const [updatingCategoryId, setUpdatingCategoryId] = React.useState<
		number | null
	>(null);
	const [deletingCategoryId, setDeletingCategoryId] = React.useState<
		number | null
	>(null);
	const [confirmDeleteCategoryId, setConfirmDeleteCategoryId] =
		React.useState<number | null>(null);
	const [isCreateSpaceOpen, setIsCreateSpaceOpen] = React.useState(false);
	const [newSpaceName, setNewSpaceName] = React.useState("");
	const [isCreatingSpace, setIsCreatingSpace] = React.useState(false);
	const [createSpaceError, setCreateSpaceError] = React.useState<
		string | null
	>(null);
	const [isEditSpaceOpen, setIsEditSpaceOpen] = React.useState(false);
	const [editSpaceName, setEditSpaceName] = React.useState("");
	const [editSpaceError, setEditSpaceError] = React.useState<string | null>(
		null,
	);
	const [isUpdatingSpace, setIsUpdatingSpace] = React.useState(false);
	const [isDeleteSpaceOpen, setIsDeleteSpaceOpen] = React.useState(false);
	const [deleteSpaceError, setDeleteSpaceError] = React.useState<
		string | null
	>(null);
	const [isDeletingSpace, setIsDeletingSpace] = React.useState(false);
	const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false);
	const [searchQuery, setSearchQuery] = React.useState("");
	const searchInputRef = React.useRef<HTMLInputElement | null>(null);
	const [newCategoryIds, setNewCategoryIds] = React.useState<Set<number>>(
		() => new Set(),
	);
	const [newFileCategoryIds, setNewFileCategoryIds] = React.useState<
		Set<number>
	>(() => new Set());
	const [newFileIds, setNewFileIds] = React.useState<Set<number>>(
		() => new Set(),
	);
	const [expandedCategoryIds, setExpandedCategoryIds] = React.useState<
		Set<number>
	>(() => new Set());
	const categoryFileIdsRef = React.useRef<Map<number, Set<number>>>(
		new Map(),
	);
	const fileTreeLoadedRef = React.useRef(false);
	const categoryExpansionInitializedRef = React.useRef(false);

	const activeSpaceId =
		controlledActiveSpaceId !== undefined
			? controlledActiveSpaceId
			: uncontrolledActiveSpaceId;
	const setActiveSpaceId = React.useCallback(
		(value: React.SetStateAction<number | null>) => {
			if (onSpaceChange) {
				onSpaceChange(value);
				return;
			}

			setUncontrolledActiveSpaceId(value);
		},
		[onSpaceChange],
	);

	const activeSpace =
		spaces.find((space) => space.id === activeSpaceId) ?? spaces[0] ?? null;
	const { setOpen: setSidebarOpen } = useSidebar();
	const trimmedSearchQuery = searchQuery.trim().toLowerCase();
	const visibleCategories = React.useMemo(() => {
		if (!trimmedSearchQuery) {
			return categories;
		}

		return categories
			.map((category) => {
				const categoryMatches = category.name
					.toLowerCase()
					.includes(trimmedSearchQuery);
				const matchingFiles = category.files.filter(
					(file) =>
						file.name.toLowerCase().includes(trimmedSearchQuery) ||
						file.filename
							.toLowerCase()
							.includes(trimmedSearchQuery),
				);

				if (categoryMatches) {
					return category;
				}

				if (matchingFiles.length > 0) {
					return {
						...category,
						files: matchingFiles,
					};
				}

				return null;
			})
			.filter((category): category is Category => category !== null);
	}, [categories, trimmedSearchQuery]);
	const validateCategoryName = React.useCallback(
		(value: string) => {
			const trimmed = value.trim();

			if (!trimmed) return "Category name is required.";
			if (trimmed.length < 2)
				return "Category name must be at least 2 characters.";
			if (trimmed.length > 80)
				return "Category name must be 80 characters or fewer.";
			if (
				categories.some(
					(category) =>
						category.name.trim().toLowerCase() ===
						trimmed.toLowerCase(),
				)
			) {
				return "A category with this name already exists.";
			}

			return null;
		},
		[categories],
	);

	const validateSpaceName = React.useCallback(
		(value: string) => {
			const trimmed = value.trim();

			if (!trimmed) return "Space name is required.";
			if (trimmed.length < 2)
				return "Space name must be at least 2 characters.";
			if (trimmed.length > 80)
				return "Space name must be 80 characters or fewer.";

			return null;
		},
		[spaces],
	);

	const openSearch = React.useCallback(() => {
		setSidebarOpen(true);

		window.setTimeout(() => {
			searchInputRef.current?.focus();
		}, 220);
	}, [setSidebarOpen]);

	const openCreateCategoryModal = React.useCallback(() => {
		setNewCategoryName("");
		setCreateCategoryError(null);
		setIsCreateCategoryOpen(true);
	}, []);

	const openManageCategoriesModal = React.useCallback(() => {
		setEditingCategoryId(null);
		setEditingCategoryName("");
		setCategoryActionError(null);
		setConfirmDeleteCategoryId(null);
		setIsManageCategoriesOpen(true);
	}, []);

	const handleCategoryOpenChange = React.useCallback(
		(categoryId: number, open: boolean) => {
			setExpandedCategoryIds((currentIds) => {
				const nextIds = new Set(currentIds);
				if (open) {
					nextIds.add(categoryId);
				} else {
					nextIds.delete(categoryId);
				}
				return nextIds;
			});
		},
		[],
	);

	const toggleAllCategories = React.useCallback(() => {
		setExpandedCategoryIds((currentIds) => {
			const expandableCategories = categories.filter(
				(category) => category.files.length > 0,
			);
			const allExpanded =
				expandableCategories.length > 0 &&
				expandableCategories.every((category) =>
					currentIds.has(category.id),
				);

			return allExpanded
				? new Set()
				: new Set(expandableCategories.map((category) => category.id));
		});
	}, [categories]);

	const closeCreateCategoryModal = React.useCallback(() => {
		if (isCreatingCategory) return;
		setIsCreateCategoryOpen(false);
		setNewCategoryName("");
		setCreateCategoryError(null);
	}, [isCreatingCategory]);

	const openEditSpaceModal = React.useCallback(() => {
		if (!activeSpace) return;
		setEditSpaceName(activeSpace.name);
		setEditSpaceError(null);
		setIsEditSpaceOpen(true);
	}, [activeSpace]);

	const openDeleteSpaceModal = React.useCallback(() => {
		if (!activeSpace) return;
		setDeleteSpaceError(null);
		setIsDeleteSpaceOpen(true);
	}, [activeSpace]);

	const startEditingCategory = React.useCallback((category: Category) => {
		setEditingCategoryId(category.id);
		setEditingCategoryName(category.name);
		setCategoryActionError(null);
		setConfirmDeleteCategoryId(null);
	}, []);

	const clearNewFile = React.useCallback(
		(categoryId: number, fileId: number) => {
			setNewFileIds((currentIds) => {
				if (!currentIds.has(fileId)) return currentIds;

				const nextIds = new Set(currentIds);
				nextIds.delete(fileId);
				return nextIds;
			});
			setNewCategoryIds((currentIds) => {
				if (!currentIds.has(categoryId)) return currentIds;

				const nextIds = new Set(currentIds);
				nextIds.delete(categoryId);
				return nextIds;
			});
			setNewFileCategoryIds((currentIds) => {
				if (!currentIds.has(categoryId)) return currentIds;

				const nextIds = new Set(currentIds);
				nextIds.delete(categoryId);
				return nextIds;
			});
		},
		[],
	);

	const clearCategoryNotification = React.useCallback(
		(category: Category) => {
			setNewCategoryIds((currentIds) => {
				if (!currentIds.has(category.id)) return currentIds;

				const nextIds = new Set(currentIds);
				nextIds.delete(category.id);
				return nextIds;
			});
			setNewFileCategoryIds((currentIds) => {
				if (!currentIds.has(category.id)) return currentIds;

				const nextIds = new Set(currentIds);
				nextIds.delete(category.id);
				return nextIds;
			});
			setNewFileIds((currentIds) => {
				const nextIds = new Set(currentIds);
				let changed = false;

				for (const file of category.files) {
					if (nextIds.delete(file.id)) {
						changed = true;
					}
				}

				return changed ? nextIds : currentIds;
			});
		},
		[],
	);

	const loadFileTree = React.useCallback(
		async (detectNewFiles = false, changedDocumentIds: number[] = []) => {
			if (!spacesLoaded) return;

			setIsLoading(true);
			setError(null);

			const query = activeSpaceId ? `?spaceId=${activeSpaceId}` : "";

			try {
				const [categoryResponse, documentResponse] = await Promise.all([
					fetch(`${apiBaseUrl}/categories${query}`, {
						headers: authHeaders(),
					}),
					fetch(`${apiBaseUrl}/documents${query}`, {
						headers: authHeaders(),
					}),
				]);

				if (!categoryResponse.ok || !documentResponse.ok) {
					throw new Error("Unable to load files");
				}

				const [categoryPayload, documentPayload] = (await Promise.all([
					categoryResponse.json(),
					documentResponse.json(),
				])) as [
					{ categories?: ApiCategory[] },
					{ documents?: ApiDocument[] },
				];

				const documents = documentPayload.documents ?? [];
				const nextCategories = (categoryPayload.categories ?? []).map(
					(category) => ({
						id: category.id,
						name: category.name,
						files: documents
							.filter(
								(document) =>
									document.categoryId === category.id,
							)
							.map((document) => ({
								id: document.id,
								name: fileDisplayName(document),
								filename: document.filename,
								mimeType: document.mimeType,
							})),
					}),
				);
				const nextCategoryFileIds = new Map(
					nextCategories.map((category) => [
						category.id,
						new Set(category.files.map((file) => file.id)),
					]),
				);
				const changedDocumentIdSet = new Set(changedDocumentIds);

				if (
					detectNewFiles &&
					(fileTreeLoadedRef.current || changedDocumentIdSet.size > 0)
				) {
					setNewCategoryIds((currentIds) => {
						const nextIds = new Set(currentIds);

						for (const category of nextCategories) {
							const previousFileIds =
								categoryFileIdsRef.current.get(category.id);
							const hasChangedDocument = category.files.some(
								(file) => changedDocumentIdSet.has(file.id),
							);

							if (
								!previousFileIds &&
								(fileTreeLoadedRef.current ||
									hasChangedDocument)
							) {
								nextIds.add(category.id);
							}
						}

						return nextIds;
					});
					setNewFileCategoryIds((currentIds) => {
						const nextIds = new Set(currentIds);

						for (const [
							categoryId,
							fileIds,
						] of nextCategoryFileIds) {
							const previousFileIds =
								categoryFileIdsRef.current.get(categoryId);
							const hasChangedDocument = [...fileIds].some(
								(fileId) => changedDocumentIdSet.has(fileId),
							);
							const hasAddedFiles = previousFileIds
								? [...fileIds].some(
										(fileId) =>
											!previousFileIds.has(fileId),
									)
								: fileIds.size > 0;

							if (hasAddedFiles || hasChangedDocument) {
								nextIds.add(categoryId);
							}
						}

						return nextIds;
					});
					setNewFileIds((currentIds) => {
						const nextIds = new Set(currentIds);

						for (const [
							categoryId,
							fileIds,
						] of nextCategoryFileIds) {
							const previousFileIds =
								categoryFileIdsRef.current.get(categoryId);

							for (const fileId of fileIds) {
								if (
									changedDocumentIdSet.has(fileId) ||
									(fileTreeLoadedRef.current &&
										(!previousFileIds ||
											!previousFileIds.has(fileId)))
								) {
									nextIds.add(fileId);
								}
							}
						}

						return nextIds;
					});
				}

				categoryFileIdsRef.current = nextCategoryFileIds;
				fileTreeLoadedRef.current = true;
				setExpandedCategoryIds((currentIds) => {
					const nextCategoryIds = new Set(
						nextCategories.map((category) => category.id),
					);
					const nextIds = new Set(
						[...currentIds].filter((categoryId) =>
							nextCategoryIds.has(categoryId),
						),
					);

					if (!categoryExpansionInitializedRef.current) {
						for (const category of nextCategories) {
							if (category.files.length > 0) {
								nextIds.add(category.id);
							}
						}
						categoryExpansionInitializedRef.current = true;
					}

					return nextIds;
				});
				setCategories(nextCategories);
			} catch {
				setCategories([]);
				setError("Unable to load files");
			} finally {
				setIsLoading(false);
			}
		},
		[activeSpaceId, spacesLoaded],
	);

	React.useEffect(() => {
		let ignore = false;

		async function loadSpaces() {
			try {
				const response = await fetch(`${apiBaseUrl}/spaces`, {
					headers: authHeaders(),
				});

				if (!response.ok) {
					throw new Error("Unable to load spaces");
				}

				const payload = (await response.json()) as {
					spaces?: ApiSpace[];
				};
				const nextSpaces = payload.spaces ?? [];

				if (ignore) return;

				setSpaces(nextSpaces);
				onSpacesLoaded?.(nextSpaces);
				setActiveSpaceId((currentSpaceId) => {
					if (
						currentSpaceId &&
						nextSpaces.some((space) => space.id === currentSpaceId)
					) {
						return currentSpaceId;
					}

					return nextSpaces[0]?.id ?? null;
				});
				setSpacesLoaded(true);
			} catch {
				if (!ignore) {
					setError("Unable to load spaces");
					setSpacesLoaded(true);
				}
			} finally {
				if (!ignore) {
					fileTreeLoadedRef.current = false;
				}
				setIsLoading(false);
			}
		}

		loadSpaces();

		return () => {
			ignore = true;
		};
	}, [onSpacesLoaded, setActiveSpaceId]);

	React.useEffect(() => {
		if (!spacesLoaded) return;

		categoryExpansionInitializedRef.current = false;
		setExpandedCategoryIds(new Set());

		async function run() {
			await loadFileTree();
		}

		void run();

		return () => {};
	}, [spacesLoaded, activeSpaceId, loadFileTree]);

	React.useEffect(() => {
		const handleFileTreeUpdated = (event: Event) => {
			const documentIds =
				(event as FileTreeUpdatedEvent).detail?.documentIds ?? [];
			void loadFileTree(true, documentIds);
		};

		window.addEventListener(fileTreeUpdatedEvent, handleFileTreeUpdated);

		return () => {
			window.removeEventListener(
				fileTreeUpdatedEvent,
				handleFileTreeUpdated,
			);
		};
	}, [loadFileTree]);

	React.useEffect(() => {
		const handleOpenUploadModal = () => {
			setIsUploadModalOpen(true);
		};

		window.addEventListener(openUploadModalEvent, handleOpenUploadModal);

		return () => {
			window.removeEventListener(
				openUploadModalEvent,
				handleOpenUploadModal,
			);
		};
	}, []);

	const handleCreateCategory = async (
		event: React.FormEvent<HTMLFormElement>,
	) => {
		event.preventDefault();

		const trimmedName = newCategoryName.trim();
		const validationError = validateCategoryName(trimmedName);
		if (validationError) {
			setCreateCategoryError(validationError);
			return;
		}

		setIsCreatingCategory(true);
		setCreateCategoryError(null);

		try {
			const response = await fetch(`${apiBaseUrl}/categories`, {
				method: "POST",
				headers: {
					...authHeaders(),
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name: trimmedName,
					spaceId: activeSpaceId ?? null,
				}),
			});
			const payload = (await response.json().catch(() => null)) as {
				category?: {
					id?: number;
					name?: string;
					spaceId?: number | null;
					metadata?: any;
					description?: string | null;
				};
				error?: string;
			} | null;

			if (!response.ok) {
				throw new Error(payload?.error ?? "Could not create category.");
			}

			const createdCategory = payload?.category;
			if (createdCategory && typeof createdCategory.id === "number") {
				const createdCategoryId = createdCategory.id;

				// Insert the new category into the categories list client-side to avoid full refetch
				setCategories((current) => {
					const next = [...current];
					next.push({
						id: createdCategoryId,
						name: createdCategory.name || trimmedName,
						files: [],
					});
					return next.sort((a, b) => a.name.localeCompare(b.name));
				});

				setNewCategoryIds((currentIds) => {
					const nextIds = new Set(currentIds);
					nextIds.add(createdCategoryId);
					return nextIds;
				});

				toast.success(
					`Category '${createdCategory.name ?? trimmedName}' created in '${activeSpace.name ?? "Default Space"}'`,
				);

				window.dispatchEvent(new CustomEvent(fileTreeUpdatedEvent));
			}

			setIsCreateCategoryOpen(false);
			setNewCategoryName("");
			setCreateCategoryError(null);
		} catch (err) {
			setCreateCategoryError(
				err instanceof Error
					? err.message
					: "Could not create category.",
			);
		} finally {
			setIsCreatingCategory(false);
		}
	};

	const handleUpdateCategory = async (category: Category) => {
		const trimmedName = editingCategoryName.trim();
		if (!trimmedName) {
			setCategoryActionError("Category name is required.");
			return;
		}
		if (trimmedName.length > 80) {
			setCategoryActionError(
				"Category name must be 80 characters or fewer.",
			);
			return;
		}
		if (
			categories.some(
				(currentCategory) =>
					currentCategory.id !== category.id &&
					currentCategory.name.trim().toLowerCase() ===
						trimmedName.toLowerCase(),
			)
		) {
			setCategoryActionError("A category with this name already exists.");
			return;
		}

		setUpdatingCategoryId(category.id);
		setCategoryActionError(null);

		try {
			const response = await fetch(
				`${apiBaseUrl}/categories/${category.id}`,
				{
					method: "PATCH",
					headers: {
						...authHeaders(),
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ name: trimmedName }),
				},
			);
			const payload = (await response.json().catch(() => null)) as {
				category?: { id: number; name: string };
				error?: string;
			} | null;

			if (!response.ok || !payload?.category) {
				throw new Error(payload?.error ?? "Could not rename category.");
			}

			setCategories((currentCategories) =>
				currentCategories
					.map((currentCategory) =>
						currentCategory.id === payload.category!.id
							? {
									...currentCategory,
									name: payload.category!.name,
								}
							: currentCategory,
					)
					.sort((left, right) => left.name.localeCompare(right.name)),
			);
			setEditingCategoryId(null);
			setEditingCategoryName("");
			toast.success(`Category renamed to '${payload.category.name}'`);
			window.dispatchEvent(new CustomEvent(fileTreeUpdatedEvent));
		} catch (err) {
			setCategoryActionError(
				err instanceof Error
					? err.message
					: "Could not rename category.",
			);
		} finally {
			setUpdatingCategoryId(null);
		}
	};

	const handleDeleteCategory = async (category: Category) => {
		if (confirmDeleteCategoryId !== category.id) {
			setConfirmDeleteCategoryId(category.id);
			setCategoryActionError(null);
			return;
		}

		setDeletingCategoryId(category.id);
		setCategoryActionError(null);

		try {
			const response = await fetch(
				`${apiBaseUrl}/categories/${category.id}`,
				{
					method: "DELETE",
					headers: authHeaders(),
				},
			);
			const payload = (await response.json().catch(() => null)) as {
				error?: string;
			} | null;

			if (!response.ok) {
				throw new Error(payload?.error ?? "Could not delete category.");
			}

			setCategories((currentCategories) =>
				currentCategories.filter(
					(currentCategory) => currentCategory.id !== category.id,
				),
			);
			setEditingCategoryId(null);
			setConfirmDeleteCategoryId(null);
			toast.success(`Category '${category.name}' deleted`);
			window.dispatchEvent(new CustomEvent(fileTreeUpdatedEvent));
		} catch (err) {
			setCategoryActionError(
				err instanceof Error
					? err.message
					: "Could not delete category.",
			);
		} finally {
			setDeletingCategoryId(null);
		}
	};

	const handleCreateSpace = async (
		event?: React.FormEvent<HTMLFormElement>,
	) => {
		if (event) event.preventDefault();

		const trimmedName = newSpaceName.trim();
		const validationError = validateSpaceName(trimmedName);
		if (validationError) {
			setCreateSpaceError(validationError);
			return;
		}

		setIsCreatingSpace(true);
		setCreateSpaceError(null);

		try {
			const response = await fetch(`${apiBaseUrl}/spaces`, {
				method: "POST",
				headers: {
					...authHeaders(),
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ name: trimmedName }),
			});

			const payload = await response.json().catch(() => null);
			if (!response.ok) {
				throw new Error(payload?.error ?? "Could not create space.");
			}

			// Reload spaces
			try {
				const resp = await fetch(`${apiBaseUrl}/spaces`, {
					headers: authHeaders(),
				});
				if (resp.ok) {
					const body = (await resp.json()) as { spaces?: ApiSpace[] };
					const nextSpaces = body.spaces ?? [];
					setSpaces(nextSpaces);
					onSpacesLoaded?.(nextSpaces);
					const created = nextSpaces.find(
						(s) => s.name === trimmedName,
					);
					if (created) {
						setActiveSpaceId(created.id);

						toast.success(`Space '${created.name}' created`);
					}
				}
			} catch {
				// ignore
			}

			setIsCreateSpaceOpen(false);
			setNewSpaceName("");
			setCreateSpaceError(null);
		} catch (err) {
			setCreateSpaceError(
				err instanceof Error ? err.message : "Could not create space.",
			);
		} finally {
			setIsCreatingSpace(false);
		}
	};

	const handleUpdateSpace = async (
		event: React.FormEvent<HTMLFormElement>,
	) => {
		event.preventDefault();
		if (!activeSpace) return;

		const trimmedName = editSpaceName.trim();
		const validationError = validateSpaceName(trimmedName);
		if (validationError) {
			setEditSpaceError(validationError);
			return;
		}

		setIsUpdatingSpace(true);
		setEditSpaceError(null);

		try {
			const response = await fetch(
				`${apiBaseUrl}/spaces/${activeSpace.id}`,
				{
					method: "PATCH",
					headers: {
						...authHeaders(),
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ name: trimmedName }),
				},
			);
			const payload = (await response.json().catch(() => null)) as {
				space?: ApiSpace;
				error?: string;
			} | null;

			if (!response.ok || !payload?.space) {
				throw new Error(payload?.error ?? "Could not rename space.");
			}

			setSpaces((currentSpaces) =>
				currentSpaces.map((space) =>
					space.id === payload.space!.id ? payload.space! : space,
				),
			);
			onSpacesLoaded?.((currentSpaces) =>
				currentSpaces.map((space) =>
					space.id === payload.space!.id ? payload.space! : space,
				),
			);
			toast.success(`Space renamed to '${payload.space.name}'`);
			setIsEditSpaceOpen(false);
		} catch (err) {
			setEditSpaceError(
				err instanceof Error ? err.message : "Could not rename space.",
			);
		} finally {
			setIsUpdatingSpace(false);
		}
	};

	const handleDeleteSpace = async () => {
		if (!activeSpace) return;

		setIsDeletingSpace(true);
		setDeleteSpaceError(null);

		try {
			const response = await fetch(
				`${apiBaseUrl}/spaces/${activeSpace.id}`,
				{
					method: "DELETE",
					headers: authHeaders(),
				},
			);
			const payload = (await response.json().catch(() => null)) as {
				error?: string;
			} | null;

			if (!response.ok) {
				throw new Error(payload?.error ?? "Could not delete space.");
			}

			const nextSpaces = spaces.filter(
				(space) => space.id !== activeSpace.id,
			);
			setSpaces(nextSpaces);
			onSpacesLoaded?.(nextSpaces);
			setActiveSpaceId(nextSpaces[0]?.id ?? null);
			setCategories([]);
			toast.success(`Space '${activeSpace.name}' deleted`);
			setIsDeleteSpaceOpen(false);
		} catch (err) {
			setDeleteSpaceError(
				err instanceof Error ? err.message : "Could not delete space.",
			);
		} finally {
			setIsDeletingSpace(false);
		}
	};

	return (
		<>
			<Sidebar
				overlay
				collapsible="icon"
				className="top-[var(--header-height)] h-[calc(100svh-var(--header-height))] border-r border-r-border"
				{...props}
			>
				{/* Header: space switcher */}
				<SidebarHeader>
					<SidebarMenu>
						<SidebarMenuItem>
							<SpaceSwitcher
								spaces={spaces}
								activeSpace={activeSpace}
								onSelect={(space) => setActiveSpaceId(space.id)}
								onCreateSpace={() => setIsCreateSpaceOpen(true)}
								onEditActiveSpace={openEditSpaceModal}
								onDeleteActiveSpace={openDeleteSpaceModal}
							/>
						</SidebarMenuItem>
					</SidebarMenu>
					<div className="hidden group-data-[collapsible=icon]:block">
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									tooltip="Search"
									className="justify-center hover:bg-muted"
									style={{ transition: "none" }}
									onClick={openSearch}
								>
									<Search className="size-4" />
									<span className="sr-only">Open search</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</div>
					<div className="group-data-[collapsible=icon]:hidden">
						<div className="flex items-center gap-2 flex-col">
							<div className="relative flex-1 w-full">
								<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
								<SidebarInput
									ref={searchInputRef}
									value={searchQuery}
									onChange={(event) =>
										setSearchQuery(event.target.value)
									}
									placeholder="Search"
									className="pl-9"
								/>
							</div>
						</div>
					</div>
				</SidebarHeader>

				{/* Content: file tree for active space */}
				<SidebarContent>
					<FileTree
						categories={visibleCategories}
						isLoading={isLoading}
						error={error}
						newCategoryIds={newCategoryIds}
						newFileCategoryIds={newFileCategoryIds}
						newFileIds={newFileIds}
						expandedCategoryIds={expandedCategoryIds}
						onCategoryOpenChange={handleCategoryOpenChange}
						onManageCategories={openManageCategoriesModal}
						onToggleAllCategories={toggleAllCategories}
						onClearCategory={clearCategoryNotification}
						onClearNewFile={clearNewFile}
					/>
				</SidebarContent>

				{/* Footer: add buttons */}
				<SidebarFooter>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								tooltip="New file"
								className="w-full border border-dashed border-sidebar-border bg-sidebar text-muted-foreground transition-colors hover:border-sidebar-accent-foreground/30 hover:bg-sidebar-accent hover:text-foreground"
								onClick={() => setIsUploadModalOpen(true)}
							>
								<UploadCloud className="size-4" />
								<span className="group-data-[collapsible=icon]:hidden">
									New file
								</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton
								tooltip="New category"
								className="w-full mt-2 border border-dashed border-sidebar-border bg-sidebar text-muted-foreground transition-colors hover:border-sidebar-accent-foreground/30 hover:bg-sidebar-accent hover:text-foreground"
								onClick={openCreateCategoryModal}
							>
								<FolderPlus className="shrink-0" />
								<span className="group-data-[collapsible=icon]:hidden">
									New category
								</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarFooter>

				<SidebarRail />
			</Sidebar>

			<UploadModal
				open={isUploadModalOpen}
				onOpenChange={setIsUploadModalOpen}
				spaceId={activeSpaceId}
			/>

			{isManageCategoriesOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-xs">
					<div className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
						<div className="flex items-start justify-between gap-4 border-b border-border bg-muted/40 px-6 py-5">
							<div className="flex min-w-0 items-start gap-3">
								<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
									<SlidersHorizontal className="size-5" />
								</span>
								<div className="min-w-0">
									<h2 className="text-lg font-semibold text-foreground">
										Manage categories
									</h2>
									<p className="mt-1 text-sm leading-6 text-muted-foreground">
										Rename or delete categories in{" "}
										<span className="font-medium text-foreground">
											{activeSpace?.name ?? "this space"}
										</span>
										.
									</p>
								</div>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={() => {
									setIsManageCategoriesOpen(false);
									setEditingCategoryId(null);
									setConfirmDeleteCategoryId(null);
									setCategoryActionError(null);
								}}
								aria-label="Close category manager"
							>
								<X className="size-4" />
							</Button>
						</div>

						<div className="max-h-[60vh] overflow-y-auto px-6 py-5">
							{categoryActionError && (
								<p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100">
									{categoryActionError}
								</p>
							)}
							{categories.length > 0 ? (
								<div className="space-y-2">
									{categories.map((category) => {
										const isEditing =
											editingCategoryId === category.id;
										const isUpdating =
											updatingCategoryId === category.id;
										const isDeleting =
											deletingCategoryId === category.id;
										const isConfirmingDelete =
											confirmDeleteCategoryId ===
											category.id;

										return (
											<div
												key={category.id}
												className="rounded-lg bg-background px-3 py-3 ring-1 ring-border/80"
											>
												{isEditing ? (
													<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
														<Input
															value={
																editingCategoryName
															}
															onChange={(
																event,
															) => {
																setEditingCategoryName(
																	event.target
																		.value,
																);
																if (
																	categoryActionError
																) {
																	setCategoryActionError(
																		null,
																	);
																}
															}}
															maxLength={80}
															className="h-9 bg-background px-3"
															aria-label="Category name"
														/>
														<div className="flex shrink-0 justify-end gap-2">
															<Button
																type="button"
																variant="outline"
																size="sm"
																onClick={() => {
																	setEditingCategoryId(
																		null,
																	);
																	setEditingCategoryName(
																		"",
																	);
																	setCategoryActionError(
																		null,
																	);
																}}
																disabled={
																	isUpdating
																}
															>
																Cancel
															</Button>
															<Button
																type="button"
																variant="accent"
																size="sm"
																onClick={() =>
																	handleUpdateCategory(
																		category,
																	)
																}
																disabled={
																	isUpdating
																}
															>
																{isUpdating
																	? "Saving..."
																	: "Save"}
															</Button>
														</div>
													</div>
												) : (
													<div className="flex items-center gap-3">
														<div className="min-w-0 flex-1">
															<p className="truncate text-sm font-medium text-foreground">
																{category.name}
															</p>
															<p className="mt-0.5 text-xs text-muted-foreground">
																{
																	category
																		.files
																		.length
																}{" "}
																{category.files
																	.length ===
																1
																	? "file"
																	: "files"}
															</p>
														</div>
														<Button
															type="button"
															variant="outline"
															size="sm"
															onClick={() =>
																startEditingCategory(
																	category,
																)
															}
															disabled={
																isDeleting
															}
														>
															<Edit3 className="size-3.5" />
															Rename
														</Button>
														<Button
															type="button"
															variant="destructive"
															size="sm"
															onClick={() =>
																handleDeleteCategory(
																	category,
																)
															}
															disabled={
																isDeleting
															}
														>
															<Trash2 className="size-3.5" />
															{isDeleting
																? "Deleting..."
																: isConfirmingDelete
																	? "Confirm"
																	: "Delete"}
														</Button>
													</div>
												)}
											</div>
										);
									})}
								</div>
							) : (
								<div className="rounded-lg bg-background px-4 py-8 text-center ring-1 ring-border/80">
									<p className="text-sm font-medium text-foreground">
										No categories yet
									</p>
									<p className="mt-1 text-sm text-muted-foreground">
										Create a category to start organizing
										files in this space.
									</p>
								</div>
							)}
						</div>

						<div className="flex justify-end gap-2 border-t border-border bg-muted/40 px-6 py-3">
							<Button
								type="button"
								variant="outline"
								size="lg"
								onClick={() => setIsManageCategoriesOpen(false)}
							>
								Done
							</Button>
							<Button
								type="button"
								variant="accent"
								size="lg"
								onClick={() => {
									setIsManageCategoriesOpen(false);
									openCreateCategoryModal();
								}}
							>
								<FolderPlus className="size-4" />
								New category
							</Button>
						</div>
					</div>
				</div>
			)}

			{isCreateCategoryOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-xs">
					<div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
						<div className="flex items-start gap-3 border-b border-border bg-muted/40 px-6 py-5">
							<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
								<FolderPlus className="size-5" />
							</span>
							<div className="min-w-0">
								<h2 className="text-lg font-semibold text-foreground">
									Create new category
								</h2>
								<p className="mt-1 text-sm leading-6 text-muted-foreground">
									Group related files inside the current
									space.
								</p>
								<span className="mt-3 inline-flex max-w-full rounded-md bg-background px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border/80">
									<span className="truncate">
										{activeSpace?.name ?? "Default Space"}
									</span>
								</span>
							</div>
						</div>

						<form
							className="px-6 py-5"
							onSubmit={handleCreateCategory}
						>
							<div className="space-y-2">
								<Label htmlFor="new-category-name">
									Category name
								</Label>
								<Input
									id="new-category-name"
									type="text"
									value={newCategoryName}
									onChange={(event) => {
										setNewCategoryName(event.target.value);
										if (createCategoryError) {
											setCreateCategoryError(null);
										}
									}}
									placeholder="e.g. Contracts"
									maxLength={80}
									autoFocus
									className="h-10 bg-background px-3"
								/>
								<p className="text-xs text-muted-foreground">
									Use a short label that will scan well in the
									sidebar.
								</p>
							</div>

							{createCategoryError && (
								<p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100">
									{createCategoryError}
								</p>
							)}

							<div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
								<Button
									type="button"
									variant="outline"
									size="lg"
									className="min-w-24"
									onClick={closeCreateCategoryModal}
									disabled={isCreatingCategory}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									variant="accent"
									size="lg"
									className="min-w-40"
									disabled={isCreatingCategory}
								>
									{isCreatingCategory
										? "Creating..."
										: "Create new category"}
								</Button>
							</div>
						</form>
					</div>
				</div>
			)}
			{isCreateSpaceOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-xs">
					<div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
						<div className="flex items-start gap-3 border-b border-border bg-muted/40 px-6 py-5">
							<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
								<LayersPlus className="size-5" />
							</span>
							<div className="min-w-0">
								<h2 className="text-lg font-semibold text-foreground">
									Create new space
								</h2>
								<p className="mt-1 text-sm leading-6 text-muted-foreground">
									Keep files, categories, and graph
									connections separated by workspace.
								</p>
							</div>
						</div>

						<form
							className="px-6 py-5"
							onSubmit={handleCreateSpace}
						>
							<div className="space-y-2">
								<Label htmlFor="new-space-name">
									Space name
								</Label>
								<Input
									id="new-space-name"
									type="text"
									value={newSpaceName}
									onChange={(event) => {
										setNewSpaceName(event.target.value);
										if (createSpaceError)
											setCreateSpaceError(null);
									}}
									placeholder="e.g. Acme Corp"
									maxLength={80}
									autoFocus
									className="h-10 bg-background px-3"
								/>
								<p className="text-xs text-muted-foreground">
									Spaces are private containers for a focused
									set of documents.
								</p>
							</div>

							{createSpaceError && (
								<p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100">
									{createSpaceError}
								</p>
							)}

							<div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
								<Button
									type="button"
									variant="outline"
									size="lg"
									className="min-w-24"
									onClick={() => {
										if (isCreatingSpace) return;
										setIsCreateSpaceOpen(false);
										setNewSpaceName("");
										setCreateSpaceError(null);
									}}
									disabled={isCreatingSpace}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									variant="accent"
									size="lg"
									className="min-w-36"
									disabled={isCreatingSpace}
								>
									{isCreatingSpace
										? "Creating..."
										: "Create new space"}
								</Button>
							</div>
						</form>
					</div>
				</div>
			)}
			{isEditSpaceOpen && activeSpace && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-xs">
					<div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
						<div className="flex items-start gap-3 border-b border-border bg-muted/40 px-6 py-5">
							<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
								<Edit3 className="size-5" />
							</span>
							<div className="min-w-0">
								<h2 className="text-lg font-semibold text-foreground">
									Rename space
								</h2>
								<p className="mt-1 text-sm leading-6 text-muted-foreground">
									Update the workspace name shown in the
									sidebar.
								</p>
							</div>
						</div>

						<form
							className="px-6 py-5"
							onSubmit={handleUpdateSpace}
						>
							<div className="space-y-2">
								<Label htmlFor="edit-space-name">
									Space name
								</Label>
								<Input
									id="edit-space-name"
									type="text"
									value={editSpaceName}
									onChange={(event) => {
										setEditSpaceName(event.target.value);
										if (editSpaceError)
											setEditSpaceError(null);
									}}
									maxLength={80}
									autoFocus
									className="h-10 bg-background px-3"
								/>
							</div>

							{editSpaceError && (
								<p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100">
									{editSpaceError}
								</p>
							)}

							<div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
								<Button
									type="button"
									variant="outline"
									size="lg"
									className="min-w-24"
									onClick={() => {
										if (isUpdatingSpace) return;
										setIsEditSpaceOpen(false);
										setEditSpaceError(null);
									}}
									disabled={isUpdatingSpace}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									variant="accent"
									size="lg"
									className="min-w-32"
									disabled={isUpdatingSpace}
								>
									{isUpdatingSpace ? "Saving..." : "Save"}
								</Button>
							</div>
						</form>
					</div>
				</div>
			)}
			{isDeleteSpaceOpen && activeSpace && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-xs">
					<div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
						<div className="flex items-start gap-3 border-b border-border bg-muted/40 px-6 py-5">
							<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background text-red-600 ring-1 ring-red-200">
								<Trash2 className="size-5" />
							</span>
							<div className="min-w-0">
								<h2 className="text-lg font-semibold text-foreground">
									Delete space?
								</h2>
								<p className="mt-1 text-sm leading-6 text-muted-foreground">
									This deletes{" "}
									<span className="font-medium text-foreground">
										{activeSpace.name}
									</span>{" "}
									and all categories and files inside it.
								</p>
							</div>
						</div>

						<div className="px-6 py-5">
							{deleteSpaceError && (
								<p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100">
									{deleteSpaceError}
								</p>
							)}
							<div className="flex justify-end gap-2 border-t border-border pt-4">
								<Button
									type="button"
									variant="outline"
									size="lg"
									className="min-w-24"
									onClick={() => {
										if (isDeletingSpace) return;
										setIsDeleteSpaceOpen(false);
										setDeleteSpaceError(null);
									}}
									disabled={isDeletingSpace}
								>
									Cancel
								</Button>
								<Button
									type="button"
									variant="destructive"
									size="lg"
									className="min-w-32"
									onClick={handleDeleteSpace}
									disabled={isDeletingSpace}
								>
									{isDeletingSpace ? "Deleting..." : "Delete"}
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
