import type { CreatedCategory } from "./types";

export function UploadCategorySelector({
	knownCategoryOptions,
	selectedCategoryId,
	selectedUploadCategory,
	isBusy,
	onSelectedCategoryIdChange,
}: {
	knownCategoryOptions: CreatedCategory[];
	selectedCategoryId: string;
	selectedUploadCategory: CreatedCategory | null;
	isBusy: boolean;
	onSelectedCategoryIdChange: (categoryId: string) => void;
}) {
	return (
		<div className="rounded-lg border border-border bg-background px-3 py-3">
			<label
				htmlFor="upload-target-category"
				className="block text-sm font-medium text-foreground"
			>
				Upload to
			</label>
			<select
				id="upload-target-category"
				value={selectedCategoryId}
				onChange={(event) =>
					onSelectedCategoryIdChange(event.target.value)
				}
				disabled={isBusy || knownCategoryOptions.length === 0}
				className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
			>
				<option value="">Auto categorize</option>
				{knownCategoryOptions.map((category) => (
					<option key={category.id ?? category.name} value={category.id}>
						{category.name}
					</option>
				))}
			</select>
			<p className="mt-2 text-xs text-muted-foreground">
				{knownCategoryOptions.length === 0
					? "Create a category first to upload directly into it."
					: selectedUploadCategory
						? `Files will be placed in ${selectedUploadCategory.name}.`
						: "Let Kibi choose the best category during analysis."}
			</p>
		</div>
	);
}
