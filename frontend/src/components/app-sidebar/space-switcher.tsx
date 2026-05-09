import {
	ChevronRight,
	Edit3,
	Layers,
	LayersPlus,
	Trash2,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenuButton,
	useSidebar,
} from "@/components/ui/sidebar";
import type { Space } from "./types";

export function SpaceSwitcher({
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
