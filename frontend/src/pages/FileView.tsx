import { useEffect, useMemo, useRef, useState } from "react";
import {
	Link,
	useNavigate,
	useOutletContext,
	useParams,
} from "react-router-dom";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
	Check,
	Code2,
	Copy,
	Download,
	Edit3,
	Eye,
	ExternalLink,
	FileText,
	Maximize2,
	MessageCircle,
	Minimize2,
	Minus,
	Plus,
	Save,
	Trash2,
	X,
} from "lucide-react";
import {
	AssistantChatMessage,
	AssistantComposer,
	AssistantQuickActions,
	AssistantTypingIndicator,
	type AssistantMessage,
	type AssistantSuggestion,
} from "@/components/assistant-chat";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import type { KibiFile } from "@/components/app-sidebar";
import { apiBaseUrl } from "@/lib/api";
import { fileIconFor } from "@/lib/file-icons";
import React from "react";

const fileTreeUpdatedEvent = "kibi:file-tree-updated";

type PublicDocument = {
	id: number;
	spaceId: number | null;
	filename: string;
	fileName: string;
	originalFileName: string | null;
	mimeType: string;
	fileSize: number;
	categoryId: number | null;
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

type CategorySummary = {
	id: number;
	name: string;
};

type CategoriesResponse = {
	categories?: CategorySummary[];
};

type FileAssistantResponse = {
	message: string;
	suggestedActions?: AssistantSuggestion[];
	error?: string;
};

type AppLayoutContext = {
	activeSpaceId: number | null;
	activeSpaceName: string | null;
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
	const { activeSpaceId, activeSpaceName } =
		useOutletContext<AppLayoutContext>();
	const [document, setDocument] = useState<PublicDocument | null>(null);
	const [categoryName, setCategoryName] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [editableName, setEditableName] = useState("");
	const [isEditingName, setIsEditingName] = useState(false);
	const [isSavingName, setIsSavingName] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
	const [actionError, setActionError] = useState<string | null>(null);
	const [fileObjectUrl, setFileObjectUrl] = useState<string | null>(null);
	const [fileContentVersion, setFileContentVersion] = useState(0);
	const [isFileLoading, setIsFileLoading] = useState(false);
	const [filePreviewError, setFilePreviewError] = useState<string | null>(
		null,
	);
	const [isFileAssistantOpen, setIsFileAssistantOpen] = useState(false);
	const [fileAssistantInput, setFileAssistantInput] = useState("");
	const [fileAssistantMessages, setFileAssistantMessages] = useState<
		AssistantMessage[]
	>([]);
	const [fileAssistantSuggestions, setFileAssistantSuggestions] = useState<
		AssistantSuggestion[]
	>([]);
	const [isFileAssistantLoading, setIsFileAssistantLoading] = useState(false);
	const fileAssistantScrollRef = useRef<HTMLDivElement>(null);
	const fileAssistantInputRef = useRef<HTMLTextAreaElement>(null);

	const fileUrl = useMemo(() => {
		return documentId ? `${apiBaseUrl}/documents/${documentId}/file` : "";
	}, [documentId]);

	useEffect(() => {
		let ignore = false;

		async function loadDocument() {
			if (!documentId) {
				navigate("/", { replace: true });
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
					if ([401, 403, 404].includes(response.status)) {
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
		const handleFileTreeUpdated = (event: Event) => {
			if (!documentId) return;

			const documentIds =
				(event as CustomEvent<{ documentIds?: number[] }>).detail
					?.documentIds ?? [];
			const numericDocumentId = Number(documentId);
			if (
				documentIds.length > 0 &&
				!documentIds.includes(numericDocumentId)
			) {
				return;
			}

			void fetch(`${apiBaseUrl}/documents/${documentId}`, {
				headers: authHeaders(),
			})
				.then((response) =>
					response.ok ? response.json() : Promise.reject(),
				)
				.then((payload: DocumentResponse) => {
					if (payload.document) {
						setDocument(payload.document);
					}
				})
				.catch(() => undefined);
		};

		window.addEventListener(fileTreeUpdatedEvent, handleFileTreeUpdated);
		return () => {
			window.removeEventListener(
				fileTreeUpdatedEvent,
				handleFileTreeUpdated,
			);
		};
	}, [documentId]);

	useEffect(() => {
		if (!document || !fileUrl) {
			setFileObjectUrl(null);
			return;
		}

		const abortController = new AbortController();
		let objectUrl: string | null = null;
		setIsFileLoading(true);
		setFileObjectUrl(null);
		setFilePreviewError(null);

		async function loadFileBlob() {
			try {
				const response = await fetch(fileUrl, {
					headers: authHeaders(),
					signal: abortController.signal,
				});

				if (!response.ok) {
					setFilePreviewError(
						response.status === 404
							? "The file record exists, but the stored file content is not available on the server."
							: response.status === 403
								? "You can view this file record, but the stored file content is not available to preview."
								: "Could not load file preview.",
					);
					return;
				}

				const blob = await response.blob();
				objectUrl = URL.createObjectURL(blob);
				setFileObjectUrl(objectUrl);
			} catch (err) {
				if (err instanceof DOMException && err.name === "AbortError") {
					return;
				}

				setFilePreviewError(
					err instanceof Error
						? err.message
						: "Could not load file preview.",
				);
			} finally {
				if (!abortController.signal.aborted) {
					setIsFileLoading(false);
				}
			}
		}

		void loadFileBlob();

		return () => {
			abortController.abort();
			if (objectUrl) {
				URL.revokeObjectURL(objectUrl);
			}
		};
	}, [document, fileContentVersion, fileUrl]);

	useEffect(() => {
		let ignore = false;

		async function loadCategories() {
			if (!activeSpaceId || !document) {
				setCategoryName(null);
				return;
			}

			try {
				const response = await fetch(
					`${apiBaseUrl}/categories?spaceId=${activeSpaceId}`,
					{ headers: authHeaders() },
				);

				if (!response.ok) {
					throw new Error("Unable to load categories");
				}

				const payload = (await response
					.json()
					.catch(() => null)) as CategoriesResponse | null;
				const categories = payload?.categories ?? [];
				const matchingCategory =
					categories.find(
						(category) => category.id === document.categoryId,
					) ?? null;

				if (!ignore) {
					setCategoryName(matchingCategory?.name ?? null);
				}
			} catch {
				if (!ignore) {
					setCategoryName(null);
				}
			}
		}

		void loadCategories();

		return () => {
			ignore = true;
		};
	}, [activeSpaceId, document?.categoryId]);

	useEffect(() => {
		const container = fileAssistantScrollRef.current;
		if (!container || fileAssistantMessages.length === 0) return;

		container.scrollTo({
			top: container.scrollHeight,
			behavior: "smooth",
		});
	}, [fileAssistantMessages, isFileAssistantLoading]);

	useEffect(() => {
		const element = fileAssistantInputRef.current;
		if (!element) return;

		element.style.height = "auto";
		element.style.height = `${Math.min(element.scrollHeight, 96)}px`;
		element.style.overflowY =
			element.scrollHeight > 96 ? "auto" : "hidden";
	}, [fileAssistantInput, isFileAssistantOpen]);

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
		document.mimeType === "application/pdf" ||
		document.mimeType.startsWith("image/") ||
		document.mimeType.startsWith("audio/") ||
		document.mimeType.startsWith("video/") ||
		document.mimeType.startsWith("text/") ||
		document.mimeType.includes("json") ||
		document.mimeType.includes("xml") ||
		isAudioFileName(displayName) ||
		isVideoFileName(displayName) ||
		isTextLikeFileName(displayName);
	const visibleFileAssistantSuggestions =
		fileAssistantSuggestions.length > 0
			? fileAssistantSuggestions
			: [
					{
						label: "Summarize",
						sub: "Explain this file",
						prompt: `Summarize ${displayName}`,
					},
					{
						label: "Key details",
						sub: "Pull useful facts",
						prompt: "What are the key details in this file?",
					},
					{
						label: "Category",
						sub: categoryName ?? "Review fit",
						prompt: "Why is this file in this category?",
					},
				];

	async function sendFileAssistantMessage(text: string) {
		const trimmedText = text.trim();
		if (!trimmedText || isFileAssistantLoading || !documentId) return;

		const userMessage: AssistantMessage = {
			id: crypto.randomUUID(),
			role: "user",
			content: trimmedText,
			timestamp: new Date(),
		};

		setFileAssistantMessages((messages) => [...messages, userMessage]);
		setFileAssistantInput("");
		setIsFileAssistantLoading(true);
		setIsFileAssistantOpen(true);

		try {
			const response = await fetch(
				`${apiBaseUrl}/assistant/file/${documentId}`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...authHeaders(),
					},
					body: JSON.stringify({ prompt: trimmedText }),
				},
			);
			const payload = (await response.json().catch(() => null)) as
				| FileAssistantResponse
				| null;

			if (!response.ok) {
				throw new Error(
					payload?.error ??
						"Something went wrong. Please try again.",
				);
			}

			if (payload?.suggestedActions?.length) {
				setFileAssistantSuggestions(payload.suggestedActions);
			}

			setFileAssistantMessages((messages) => [
				...messages,
				{
					id: crypto.randomUUID(),
					role: "assistant",
					content:
						payload?.message ??
						"I couldn't find enough file context to answer that.",
					timestamp: new Date(),
				},
			]);
		} catch (err) {
			setFileAssistantMessages((messages) => [
				...messages,
				{
					id: crypto.randomUUID(),
					role: "assistant",
					content:
						err instanceof Error
							? err.message
							: "Something went wrong. Please try again.",
					timestamp: new Date(),
				},
			]);
		} finally {
			setIsFileAssistantLoading(false);
		}
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

	function handleFileDragStart(event: React.DragEvent<HTMLElement>) {
		if (!document) return;

		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData(
			"application/x-kibi-document",
			JSON.stringify({
				documentId: document.id,
				categoryId: document.categoryId,
				name: displayName,
			}),
		);
		event.dataTransfer.setData("text/plain", displayName);
	}

	const fileSummary = document.summary?.trim();

	return (
		<div className="graph-page relative min-h-[calc(100vh-var(--header-height)-1rem)] overflow-y-auto rounded-2xl border border-stone-200 bg-stone-50">
			<main className="min-h-[calc(100svh-var(--header-height)-1rem)] bg-muted/40">
				<header className="border-b border-border bg-background px-6 py-4">
					<Breadcrumb className="mb-4">
						<BreadcrumbList>
							<BreadcrumbItem>
								<BreadcrumbLink asChild>
									<Link to="/graph">
										{activeSpaceName ?? "Space"}
									</Link>
								</BreadcrumbLink>
							</BreadcrumbItem>
							{categoryName ? (
								<>
									<BreadcrumbSeparator />
									<BreadcrumbItem>
										<BreadcrumbLink asChild>
											<Link
												to={
													document.categoryId
														? `/graph?categoryId=${document.categoryId}`
														: "/graph"
												}
											>
												{categoryName}
											</Link>
										</BreadcrumbLink>
									</BreadcrumbItem>
								</>
							) : null}
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbPage>{displayName}</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
					<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
						<div className="min-w-0">
							<div className="flex min-w-0 items-center gap-2">
								{isEditingName ? (
									<>
										<input
											value={editableName}
											onChange={(event) =>
												setEditableName(
													event.target.value,
												)
											}
											className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-lg font-semibold text-foreground outline-none ring-0 placeholder:text-muted-foreground focus:border-ring"
											maxLength={180}
											disabled={
												isSavingName || isDeleting
											}
											aria-label="File name"
										/>
										<button
											type="button"
											onClick={handleSaveName}
											disabled={
												isSavingName || isDeleting
											}
											className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
											aria-label="Save file name"
										>
											<Save className="size-4" />
										</button>
										<button
											type="button"
											onClick={() => {
												setEditableName(displayName);
												setIsEditingName(false);
												setActionError(null);
											}}
											disabled={
												isSavingName || isDeleting
											}
											className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
											aria-label="Cancel file name edit"
										>
											<X className="size-4" />
										</button>
									</>
								) : (
									<>
										<h1 className="truncate text-lg font-semibold text-foreground">
											{displayName}
										</h1>
										<button
											type="button"
											onClick={() => {
												setEditableName(displayName);
												setIsEditingName(true);
												setActionError(null);
											}}
											disabled={isDeleting}
											className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
											aria-label="Edit file name"
										>
											<Edit3 className="size-4" />
										</button>
									</>
								)}
							</div>
							<p className="mt-1 text-xs text-muted-foreground">
								{document.mimeType} ·{" "}
								{formatFileSize(document.fileSize)}
							</p>
							<div
								draggable
								onDragStart={handleFileDragStart}
								className="mt-2 inline-flex cursor-grab items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground active:cursor-grabbing"
								title="Drag this file onto a category in the sidebar"
							>
								<FileText className="size-3.5" />
								Drag to category
							</div>
							{actionError ? (
								<p className="mt-2 text-xs text-destructive">
									{actionError}
								</p>
							) : null}
						</div>
						<div className="flex shrink-0 gap-2">
							<Button
								type="button"
								variant="destructive"
								size="lg"
								onClick={() => {
									setActionError(null);
									setIsDeleteModalOpen(true);
								}}
								disabled={isSavingName || isDeleting}
							>
								<Trash2 className="size-4" />
								{isDeleting ? "Deleting..." : "Delete"}
							</Button>
							<a
								href={
									canPreview && fileObjectUrl
										? fileObjectUrl
										: undefined
								}
								target="_blank"
								rel="noreferrer"
								aria-disabled={!canPreview || !fileObjectUrl}
								className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted aria-disabled:pointer-events-none aria-disabled:opacity-60"
							>
								<ExternalLink className="size-4" />
								Open
							</a>
							<a
								href={fileObjectUrl ?? undefined}
								download={displayName}
								aria-disabled={!fileObjectUrl}
								className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium bg-(--color-accent) text-foreground hover:bg-(--color-accent-hover) aria-disabled:pointer-events-none aria-disabled:opacity-60"
							>
								<Download className="size-4" />
								Download
							</a>
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
					{canPreview ? (
						isFileLoading ? (
							<div className="flex h-full min-h-[480px] items-center justify-center rounded-lg border border-border bg-background text-sm text-muted-foreground">
								Loading preview...
							</div>
						) : fileObjectUrl ? (
							<FilePreview
								document={document}
								fileUrl={fileObjectUrl}
								displayName={displayName}
								onFileContentSaved={(nextDocument) => {
									if (nextDocument) {
										setDocument(nextDocument);
									}
									setFileContentVersion(
										(currentValue) => currentValue + 1,
									);
								}}
							/>
						) : (
							<FilePreviewUnavailable
								message={
									filePreviewError ??
									"This file cannot be previewed right now."
								}
							/>
						)
					) : (
						<FilePreviewUnavailable
							message={
								filePreviewError ??
								"This file type cannot be previewed inline. Download it to view the original file."
							}
						/>
					)}
				</section>

				<div className="pointer-events-none fixed right-4 bottom-4 z-40 w-[calc(100vw-2rem)] max-w-md md:right-6 md:bottom-6">
					<div
						aria-hidden={!isFileAssistantOpen}
						className={`pointer-events-auto absolute right-0 bottom-0 w-full overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-[0_18px_50px_rgba(0,0,0,0.14)] transition-all duration-300 ease-out ${
							isFileAssistantOpen
								? "translate-y-0 opacity-100"
								: "pointer-events-none translate-y-5 opacity-0"
						}`}
					>
						<div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
							<div className="flex min-w-0 items-center gap-2">
								<span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500">
									<MessageCircle className="size-4" />
								</span>
								<div className="min-w-0">
									<p className="truncate text-sm font-semibold text-zinc-900">
										Ask about this file
									</p>
									<p className="truncate text-xs text-zinc-500">
										{displayName}
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={() => setIsFileAssistantOpen(false)}
								className="inline-flex size-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
								aria-label="Close file assistant"
							>
								<X className="size-4" />
							</button>
						</div>
						<div
							ref={fileAssistantScrollRef}
							className="max-h-[48vh] min-h-48 overflow-y-auto bg-zinc-50 px-4 py-4"
						>
							{fileAssistantMessages.length === 0 ? (
								<p className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 text-zinc-500">
									Ask questions about the current file. I can
									use its summary, metadata, and any extracted
									text available.
								</p>
							) : (
								fileAssistantMessages.map((message) => (
									<AssistantChatMessage
										key={message.id}
										message={message}
										compact
									/>
								))
							)}
							{isFileAssistantLoading ? (
								<AssistantTypingIndicator />
							) : null}
						</div>
						<div className="border-t border-zinc-100">
							<AssistantComposer
								input={fileAssistantInput}
								onInputChange={setFileAssistantInput}
								onSubmit={() =>
									void sendFileAssistantMessage(
										fileAssistantInput,
									)
								}
								isLoading={isFileAssistantLoading}
								placeholder="Ask about this file"
								textareaRef={fileAssistantInputRef}
								compact
							/>
							<div className="mx-4 h-px bg-zinc-100" />
							<div className="px-3 py-2">
								<AssistantQuickActions
									suggestions={
										visibleFileAssistantSuggestions
									}
									isLoading={false}
									onSelect={(prompt) =>
										void sendFileAssistantMessage(
											prompt,
										)
									}
									spaceLabel={displayName}
									compact
								/>
							</div>
						</div>
					</div>
					<button
						type="button"
						onClick={() => setIsFileAssistantOpen(true)}
						aria-hidden={isFileAssistantOpen}
						className={`pointer-events-auto ml-auto flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 shadow-[0_14px_36px_rgba(0,0,0,0.14)] transition-all duration-300 ease-out hover:bg-zinc-50 hover:opacity-100 ${
							isFileAssistantOpen
								? "pointer-events-none translate-y-3 opacity-0"
								: "translate-y-0 opacity-100"
						}`}
					>
						<MessageCircle className="size-4 text-zinc-500" />
						Ask AI about this file
					</button>
				</div>

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
										from this space. This action cannot be
										undone.
									</p>
								</div>
							</div>

							<div className="px-6 py-5">
								{actionError ? (
									<p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100">
										{actionError}
									</p>
								) : null}
								<div className="flex justify-end gap-2 pt-4">
									<Button
										type="button"
										variant="outline"
										size="lg"
										className="min-w-24"
										onClick={() =>
											setIsDeleteModalOpen(false)
										}
										disabled={isDeleting}
									>
										Cancel
									</Button>
									<Button
										type="button"
										variant="destructive"
										size="lg"
										className="min-w-32"
										disabled={isSavingName || isDeleting}
										onClick={handleDelete}
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
		</div>
	);
}

function FilePreview({
	document,
	fileUrl,
	displayName,
	onFileContentSaved,
}: {
	document: PublicDocument;
	fileUrl: string;
	displayName: string;
	onFileContentSaved?: (document?: PublicDocument) => void;
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

	if (document.mimeType.startsWith("video/") || isVideoFileName(displayName)) {
		return (
			<div className="flex h-full items-center justify-center rounded-lg border border-border bg-black p-4">
				<video
					src={fileUrl}
					controls
					className="max-h-full max-w-full rounded-md"
				>
					<track kind="captions" />
				</video>
			</div>
		);
	}

	if (document.mimeType.startsWith("audio/") || isAudioFileName(displayName)) {
		return (
			<div className="flex h-full items-center justify-center rounded-lg border border-border bg-background p-6">
				<audio src={fileUrl} controls className="w-full max-w-xl">
					<track kind="captions" />
				</audio>
			</div>
		);
	}

	if (isCodeLikeFile(document, displayName)) {
		return (
			<CodeFileViewer
				documentId={document.id}
				fileUrl={fileUrl}
				displayName={displayName}
				mimeType={document.mimeType}
				onSaved={onFileContentSaved}
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

function FilePreviewUnavailable({ message }: { message: string }) {
	return (
		<div className="flex h-full min-h-[480px] flex-col items-center justify-center rounded-lg border border-border bg-background p-8 text-center">
			<FileText className="size-12 text-muted-foreground" />
			<h2 className="mt-4 text-base font-semibold">
				Preview unavailable
			</h2>
			<p className="mt-2 max-w-md text-sm text-muted-foreground">
				{message}
			</p>
		</div>
	);
}

function CodeFileViewer({
	documentId,
	fileUrl,
	displayName,
	mimeType,
	onSaved,
}: {
	documentId: number;
	fileUrl: string;
	displayName: string;
	mimeType: string;
	onSaved?: (document?: PublicDocument) => void;
}) {
	const [source, setSource] = useState("");
	const [draftSource, setDraftSource] = useState("");
	const [isLoadingSource, setIsLoadingSource] = useState(true);
	const [isSavingSource, setIsSavingSource] = useState(false);
	const [sourceError, setSourceError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [isEditingSource, setIsEditingSource] = useState(false);
	const canPreview = supportsCodePreview(displayName, mimeType);
	const [mode, setMode] = useState<"code" | "preview">("code");
	const activeSource = isEditingSource ? draftSource : source;
	const language = languageLabelForFile(displayName, mimeType);

	useEffect(() => {
		const abortController = new AbortController();
		setIsLoadingSource(true);
		setSource("");
		setDraftSource("");
		setSourceError(null);
		setCopied(false);
		setIsEditingSource(false);
		setMode("code");

		async function loadSource() {
			try {
				const response = await fetch(fileUrl, {
					signal: abortController.signal,
				});
				if (!response.ok) {
					throw new Error("Could not load source.");
				}

				const nextSource = await response.text();
				setSource(nextSource);
				setDraftSource(nextSource);
			} catch (err) {
				if (err instanceof DOMException && err.name === "AbortError") {
					return;
				}

				setSourceError(
					err instanceof Error
						? err.message
						: "Could not load source.",
				);
			} finally {
				if (!abortController.signal.aborted) {
					setIsLoadingSource(false);
				}
			}
		}

		void loadSource();

		return () => abortController.abort();
	}, [fileUrl]);

	const handleCopy = async () => {
		if (!activeSource) return;

		try {
			await navigator.clipboard.writeText(activeSource);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1400);
		} catch {
			setSourceError("Could not copy code to the clipboard.");
		}
	};

	const handleSave = async () => {
		setIsSavingSource(true);
		setSourceError(null);

		try {
			const response = await fetch(
				`${apiBaseUrl}/documents/${documentId}/file`,
				{
					method: "PATCH",
					headers: {
						...authHeaders(),
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ content: draftSource }),
				},
			);
			const payload = (await response
				.json()
				.catch(() => null)) as {
				document?: PublicDocument;
				error?: string;
			} | null;

			if (!response.ok) {
				throw new Error(
					payload?.error ?? "Could not save the file content.",
				);
			}

			setSource(draftSource);
			setIsEditingSource(false);
			onSaved?.(payload?.document);
		} catch (err) {
			setSourceError(
				err instanceof Error
					? err.message
					: "Could not save the file content.",
			);
		} finally {
			setIsSavingSource(false);
		}
	};

	const handleCancelEdit = () => {
		setDraftSource(source);
		setSourceError(null);
		setIsEditingSource(false);
	};

	return (
		<div className="flex h-full min-h-[480px] flex-col overflow-hidden rounded-lg border border-border bg-background">
			<div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-3">
				<div className="flex min-w-0 items-center gap-2">
					<span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
						<Code2 className="size-3.5" />
					</span>
					<span className="truncate text-sm font-medium text-foreground">
						{displayName}
					</span>
					<span className="hidden rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline-flex">
						{language}
					</span>
				</div>
				<div className="flex shrink-0 items-center gap-1.5">
					{canPreview ? (
						<div className="flex items-center rounded-lg border border-border bg-muted p-0.5">
							<button
								type="button"
								onClick={() => setMode("preview")}
								className={
									mode === "preview"
										? "inline-flex h-7 items-center gap-1 rounded-md bg-background px-2 text-xs font-medium text-foreground"
										: "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground"
								}
							>
								<Eye className="size-3.5" />
								Preview
							</button>
							<button
								type="button"
								onClick={() => setMode("code")}
								className={
									mode === "code"
										? "inline-flex h-7 items-center gap-1 rounded-md bg-background px-2 text-xs font-medium text-foreground"
										: "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground"
								}
							>
								<Code2 className="size-3.5" />
								Code
							</button>
						</div>
					) : null}
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={handleCopy}
						disabled={!activeSource || isLoadingSource}
					>
						{copied ? (
							<Check className="size-3.5" />
						) : (
							<Copy className="size-3.5" />
						)}
						{copied ? "Copied" : "Copy"}
					</Button>
					{isEditingSource ? (
						<>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={handleCancelEdit}
								disabled={isSavingSource}
							>
								<X className="size-3.5" />
								Cancel
							</Button>
							<Button
								type="button"
								variant="accent"
								size="sm"
								onClick={() => void handleSave()}
								disabled={isSavingSource}
							>
								<Save className="size-3.5" />
								{isSavingSource ? "Saving..." : "Save"}
							</Button>
						</>
					) : (
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => {
								setDraftSource(source);
								setIsEditingSource(true);
								setMode("code");
							}}
							disabled={isLoadingSource}
						>
							<Edit3 className="size-3.5" />
							Edit
						</Button>
					)}
				</div>
			</div>
			<div className="min-h-0 flex-1 overflow-auto bg-muted/40">
				{isLoadingSource ? (
					<div className="flex h-full min-h-[420px] items-center justify-center text-sm text-muted-foreground">
						Loading source...
					</div>
				) : sourceError ? (
					<FilePreviewUnavailable message={sourceError} />
				) : mode === "preview" && canPreview ? (
					<CodePreview
						source={activeSource}
						displayName={displayName}
						mimeType={mimeType}
					/>
				) : (
					<CodeEditorView
						value={activeSource}
						isEditing={isEditingSource}
						onChange={setDraftSource}
						displayName={displayName}
						mimeType={mimeType}
					/>
				)}
			</div>
		</div>
	);
}

function CodeEditorView({
	value,
	isEditing,
	onChange,
	displayName,
	mimeType,
}: {
	value: string;
	isEditing: boolean;
	onChange: (nextValue: string) => void;
	displayName: string;
	mimeType: string;
}) {
	const language = languageLabelForFile(displayName, mimeType);
	const lines = value.length ? value.split(/\r?\n/) : [""];

	return (
		<div className="flex h-full min-h-[420px] flex-col bg-zinc-950 text-zinc-100">
			<div className="min-h-0 flex-1 overflow-auto">
				<div className="grid min-h-full min-w-max grid-cols-[auto_minmax(48rem,1fr)] font-mono text-xs leading-5">
					<div className="select-none border-r border-zinc-800 bg-zinc-900/80 py-4 text-right text-zinc-500">
						{lines.map((_, index) => (
							<div key={index} className="px-3 tabular-nums">
								{index + 1}
							</div>
						))}
					</div>
					{isEditing ? (
						<textarea
							value={value}
							onChange={(event) => onChange(event.target.value)}
							spellCheck={false}
							aria-label={`Edit ${displayName}`}
							className="min-h-[420px] resize-none bg-transparent py-4 pr-6 pl-4 font-mono text-xs leading-5 text-zinc-100 outline-none selection:bg-zinc-700"
						/>
					) : (
						<pre className="py-4 pr-6 pl-4 text-zinc-100">
							<code>
								{lines.map((line, index) => (
									<span
										key={index}
										className="block min-h-5 whitespace-pre"
									>
										{line || " "}
									</span>
								))}
							</code>
						</pre>
					)}
				</div>
			</div>
			<div className="flex h-9 shrink-0 items-center justify-between border-t border-zinc-800 bg-zinc-900 px-3 text-[11px] text-zinc-500">
				<span>{isEditing ? "Editing" : "Read only"}</span>
				<span>{language}</span>
			</div>
		</div>
	);
}

function CodePreview({
	source,
	displayName,
	mimeType,
}: {
	source: string;
	displayName: string;
	mimeType: string;
}) {
	const extension = getFileExtension(displayName);

	if (extension === "html" || mimeType === "text/html") {
		return (
			<iframe
				srcDoc={source}
				title={`${displayName} preview`}
				className="h-full min-h-[420px] w-full border-0 bg-white"
				sandbox=""
			/>
		);
	}

	if (extension === "csv" || extension === "tsv" || mimeType.includes("csv")) {
		return <DelimitedTablePreview source={source} delimiter={extension === "tsv" ? "\t" : ","} />;
	}

	return <MarkdownPreview source={source} />;
}

function MarkdownPreview({ source }: { source: string }) {
	return (
		<div className="mx-auto max-w-3xl bg-background px-6 py-5 text-sm leading-6 text-foreground">
			{source.split(/\n{2,}/).map((block, index) => {
				const trimmed = block.trim();
				if (!trimmed) return null;
				if (trimmed.startsWith("# ")) {
					return (
						<h1 key={index} className="mb-3 text-2xl font-semibold">
							{trimmed.replace(/^#\s+/, "")}
						</h1>
					);
				}
				if (trimmed.startsWith("## ")) {
					return (
						<h2 key={index} className="mb-2 text-lg font-semibold">
							{trimmed.replace(/^##\s+/, "")}
						</h2>
					);
				}
				if (trimmed.startsWith("```")) {
					return (
						<pre
							key={index}
							className="mb-4 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100"
						>
							<code>{trimmed.replace(/^```\w*\n?/, "").replace(/```$/, "")}</code>
						</pre>
					);
				}
				return (
					<p key={index} className="mb-4 whitespace-pre-wrap">
						{trimmed}
					</p>
				);
			})}
		</div>
	);
}

function DelimitedTablePreview({
	source,
	delimiter,
}: {
	source: string;
	delimiter: string;
}) {
	const rows = source
		.split(/\r?\n/)
		.filter((row) => row.trim())
		.slice(0, 80)
		.map((row) => row.split(delimiter).slice(0, 16));
	const [header, ...body] = rows;

	if (!header) {
		return <FilePreviewUnavailable message="This data file is empty." />;
	}

	return (
		<div className="h-full overflow-auto bg-background p-4">
			<table className="w-full min-w-max border-collapse text-left text-xs">
				<thead>
					<tr>
						{header.map((cell, index) => (
							<th
								key={`${cell}-${index}`}
								className="border border-border bg-muted px-2 py-1 font-medium text-foreground"
							>
								{cell}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{body.map((row, rowIndex) => (
						<tr key={rowIndex}>
							{header.map((_, cellIndex) => (
								<td
									key={cellIndex}
									className="border border-border px-2 py-1 text-muted-foreground"
								>
									{row[cellIndex] ?? ""}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
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

function getFileExtension(name: string) {
	const extension = name.split(".").pop();
	return extension && extension !== name ? extension.toLowerCase() : "";
}

function isCodeLikeFile(document: PublicDocument, name: string) {
	const extension = getFileExtension(name);
	return (
		document.mimeType.startsWith("text/") ||
		document.mimeType.includes("json") ||
		document.mimeType.includes("xml") ||
		[
			"bash",
			"c",
			"cc",
			"cpp",
			"cs",
			"css",
			"csv",
			"go",
			"h",
			"hpp",
			"html",
			"java",
			"js",
			"jsx",
			"json",
			"kt",
			"log",
			"lua",
			"md",
			"mdx",
			"php",
			"py",
			"rb",
			"rs",
			"scss",
			"sh",
			"sql",
			"swift",
			"toml",
			"ts",
			"tsx",
			"tsv",
			"txt",
			"vue",
			"xml",
			"yaml",
			"yml",
		].includes(extension)
	);
}

function supportsCodePreview(name: string, mimeType: string) {
	const extension = getFileExtension(name);
	return (
		mimeType === "text/html" ||
		mimeType === "text/markdown" ||
		mimeType.includes("csv") ||
		["csv", "html", "md", "mdx", "tsv"].includes(extension)
	);
}

function languageLabelForFile(name: string, mimeType: string) {
	const extension = getFileExtension(name);
	const labels: Record<string, string> = {
		bash: "Bash",
		c: "C",
		cc: "C++",
		cpp: "C++",
		cs: "C#",
		css: "CSS",
		csv: "CSV",
		go: "Go",
		h: "C/C++",
		hpp: "C++",
		html: "HTML",
		java: "Java",
		js: "JavaScript",
		jsx: "React JSX",
		json: "JSON",
		kt: "Kotlin",
		log: "Log",
		lua: "Lua",
		md: "Markdown",
		mdx: "MDX",
		php: "PHP",
		py: "Python",
		rb: "Ruby",
		rs: "Rust",
		scss: "SCSS",
		sh: "Shell",
		sql: "SQL",
		swift: "Swift",
		toml: "TOML",
		ts: "TypeScript",
		tsx: "React TSX",
		tsv: "TSV",
		txt: "Text",
		vue: "Vue",
		xml: "XML",
		yaml: "YAML",
		yml: "YAML",
	};

	return labels[extension] ?? (mimeType.startsWith("text/") ? "Text" : "Code");
}

function isTextLikeFileName(name: string) {
	const extension = getFileExtension(name);
	return Boolean(
		extension &&
			[
				"bash",
				"c",
				"cc",
				"cpp",
				"cs",
				"css",
				"csv",
				"go",
				"h",
				"hpp",
				"html",
				"java",
				"js",
				"jsx",
				"json",
				"kt",
				"log",
				"lua",
				"md",
				"mdx",
				"php",
				"py",
				"rb",
				"rs",
				"scss",
				"sh",
				"sql",
				"swift",
				"toml",
				"ts",
				"tsx",
				"tsv",
				"txt",
				"vue",
				"xml",
				"yaml",
				"yml",
			].includes(extension),
	);
}

function isAudioFileName(name: string) {
	const extension = name.split(".").pop()?.toLowerCase();
	return Boolean(
		extension && ["aac", "flac", "m4a", "mp3", "ogg", "wav"].includes(extension),
	);
}

function isVideoFileName(name: string) {
	const extension = name.split(".").pop()?.toLowerCase();
	return Boolean(
		extension && ["avi", "m4v", "mov", "mp4", "mpeg", "webm"].includes(extension),
	);
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
					<button
						type="button"
						className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
						onClick={() =>
							setZoom((value) => Math.max(50, value - 10))
						}
						aria-label="Zoom out"
					>
						<Minus className="size-4" />
					</button>
					<button
						type="button"
						className="h-8 w-12 rounded-md text-center text-xs tabular-nums text-muted-foreground hover:bg-muted hover:text-foreground"
						onClick={() => setZoom(100)}
						aria-label="Reset zoom"
					>
						{zoom}%
					</button>
					<button
						type="button"
						className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
						onClick={() =>
							setZoom((value) => Math.min(250, value + 10))
						}
						aria-label="Zoom in"
					>
						<Plus className="size-4" />
					</button>
					<button
						type="button"
						className="ml-1 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
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
					</button>
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
