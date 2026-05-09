// components/app-sidebar.tsx
"use client";

import * as React from "react";
import {
	ChevronRight,
	FolderOpen,
	FileText,
	Plus,
	Layers,
	FolderClosed,
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

const apiBaseUrl = "http://localhost:3000/api/v1";
const fileTreeUpdatedEvent = "kibi:file-tree-updated";

type KibiFile = { id: number; name: string };
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
	categoryId: number | null;
};

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
				<SidebarMenuButton tooltip={activeSpaceName}>
					<Layers />
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
							<div className="flex size-6 items-center justify-center rounded-md border bg-background">
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
					<DropdownMenuItem disabled>No spaces found</DropdownMenuItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ── File tree (categories → files) ───────────────────────────────────────────

function CategoryItem({ category }: { category: Category }) {
	const [open, setOpen] = React.useState(category.files.length > 0);
	const { state, setOpen: setSidebarOpen } = useSidebar();

	React.useEffect(() => {
		if (category.files.length > 0) {
			setOpen(true);
		}
	}, [category.files.length]);

	function handleOpenChange(nextOpen: boolean) {
		setOpen(nextOpen);
		if (nextOpen && state === "collapsed") {
			setSidebarOpen(true);
		}
	}

	return (
		<Collapsible
			open={open}
			onOpenChange={handleOpenChange}
			className="group/collapsible"
		>
			<SidebarMenuItem>
				<CollapsibleTrigger asChild>
					<SidebarMenuButton tooltip={category.name}>
						{open ? (
							<FolderOpen className="shrink-0" />
						) : (
							<FolderClosed className="shrink-0" />
						)}
						<span className="group-data-[collapsible=icon]:hidden">
							{category.name}
						</span>
						<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
					</SidebarMenuButton>
				</CollapsibleTrigger>

				<CollapsibleContent>
					<SidebarMenuSub>
						{category.files.length > 0 ? (
							category.files.map((file) => (
								<SidebarMenuSubItem key={file.id}>
									<SidebarMenuSubButton asChild>
										<a
											href={`/file/${file.id}`}
											className="flex items-center gap-2"
										>
											<FileText className="size-3.5 shrink-0" />
											<span>{file.name}</span>
										</a>
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
}: {
	categories: Category[];
	isLoading: boolean;
	error: string | null;
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
						<CategoryItem key={category.id} category={category} />
					))}
			</SidebarMenu>
		</SidebarGroup>
	);
}

// ── Add button (footer) ───────────────────────────────────────────────────────

function AddButton() {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<SidebarMenuButton
					tooltip="Add new"
					className="w-full border border-dashed border-sidebar-border hover:border-sidebar-accent-foreground/30 text-muted-foreground hover:text-foreground transition-colors"
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
				<DropdownMenuItem className="gap-2">
					<FolderOpen className="size-4" /> New collection
				</DropdownMenuItem>
				<DropdownMenuItem className="gap-2">
					<Layers className="size-4" /> New space
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ── AppSidebar ────────────────────────────────────────────────────────────────

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const [spaces, setSpaces] = React.useState<Space[]>([]);
	const [activeSpaceId, setActiveSpaceId] = React.useState<number | null>(null);
	const [categories, setCategories] = React.useState<Category[]>([]);
	const [isLoading, setIsLoading] = React.useState(true);
	const [spacesLoaded, setSpacesLoaded] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const activeSpace =
		spaces.find((space) => space.id === activeSpaceId) ?? spaces[0] ?? null;

	const loadFileTree = React.useCallback(async () => {
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
			])) as [{ categories?: ApiCategory[] }, { documents?: ApiDocument[] }];

			const documents = documentPayload.documents ?? [];
			const nextCategories = (categoryPayload.categories ?? []).map(
				(category) => ({
					id: category.id,
					name: category.name,
					files: documents
						.filter((document) => document.categoryId === category.id)
						.map((document) => ({
							id: document.id,
							name: fileDisplayName(document),
						})),
				}),
			);

			setCategories(nextCategories);
		} catch {
			setCategories([]);
			setError("Unable to load files");
		} finally {
			setIsLoading(false);
		}
	}, [activeSpaceId, spacesLoaded]);

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

				const payload = (await response.json()) as { spaces?: ApiSpace[] };
				const nextSpaces = payload.spaces ?? [];
				if (ignore) return;

				setSpaces(nextSpaces);
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
		loadFileTree();
	}, [loadFileTree]);

	React.useEffect(() => {
		window.addEventListener(fileTreeUpdatedEvent, loadFileTree);

		return () => {
			window.removeEventListener(fileTreeUpdatedEvent, loadFileTree);
		};
	}, [loadFileTree]);

	return (
		<Sidebar
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
				/>
			</SidebarContent>

			{/* Footer: add button */}
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<AddButton />
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>

			<SidebarRail />
		</Sidebar>
	);
}
