import * as React from "react";
import { Link } from "react-router-dom";
import {
	ChevronRight,
	FolderClosed,
	FolderOpen,
} from "lucide-react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
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

type CategoryItemProps = {
	category: Category;
	searchQuery: string;
	hasNewCategory: boolean;
	hasNewFiles: boolean;
	newFileIds: Set<number>;
	onClearCategory: (category: Category) => void;
	onClearNewFile: (categoryId: number, fileId: number) => void;
};

function CategoryItemBase({
	category,
	searchQuery,
	hasNewCategory,
	hasNewFiles,
	newFileIds,
	onClearCategory,
	onClearNewFile,
}: CategoryItemProps) {
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
							{highlightSearchText(category.name, searchQuery)}
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
										className="h-auto hover:bg-muted"
									>
										<Link
											to={`/file/${file.id}`}
											className="flex items-start gap-2 text-muted-foreground"
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
		previous.searchQuery === next.searchQuery &&
		previous.hasNewCategory === next.hasNewCategory &&
		previous.hasNewFiles === next.hasNewFiles &&
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
	onClearCategory,
	onClearNewFile,
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
							searchQuery={searchQuery}
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
