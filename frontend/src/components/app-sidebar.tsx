"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
	ChevronRight,
	FileArchive,
	FileAudio,
	FileCode,
	FileImage,
	FileSpreadsheet,
	FolderOpen,
	FileVideo,
	FileText,
	Layers,
	FolderClosed,
	Search,
	X,
	FolderPlus,
	LayersPlus,
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
import { UploadWorkspace } from "@/components/upload-workspace";
import { cn } from "@/lib/utils";

const apiBaseUrl = "http://localhost:3000/api/v1";
const fileTreeUpdatedEvent = "kibi:file-tree-updated";

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

type ApiSearchResult = {
  id: number;
  filename: string;
  fileName: string;
  originalFileName: string | null;
  mimeType: string;
  snippet: string | null;
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

function searchResultDisplayName(file: ApiSearchResult) {
  return file.originalFileName || file.fileName || file.filename;
}

function dedupeSearchResults(results: ApiSearchResult[]) {
  const uniqueResults = new Map<string, ApiSearchResult>();

  for (const result of results) {
    const documentKey = String(result.id);
    if (!uniqueResults.has(documentKey)) {
      uniqueResults.set(documentKey, result);
    }
  }

  return [...uniqueResults.values()];
}

function highlightMatch(text: string, query: string) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return text;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = trimmedQuery.toLowerCase();
  const parts: React.ReactNode[] = [];
  let startIndex = 0;
  let matchIndex = lowerText.indexOf(lowerQuery);

  while (matchIndex >= 0) {
    if (matchIndex > startIndex) {
      parts.push(text.slice(startIndex, matchIndex));
    }

    const endIndex = matchIndex + trimmedQuery.length;
    parts.push(
      <mark key={`${matchIndex}-${endIndex}`} className="rounded bg-(--color-accent)/50 px-0.5 text-current">
        {text.slice(matchIndex, endIndex)}
      </mark>,
    );
    startIndex = endIndex;
    matchIndex = lowerText.indexOf(lowerQuery, startIndex);
  }

  if (startIndex < text.length) {
    parts.push(text.slice(startIndex));
  }

  return parts;
}

function fileExtension(file: KibiFile) {
	const name = file.filename || file.name;
	const extension = name.split(".").pop();
	return extension && extension !== name ? extension.toLowerCase() : "";
}

export function fileIconFor(file: KibiFile) {
	const mimeType = file.mimeType.toLowerCase();
	const extension = fileExtension(file);

	if (mimeType === "application/pdf" || extension === "pdf") return FileText;
	if (mimeType.startsWith("image/")) return FileImage;
	if (mimeType.startsWith("audio/")) return FileAudio;
	if (mimeType.startsWith("video/")) return FileVideo;
	if (
		mimeType.includes("spreadsheet") ||
		mimeType.includes("excel") ||
		["csv", "tsv", "xls", "xlsx"].includes(extension)
	) {
		return FileSpreadsheet;
	}
	if (
		mimeType.includes("zip") ||
		mimeType.includes("compressed") ||
		["zip", "rar", "7z", "tar", "gz"].includes(extension)
	) {
		return FileArchive;
	}
	if (
		mimeType.includes("json") ||
		mimeType.includes("xml") ||
		["js", "jsx", "ts", "tsx", "json", "html", "css", "md", "xml"].includes(
			extension,
		)
	) {
		return FileCode;
	}

	return FileText;
}

// ── Space switcher (header) ───────────────────────────────────────────────────

