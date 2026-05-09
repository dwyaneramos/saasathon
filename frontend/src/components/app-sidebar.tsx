// components/app-sidebar.tsx
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
  Search,
  FileSpreadsheet,
  FolderOpen,
  FileVideo,
  FileText,
  Plus,
  Layers,
  FolderClosed,
  X,
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
import { Button } from "@/components/ui/button";
import { UploadWorkspace } from "@/components/upload-workspace";

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
    if (category.files.length > 0) {
      setOpen(true);
    }
  }, [category.files.length]);

  React.useEffect(() => {
    if (state !== "expanded") {
      setAllowCategoryWrap(false);
      return;
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
            className={
              allowCategoryWrap ? "h-auto min-h-8 items-start" : undefined
            }
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
                  <SidebarMenuSubButton asChild>
                    <Link
                      to={`/file/${file.id}`}
                      className="flex items-start gap-2 text-muted-foreground"
                      onClick={() => onClearNewFile(category.id, file.id)}
                    >
                      <span className="relative mt-0.5 flex shrink-0">
                        {React.createElement(fileIconFor(file), {
                          className: "size-3.5 shrink-0 text-muted-foreground/80",
                        })}
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

function SearchPanel({
  query,
  onQueryChange,
  inputRef,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { setOpen } = useSidebar();

  const handleSearchActivate = React.useCallback(() => {
    setOpen(true);
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 220);
  }, [inputRef, setOpen]);

  return (
    <div className="relative min-h-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 hidden group-data-[collapsible=icon]:block">
        <button
          onClick={handleSearchActivate}
          title="Search"
          className="pointer-events-auto absolute top-0 left-4 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Search className="size-4 shrink-0" />
        </button>
      </div>
      <SidebarGroup className="gap-2 group-data-[collapsible=icon]:hidden">
        <div className="px-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
            <SidebarInput
              ref={inputRef}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search"
              className="pl-8"
            />
          </div>
        </div>
      </SidebarGroup>
    </div>
  );
}

function SearchResults({
  query,
  results,
  isSearching,
  error,
}: {
  query: string;
  results: ApiSearchResult[];
  isSearching: boolean;
  error: string | null;
}) {
  const trimmedQuery = query.trim();

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
        Results
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
        {!isSearching && !error && trimmedQuery && results.length === 0 && (
          <SidebarMenuItem>
            <span className="block px-2 py-1 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
              No matches found
            </span>
          </SidebarMenuItem>
        )}
        {results.map((result) => (
          <SidebarMenuItem key={result.id}>
            <SidebarMenuButton asChild className="h-auto py-2">
              <Link
                to={`/file/${result.id}`}
                className="flex items-start gap-2"
              >
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
                    {highlightMatch(searchResultDisplayName(result), trimmedQuery)}
                  </span>
                  {result.snippet && (
                    <span className="mt-1 block whitespace-normal break-words text-xs leading-relaxed text-muted-foreground">
                      {highlightMatch(result.snippet, trimmedQuery)}
                    </span>
                  )}
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

function AddButton() {
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
          <DropdownMenuItem className="gap-2">
            <FolderOpen className="size-4" /> New collection
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isUploadLocked, setIsUploadLocked] = React.useState(false);

  const requestClose = React.useCallback(() => {
    if (isUploadLocked) {
      return;
    }

    onOpenChange(false);
  }, [isUploadLocked, onOpenChange]);

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
            Drop PDFs or images here, then track each file while analysis runs.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-y-auto py-4">
          <UploadWorkspace
            detailMode="compact"
            showHeading={false}
            onBusyChange={setIsUploadLocked}
          />
        </CardContent>
        <div className="grid min-h-18 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t bg-muted/40 px-6 py-3 text-muted-foreground">
          <span className="flex min-h-full items-center text-sm leading-relaxed md:text-[15px]">
            {isUploadLocked
              ? "You can't leave while files are uploading or analyzing, or the batch may be interrupted."
              : "Finished here? Press Esc, click outside, or use Done to close."}
          </span>
          <Button
            type="button"
            variant="ghost"
            className="shrink-0 self-end !bg-bg !text-white hover:!bg-bg/90 disabled:!bg-bg/50 disabled:!text-white"
            size="default"
            onClick={requestClose}
            disabled={isUploadLocked}
          >
            Done
          </Button>
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
  const [uncontrolledActiveSpaceId, setUncontrolledActiveSpaceId] = React.useState<number | null>(null);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [spacesLoaded, setSpacesLoaded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<ApiSearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const [newCategoryIds, setNewCategoryIds] = React.useState<Set<number>>(
    () => new Set(),
  );
  const [newFileCategoryIds, setNewFileCategoryIds] = React.useState<Set<number>>(
    () => new Set(),
  );
  const [newFileIds, setNewFileIds] = React.useState<Set<number>>(
    () => new Set(),
  );
  const categoryFileIdsRef = React.useRef<Map<number, Set<number>>>(new Map());
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
  const hasActiveSearch = searchQuery.trim().length > 0;

  const clearNewFile = React.useCallback((categoryId: number, fileId: number) => {
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
  }, []);

  const clearCategoryNotification = React.useCallback((category: Category) => {
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
  }, []);

  const loadFileTree = React.useCallback(async (
    detectNewFiles = false,
    changedDocumentIds: number[] = [],
  ) => {
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

      if (detectNewFiles && (fileTreeLoadedRef.current || changedDocumentIdSet.size > 0)) {
        setNewCategoryIds((currentIds) => {
          const nextIds = new Set(currentIds);

          for (const category of nextCategories) {
            const previousFileIds = categoryFileIdsRef.current.get(category.id);
            const hasChangedDocument = category.files.some((file) =>
              changedDocumentIdSet.has(file.id),
            );

            if (!previousFileIds && (fileTreeLoadedRef.current || hasChangedDocument)) {
              nextIds.add(category.id);
            }
          }

          return nextIds;
        });
        setNewFileCategoryIds((currentIds) => {
          const nextIds = new Set(currentIds);

          for (const [categoryId, fileIds] of nextCategoryFileIds) {
            const previousFileIds = categoryFileIdsRef.current.get(categoryId);
            const hasChangedDocument = [...fileIds].some((fileId) =>
              changedDocumentIdSet.has(fileId),
            );
            const hasAddedFiles = previousFileIds
              ? [...fileIds].some((fileId) => !previousFileIds.has(fileId))
              : fileIds.size > 0;

            if (hasAddedFiles || hasChangedDocument) {
              nextIds.add(categoryId);
            }
          }

          return nextIds;
        });
        setNewFileIds((currentIds) => {
          const nextIds = new Set(currentIds);

          for (const [categoryId, fileIds] of nextCategoryFileIds) {
            const previousFileIds = categoryFileIdsRef.current.get(categoryId);

            for (const fileId of fileIds) {
              if (
                changedDocumentIdSet.has(fileId) ||
                (fileTreeLoadedRef.current &&
                  (!previousFileIds || !previousFileIds.has(fileId)))
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
          setIsLoading(false);
          setSpacesLoaded(true);
        }
      }
    }

    loadSpaces();

    return () => {
      ignore = true;
    };
  }, [onSpacesLoaded, setActiveSpaceId]);

  React.useEffect(() => {
    loadFileTree();
  }, [loadFileTree]);

  React.useEffect(() => {
    if (!hasActiveSearch) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);

      try {
        const params = new URLSearchParams({
          q: searchQuery.trim(),
        });
        if (activeSpaceId) {
          params.set("spaceId", String(activeSpaceId));
        }

        const response = await fetch(
          `${apiBaseUrl}/documents/search?${params.toString()}`,
          {
            headers: authHeaders(),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("Unable to search files");
        }

        const payload = (await response.json()) as {
          results?: ApiSearchResult[];
        };
        setSearchResults(payload.results ?? []);
      } catch (searchErr) {
        if (controller.signal.aborted) {
          return;
        }
        setSearchResults([]);
        setSearchError("Unable to search files");
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 320);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [activeSpaceId, hasActiveSearch, searchQuery]);

  React.useEffect(() => {
    const handleFileTreeUpdated = (event: Event) => {
      const documentIds =
        (event as FileTreeUpdatedEvent).detail?.documentIds ?? [];
      void loadFileTree(true, documentIds);
    };

    window.addEventListener(fileTreeUpdatedEvent, handleFileTreeUpdated);

    return () => {
      window.removeEventListener(fileTreeUpdatedEvent, handleFileTreeUpdated);
    };
  }, [loadFileTree]);

  return (
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
            />
          </SidebarMenuItem>
        </SidebarMenu>
        <SearchPanel
          query={searchQuery}
          onQueryChange={setSearchQuery}
          inputRef={searchInputRef}
        />
      </SidebarHeader>

      {/* Content: file tree for active space */}
      <SidebarContent>
        {hasActiveSearch ? (
          <SearchResults
            query={searchQuery}
            results={searchResults}
            isSearching={isSearching}
            error={searchError}
          />
        ) : (
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
        )}
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

function highlightMatch(text: string, query: string) {
  if (!query.trim()) {
    return text;
  }

  const terms = buildHighlightTerms(query);
  if (terms.length === 0) {
    return text;
  }

  const pattern = new RegExp(`(${terms.join("|")})`, "gi");
  const parts = text.split(pattern);

  return parts.map((part, index) =>
    terms.some((term) => new RegExp(`^${term}$`, "i").test(part)) ? (
      <mark
        key={`${part}-${index}`}
        className="rounded bg-amber-200/80 px-0.5 text-foreground"
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    ),
  );
}

function buildHighlightTerms(query: string) {
  return [...new Set(
    query
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .concat(query.trim())
      .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  )].sort((a, b) => b.length - a.length);
}
