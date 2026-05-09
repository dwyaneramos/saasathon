import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
	Download,
	Edit3,
	ExternalLink,
	FileText,
	Maximize2,
	Minimize2,
	Minus,
	MoreVertical,
	Plus,
	Save,
	Trash2,
	X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import type { KibiFile } from "@/components/app-sidebar";
import { apiBaseUrl } from "@/lib/api";
import { fileIconFor } from "@/lib/file-icons";
import React from "react";

const fileTreeUpdatedEvent = "kibi:file-tree-updated";

type PublicDocument = {
	id: number;
	filename: string;
	fileName: string;
	originalFileName: string | null;
	mimeType: string;
	fileSize: number;
	summary: string;
	createdAt: string;
};

type DocumentResponse = {
	document?: PublicDocument;
	error?: string;
};

type ApiErrorPayload = {
	error?: string;
};

function authHeaders() {
	const token = localStorage.getItem("token");
	return token
		? ({ Authorization: `Bearer ${token}` } as Record<string, string>)
		: ({} as Record<string, string>);
}

function validateDocumentName(name: string) {
	const trimmed = name.trim();

	if (!trimmed) {
		return "Enter a file name.";
	}

	if (trimmed.length > 180) {
		return "File names can be up to 180 characters.";
	}

	if (trimmed === "." || trimmed === "..") {
		return "Choose a different file name.";
	}

	if (/[\\/]/.test(trimmed)) {
		return "File names can't include / or \\.";
	}

	if (/[\u0000-\u001F]/.test(trimmed)) {
		return "That file name contains characters that aren't allowed.";
	}

	return null;
}

function notifyFileTreeUpdated(documentIds: number[] = []) {
	window.dispatchEvent(
		new CustomEvent(fileTreeUpdatedEvent, {
			detail: { documentIds },
		}),
	);
}

async function readApiError(response: Response) {
	const rawText = await response.text().catch(() => "");

	if (!rawText.trim()) {
		return "";
	}

	try {
		const payload = JSON.parse(rawText) as ApiErrorPayload;
		return payload?.error?.trim() ?? "";
	} catch {
		return rawText.trim();
	}
}

function toFriendlyDocumentError(
	action: "load" | "rename" | "delete",
	status?: number,
	apiError?: string,
) {
	const normalizedError = apiError?.trim().toLowerCase() ?? "";

	if (status === 401) {
		return "Your session has expired. Please sign in again and try once more.";
	}

	if (status === 404) {
		if (action === "load") {
			return "This file could not be found. It may have been moved or deleted.";
		}

		if (action === "rename") {
			return "We couldn't rename this file because it no longer exists.";
		}

		return "This file was already removed.";
	}

	if (status === 400) {
		if (
			normalizedError.includes("slash") ||
			normalizedError.includes("invalid characters")
		) {
			return "Please use a file name without slashes or unsupported characters.";
		}

		if (normalizedError.includes("180 characters")) {
			return "File names can be up to 180 characters.";
		}

		if (
			normalizedError.includes("required") ||
			normalizedError.includes("invalid")
		) {
			return action === "load"
				? "This file link is invalid."
				: "Please enter a valid file name.";
		}
	}

	if (action === "load") {
		return "We couldn't load this file right now. Please try again.";
	}

	if (action === "rename") {
		return "We couldn't save the new file name. Please try again.";
	}

	return "We couldn't delete this file right now. Please try again.";
}

