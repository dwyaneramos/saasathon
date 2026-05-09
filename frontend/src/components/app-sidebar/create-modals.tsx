import type * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
			<div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground">
				<h2 className="text-lg font-semibold text-foreground">
					Create New Category
				</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					Add a name for the new category.
				</p>
				<p className="mt-2 text-xs text-muted-foreground">
					Creating category in: <strong>{activeSpaceName}</strong>
				</p>

				<form className="mt-5" onSubmit={onSubmit}>
					<Label htmlFor="new-category-name">Category name</Label>
					<Input
						id="new-category-name"
						type="text"
						value={newCategoryName}
						onChange={(event) => onNameChange(event.target.value)}
						placeholder="e.g. Contracts"
						maxLength={80}
						autoFocus
						className="mt-2"
					/>

					{createCategoryError && (
						<p className="mt-2 text-sm text-destructive">
							{createCategoryError}
						</p>
					)}

					<div className="mt-5 flex justify-end gap-3">
						<Button
							type="button"
							variant="outline"
							onClick={onClose}
							disabled={isCreatingCategory}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							variant="accent"
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
			<div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground">
				<h2 className="text-lg font-semibold text-foreground">
					Create New Space
				</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					Add a name for the new space.
				</p>

				<form className="mt-5" onSubmit={onSubmit}>
					<Label htmlFor="new-space-name">Space name</Label>
					<Input
						id="new-space-name"
						type="text"
						value={newSpaceName}
						onChange={(event) => onNameChange(event.target.value)}
						placeholder="e.g. Acme Corp"
						maxLength={80}
						autoFocus
						className="mt-2"
					/>

					{createSpaceError && (
						<p className="mt-2 text-sm text-destructive">
							{createSpaceError}
						</p>
					)}

					<div className="mt-5 flex justify-end gap-3">
						<Button
							type="button"
							variant="outline"
							onClick={onClose}
							disabled={isCreatingSpace}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							variant="accent"
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