function SpaceSwitcher({
	spaces,
	activeSpace,
	onSelect,
	onCreateSpace,
}: {
	spaces: Space[];
	activeSpace: Space | null;
	onSelect: (space: Space) => void;
	onCreateSpace?: () => void;
}) {
	const { isMobile } = useSidebar();
	const activeSpaceName = activeSpace?.name ?? "No spaces";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<SidebarMenuButton
					tooltip={activeSpaceName}
					className="hover:bg-zinc-200 py-6"
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
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ── File tree (categories → files) ───────────────────────────────────────────

function CategoryItem({
	category,
	hasNewCategory,
	hasNewFiles,
	newFileIds,
	onClearCategory,
	onClearNewFile,
}: {
	category: Category;
	hasNewCategory: boolean;
	hasNewFiles: boolean;
	newFileIds: Set<number>;
	onClearCategory: (category: Category) => void;
	onClearNewFile: (categoryId: number, fileId: number) => void;
}) {
	const [open, setOpen] = React.useState(category.files.length > 0);
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
		setOpen(nextOpen);
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
							"hover:bg-zinc-200",
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
						<ChevronRight
							className={
								allowCategoryWrap
									? "mt-0.5 ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden"
									: "ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden"
							}
						/>
					</SidebarMenuButton>
				</CollapsibleTrigger>

				<CollapsibleContent>
					<SidebarMenuSub>
						{category.files.length > 0 ? (
							category.files.map((file) => (
								<SidebarMenuSubItem key={file.id}>
									<SidebarMenuSubButton
										asChild
										className="hover:bg-zinc-200"
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
	onClearCategory,
	onClearNewFile,
}: {
	categories: Category[];
	isLoading: boolean;
	error: string | null;
	newCategoryIds: Set<number>;
	newFileCategoryIds: Set<number>;
	newFileIds: Set<number>;
	onClearCategory: (category: Category) => void;
	onClearNewFile: (categoryId: number, fileId: number) => void;
}) {
	return (
		<SidebarGroup>
			<SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
				Categories
			</SidebarGroupLabel>
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
							hasNewCategory={newCategoryIds.has(category.id)}
							hasNewFiles={newFileCategoryIds.has(category.id)}
							newFileIds={newFileIds}
							onClearCategory={onClearCategory}
							onClearNewFile={onClearNewFile}
						/>
					))}
			</SidebarMenu>
		</SidebarGroup>
	);
}

function SearchResults({
  results,
  query,
  isSearching,
  error,
}: {
  results: ApiSearchResult[];
  query: string;
  isSearching: boolean;
  error: string | null;
}) {
  const dedupedResults = React.useMemo(
    () => dedupeSearchResults(results),
    [results],
  );

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
        Search
      </SidebarGroupLabel>
      <SidebarMenu>
        {isSearching && (
          <SidebarMenuItem>
            <span className="block px-2 py-1 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
              Searching...
            </span>
          </SidebarMenuItem>
        )}
        {!isSearching && error && (
          <SidebarMenuItem>
            <span className="block px-2 py-1 text-sm text-destructive group-data-[collapsible=icon]:hidden">
              {error}
            </span>
          </SidebarMenuItem>
        )}
        {!isSearching && !error && dedupedResults.length === 0 && (
          <SidebarMenuItem>
            <span className="block px-2 py-1 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
              No matches for "{query}"
            </span>
          </SidebarMenuItem>
        )}
        {!isSearching &&
          !error &&
          dedupedResults.map((result) => (
            <SidebarMenuItem key={result.id}>
              <SidebarMenuButton asChild className="hover:bg-zinc-200 h-auto">
                <Link to={`/file/${result.id}`} className="flex items-start gap-2 py-2">
                  <span className="mt-0.5 shrink-0">
                    {React.createElement(
                      fileIconFor({
                        id: result.id,
                        name: searchResultDisplayName(result),
                        filename: result.filename,
                        mimeType: result.mimeType,
                      }),
                      { className: "size-4 text-muted-foreground/80" },
                    )}
                  </span>
                  <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <span className="block truncate text-sm text-foreground">
                      {highlightMatch(searchResultDisplayName(result), query)}
                    </span>
                    {result.snippet ? (
                      <span className="mt-1 block whitespace-normal break-words text-xs leading-relaxed text-muted-foreground">
                        {highlightMatch(result.snippet, query)}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

// ── Add button (footer) ───────────────────────────────────────────────────────

function AddButton({
  onNewCollection,
}: {
  onNewCollection: () => void;
}) {
  const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            tooltip="Add new"
            className="w-full border border-dashed border-sidebar-border bg-sidebar text-muted-foreground shadow-sm transition-colors hover:border-sidebar-accent-foreground/30 hover:bg-sidebar-accent hover:text-foreground"
          >
            <Plus className="shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">
              Add new
            </span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="min-w-44">
          <DropdownMenuItem
            className="gap-2"
            onSelect={() => setIsUploadModalOpen(true)}
          >
            <FileText className="size-4" /> New file
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2" onSelect={onNewCollection}>
            <FolderOpen className="size-4" /> New category
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2">
            <Layers className="size-4" /> New space
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <UploadModal
        open={isUploadModalOpen}
        onOpenChange={setIsUploadModalOpen}
      />
    </>
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
			className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 p-4 supports-backdrop-filter:backdrop-blur-xs"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget && !isUploadLocked) {
					onOpenChange(false);
				}
			}}
		>
			<Card className="relative z-[201] max-h-[85vh] w-full max-w-4xl overflow-hidden py-0 shadow-2xl">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="absolute top-4 right-4 z-10 disabled:cursor-not-allowed disabled:opacity-40"
					onClick={requestClose}
					disabled={isUploadLocked}
				>
					<X className="size-4" />
					<span className="sr-only">Close upload modal</span>
				</Button>
				<CardHeader className="border-b pr-12">
					<CardTitle>Upload files</CardTitle>
					<CardDescription>
						Drop PDFs or images here, then track each file while
						analysis runs.
					</CardDescription>
				</CardHeader>
				<CardContent className="overflow-y-auto py-4">
					<UploadWorkspace
						detailMode="compact"
						showHeading={false}
						onBusyChange={handleBusyChange}
						spaceId={spaceId}
					/>
				</CardContent>
				<div className="grid min-h-18 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t bg-muted/40 px-6 py-3 text-muted-foreground">
					<span className="flex min-h-full items-center text-sm leading-relaxed md:text-[15px]">
						{isUploadLocked
							? "You can't leave while files are uploading or analyzing, or the batch may be interrupted."
							: hasAnalysisStarted
								? "Finished here? Press Esc, click outside, or use Done to close."
								: "Press Esc, click outside, or use the close button to leave."}
					</span>
					{hasAnalysisStarted ? (
						<Button
							type="button"
							variant="ghost"
							className="shrink-0 self-end !bg-(--color-accent) !text-black hover:!bg-(--color-accent-hover) disabled:!bg-zinc-400 disabled:!text-zinc-100"
							size="default"
							onClick={requestClose}
							disabled={isUploadLocked}
						>
							Done
						</Button>
					) : null}
				</div>
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
	const [isCreateSpaceOpen, setIsCreateSpaceOpen] = React.useState(false);
	const [newSpaceName, setNewSpaceName] = React.useState("");
	const [isCreatingSpace, setIsCreatingSpace] = React.useState(false);
	const [createSpaceError, setCreateSpaceError] = React.useState<
		string | null
	>(null);
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
	const categoryFileIdsRef = React.useRef<Map<number, Set<number>>>(
		new Map(),
	);
	const fileTreeLoadedRef = React.useRef(false);

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

	const closeCreateCategoryModal = React.useCallback(() => {
		if (isCreatingCategory) return;
		setIsCreateCategoryOpen(false);
		setNewCategoryName("");
		setCreateCategoryError(null);
	}, [isCreatingCategory]);

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
				// Insert the new category into the categories list client-side to avoid full refetch
				setCategories((current) => {
					const next = [...current];
					next.push({
						id: createdCategory.id,
						name: createdCategory.name || trimmedName,
						files: [],
					});
					return next.sort((a, b) => a.name.localeCompare(b.name));
				});

				setNewCategoryIds((currentIds) => {
					const nextIds = new Set(currentIds);
					nextIds.add(createdCategory.id as number);
					return nextIds;
				});

				toast.success(
					`Category '${createdCategory.name ?? trimmedName}' created in '${activeSpace.name ?? "Default Space"}'`,
				);
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

	return (
		<>
			<Sidebar
				overlay
				collapsible="icon"
				className="top-[var(--header-height)] h-[calc(100svh-var(--header-height))] border-r border-r-zinc-100"
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
							/>
						</SidebarMenuItem>
					</SidebarMenu>
					<div className="hidden group-data-[collapsible=icon]:block">
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									tooltip="Search"
									className="justify-center hover:bg-zinc-200"
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
						onClearCategory={clearCategoryNotification}
						onClearNewFile={clearNewFile}
					/>
				</SidebarContent>

				{/* Footer: add buttons */}
				<SidebarFooter>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								tooltip="New category"
								className="w-full border border-dashed border-sidebar-border bg-sidebar text-muted-foreground transition-colors hover:border-sidebar-accent-foreground/30 hover:bg-sidebar-accent hover:text-foreground"
								onClick={openCreateCategoryModal}
							>
								<FolderPlus className="shrink-0" />
								<span className="group-data-[collapsible=icon]:hidden">
									New category
								</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton
								tooltip="New file"
								className="w-full mt-2 border border-dashed border-sidebar-border bg-sidebar text-muted-foreground transition-colors hover:border-sidebar-accent-foreground/30 hover:bg-sidebar-accent hover:text-foreground"
								onClick={() => setIsUploadModalOpen(true)}
							>
								<FileText className="size-4" />
								<span className="group-data-[collapsible=icon]:hidden">
									New file
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

			{isCreateCategoryOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-xs">
					<div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
						<h2 className="text-lg font-semibold text-zinc-950">
							Create New Category
						</h2>
						<p className="mt-1 text-sm text-zinc-500">
							Add a name for the new category.
						</p>
						<p className="mt-2 text-xs text-zinc-500">
							Creating category in:{" "}
							<strong>
								{activeSpace?.name ?? "Default Space"}
							</strong>
						</p>

						<form className="mt-5" onSubmit={handleCreateCategory}>
							<label
								htmlFor="new-category-name"
								className="block text-sm font-medium text-zinc-800"
							>
								Category name
							</label>
							<input
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
								className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500"
							/>

							{createCategoryError && (
								<p className="mt-2 text-sm text-red-600">
									{createCategoryError}
								</p>
							)}

							<div className="mt-5 flex justify-end gap-3">
								<button
									type="button"
									onClick={closeCreateCategoryModal}
									disabled={isCreatingCategory}
									className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={isCreatingCategory}
									className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
								>
									{isCreatingCategory
										? "Creating..."
										: "Create new category"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
			{isCreateSpaceOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-xs">
					<div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
						<h2 className="text-lg font-semibold text-zinc-950">
							Create New Space
						</h2>
						<p className="mt-1 text-sm text-zinc-500">
							Add a name for the new space.
						</p>

						<form className="mt-5" onSubmit={handleCreateSpace}>
							<label
								htmlFor="new-space-name"
								className="block text-sm font-medium text-zinc-800"
							>
								Space name
							</label>
							<input
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
								className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500"
							/>

							{createSpaceError && (
								<p className="mt-2 text-sm text-red-600">
									{createSpaceError}
								</p>
							)}

							<div className="mt-5 flex justify-end gap-3">
								<button
									type="button"
									onClick={() => {
										if (isCreatingSpace) return;
										setIsCreateSpaceOpen(false);
										setNewSpaceName("");
										setCreateSpaceError(null);
									}}
									disabled={isCreatingSpace}
									className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={isCreatingSpace}
									className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
								>
									{isCreatingSpace
										? "Creating..."
										: "Create new space"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</>
	);
}
