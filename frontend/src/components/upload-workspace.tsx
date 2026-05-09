import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	CheckCircle2,
	ChevronDown,
	Hourglass,
	LoaderCircle,
	UploadCloud,
	X,
} from "lucide-react";
import { fileIconFor } from "@/lib/file-icons";
import type {
	FileAnalysisResult,
	MultipleUploadResponse,
	UploadedFile,
} from "@/types/upload";

type AnalysisResponse = {
	document?: {
		id?: number;
		summary?: string;
	};
	category?: {
		id?: number;
		name?: string;
		spaceId?: number | null;
		metadata?: {
			description?: string | null;
			keywords?: string[];
		};
		description?: string | null;
	} | null;
	needsNewCategory?: boolean;
	suggestedCategoryName?: string;
	suggestedCategoryDescription?: string;
	prompt?: string | null;
	error?: string;
};

type CreatedCategory = {
	id?: number;
	name: string;
	description: string;
};

type CategoryListResponse = {
	categories?: Array<{
		id?: number;
		name: string;
		spaceId?: number | null;
		metadata?: {
			description?: string | null;
			keywords?: string[];
		};
		description: string | null;
	}>;
};

type CategoryUpsertResponse = {
	category?: {
		id?: number;
		name?: string;
		metadata?: {
			description?: string | null;
			keywords?: string[];
		};
		description?: string | null;
	};
	error?: string;
};

type CompactAnalysisStatus = {
	currentFileName: string;
	currentStatus: "Analyzing" | "Finished" | "Failed";
	remainingCount: number;
	totalCount: number;
};

type UploadWorkspaceProps = {
	detailMode?: "full" | "compact";
	showHeading?: boolean;
	onBusyChange?: (isBusy: boolean) => void;
	spaceId?: number | null;
};

const apiBaseUrl = "http://localhost:3000/api/v1";
const fileTreeUpdatedEvent = "kibi:file-tree-updated";
const textareaClassName =
	"min-h-20 w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm";

