// components/app-sidebar.tsx
"use client";

import * as React from "react";
import {
	ChevronRight,
	FolderOpen,
	FileText,
	Plus,
	Layers,
	LayoutGrid,
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

type KibiFile = { id: string; name: string };
type Collection = { id: string; name: string; files: KibiFile[] };
type Space = { id: string; name: string; collections: Collection[] };

const spaces: Space[] = [
	{
		id: "s1",
		name: "Personal",
		collections: [
			{
				id: "c1",
				name: "Notes",
				files: [
					{ id: "f1", name: "Meeting notes" },
					{ id: "f2", name: "Ideas" },
				],
			},
			{
				id: "c2",
				name: "Research",
				files: [{ id: "f3", name: "Paper summaries" }],
			},
		],
	},
	{
		id: "s2",
		name: "Work",
		collections: [
			{
				id: "c3",
				name: "Projects",
				files: [
					{ id: "f4", name: "Q1 Roadmap" },
					{ id: "f5", name: "Sprint planning" },
					{ id: "f6", name: "Retro notes" },
				],
			},
		],
	},
	{
		id: "s3",
		name: "Learning",
		collections: [
			{
				id: "c4",
				name: "Courses",
				files: [
					{ id: "f7", name: "TypeScript handbook" },
					{ id: "f8", name: "System design" },
				],
			},
		],
	},
];

// ── Space switcher (header) ───────────────────────────────────────────────────

function SpaceSwitcher({
	spaces,
	activeSpace,
	onSelect,
}: {
	spaces: Space[];
	activeSpace: Space;
	onSelect: (space: Space) => void;
}) {
	const { isMobile, state } = useSidebar();
	const collapsed = state === "collapsed";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<SidebarMenuButton tooltip={activeSpace.name}>
					<Layers />
					<div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
						<span className="truncate font-semibold">
							{activeSpace.name}
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
				{spaces.map((space) => (
					<DropdownMenuItem
						key={space.id}
						onSelect={() => onSelect(space)}
						className="gap-2"
					>
						<div className="flex size-6 items-center justify-center rounded-md border bg-background">
							<Layers className="size-3.5 shrink-0" />
						</div>
						{space.name}
						{space.id === activeSpace.id && (
							<span className="ml-auto text-xs text-muted-foreground">
								Active
							</span>
						)}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ── File tree (collections → files) ──────────────────────────────────────────

function CollectionItem({ collection }: { collection: Collection }) {
	const [open, setOpen] = React.useState(false);
	const { state, setOpen: setSidebarOpen } = useSidebar();

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
					<SidebarMenuButton tooltip={collection.name}>
						{open ? (
							<FolderOpen className="shrink-0" />
						) : (
							<FolderClosed className="shrink-0" />
						)}
						<span className="group-data-[collapsible=icon]:hidden">
							{collection.name}
						</span>
						<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
					</SidebarMenuButton>
				</CollapsibleTrigger>

				<CollapsibleContent>
					<SidebarMenuSub>
						{collection.files.map((file) => (
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
						))}
					</SidebarMenuSub>
				</CollapsibleContent>
			</SidebarMenuItem>
		</Collapsible>
	);
}

function FileTree({ space }: { space: Space }) {
	return (
		<SidebarGroup>
			<SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
				Collections
			</SidebarGroupLabel>
			<SidebarMenu>
				{space.collections.map((collection) => (
					<CollectionItem
						key={collection.id}
						collection={collection}
					/>
				))}
			</SidebarMenu>
		</SidebarGroup>
	);
}

// ── Add button (footer) ───────────────────────────────────────────────────────

function AddButton() {
	const { state } = useSidebar();
	const collapsed = state === "collapsed";

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
	const [activeSpace, setActiveSpace] = React.useState<Space>(spaces[0]);

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
							onSelect={setActiveSpace}
						/>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			{/* Content: file tree for active space */}
			<SidebarContent>
				<FileTree space={activeSpace} />
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