export default function FileView() {
	const { documentId } = useParams();
	const navigate = useNavigate();
	const [document, setDocument] = useState<PublicDocument | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [editableName, setEditableName] = useState("");
	const [isEditingName, setIsEditingName] = useState(false);
	const [isSavingName, setIsSavingName] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
	const [actionError, setActionError] = useState<string | null>(null);
	const [fileObjectUrl, setFileObjectUrl] = useState<string | null>(null);
	const [isFileLoading, setIsFileLoading] = useState(false);

	const fileApiUrl = useMemo(() => {
		return documentId ? `${apiBaseUrl}/documents/${documentId}/file` : "";
	}, [documentId]);

	useEffect(() => {
		let ignore = false;

		async function loadDocument() {
			if (!documentId) {
				setError("Missing file id.");
				setIsLoading(false);
				return;
			}

			setIsLoading(true);
			setError(null);

			try {
				const response = await fetch(
					`${apiBaseUrl}/documents/${documentId}`,
					{ headers: authHeaders() },
				);

				if (!response.ok) {
					if (
						response.status === 401 ||
						response.status === 403 ||
						response.status === 404
					) {
						navigate("/", { replace: true });
						return;
					}

					throw new Error(
						toFriendlyDocumentError(
							"load",
							response.status,
							await readApiError(response),
						),
					);
				}

				const payload = (await response
					.json()
					.catch(() => null)) as DocumentResponse | null;

				if (!ignore) {
					const nextDocument = payload?.document ?? null;
					setDocument(nextDocument);
					setEditableName(
						nextDocument
							? nextDocument.originalFileName ||
									nextDocument.fileName ||
									nextDocument.filename
							: "",
					);
				}
			} catch (err) {
				if (!ignore) {
					setError(
						err instanceof Error
							? err.message
							: "Could not load file.",
					);
				}
			} finally {
				if (!ignore) {
					setIsLoading(false);
				}
			}
		}

		loadDocument();

		return () => {
			ignore = true;
		};
	}, [documentId, navigate]);

	useEffect(() => {
		if (!document || !fileApiUrl) {
			setFileObjectUrl(null);
			return;
		}

		let objectUrl: string | null = null;
		let ignore = false;

		async function loadFileBlob() {
			setIsFileLoading(true);
			setFileObjectUrl(null);

			try {
				const response = await fetch(fileApiUrl, {
					headers: authHeaders(),
				});

				if (!response.ok) {
					if (
						response.status === 401 ||
						response.status === 403 ||
						response.status === 404
					) {
						navigate("/", { replace: true });
						return;
					}

					throw new Error(
						toFriendlyDocumentError(
							"load",
							response.status,
							await readApiError(response),
						),
					);
				}

				const blob = await response.blob();
				objectUrl = URL.createObjectURL(blob);

				if (!ignore) {
					setFileObjectUrl(objectUrl);
				}
			} catch (err) {
				if (!ignore) {
					setActionError(
						err instanceof Error
							? err.message
							: "Could not load file preview.",
					);
				}
			} finally {
				if (!ignore) {
					setIsFileLoading(false);
				}
			}
		}

		loadFileBlob();

		return () => {
			ignore = true;
			if (objectUrl) {
				URL.revokeObjectURL(objectUrl);
			}
		};
	}, [document, fileApiUrl, navigate]);

	if (isLoading) {
		return (
			<main className="flex min-h-[calc(100svh-var(--header-height))] items-center justify-center text-sm text-muted-foreground">
				Loading file...
			</main>
		);
	}

	if (error || !document) {
		return (
			<main className="mx-auto flex min-h-[calc(100svh-var(--header-height))] max-w-3xl flex-col items-center justify-center gap-4 p-6 text-center">
				<FileText className="size-10 text-muted-foreground" />
				<div>
					<h1 className="text-xl font-semibold">File unavailable</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						{error ?? "This file could not be loaded."}
					</p>
				</div>
				<Link
					className="text-sm font-medium text-foreground hover:underline"
					to="/upload"
				>
					Back to uploads
				</Link>
			</main>
		);
	}

	const displayName =
		document.originalFileName || document.fileName || document.filename;
	const canPreview =
		Boolean(fileObjectUrl) &&
		(document.mimeType === "application/pdf" ||
			document.mimeType.startsWith("image/") ||
			document.mimeType.startsWith("text/") ||
			document.mimeType.includes("json") ||
			document.mimeType.includes("xml"));

	function handleOpenFile() {
		if (!fileObjectUrl) return;
		window.open(fileObjectUrl, "_blank", "noopener,noreferrer");
	}

	function handleDownloadFile() {
		if (!fileObjectUrl) return;

		const link = window.document.createElement("a");
		link.href = fileObjectUrl;
		link.download = displayName;
		link.rel = "noreferrer";
		window.document.body.appendChild(link);
		link.click();
		link.remove();
	}

	async function handleSaveName() {
		if (!documentId || !document) {
			return;
		}

		const validationError = validateDocumentName(editableName);
		if (validationError) {
			setActionError(validationError);
			return;
		}

		const trimmedName = editableName.trim();
		if (trimmedName === displayName) {
			setIsEditingName(false);
			setActionError(null);
			return;
		}

		setIsSavingName(true);
		setActionError(null);

		try {
			const response = await fetch(
				`${apiBaseUrl}/documents/${documentId}`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						...authHeaders(),
					},
					body: JSON.stringify({ name: trimmedName }),
				},
			);

			if (!response.ok) {
				throw new Error(
					toFriendlyDocumentError(
						"rename",
						response.status,
						await readApiError(response),
					),
				);
			}

			const payload = (await response
				.json()
				.catch(() => null)) as DocumentResponse | null;

			if (!payload?.document) {
				throw new Error(
					"The file name was saved, but the page could not refresh. Please reload and check again.",
				);
			}

			setDocument(payload.document);
			setEditableName(
				payload.document.originalFileName ||
					payload.document.fileName ||
					payload.document.filename,
			);
			notifyFileTreeUpdated();
			setIsEditingName(false);
		} catch (err) {
			setActionError(
				err instanceof Error ? err.message : "Could not rename file.",
			);
		} finally {
			setIsSavingName(false);
		}
	}

	async function handleDelete() {
		if (!documentId || !document) {
			return;
		}

		setIsDeleting(true);
		setActionError(null);

		try {
			const response = await fetch(
				`${apiBaseUrl}/documents/${documentId}`,
				{
					method: "DELETE",
					headers: authHeaders(),
				},
			);

			if (!response.ok) {
				throw new Error(
					toFriendlyDocumentError(
						"delete",
						response.status,
						await readApiError(response),
					),
				);
			}

			notifyFileTreeUpdated();
			setIsDeleteModalOpen(false);
			navigate("/graph");
		} catch (err) {
			setActionError(
				err instanceof Error ? err.message : "Could not delete file.",
			);
			setIsDeleting(false);
		}
	}

	const fileSummary = document.summary?.trim();

	return (
		<main className="min-h-[calc(100svh-var(--header-height))] bg-muted/40">
			<header className="border-b border-border bg-background px-6 py-4">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="min-w-0">
						<div className="flex min-w-0 items-center gap-2">
							{isEditingName ? (
								<>
									<input
										value={editableName}
										onChange={(event) =>
											setEditableName(event.target.value)
										}
										className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-lg font-semibold text-foreground outline-none ring-0 placeholder:text-muted-foreground focus:border-ring"
										maxLength={180}
										disabled={isSavingName || isDeleting}
										aria-label="File name"
									/>
									<Button
										type="button"
										onClick={handleSaveName}
										disabled={isSavingName || isDeleting}
										variant="outline"
										size="icon-lg"
										aria-label="Save file name"
									>
										<Save className="size-4" />
									</Button>
									<Button
										type="button"
										onClick={() => {
											setEditableName(displayName);
											setIsEditingName(false);
											setActionError(null);
										}}
										disabled={isSavingName || isDeleting}
										variant="outline"
										size="icon-lg"
										aria-label="Cancel file name edit"
									>
										<X className="size-4" />
									</Button>
								</>
							) : (
								<>
									<h1 className="truncate text-lg font-semibold text-foreground">
										{displayName}
									</h1>
									<Button
										type="button"
										onClick={() => {
											setEditableName(displayName);
											setIsEditingName(true);
											setActionError(null);
										}}
										disabled={isDeleting}
										variant="ghost"
										size="icon"
										aria-label="Edit file name"
									>
										<Edit3 className="size-4" />
									</Button>
								</>
							)}
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							{document.mimeType} ·{" "}
							{formatFileSize(document.fileSize)}
						</p>
						{actionError ? (
							<p className="mt-2 text-xs text-destructive">
								{actionError}
							</p>
						) : null}
					</div>
					<div className="flex shrink-0 gap-2">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									type="button"
									variant="outline"
									size="icon-lg"
									disabled={isSavingName || isDeleting}
									aria-label="File actions"
								>
									<MoreVertical className="size-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-44">
								<DropdownMenuItem
									onClick={handleOpenFile}
									disabled={!fileObjectUrl || isFileLoading}
								>
									<ExternalLink className="size-4" />
									Open
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={handleDownloadFile}
									disabled={!fileObjectUrl || isFileLoading}
								>
									<Download className="size-4" />
									Download
								</DropdownMenuItem>
								<DropdownMenuItem
									variant="destructive"
									onClick={() => {
										setActionError(null);
										setIsDeleteModalOpen(true);
									}}
								>
									<Trash2 className="size-4" />
									{isDeleting ? "Deleting..." : "Delete"}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
				{fileSummary ? (
					<div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
						<p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
							Summary
						</p>
						<p className="mt-1 text-sm leading-6 text-zinc-700">
							{fileSummary}
						</p>
					</div>
				) : null}
			</header>

				<section className="min-h-[480px] flex-1 p-4 md:p-6">
					{isFileLoading ? (
						<div className="flex h-full flex-col items-center justify-center rounded-lg border border-border bg-background p-8 text-center">
							<FileText className="size-12 text-muted-foreground" />
							<h2 className="mt-4 text-base font-semibold">
								Loading preview
							</h2>
							<p className="mt-2 max-w-md text-sm text-muted-foreground">
								Preparing the secured file preview.
							</p>
						</div>
					) : canPreview && fileObjectUrl ? (
						<FilePreview
							document={document}
							fileUrl={fileObjectUrl}
							displayName={displayName}
						/>
					) : (
					<div className="flex h-full flex-col items-center justify-center rounded-lg border border-border bg-background p-8 text-center">
						<FileText className="size-12 text-muted-foreground" />
						<h2 className="mt-4 text-base font-semibold">
							Preview unavailable
						</h2>
						<p className="mt-2 max-w-md text-sm text-muted-foreground">
							This file type cannot be previewed inline. Open it
							in a new tab or download it to view.
						</p>
					</div>
				)}
			</section>

				{isDeleteModalOpen ? (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-xs">
						<div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
							<div className="flex items-start gap-3 border-b border-border bg-muted/40 px-6 py-5">
								<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background text-red-600 ring-1 ring-red-200">
									<Trash2 className="size-5" />
								</span>
								<div className="min-w-0">
									<h2 className="text-lg font-semibold text-foreground">
										Delete file?
									</h2>
									<p className="mt-1 text-sm leading-6 text-muted-foreground">
										This deletes{" "}
										<span className="font-medium text-foreground">
											{displayName}
										</span>{" "}
										permanently.
									</p>
								</div>
							</div>
							<div className="px-6 py-5">
								{actionError ? (
									<p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100">
										{actionError}
									</p>
								) : null}
								<div className="flex justify-end gap-2 border-t border-border pt-4">
									<Button
										type="button"
										variant="outline"
										size="lg"
										className="min-w-24"
										onClick={() => setIsDeleteModalOpen(false)}
										disabled={isDeleting}
									>
										Cancel
									</Button>
									<Button
										type="button"
										variant="destructive"
										size="lg"
									className="min-w-28"
									onClick={handleDelete}
									disabled={isDeleting}
								>
										<Trash2 className="size-4" />
										{isDeleting ? "Deleting..." : "Delete"}
									</Button>
								</div>
							</div>
						</div>
					</div>
			) : null}
		</main>
	);
}