function formatFileSize(bytes: number) {
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}

	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function UploadWorkspace({
	detailMode = "full",
	showHeading = true,
	onBusyChange,
	spaceId,
}: UploadWorkspaceProps) {
	const [files, setFiles] = useState<File[]>([]);
	const [status, setStatus] = useState<string | null>(null);
	const [summary, setSummary] = useState<string>("");
	const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
	const [compactAnalysisStatus, setCompactAnalysisStatus] =
		useState<CompactAnalysisStatus | null>(null);
	const [analysisResults, setAnalysisResults] = useState<
		FileAnalysisResult[]
	>([]);
	const [knownCategoryOptions, setKnownCategoryOptions] = useState<
		CreatedCategory[]
	>([]);
	const [selectedCategoryId, setSelectedCategoryId] = useState("");
	const [openCategoryCombobox, setOpenCategoryCombobox] = useState<
		string | null
	>(null);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [isBusy, setIsBusy] = useState(false);
	const [pendingCompletion, setPendingCompletion] = useState<{
		documentIds: Array<number | undefined>;
		failedCount: number;
		totalCount: number;
		lastFileName: string;
	} | null>(null);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const activePromptRef = useRef<HTMLElement | null>(null);
	const pendingCategoryConfirmationRef = useRef<{
		fileName: string;
		resolve: () => void;
	} | null>(null);

	const addFiles = (newFiles: File[]) => {
		if (newFiles.length === 0 || isBusy) {
			return;
		}

		setFiles((prev) => [...prev, ...newFiles]);
		setStatus(null);
		setSummary("");
		setUploadedFiles([]);
		setCompactAnalysisStatus(null);
		setAnalysisResults([]);
		setPendingCompletion(null);
	};

	const notifyFileTreeUpdated = (
		documentIds: Array<number | undefined> = [],
	) => {
		window.dispatchEvent(
			new CustomEvent(fileTreeUpdatedEvent, {
				detail: {
					documentIds: documentIds.filter(
						(documentId): documentId is number =>
							typeof documentId === "number",
					),
				},
			}),
		);
	};

	const onDrop = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		addFiles(Array.from(e.dataTransfer.files ?? []));
	};

	const onDragOver = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
	};

	const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
		addFiles(Array.from(e.target.files ?? []));
		e.target.value = "";
	};

	const removeFile = (index: number) => {
		if (isBusy) {
			return;
		}

		setFiles((prev) => prev.filter((_, i) => i !== index));
	};

	const selectedUploadCategory = selectedCategoryId
		? knownCategoryOptions.find(
				(category) => String(category.id) === selectedCategoryId,
			) ?? null
		: null;

	const upload = async () => {
		if (files.length === 0) {
			setStatus("Select at least one file");
			return;
		}

		setIsBusy(true);
		setStatus(`Uploading ${files.length} file(s)...`);
		setAnalysisResults([]);
		setCompactAnalysisStatus(null);
		setPendingCompletion(null);
		setIsAnalyzing(false);

		try {
			const body = new FormData();
			files.forEach((file) => body.append("files", file));
			if (typeof spaceId === "number") {
				body.append("spaceId", String(spaceId));
			}
			if (selectedCategoryId) {
				body.append("categoryId", selectedCategoryId);
			}
			const res = await fetch(`${apiBaseUrl}/upload/multiple`, {
				method: "POST",
				headers: authHeaders(),
				body,
			});

			if (!res.ok) {
				throw new Error(`${res.status} ${res.statusText}`);
			}

			const payload = (await res.json()) as MultipleUploadResponse;
			setUploadedFiles(payload.files);
			notifyFileTreeUpdated(payload.files.map((file) => file.documentId));
			setSummary(
				`${payload.message} Total size: ${(payload.totalSize / 1024 / 1024).toFixed(2)} MB`,
			);
			setStatus("Upload successful. Analyzing files...");
			setIsAnalyzing(true);

			const knownCategories = await loadKnownCategories();
			const results: FileAnalysisResult[] = [];
			const totalCount = files.length;

			for (const [index, file] of files.entries()) {
				setCompactAnalysisStatus({
					currentFileName: file.name,
					currentStatus: "Analyzing",
					remainingCount: totalCount - index,
					totalCount,
				});

				const result = await analyzeFile(
					file,
					knownCategories,
					payload.files[index],
				);
				results.push(result);
				setAnalysisResults((prev) => [...prev, result]);
				setCompactAnalysisStatus({
					currentFileName: file.name,
					currentStatus: result.error ? "Failed" : "Finished",
					remainingCount: Math.max(totalCount - (index + 1), 0),
					totalCount,
				});

				if (result.needsNewCategory && !result.error) {
					await waitForCategoryConfirmation(result.fileName);
				}
			}

			const failedCount = results.filter((result) => result.error).length;
			setPendingCompletion({
				documentIds: results.map((result) => result.documentId),
				failedCount,
				totalCount,
				lastFileName:
					results[results.length - 1]?.fileName ??
					files[files.length - 1]?.name ??
					"",
			});
		} catch (err: any) {
			setStatus(`Upload failed: ${err.message ?? err}`);
			setIsBusy(false);
			setIsAnalyzing(false);
			setPendingCompletion(null);
			setCompactAnalysisStatus((prev) =>
				prev
					? {
							...prev,
							currentStatus: "Failed",
						}
					: null,
			);
		}
	};

	const analyzeFile = async (
		file: File,
		knownCategories: Map<string, CreatedCategory>,
		uploadedFile?: UploadedFile,
	): Promise<FileAnalysisResult> => {
		const endpoint = getAnalysisEndpoint(file);

		if (!endpoint) {
			return {
				documentId: uploadedFile?.documentId,
				fileName: file.name,
				categoryName: selectedUploadCategory?.name ?? "Not analysed",
				summary:
					"Analysis is available for PDFs, JPEGs, PNGs, GIFs, and WebP images.",
				prompt: null,
				needsNewCategory: false,
				categoryInput: selectedUploadCategory?.name ?? "",
				categoryDescription: selectedUploadCategory?.description ?? "",
				isCreatingCategory: false,
				categoryStatus: selectedUploadCategory
					? `Uploaded to ${selectedUploadCategory.name}.`
					: undefined,
			};
		}

		try {
			const body = new FormData();
			body.append("file", file);
			if (uploadedFile?.documentId) {
				body.append("documentId", String(uploadedFile.documentId));
			}
			if (selectedCategoryId) {
				body.append("categoryId", selectedCategoryId);
			}

			// The analyze endpoints read spaceId from the query string, so append it if provided
			const url =
				typeof spaceId === "number"
					? `${apiBaseUrl}${endpoint}?spaceId=${spaceId}`
					: `${apiBaseUrl}${endpoint}`;
			const res = await fetch(url, {
				method: "POST",
				headers: authHeaders(),
				body,
			});
			const payload = (await res.json()) as AnalysisResponse;

			if (!res.ok && payload.error) {
				throw new Error(payload.error);
			}

			if (!res.ok) {
				throw new Error(`${res.status} ${res.statusText}`);
			}

			if (selectedUploadCategory) {
				return {
					documentId: payload.document?.id ?? uploadedFile?.documentId,
					fileName: file.name,
					categoryName: selectedUploadCategory.name,
					suggestedCategoryName: selectedUploadCategory.name,
					suggestedCategoryDescription: selectedUploadCategory.description,
					summary: payload.document?.summary ?? "No summary returned.",
					prompt: null,
					needsNewCategory: false,
					categoryInput: selectedUploadCategory.name,
					categoryDescription: selectedUploadCategory.description,
					isCreatingCategory: false,
					categoryStatus: `Uploaded to ${selectedUploadCategory.name}.`,
				};
			}

			const categoryName =
				payload.category?.name ??
				payload.suggestedCategoryName ??
				"Uncategorized";
			const suggestionKey = categoryKey(
				payload.suggestedCategoryName ?? categoryName,
			);
			const existingCategory = knownCategories.get(suggestionKey);
			const needsNewCategory =
				Boolean(payload.needsNewCategory) && !existingCategory;

			if (payload.needsNewCategory && existingCategory) {
				const assignedCategory = await createOrAssignCategory(
					existingCategory.name,
					existingCategory.description,
					payload.document?.id,
				);
				knownCategories.set(
					categoryKey(assignedCategory.name),
					assignedCategory,
				);
			}

			return {
				documentId: payload.document?.id ?? uploadedFile?.documentId,
				fileName: file.name,
				categoryName: existingCategory?.name ?? categoryName,
				suggestedCategoryName: payload.suggestedCategoryName,
				suggestedCategoryDescription:
					payload.suggestedCategoryDescription,
				summary: payload.document?.summary ?? "No summary returned.",
				prompt: payload.prompt ?? null,
				needsNewCategory,
				categoryInput: payload.suggestedCategoryName ?? categoryName,
				categoryDescription:
					existingCategory?.description ??
					payload.suggestedCategoryDescription ??
					buildFallbackCategoryDescription(categoryName),
				isCreatingCategory: false,
				categoryStatus: existingCategory
					? `Assigned to ${existingCategory.name}.`
					: undefined,
			};
		} catch (err: any) {
			return {
				fileName: file.name,
				categoryName: "Analysis failed",
				summary: "",
				prompt: null,
				needsNewCategory: false,
				categoryInput: "",
				categoryDescription: "",
				isCreatingCategory: false,
				error: err.message ?? "Analysis failed",
			};
		}
	};

	const categoryKey = (name: string) => name.trim().toLowerCase();

	const buildFallbackCategoryDescription = (name: string) =>
		`Documents related to ${name.toLowerCase()}.`;

	const getCategoryDescription = (category?: {
		metadata?: { description?: string | null };
		description?: string | null;
	}) =>
		category?.metadata?.description?.trim() ||
		category?.description?.trim() ||
		null;

	const loadKnownCategories = async () => {
		const url =
			typeof spaceId === "number"
				? `${apiBaseUrl}/categories?spaceId=${spaceId}`
				: `${apiBaseUrl}/categories`;
		const res = await fetch(url, {
			headers: authHeaders(),
		});
		if (!res.ok) {
			setKnownCategoryOptions([]);
			return new Map<string, CreatedCategory>();
		}

		const payload = (await res
			.json()
			.catch(() => null)) as CategoryListResponse | null;
		const categories = payload?.categories ?? [];
		const options = categories
			.map((category) => ({
				id: category.id,
				name: category.name,
				description:
					getCategoryDescription(category) ??
					buildFallbackCategoryDescription(category.name),
			}))
			.sort((a, b) => a.name.localeCompare(b.name));

		setKnownCategoryOptions(options);

		return new Map(
			options.map((category) => [categoryKey(category.name), category]),
		);
	};

	const createOrAssignCategory = async (
		name: string,
		description: string,
		documentId?: number,
	) => {
		const res = await fetch(`${apiBaseUrl}/categories`, {
			method: "POST",
			headers: {
				...authHeaders(),
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				name,
				description,
				keywords: [name],
				metadata: {
					description,
					keywords: [name],
				},
				documentId,
				spaceId: typeof spaceId === "number" ? spaceId : null,
			}),
		});
		const payload = (await res
			.json()
			.catch(() => null)) as CategoryUpsertResponse | null;

		if (!res.ok) {
			throw new Error(
				payload?.error ?? `${res.status} ${res.statusText}`,
			);
		}

		notifyFileTreeUpdated([documentId]);

		return {
			id: payload?.category?.id,
			name: payload?.category?.name ?? name,
			description:
				getCategoryDescription(payload?.category) ??
				(description || buildFallbackCategoryDescription(name)),
		};
	};

	const updateCategoryInput = (fileName: string, value: string) => {
		const selectedCategory = knownCategoryOptions.find(
			(category) => categoryKey(category.name) === categoryKey(value),
		);

		const nextValue = selectedCategory?.name ?? value;

		setAnalysisResults((prev) =>
			prev.map((result) =>
				result.fileName === fileName
					? {
							...result,
							categoryInput: nextValue,
							categoryDescription:
								selectedCategory?.description ??
								result.categoryDescription,
							categoryStatus: undefined,
						}
					: result,
			),
		);
	};

	const authHeaders = (): Record<string, string> => {
		const token = localStorage.getItem("token");
		return token ? { Authorization: `Bearer ${token}` } : {};
	};

	const confirmCategory = async (result: FileAnalysisResult) => {
		const name = result.categoryInput.trim();
		if (!name) {
			setAnalysisResults((prev) =>
				prev.map((item) =>
					item.fileName === result.fileName
						? { ...item, categoryStatus: "Enter a category name." }
						: item,
				),
			);
			return;
		}

		setAnalysisResults((prev) =>
			prev.map((item) =>
				item.fileName === result.fileName
					? {
							...item,
							isCreatingCategory: true,
							categoryStatus: undefined,
						}
					: item,
			),
		);

		try {
			const category = await createOrAssignCategory(
				name,
				result.categoryDescription?.trim() ||
					buildFallbackCategoryDescription(name),
				result.documentId,
			);

			setAnalysisResults((prev) =>
				prev.map((item) =>
					shouldApplyCreatedCategory(item, result, name)
						? {
								...item,
								categoryName: category.name,
								suggestedCategoryName: category.name,
								suggestedCategoryDescription:
									category.description,
								categoryDescription: category.description,
								needsNewCategory: false,
								prompt: null,
								isCreatingCategory: false,
								categoryStatus:
									item.fileName === result.fileName
										? "Category created and assigned."
										: `Assigned to ${category.name}.`,
							}
						: item,
				),
			);
			if (
				pendingCategoryConfirmationRef.current?.fileName ===
				result.fileName
			) {
				pendingCategoryConfirmationRef.current.resolve();
				pendingCategoryConfirmationRef.current = null;
			}
		} catch (err: any) {
			setAnalysisResults((prev) =>
				prev.map((item) =>
					item.fileName === result.fileName
						? {
								...item,
								isCreatingCategory: false,
								categoryStatus:
									err.message ?? "Could not create category.",
							}
						: item,
				),
			);
		}
	};

	const shouldApplyCreatedCategory = (
		item: FileAnalysisResult,
		source: FileAnalysisResult,
		createdName: string,
	) => {
		const itemSuggestionKey = categoryKey(
			item.suggestedCategoryName ?? item.categoryName,
		);
		return (
			itemSuggestionKey ===
				categoryKey(
					source.suggestedCategoryName ?? source.categoryName,
				) ||
			itemSuggestionKey === categoryKey(createdName) ||
			categoryKey(item.categoryInput) === categoryKey(createdName)
		);
	};

	const getAnalysisEndpoint = (file: File) => {
		if (file.type === "application/pdf") return "/documents/analyze";
		if (
			["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
				file.type,
			)
		) {
			return "/images/analyze";
		}
		return null;
	};

	const activeCategoryPromptIndex = analysisResults.findIndex(
		(result) => result.needsNewCategory && !result.error,
	);
	const activeCategoryPrompt =
		activeCategoryPromptIndex >= 0
			? analysisResults[activeCategoryPromptIndex]
			: null;
	const isWaitingForCategoryInput = Boolean(activeCategoryPrompt);
	const displayedAnalysisResults = activeCategoryPrompt
		? [
				activeCategoryPrompt,
				...analysisResults
					.filter((_, index) => index !== activeCategoryPromptIndex)
					.slice()
					.reverse(),
			]
		: [...analysisResults].reverse();
	const hasCompactSelection = detailMode === "compact" && files.length > 0;
	const compactProgressText = compactAnalysisStatus
		? compactAnalysisStatus.remainingCount > 0
			? isWaitingForCategoryInput
				? "Action needed"
				: `${compactAnalysisStatus.remainingCount} of ${compactAnalysisStatus.totalCount} left`
			: compactAnalysisStatus.currentStatus === "Failed"
				? "Needs attention"
				: "Complete"
		: null;
	const selectedFiles = files.map((file) => ({
		file,
		Icon: fileIconFor({
			name: file.name,
			filename: file.name,
			mimeType: file.type,
		}),
	}));

	const uploadCategorySelector = (
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
				onChange={(event) => setSelectedCategoryId(event.target.value)}
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

	const waitForCategoryConfirmation = (fileName: string) =>
		new Promise<void>((resolve) => {
			pendingCategoryConfirmationRef.current = { fileName, resolve };
		});

	useEffect(() => {
		if (!pendingCompletion) {
			return;
		}

		const hasPendingCategoryActions = analysisResults.some(
			(result) => result.needsNewCategory && !result.error,
		);

		if (
			hasPendingCategoryActions ||
			pendingCategoryConfirmationRef.current
		) {
			return;
		}

		setStatus(
			pendingCompletion.failedCount > 0
				? `Upload complete. Analysis failed for ${pendingCompletion.failedCount} file(s).`
				: "Upload and analysis complete",
		);
		setCompactAnalysisStatus({
			currentFileName: pendingCompletion.lastFileName,
			currentStatus:
				pendingCompletion.failedCount > 0 ? "Failed" : "Finished",
			remainingCount: 0,
			totalCount: pendingCompletion.totalCount,
		});
		notifyFileTreeUpdated(pendingCompletion.documentIds);
		toast.success("Analysis completed", {
			position: "bottom-center",
		});
		setIsBusy(false);
		setFiles([]);
		setIsAnalyzing(false);
		setPendingCompletion(null);
	}, [analysisResults, pendingCompletion]);

	useEffect(() => {
		onBusyChange?.(isBusy);
	}, [isBusy, onBusyChange]);

	useEffect(() => {
		return () => {
			onBusyChange?.(false);
		};
	}, [onBusyChange]);

	useEffect(() => {
		if (!activeCategoryPrompt) {
			return;
		}

		activePromptRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "start",
		});
	}, [activeCategoryPrompt]);

	useEffect(() => {
		void loadKnownCategories();
	}, [spaceId]);

	useEffect(() => {
		if (!selectedCategoryId) return;
		if (
			knownCategoryOptions.some(
				(category) => String(category.id) === selectedCategoryId,
			)
		) {
			return;
		}

		setSelectedCategoryId("");
	}, [knownCategoryOptions, selectedCategoryId]);

	return (
		<div
			className={
				showHeading ? "upload-page max-w-3xl mx-auto p-6" : "w-full"
			}
		>
			{showHeading && (
				<header className="upload-header mb-6">
					<h1 className="text-2xl font-semibold">
						Upload PDFs and Images
					</h1>
				</header>
			)}

			<main className="upload-content">
				{detailMode === "compact" ? (
					<div className="space-y-5">
						<input
							ref={inputRef}
							type="file"
							multiple
							className="hidden"
							onChange={onFileChange}
							accept=".pdf,image/*"
							disabled={isBusy}
						/>
						{!hasCompactSelection ? (
							<div
								onDrop={onDrop}
								onDragOver={onDragOver}
								className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/50 px-6 py-8 text-center transition-colors hover:border-muted-foreground/40 hover:bg-muted"
							>
								<div className="flex size-12 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
									<UploadCloud className="size-5" />
								</div>
								<p className="mt-4 text-sm font-medium text-foreground">
									Drop files here
								</p>
								<p className="mt-1 text-sm text-muted-foreground">
									PDF, PNG, JPG, GIF, WebP, SVG, BMP, or TIFF
								</p>
								<Button
									type="button"
									variant="accent"
									size="lg"
									className="mt-5 min-w-36 disabled:bg-muted disabled:text-muted-foreground"
									onClick={() => inputRef.current?.click()}
									disabled={isBusy}
								>
									Choose files
								</Button>
							</div>
						) : (
							<section className="rounded-xl border border-border bg-background overflow-hidden">
								<div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
									<div>
										<p className="text-sm font-medium text-foreground">
											Selected files
										</p>
										<p className="mt-1 text-sm text-muted-foreground">
											{files.length} file
											{files.length === 1 ? "" : "s"}{" "}
											ready for analysis
										</p>
									</div>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() =>
											inputRef.current?.click()
										}
										disabled={isBusy}
									>
										Add files
									</Button>
								</div>
								<div className="border-b border-border px-4 py-3">
									{uploadCategorySelector}
								</div>
								<ul className="max-h-48 divide-y divide-border overflow-y-auto">
									{selectedFiles.map(
										({ file, Icon }, index) => (
											<li
												key={`${file.name}-${index}`}
												className="flex items-center gap-3 px-4 py-3 text-sm"
											>
												<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground ring-1 ring-border">
													<Icon className="size-4" />
												</span>
												<span className="min-w-0 flex-1 truncate text-foreground">
													{file.name}
												</span>
												<span className="shrink-0 text-xs text-muted-foreground">
													{formatFileSize(file.size)}
												</span>
												<button
													type="button"
													onClick={() =>
														removeFile(index)
													}
													disabled={isBusy}
													className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
													aria-label={`Remove ${file.name}`}
												>
													<X className="size-4" />
												</button>
											</li>
										),
									)}
								</ul>
								<div className="flex items-center justify-between gap-4 border-t border-border bg-muted/50 px-4 py-3">
									<p className="text-sm text-muted-foreground">
										{selectedUploadCategory
											? `Uploading directly to ${selectedUploadCategory.name}.`
											: "Files will be analysed and sorted into categories."}
									</p>
									<Button
										variant="accent"
										onClick={upload}
										disabled={isBusy}
										className="min-w-32 disabled:bg-muted disabled:text-muted-foreground"
									>
										{isWaitingForCategoryInput
											? "Waiting..."
											: isBusy
												? "Analysing..."
												: `Analyse ${files.length} files`}
									</Button>
								</div>
							</section>
						)}

						{(status || compactAnalysisStatus) && (
							<section className="rounded-xl border border-border bg-muted/50 px-4 py-3">
								<div className="flex items-start gap-3">
									<span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
										{isWaitingForCategoryInput ? (
											<Hourglass className="size-4 text-(--color-accent)" />
										) : isBusy ? (
											<LoaderCircle className="size-4 animate-spin" />
										) : (
											<CheckCircle2 className="size-4 text-(--color-accent)" />
										)}
									</span>
									<div className="min-w-0 flex-1">
										<div className="flex items-center justify-between gap-3">
											<p className="text-sm font-medium text-foreground">
												{isWaitingForCategoryInput
													? "Waiting for your input"
													: isBusy
														? "Analyzing files"
														: "Upload status"}
											</p>
											{compactProgressText ? (
												<span className="shrink-0 text-xs font-medium text-muted-foreground">
													{compactProgressText}
												</span>
											) : null}
										</div>
										{compactAnalysisStatus ? (
											<p className="mt-1 truncate text-sm text-muted-foreground">
												{isWaitingForCategoryInput
													? activeCategoryPrompt?.fileName
													: compactAnalysisStatus.currentFileName}
											</p>
										) : null}
										{isWaitingForCategoryInput ? (
											<p className="mt-1 text-sm text-muted-foreground">
												Confirm the suggested category
												below to continue.
											</p>
										) : status ? (
											<p className="mt-1 text-sm text-muted-foreground">
												{status}
											</p>
										) : null}
									</div>
								</div>
							</section>
						)}
					</div>
				) : (
					<div
						onDrop={onDrop}
						onDragOver={onDragOver}
						className="border-2 border-dashed border-border rounded-2xl min-h-65 p-10 text-center cursor-pointer flex flex-col justify-center items-center gap-3"
						onClick={() => inputRef.current?.click()}
					>
						<div className="w-20 h-20 rounded-full bg-muted grid place-items-center text-3xl">
							↑
						</div>
						<p className="text-base mt-2">
							{files.length > 0
								? `${files.length} file(s) selected`
								: "Drag and drop files here, or click to browse"}
						</p>
						<small className="text-sm text-muted-foreground mt-1">
							Supported: PDF and image files (JPEG, PNG, GIF,
							WebP, SVG, BMP, TIFF)
						</small>
						<input
							ref={inputRef}
							type="file"
							multiple
							className="hidden"
							onChange={onFileChange}
							accept=".pdf,image/*"
						/>
					</div>
				)}

				{detailMode !== "compact" && files.length > 0 && (
					<div className="mt-4 p-4 bg-muted/50 rounded-lg">
						<h3 className="font-medium mb-2">Selected Files</h3>
						<ul className="space-y-2">
							{files.map((file, index) => (
								<li
									key={`${file.name}-${index}`}
									className="flex items-center justify-between gap-3 text-sm"
								>
									<span className="min-w-0 truncate">
										{file.name} (
										{(file.size / 1024).toFixed(2)} KB)
									</span>
									<button
										onClick={() => removeFile(index)}
										className="text-destructive hover:text-destructive"
									>
										Remove
									</button>
								</li>
							))}
						</ul>
					</div>
				)}

				{detailMode !== "compact" && files.length > 0 && (
					<div className="mt-4">{uploadCategorySelector}</div>
				)}

				{detailMode !== "compact" && !isAnalyzing && (
					<div className="mt-6 flex justify-center">
						<Button
							variant="accent"
							onClick={upload}
							disabled={files.length === 0}
							className="min-w-60 disabled:bg-muted disabled:text-muted-foreground"
						>
							{files.length > 0
								? `Analyze ${files.length} File(s)`
								: "Analyze Files"}
						</Button>
					</div>
				)}

				{detailMode !== "compact" && status && (
					<div className="mt-3">
						<small className="text-sm text-muted-foreground">
							{status}
						</small>
					</div>
				)}

				{detailMode === "full" &&
					(summary || uploadedFiles.length > 0) && (
						<section className="mt-6">
							<label className="block mb-2 font-medium">
								Upload Details
							</label>
							<div className="space-y-2">
								<p className="text-sm text-muted-foreground">
									{summary}
								</p>
								{uploadedFiles.length > 0 && (
									<table className="w-full text-sm border border-border rounded">
										<thead className="bg-muted">
											<tr>
												<th className="border border-border p-2 text-left">
													Document ID
												</th>
												<th className="border border-border p-2 text-left">
													Filename
												</th>
												<th className="border border-border p-2 text-left">
													Stored As
												</th>
												<th className="border border-border p-2 text-left">
													Type
												</th>
												<th className="border border-border p-2 text-right">
													Size
												</th>
											</tr>
										</thead>
										<tbody>
											{uploadedFiles.map(
												(uploadedFile, index) => (
													<tr
														key={`${uploadedFile.documentId}-${index}`}
														className="border-t border-border"
													>
														<td className="border border-border p-2">
															{
																uploadedFile.documentId
															}
														</td>
														<td className="border border-border p-2">
															{
																uploadedFile.originalName
															}
														</td>
														<td className="border border-border p-2">
															{
																uploadedFile.filename
															}
														</td>
														<td className="border border-border p-2">
															{
																uploadedFile.mimeType
															}
														</td>
														<td className="border border-border p-2 text-right">
															{(
																uploadedFile.size /
																1024
															).toFixed(2)}{" "}
															KB
														</td>
													</tr>
												),
											)}
										</tbody>
									</table>
								)}
							</div>
						</section>
					)}

				{analysisResults.length > 0 && (
					<section className="mt-6">
						<div className="flex items-center justify-between gap-3">
							<h2 className="text-sm font-medium text-foreground">
								Analysis
							</h2>
							<span className="text-xs text-muted-foreground">
								{analysisResults.length} file
								{analysisResults.length === 1 ? "" : "s"}
							</span>
						</div>
						<div className="mt-3 space-y-3">
							{displayedAnalysisResults.map((result, index) => {
								const isActivePrompt =
									activeCategoryPrompt === result;
								const isCategoryComboboxOpen =
									openCategoryCombobox === result.fileName;
								const categoryQuery = result.categoryInput
									.trim()
									.toLowerCase();
								const filteredCategoryOptions =
									categoryQuery.length > 0
										? knownCategoryOptions.filter((category) =>
												category.name
													.toLowerCase()
													.includes(categoryQuery),
											)
										: knownCategoryOptions;
								const hasExactCategoryMatch =
									knownCategoryOptions.some(
										(category) =>
											categoryKey(category.name) ===
											categoryKey(result.categoryInput),
									);
								return (
									<article
										ref={
											isActivePrompt
												? activePromptRef
												: null
										}
										key={`${result.documentId ?? "pending"}-${result.fileName}-${index}`}
										className="rounded-xl border border-border bg-muted/50 px-4 py-4"
									>
										<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
											<h3 className="min-w-0 truncate text-sm font-medium text-foreground">
												{result.fileName}
											</h3>
											<span className="inline-flex w-fit shrink-0 rounded-md bg-background px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border">
												{result.categoryName}
											</span>
										</div>

										{result.error ? (
											<p className="mt-3 text-sm text-destructive">
												{result.error}
											</p>
										) : (
											<>
												{result.needsNewCategory &&
													result.prompt &&
													isActivePrompt && (
														<div className="mt-4 border-l-2 border-(--color-accent) pl-4">
															<p className="text-sm font-medium text-foreground">
																Confirm the
																suggested
																category
															</p>
															<p className="mt-1 text-sm text-muted-foreground">
																{result.prompt}
															</p>
															<div className="mt-3 space-y-2">
																<Label
																	htmlFor={`category-name-${index}`}
																>
																	Category
																</Label>
																<div className="flex flex-col gap-2 sm:flex-row">
																	<div
																		className="relative flex-1"
																		onBlur={(
																			event,
																		) => {
																			if (
																				!event.currentTarget.contains(
																					event.relatedTarget,
																				)
																			) {
																				setOpenCategoryCombobox(
																					null,
																				);
																			}
																		}}
																	>
																		<Input
																			id={`category-name-${index}`}
																			value={
																				result.categoryInput
																			}
																			onFocus={() =>
																				setOpenCategoryCombobox(
																					result.fileName,
																				)
																			}
																			onChange={(
																				e,
																			) => {
																				updateCategoryInput(
																					result.fileName,
																					e
																						.target
																						.value,
																				);
																				setOpenCategoryCombobox(
																					result.fileName,
																				);
																			}}
																			placeholder={
																				knownCategoryOptions.length >
																				0
																					? "Search or type a new category"
																					: "Type a new category"
																			}
																			className="pr-9"
																			autoComplete="off"
																		/>
																		{knownCategoryOptions.length >
																			0 && (
																			<button
																				type="button"
																				className="absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
																				onMouseDown={(
																					event,
																				) =>
																					event.preventDefault()
																				}
																				onClick={() =>
																					setOpenCategoryCombobox(
																						isCategoryComboboxOpen
																							? null
																							: result.fileName,
																					)
																				}
																				aria-label="Toggle category suggestions"
																			>
																				<ChevronDown
																					className={
																						isCategoryComboboxOpen
																							? "size-4 rotate-180 transition-transform"
																							: "size-4 transition-transform"
																					}
																				/>
																			</button>
																		)}
																		{isCategoryComboboxOpen &&
																			knownCategoryOptions.length >
																				0 && (
																				<div className="absolute z-30 mt-2 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-background p-1 text-sm">
																					{filteredCategoryOptions.length >
																					0 ? (
																						filteredCategoryOptions.map(
																							(
																								category,
																							) => (
																								<button
																									key={`${category.id ?? category.name}-${category.name}`}
																									type="button"
																									className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-foreground hover:bg-muted/50"
																									onMouseDown={(
																										event,
																									) =>
																										event.preventDefault()
																									}
																									onClick={() => {
																										updateCategoryInput(
																											result.fileName,
																											category.name,
																										);
																										setOpenCategoryCombobox(
																											null,
																										);
																									}}
																								>
																									<span className="min-w-0 truncate">
																										{
																											category.name
																										}
																									</span>
																									<span className="shrink-0 text-xs text-muted-foreground">
																										Existing
																									</span>
																								</button>
																							),
																						)
																					) : (
																						<div className="px-2.5 py-2 text-muted-foreground">
																							No
																							matching
																							categories
																						</div>
																					)}
																					{result.categoryInput.trim() &&
																						!hasExactCategoryMatch && (
																							<div className="border-t border-border px-2.5 py-2 text-xs text-muted-foreground">
																								Press
																								Confirm
																								to
																								create
																								"
																								{result.categoryInput.trim()}

																								"
																							</div>
																						)}
																				</div>
																			)}
																	</div>
																	<Button
																		type="button"
																		variant="accent"
																		onClick={() =>
																			confirmCategory(
																				result,
																			)
																		}
																		disabled={
																			result.isCreatingCategory ||
																			!result.categoryInput.trim()
																		}
																	>
																		{result.isCreatingCategory
																			? "Creating..."
																			: "Confirm"}
																	</Button>
																</div>
															</div>
															<Label
																htmlFor={`category-description-${index}`}
																className="mt-3"
															>
																Description
															</Label>
															<textarea
																id={`category-description-${index}`}
																value={
																	result.categoryDescription
																}
																onChange={(e) =>
																	setAnalysisResults(
																		(
																			prev,
																		) =>
																			prev.map(
																				(
																					item,
																				) =>
																					item.fileName ===
																					result.fileName
																						? {
																								...item,
																								categoryDescription:
																									e
																										.target
																										.value,
																								categoryStatus:
																									undefined,
																							}
																						: item,
																			),
																	)
																}
																rows={2}
																placeholder="Describe what belongs in this category"
																className={`mt-2 ${textareaClassName}`}
															/>
														</div>
													)}
												{result.needsNewCategory &&
													!isActivePrompt && (
														<p className="mt-3 text-sm text-muted-foreground">
															Waiting for the
															previous category
															decision.
														</p>
													)}
												{result.categoryStatus && (
													<p className="mt-3 text-sm text-muted-foreground">
														{result.categoryStatus}
													</p>
												)}
												<p className="mt-3 text-sm leading-6 text-foreground">
													{result.summary}
												</p>
											</>
										)}
									</article>
								);
							})}
						</div>
					</section>
				)}
			</main>
		</div>
	);
}
