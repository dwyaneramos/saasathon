import type * as React from "react";
import type { Sidebar } from "@/components/ui/sidebar";

export const fileTreeUpdatedEvent = "kibi:file-tree-updated";
export const openUploadModalEvent = "kibi:open-upload-modal";

export type KibiFile = {
	id: number;
	name: string;
	filename: string;
	mimeType: string;
	searchSnippet?: string | null;
};

export type Category = { id: number; name: string; files: KibiFile[] };
export type Space = { id: number; name: string };

export type ApiSpace = {
	id: number;
	name: string;
};

export type ApiCategory = {
	id: number;
	name: string;
	spaceId: number | null;
};

export type ApiDocument = {
	id: number;
	filename: string;
	fileName: string;
	originalFileName: string | null;
	mimeType: string;
	categoryId: number | null;
};

export type ApiDocumentSearchResult = ApiDocument & {
	categoryName?: string | null;
	score?: number;
	snippet?: string | null;
};

export type FileTreeUpdatedEvent = CustomEvent<{
	documentIds?: number[];
}>;

export type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
	activeSpaceId?: number | null;
	onSpaceChange?: React.Dispatch<React.SetStateAction<number | null>>;
	onSpacesLoaded?: React.Dispatch<React.SetStateAction<Space[]>>;
};
