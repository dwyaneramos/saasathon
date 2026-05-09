// components/app-sidebar.tsx
"use client";

import * as React from "react";
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
	Plus,
	FolderClosed,
	Orbit,
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
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
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
}: {
	spaces: Space[];
	activeSpace: Space | null;
	onSelect: (space: Space) => void;
}) {
	const { isMobile } = useSidebar();
	const activeSpaceName = activeSpace?.name ?? "No spaces";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<SidebarMenuButton
					tooltip={activeSpaceName}
					className="hover:bg-zinc-200"
					style={{ transition: "none" }}
				>
					<Orbit />
					<div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
						<span className="truncate font-semibold">
							{activeSpaceName}
						</span>
						<span className="truncate text-xs text-muted-foreground">
							Active space
						</span>
					</div>
					<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
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
								<Orbit className="size-3.5 shrink-0" />
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
		if (nextOpen && state === "collapsed") {
			setSidebarOpen(true);
		}
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

// ── Add button (footer) ───────────────────────────────────────────────────────

type AddButtonProps = {
	onNewCollection: () => void;
};

function AddButton({ onNewCollection }: AddButtonProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<SidebarMenuButton
					tooltip="Add new"
					className="w-full border border-dashed border-sidebar-border border-zinc-400 text-muted-foreground hover:text-foreground hover:bg-zinc-200"
					style={{ transition: "none" }}
				>
					<Plus className="shrink-0" />
					<span className="group-data-[collapsible=icon]:hidden">
						Add new
					</span>
				</SidebarMenuButton>
			</DropdownMenuTrigger>
			<DropdownMenuContent side="top" align="start" className="min-w-44">
				<DropdownMenuItem className="gap-2">
					<FileText className="size-4" /> New file
				</DropdownMenuItem>
				<DropdownMenuItem className="gap-2" onSelect={onNewCollection}>
					<FolderOpen className="size-4" /> New collection
				</DropdownMenuItem>
				<DropdownMenuItem className="gap-2">
					<Orbit className="size-4" /> New space
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ── AppSidebar ────────────────────────────────────────────────────────────────

export function AppSidebar({
	activeSpaceId,
	onSpaceChange,
	onSpacesLoaded,
	...props
}: React.ComponentProps<typeof Sidebar> & {
	activeSpaceId: number | null;
	onSpaceChange: (id: number | null) => void;
	onSpacesLoaded: (spaces: Space[]) => void;
}) {
	const [spaces, setSpaces] = React.useState<Space[]>([]);
	const [categories, setCategories] = React.useState<Category[]>([]);
	const [isLoading, setIsLoading] = React.useState(true);
	const [spacesLoaded, setSpacesLoaded] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [isCreateCategoryOpen, setIsCreateCategoryOpen] = React.useState(false);
	const [newCategoryName, setNewCategoryName] = React.useState("");
	const [createCategoryError, setCreateCategoryError] = React.useState<string | null>(
		null,
	);
	const [isCreatingCategory, setIsCreatingCategory] = React.useState(false);
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

	const activeSpace =
		spaces.find((space) => space.id === activeSpaceId) ?? spaces[0] ?? null;

	const validateCategoryName = React.useCallback(
		(value: string) => {
			const trimmed = value.trim();

			if (!trimmed) return "Category name is required.";
			if (trimmed.length < 2) return "Category name must be at least 2 characters.";
			if (trimmed.length > 80) return "Category name must be 80 characters or fewer.";
			if (
				categories.some(
					(category) => category.name.trim().toLowerCase() === trimmed.toLowerCase(),
				)
			) {
				return "A category with this name already exists.";
			}

			return null;
		},
		[categories],
	);

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
				onSpacesLoaded(nextSpaces);
				onSpaceChange(
					nextSpaces.some((s) => s.id === activeSpaceId)
						? activeSpaceId
						: (nextSpaces[0]?.id ?? null),
				);
				setSpacesLoaded(true);
			} catch {
				if (!ignore) {
					setError("Unable to load spaces");
					setIsLoading(false);
					setSpacesLoaded(true);
				}
			}
		}

		loadSpaces();

		return () => {
			ignore = true;
		};
	}, []);

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

	const handleCreateCategory = async (event: React.FormEvent<HTMLFormElement>) => {
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
			const payload = (await response.json().catch(() => null)) as
				| { category?: { id?: number }; error?: string }
				| null;

			if (!response.ok) {
				throw new Error(payload?.error ?? "Could not create category.");
				}

				await loadFileTree();

				const createdCategoryId = payload?.category?.id;
				if (typeof createdCategoryId === "number") {
					setNewCategoryIds((currentIds) => {
						const nextIds = new Set(currentIds);
						nextIds.add(createdCategoryId);
						return nextIds;
					});
				}

			setIsCreateCategoryOpen(false);
			setNewCategoryName("");
			setCreateCategoryError(null);
		} catch (err) {
			setCreateCategoryError(
				err instanceof Error ? err.message : "Could not create category.",
			);
		} finally {
			setIsCreatingCategory(false);
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
								onSelect={(space) => onSpaceChange(space.id)}
							/>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarHeader>

				{/* Content: file tree for active space */}
				<SidebarContent>
					<FileTree
						categories={categories}
						isLoading={isLoading}
						error={error}
						newCategoryIds={newCategoryIds}
						newFileCategoryIds={newFileCategoryIds}
						newFileIds={newFileIds}
						onClearCategory={clearCategoryNotification}
						onClearNewFile={clearNewFile}
					/>
				</SidebarContent>

				{/* Footer: add button */}
				<SidebarFooter>
					<SidebarMenu>
						<SidebarMenuItem>
							<AddButton onNewCollection={openCreateCategoryModal} />
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarFooter>

				<SidebarRail />
			</Sidebar>

			{isCreateCategoryOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-xs">
					<div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
						<h2 className="text-lg font-semibold text-zinc-950">
							Create New Category
						</h2>
						<p className="mt-1 text-sm text-zinc-500">
							Add a name for the new collection.
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
		</>
	);
}
