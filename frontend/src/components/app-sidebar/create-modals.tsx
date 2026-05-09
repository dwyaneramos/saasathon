import type * as React from "react";
import { Edit3, FolderPlus, LayersPlus, SlidersHorizontal, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Category, Space } from "./types";

export function CreateCategoryModal({
	activeSpaceName,
	newCategoryName,
	createCategoryError,
	isCreatingCategory,
	onNameChange,
	onSubmit,
	onClose,
}: {
	activeSpaceName: string;
	newCategoryName: string;
	createCategoryError: string | null;
	isCreatingCategory: boolean;
	onNameChange: (value: string) => void;
	onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
	onClose: () => void;
}) {
	return (
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
							Group related files inside the current space.
						</p>
						<span className="mt-3 inline-flex max-w-full rounded-md bg-background px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border/80">
							<span className="truncate">{activeSpaceName}</span>
						</span>
					</div>
				</div>

				<form className="px-6 py-5" onSubmit={onSubmit}>
					<div className="space-y-2">
						<Label htmlFor="new-category-name">Category name</Label>
						<Input
							id="new-category-name"
							type="text"
							value={newCategoryName}
							onChange={(event) => onNameChange(event.target.value)}
							placeholder="e.g. Contracts"
							maxLength={80}
							autoFocus
							className="h-10 bg-background px-3"
						/>
						<p className="text-xs text-muted-foreground">
							Use a short label that will scan well in the sidebar.
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
							onClick={onClose}
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
	);
}

export function CreateSpaceModal({
	newSpaceName,
	createSpaceError,
	isCreatingSpace,
	onNameChange,
	onSubmit,
	onClose,
}: {
	newSpaceName: string;
	createSpaceError: string | null;
	isCreatingSpace: boolean;
	onNameChange: (value: string) => void;
	onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
	onClose: () => void;
}) {
	return (
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
							Keep files, categories, and graph connections separated by workspace.
						</p>
					</div>
				</div>

				<form className="px-6 py-5" onSubmit={onSubmit}>
					<div className="space-y-2">
						<Label htmlFor="new-space-name">Space name</Label>
						<Input
							id="new-space-name"
							type="text"
							value={newSpaceName}
							onChange={(event) => onNameChange(event.target.value)}
							placeholder="e.g. Acme Corp"
							maxLength={80}
							autoFocus
							className="h-10 bg-background px-3"
						/>
						<p className="text-xs text-muted-foreground">
							Spaces are private containers for a focused set of documents.
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
							onClick={onClose}
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
							{isCreatingSpace ? "Creating..." : "Create new space"}
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}

export function ManageCategoriesModal({
	activeSpaceName,
	categories,
	categoryActionError,
	editingCategoryId,
	editingCategoryName,
	updatingCategoryId,
	deletingCategoryId,
	confirmDeleteCategoryId,
	onEditingNameChange,
	onStartEditing,
	onCancelEditing,
	onUpdateCategory,
	onDeleteCategory,
	onClose,
	onCreateCategory,
}: {
	activeSpaceName: string;
	categories: Category[];
	categoryActionError: string | null;
	editingCategoryId: number | null;
	editingCategoryName: string;
	updatingCategoryId: number | null;
	deletingCategoryId: number | null;
	confirmDeleteCategoryId: number | null;
	onEditingNameChange: (value: string) => void;
	onStartEditing: (category: Category) => void;
	onCancelEditing: () => void;
	onUpdateCategory: (category: Category) => void;
	onDeleteCategory: (category: Category) => void;
	onClose: () => void;
	onCreateCategory: () => void;
}) {
	return (
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
									{activeSpaceName}
								</span>
								.
							</p>
						</div>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={onClose}
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
								const isEditing = editingCategoryId === category.id;
								const isUpdating = updatingCategoryId === category.id;
								const isDeleting = deletingCategoryId === category.id;
								const isConfirmingDelete =
									confirmDeleteCategoryId === category.id;

								return (
									<div
										key={category.id}
										className="rounded-lg bg-background px-3 py-3 ring-1 ring-border/80"
									>
										{isEditing ? (
											<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
												<Input
													value={editingCategoryName}
													onChange={(event) =>
														onEditingNameChange(event.target.value)
													}
													maxLength={80}
													className="h-9 bg-background px-3"
													aria-label="Category name"
												/>
												<div className="flex shrink-0 justify-end gap-2">
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={onCancelEditing}
														disabled={isUpdating}
													>
														Cancel
													</Button>
													<Button
														type="button"
														variant="accent"
														size="sm"
														onClick={() => onUpdateCategory(category)}
														disabled={isUpdating}
													>
														{isUpdating ? "Saving..." : "Save"}
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
														{category.files.length}{" "}
														{category.files.length === 1
															? "file"
															: "files"}
													</p>
												</div>
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() => onStartEditing(category)}
													disabled={isDeleting}
												>
													<Edit3 className="size-3.5" />
													Rename
												</Button>
												<Button
													type="button"
													variant="destructive"
													size="sm"
													onClick={() => onDeleteCategory(category)}
													disabled={isDeleting}
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
								Create a category to start organizing files in this space.
							</p>
						</div>
					)}
				</div>

				<div className="flex justify-end gap-2 border-t border-border bg-muted/40 px-6 py-3">
					<Button type="button" variant="outline" size="lg" onClick={onClose}>
						Done
					</Button>
					<Button
						type="button"
						variant="accent"
						size="lg"
						onClick={onCreateCategory}
					>
						<FolderPlus className="size-4" />
						New category
					</Button>
				</div>
			</div>
		</div>
	);
}

export function EditSpaceModal({
	space,
	editSpaceName,
	editSpaceError,
	isUpdatingSpace,
	onNameChange,
	onSubmit,
	onClose,
}: {
	space: Space;
	editSpaceName: string;
	editSpaceError: string | null;
	isUpdatingSpace: boolean;
	onNameChange: (value: string) => void;
	onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
	onClose: () => void;
}) {
	return (
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
							Update the workspace name shown in the sidebar.
						</p>
					</div>
				</div>

				<form className="px-6 py-5" onSubmit={onSubmit}>
					<div className="space-y-2">
						<Label htmlFor="edit-space-name">Space name</Label>
						<Input
							id="edit-space-name"
							type="text"
							value={editSpaceName}
							onChange={(event) => onNameChange(event.target.value)}
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
							onClick={onClose}
							disabled={isUpdatingSpace}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							variant="accent"
							size="lg"
							className="min-w-32"
							disabled={isUpdatingSpace || editSpaceName.trim() === space.name}
						>
							{isUpdatingSpace ? "Saving..." : "Save"}
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}

export function DeleteSpaceModal({
	space,
	deleteSpaceError,
	isDeletingSpace,
	onDelete,
	onClose,
}: {
	space: Space;
	deleteSpaceError: string | null;
	isDeletingSpace: boolean;
	onDelete: () => void;
	onClose: () => void;
}) {
	return (
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
								{space.name}
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
							onClick={onClose}
							disabled={isDeletingSpace}
						>
							Cancel
						</Button>
						<Button
							type="button"
							variant="destructive"
							size="lg"
							className="min-w-32"
							onClick={onDelete}
							disabled={isDeletingSpace}
						>
							{isDeletingSpace ? "Deleting..." : "Delete"}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
