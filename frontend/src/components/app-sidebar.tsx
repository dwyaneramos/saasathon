"use client";

import * as React from "react";
import {
	Search,
	FolderPlus,
	UploadCloud,
} from "lucide-react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarInput,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
import { toast } from "sonner";
import { apiBaseUrl } from "@/lib/api";
import {
	CreateCategoryModal,
	CreateSpaceModal,
} from "./app-sidebar/create-modals";
import { SpaceSwitcher } from "./app-sidebar/space-switcher";
import { FileTree } from "./app-sidebar/file-tree";
import { UploadModal } from "./app-sidebar/upload-modal";
import {
	fileTreeUpdatedEvent,
	openUploadModalEvent,
	type ApiCategory,
	type ApiDocument,
	type ApiDocumentSearchResult,
	type ApiSpace,
	type AppSidebarProps,
	type Category,
	type FileTreeUpdatedEvent,
	type Space,
} from "./app-sidebar/types";

export { fileTreeUpdatedEvent, openUploadModalEvent };
export type { KibiFile } from "./app-sidebar/types";

function authHeaders() {
	const token = localStorage.getItem("token");
	return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function fileDisplayName(file: ApiDocument) {
	return file.originalFileName || file.fileName || file.filename;
}

function reconcileFiles(
	currentFiles: Category["files"],
	nextFiles: Category["files"],
) {
	const currentById = new Map(currentFiles.map((file) => [file.id, file]));
	let changed = currentFiles.length !== nextFiles.length;

	const files = nextFiles.map((nextFile) => {
		const currentFile = currentById.get(nextFile.id);
		if (
			currentFile &&
			currentFile.name === nextFile.name &&
			currentFile.filename === nextFile.filename &&
			currentFile.mimeType === nextFile.mimeType
		) {
			return currentFile;
		}

		changed = true;
		return nextFile;
	});

	return changed ? files : currentFiles;
}

function reconcileCategories(
	currentCategories: Category[],
	nextCategories: Category[],
) {
	const currentById = new Map(
		currentCategories.map((category) => [category.id, category]),
	);
	let changed = currentCategories.length !== nextCategories.length;

	const categories = nextCategories.map((nextCategory) => {
		const currentCategory = currentById.get(nextCategory.id);
		if (!currentCategory) {
			changed = true;
			return nextCategory;
		}

		const files = reconcileFiles(currentCategory.files, nextCategory.files);
		if (
			currentCategory.name === nextCategory.name &&
			files === currentCategory.files
		) {
			return currentCategory;
		}

		changed = true;
		return {
			...currentCategory,
			name: nextCategory.name,
			files,
		};
	});

	return changed ? categories : currentCategories;
}

// ── AppSidebar ────────────────────────────────────────────────────────────────

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
	const [contentSearchResults, setContentSearchResults] = React.useState<
		ApiDocumentSearchResult[]
	>([]);
	const [isContentSearching, setIsContentSearching] = React.useState(false);
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
	const contentSearchFileIds = React.useMemo(
		() => new Set(contentSearchResults.map((result) => result.id)),
		[contentSearchResults],
	);
	const contentSearchResultsById = React.useMemo(
		() =>
			new Map(
				contentSearchResults.map((result) => [
					result.id,
					result,
				]),
			),
		[contentSearchResults],
	);
	const visibleCategories = React.useMemo<Category[]>(() => {
		if (!trimmedSearchQuery) {
			return categories;
		}

		return categories
			.map((category): Category | null => {
				const categoryMatches = category.name
					.toLowerCase()
					.includes(trimmedSearchQuery);
				const matchingFiles = category.files
					.filter(
						(file) =>
							file.name
								.toLowerCase()
								.includes(trimmedSearchQuery) ||
							file.filename
								.toLowerCase()
								.includes(trimmedSearchQuery) ||
							contentSearchFileIds.has(file.id),
					)
					.map((file) => ({
						...file,
							searchSnippet:
								contentSearchResultsById.get(file.id)
									?.snippet ?? undefined,
					}));

				if (categoryMatches) {
					return {
						...category,
						files: category.files.map((file) => ({
							...file,
								searchSnippet:
									contentSearchResultsById.get(file.id)
										?.snippet ?? undefined,
						})),
					};
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
	}, [
		categories,
		contentSearchFileIds,
		contentSearchResultsById,
		trimmedSearchQuery,
	]);
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

			const shouldBlockTree = !fileTreeLoadedRef.current;
			if (shouldBlockTree) {
				setIsLoading(true);
				setError(null);
			}

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
				setCategories((currentCategories) =>
					reconcileCategories(currentCategories, nextCategories),
				);
			} catch {
				if (shouldBlockTree) {
					setCategories([]);
					setError("Unable to load files");
				}
			} finally {
				if (shouldBlockTree) {
					setIsLoading(false);
				}
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
			fileTreeLoadedRef.current = false;
			categoryFileIdsRef.current = new Map();
			setCategories([]);
			setContentSearchResults([]);
			setIsLoading(true);
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
		const query = searchQuery.trim();
		if (query.length < 2) {
			setContentSearchResults([]);
			setIsContentSearching(false);
			return;
		}

		const abortController = new AbortController();
		const timeout = window.setTimeout(async () => {
			setIsContentSearching(true);

			try {
				const params = new URLSearchParams({
					q: query,
					limit: "20",
				});
				if (typeof activeSpaceId === "number") {
					params.set("spaceId", String(activeSpaceId));
				}

				const response = await fetch(
					`${apiBaseUrl}/documents/search?${params.toString()}`,
					{
						headers: authHeaders(),
						signal: abortController.signal,
					},
				);
				const payload = (await response.json().catch(() => null)) as {
					documents?: ApiDocumentSearchResult[];
				} | null;

				if (!response.ok) {
					throw new Error("Search failed");
				}

				setContentSearchResults(payload?.documents ?? []);
			} catch (err) {
				if (
					err instanceof DOMException &&
					err.name === "AbortError"
				) {
					return;
				}

				setContentSearchResults([]);
			} finally {
				if (!abortController.signal.aborted) {
					setIsContentSearching(false);
				}
			}
		}, 180);

		return () => {
			window.clearTimeout(timeout);
			abortController.abort();
		};
	}, [activeSpaceId, searchQuery]);

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
						isSearching={isContentSearching}
						hasSearchQuery={trimmedSearchQuery.length > 0}
						searchQuery={searchQuery}
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

			{isCreateCategoryOpen && (
				<CreateCategoryModal
					activeSpaceName={activeSpace?.name ?? "Default Space"}
					newCategoryName={newCategoryName}
					createCategoryError={createCategoryError}
					isCreatingCategory={isCreatingCategory}
					onNameChange={(value) => {
						setNewCategoryName(value);
						if (createCategoryError) {
							setCreateCategoryError(null);
						}
					}}
					onSubmit={handleCreateCategory}
					onClose={closeCreateCategoryModal}
				/>
			)}
			{isCreateSpaceOpen && (
				<CreateSpaceModal
					newSpaceName={newSpaceName}
					createSpaceError={createSpaceError}
					isCreatingSpace={isCreatingSpace}
					onNameChange={(value) => {
						setNewSpaceName(value);
						if (createSpaceError) {
							setCreateSpaceError(null);
						}
					}}
					onSubmit={handleCreateSpace}
					onClose={() => {
						if (isCreatingSpace) return;
						setIsCreateSpaceOpen(false);
						setNewSpaceName("");
						setCreateSpaceError(null);
					}}
				/>
			)}
		</>
	);
}