function FilePreview({
	document,
	fileUrl,
	displayName,
}: {
	document: PublicDocument;
	fileUrl: string;
	displayName: string;
}) {
	if (
		document.mimeType === "application/pdf" ||
		document.mimeType.startsWith("image/")
	) {
		return (
			<ZoomableFileViewer
				document={document}
				fileUrl={fileUrl}
				displayName={displayName}
			/>
		);
	}

	return (
		<div className="h-full overflow-hidden rounded-lg border border-border bg-background">
			<iframe
				src={fileUrl}
				title={displayName}
				className="h-full w-full"
			/>
		</div>
	);
}

function documentToKibiFile(document: PublicDocument): KibiFile {
	return {
		id: document.id,
		name:
			document.originalFileName ?? document.fileName ?? document.filename,
		filename: document.filename,
		mimeType: document.mimeType,
	};
}

function ZoomableFileViewer({
	document: fileDocument,
	fileUrl,
	displayName,
}: {
	document: PublicDocument;
	fileUrl: string;
	displayName: string;
}) {
	const [zoom, setZoom] = useState(100);
	const [isExpanded, setIsExpanded] = useState(false);
	const { setOpen } = useSidebar();
	const scale = zoom / 100;
	const isImage = fileDocument.mimeType.startsWith("image/");

	useEffect(() => {
		if (isExpanded) {
			setOpen(false);
		}
	}, [isExpanded, setOpen]);

	const toggleExpanded = () => {
		setIsExpanded((current) => !current);
	};

	const pdfWidth = isExpanded ? 980 : 820;
	const pdfHeight = isExpanded ? 780 : 720;
	const imageWidth = isExpanded ? 1080 : 820;

	const file = documentToKibiFile(fileDocument);

	const viewer = (
		<div
			className={
				isExpanded
					? "flex h-[90svh] w-[90vw] flex-col overflow-hidden rounded-lg border border-border bg-muted shadow-2xl"
					: "flex h-full flex-col overflow-hidden rounded-lg border border-border bg-muted shadow-sm"
			}
		>
			<div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-3">
				<div className="flex min-w-0 items-center gap-2">
					<div className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
						{React.createElement(fileIconFor(file), {
							className:
								"size-3.5 shrink-0 text-muted-foreground/80",
						})}
					</div>
					<span className="truncate text-sm font-medium text-foreground">
						{displayName}
					</span>
				</div>
				<div className="flex shrink-0 items-center gap-1">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={() =>
							setZoom((value) => Math.max(50, value - 10))
						}
						aria-label="Zoom out"
					>
						<Minus className="size-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="w-12 tabular-nums"
						onClick={() => setZoom(100)}
						aria-label="Reset zoom"
					>
						{zoom}%
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={() =>
							setZoom((value) => Math.min(250, value + 10))
						}
						aria-label="Zoom in"
					>
						<Plus className="size-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="ml-1"
						onClick={toggleExpanded}
						aria-label={
							isExpanded ? "Shrink viewer" : "Expand viewer"
						}
					>
						{isExpanded ? (
							<Minimize2 className="size-4" />
						) : (
							<Maximize2 className="size-4" />
						)}
					</Button>
				</div>
			</div>
			<div className="flex-1 overflow-auto bg-muted">
				<div
					style={{
						display: "flex",
						alignItems: "flex-start",
						justifyContent: "center",
						padding: "24px",
						minHeight: "100%",
					}}
				>
					{isImage ? (
						<div className="rounded-md border border-border bg-background shadow-sm">
							<img
								src={fileUrl}
								alt={displayName}
								className="block max-w-none object-contain"
								draggable={false}
								style={{
									width: `${imageWidth}px`,
									transform: `scale(${scale})`,
									transformOrigin: "top center",
									transition: "transform 0.15s ease-out",
								}}
							/>
						</div>
					) : (
						<iframe
							src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
							title={displayName}
							className="block rounded-md border border-border bg-background shadow-sm"
							style={{
								width: `${pdfWidth}px`,
								height: `${pdfHeight}px`,
								transform: `scale(${scale})`,
								transformOrigin: "top center",
								transition: "transform 0.15s ease-out",
							}}
						/>
					)}
				</div>
			</div>
		</div>
	);

	if (isExpanded) {
		return (
			<div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/20 p-6 backdrop-blur-sm">
				{viewer}
			</div>
		);
	}

	return viewer;
}

function formatFileSize(bytes: number) {
	if (!Number.isFinite(bytes) || bytes <= 0) return "Unknown size";

	const units = ["B", "KB", "MB", "GB"];
	let value = bytes;
	let unitIndex = 0;

	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}

	return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
