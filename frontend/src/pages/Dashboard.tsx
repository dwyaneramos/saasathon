import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type DragEvent,
} from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import {
	RotateCcw,
	UploadCloud,
} from "lucide-react";
import {
	AssistantChatMessage as ChatMessage,
	AssistantComposer,
	AssistantQuickActions as QuickActions,
	AssistantTypingIndicator as TypingIndicator,
	type AssistantMessage as Message,
	type AssistantSuggestion as Suggestion,
} from "@/components/assistant-chat";
import { useAuth } from "@/context/AuthContext";
import { openUploadModalEvent } from "@/components/app-sidebar";
import { apiBaseUrl } from "@/lib/api";
import { downloadResponseBlob } from "@/lib/download";
import type { CategorySummary, DocumentSummary } from "@/types/graph";

const fileTreeUpdatedEvent = "kibi:file-tree-updated";

type AppLayoutContext = {
	activeSpaceId: number | null;
	activeSpaceName: string | null;
};

type CategoriesResponse = { categories?: CategorySummary[] };
type DocumentsResponse = { documents?: DocumentSummary[] };
type AssistantResponse = {
	message: string;
	navigateTo: string | null;
	suggestedActions?: Suggestion[];
};

function authHeaders() {
	const token = localStorage.getItem("token");
	return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function isDownloadRequest(text: string) {
	return /\b(download|export|zip|save)\b/i.test(text);
}

function truncateFilenameForDisplay(filename: string, maxLength = 52) {
	const trimmedFilename = filename.trim();
	if (trimmedFilename.length <= maxLength) {
		return trimmedFilename;
	}

	const extensionMatch = trimmedFilename.match(/(\.[a-z0-9]{1,8})$/i);
	const extension = extensionMatch?.[1] ?? "";
	const basename = extension
		? trimmedFilename.slice(0, -extension.length)
		: trimmedFilename;
	const basenameLimit = Math.max(12, maxLength - extension.length - 3);

	return `${basename.slice(0, basenameLimit)}...${extension}`;
}

function documentDisplayName(document: DocumentSummary) {
	return document.originalFileName || document.fileName || document.filename;
}

function sortDocumentsByNewest(documents: DocumentSummary[]) {
	return [...documents].sort((left, right) => {
		return (
			new Date(right.createdAt).getTime() -
			new Date(left.createdAt).getTime()
		);
	});
}

const productivityPromptTemplates = [
	"How can I help inside {spaceLabel}?",
	"What should we get moving inside {spaceLabel}?",
	"What would you like to clear first in {spaceLabel}?",
	"What can I help organise in {spaceLabel}?",
	"What should we make easier in {spaceLabel} today?",
	"Where should we focus inside {spaceLabel}?",
	"What do you want to get done in {spaceLabel}?",
	"Want to find, file, or tidy something in {spaceLabel}?",
];

function productivityPromptForSpace(spaceLabel: string, seed: number) {
	const template =
		productivityPromptTemplates[
			seed % productivityPromptTemplates.length
		];

	return template.replace("{spaceLabel}", spaceLabel);
}

export default function Dashboard() {
	const { user } = useAuth();
	const { activeSpaceId, activeSpaceName } =
		useOutletContext<AppLayoutContext>();
	const navigate = useNavigate();
	const location = useLocation();
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isContextLoading, setIsContextLoading] = useState(false);
	const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
	const [categories, setCategories] = useState<CategorySummary[]>([]);
	const [documents, setDocuments] = useState<DocumentSummary[]>([]);
	const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
	const [contextRefreshKey, setContextRefreshKey] = useState(0);
	const [isDragUploadActive, setIsDragUploadActive] = useState(false);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const dragDepthRef = useRef(0);
	const isEmpty = messages.length === 0;
	const hasStartedConversation = messages.length > 0 || isLoading;
	const userFirstName = user?.firstName ?? null;
	const spaceLabel = activeSpaceName ?? "your space";
	const [productivityPromptSeed, setProductivityPromptSeed] = useState(() =>
		Math.floor(Math.random() * productivityPromptTemplates.length),
	);
	const productivityPrompt = useMemo(
		() => productivityPromptForSpace(spaceLabel, productivityPromptSeed),
		[productivityPromptSeed, spaceLabel],
	);

	useEffect(() => {
		setProductivityPromptSeed(
			Math.floor(Math.random() * productivityPromptTemplates.length),
		);
	}, [activeSpaceId]);

	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container || messages.length === 0) return;

		container.scrollTo({
			top: container.scrollHeight,
			behavior: "smooth",
		});
	}, [messages, isLoading]);

	useEffect(() => {
		const element = textareaRef.current;
		if (!element) return;
		element.style.height = "auto";
		element.style.height = `${Math.min(element.scrollHeight, 140)}px`;
		element.style.overflowY =
			element.scrollHeight > 140 ? "auto" : "hidden";
	}, [input]);

	useEffect(() => {
		const handleFileTreeUpdated = () => {
			setContextRefreshKey((currentValue) => currentValue + 1);
		};

		window.addEventListener(fileTreeUpdatedEvent, handleFileTreeUpdated);

		return () => {
			window.removeEventListener(
				fileTreeUpdatedEvent,
				handleFileTreeUpdated,
			);
		};
	}, []);

	useEffect(() => {
		let ignore = false;

		if (!activeSpaceId) {
			setCategories([]);
			setDocuments([]);
			setIsContextLoading(false);
			return () => {
				ignore = true;
			};
		}

		async function loadContext() {
			setIsContextLoading(true);

			try {
				const query = `?spaceId=${activeSpaceId}`;
				const [categoriesResponse, documentsResponse] =
					await Promise.all([
						fetch(`${apiBaseUrl}/categories${query}`, {
							headers: authHeaders(),
						}),
						fetch(`${apiBaseUrl}/documents${query}`, {
							headers: authHeaders(),
						}),
					]);

				if (!categoriesResponse.ok || !documentsResponse.ok) {
					throw new Error("Unable to load dashboard context.");
				}

				const [categoriesPayload, documentsPayload] =
					(await Promise.all([
						categoriesResponse.json(),
						documentsResponse.json(),
					])) as [CategoriesResponse, DocumentsResponse];

				if (!ignore) {
					setCategories(categoriesPayload.categories ?? []);
					setDocuments(documentsPayload.documents ?? []);
				}
			} catch {
				if (!ignore) {
					setCategories([]);
					setDocuments([]);
				}
			} finally {
				if (!ignore) {
					setIsContextLoading(false);
				}
			}
		}

		void loadContext();

		return () => {
			ignore = true;
		};
	}, [activeSpaceId, contextRefreshKey]);

	useEffect(() => {
		let ignore = false;

		if (!activeSpaceId) {
			setSuggestions([]);
			setIsSuggestionsLoading(false);
			return () => {
				ignore = true;
			};
		}

		async function loadSuggestions() {
			setIsSuggestionsLoading(true);

			try {
				const response = await fetch(
					`${apiBaseUrl}/assistant/dashboard`,
					{
						method: "POST",
						headers: {
							...authHeaders(),
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							prompt: "",
							spaceId: activeSpaceId,
							pathname: location.pathname,
						}),
					},
				);

				if (!response.ok) {
					throw new Error("Could not load suggestions.");
				}

				const payload = (await response.json()) as AssistantResponse;
				if (!ignore) {
					setSuggestions(payload.suggestedActions ?? []);
				}
			} catch {
				if (!ignore) {
					setSuggestions([]);
				}
			} finally {
				if (!ignore) {
					setIsSuggestionsLoading(false);
				}
			}
		}

		void loadSuggestions();

		return () => {
			ignore = true;
		};
	}, [activeSpaceId, location.pathname, contextRefreshKey]);

	const contextSummary = useMemo(() => {
		if (!activeSpaceId) {
			return "Choose a space from the sidebar to unlock file-aware suggestions.";
		}

		if (isContextLoading) {
			return "Refreshing your files, categories, and assistant context for this space.";
		}

		const newestDocument = sortDocumentsByNewest(documents)[0];
		const counts = `${categories.length} categor${categories.length === 1 ? "y" : "ies"} and ${documents.length} file${documents.length === 1 ? "" : "s"}`;

		if (!newestDocument) {
			return `${counts}. This space is ready for its first upload.`;
		}

		return `${counts}. Latest file: ${documentDisplayName(newestDocument)}.`;
	}, [activeSpaceId, categories.length, documents, isContextLoading]);

	const downloadMatchingFiles = async (query: string) => {
		if (!activeSpaceId) {
			throw new Error("Choose a space before downloading files.");
		}

		const response = await fetch(`${apiBaseUrl}/documents/download-query`, {
			method: "POST",
			headers: {
				...authHeaders(),
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query,
				spaceId: activeSpaceId,
			}),
		});

		if (!response.ok) {
			const payload = (await response.json().catch(() => null)) as {
				error?: string;
			} | null;
			throw new Error(
				payload?.error ?? "No files matched that download request.",
			);
		}

		const filename = await downloadResponseBlob(
			response,
			"kibi-download.zip",
		);
		const fileCount = Number(response.headers.get("X-File-Count"));
		const countText = Number.isFinite(fileCount)
			? `${fileCount} file${fileCount === 1 ? "" : "s"}`
			: "the matching files";

		return `Downloading ${countText} as \`${truncateFilenameForDisplay(filename)}\`.`;
	};

	const sendMessage = async (text: string) => {
		const trimmedText = text.trim();
		if (!trimmedText || isLoading) return;
		if (!activeSpaceId) {
			const assistantMessage: Message = {
				id: crypto.randomUUID(),
				role: "assistant",
				content: "Choose a space from the sidebar first, then I can search its files and categories.",
				timestamp: new Date(),
			};
			setMessages((currentMessages) => [
				...currentMessages,
				assistantMessage,
			]);
			return;
		}

		const userMessage: Message = {
			id: crypto.randomUUID(),
			role: "user",
			content: trimmedText,
			timestamp: new Date(),
		};

		setMessages((currentMessages) => [...currentMessages, userMessage]);
		setInput("");
		setIsLoading(true);

		try {
			if (isDownloadRequest(trimmedText)) {
				const downloadReply = await downloadMatchingFiles(trimmedText);
				await new Promise((resolve) => window.setTimeout(resolve, 220));
				setMessages((currentMessages) => [
					...currentMessages,
					{
						id: crypto.randomUUID(),
						role: "assistant",
						content: downloadReply,
						timestamp: new Date(),
					},
				]);
				return;
			}

			const response = await fetch(`${apiBaseUrl}/assistant/dashboard`, {
				method: "POST",
				headers: {
					...authHeaders(),
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					prompt: trimmedText,
					spaceId: activeSpaceId,
					pathname: location.pathname,
				}),
			});

			const payload = (await response.json().catch(() => null)) as
				| AssistantResponse
				| { error?: string }
				| null;

			if (!response.ok) {
				const errorMessage =
					payload &&
					typeof payload === "object" &&
					"error" in payload &&
					typeof payload.error === "string"
						? payload.error
						: "Something went wrong. Please try again.";
				throw new Error(errorMessage);
			}

			const assistantReply = payload as AssistantResponse;

			if (assistantReply.suggestedActions?.length) {
				setSuggestions(assistantReply.suggestedActions);
			}

			await new Promise((resolve) => window.setTimeout(resolve, 220));

			if (assistantReply.navigateTo === "/upload") {
				if (location.pathname !== "/graph") {
					navigate("/graph");
					window.setTimeout(() => {
						window.dispatchEvent(new Event(openUploadModalEvent));
					}, 120);
				} else {
					window.dispatchEvent(new Event(openUploadModalEvent));
				}
			} else if (
				assistantReply.navigateTo &&
				assistantReply.navigateTo !== location.pathname
			) {
				navigate(assistantReply.navigateTo);
			}

			setMessages((currentMessages) => [
				...currentMessages,
				{
					id: crypto.randomUUID(),
					role: "assistant",
					content: assistantReply.message,
					timestamp: new Date(),
				},
			]);
		} catch (error) {
			setMessages((currentMessages) => [
				...currentMessages,
				{
					id: crypto.randomUUID(),
					role: "assistant",
					content:
						error instanceof Error
							? error.message
							: "Something went wrong. Please try again.",
					timestamp: new Date(),
				},
			]);
		} finally {
			setIsLoading(false);
		}
	};

	const resetConversation = () => {
		if (isLoading) return;
		setMessages([]);
	};

	const handleDashboardDragEnter = (event: DragEvent<HTMLDivElement>) => {
		if (!event.dataTransfer.types.includes("Files")) {
			return;
		}

		event.preventDefault();
		dragDepthRef.current += 1;
		setIsDragUploadActive(true);
	};

	const handleDashboardDragOver = (event: DragEvent<HTMLDivElement>) => {
		if (!event.dataTransfer.types.includes("Files")) {
			return;
		}

		event.preventDefault();
		event.dataTransfer.dropEffect = "copy";
		if (!isDragUploadActive) {
			setIsDragUploadActive(true);
		}
	};

	const handleDashboardDragLeave = (event: DragEvent<HTMLDivElement>) => {
		if (!event.dataTransfer.types.includes("Files")) {
			return;
		}

		event.preventDefault();
		dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
		if (dragDepthRef.current === 0) {
			setIsDragUploadActive(false);
		}
	};

	const handleDashboardDrop = (event: DragEvent<HTMLDivElement>) => {
		if (!event.dataTransfer.files.length) {
			return;
		}

		event.preventDefault();
		dragDepthRef.current = 0;
		setIsDragUploadActive(false);
		window.dispatchEvent(
			new CustomEvent(openUploadModalEvent, {
				detail: {
					files: Array.from(event.dataTransfer.files),
					categoryId: null,
				},
			}),
		);
	};

	return (
		<div
			className="relative flex h-[calc(100svh-var(--header-height)-1rem)] max-h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-stone-50"
			onDragEnter={handleDashboardDragEnter}
			onDragOver={handleDashboardDragOver}
			onDragLeave={handleDashboardDragLeave}
			onDrop={handleDashboardDrop}
		>
			<div
				ref={scrollContainerRef}
				className="min-h-0 flex-1 overflow-y-auto px-4 pb-52 pt-6 sm:px-6 sm:pb-64 sm:pt-8"
			>
				<div className="mx-auto max-w-3xl">
					{isEmpty ? (
						<div className="pointer-events-none flex min-h-[44svh] flex-col items-center justify-start gap-4 pt-6 text-center sm:min-h-[50vh] sm:gap-6 sm:pt-10">
							<div>
								<h1 className="bg-gradient-to-b from-zinc-900 to-zinc-400 bg-clip-text pb-3 text-4xl font-bold leading-[0.9] tracking-tighter text-transparent sm:text-5xl md:text-7xl">
									Hi
									{userFirstName
										? ` ${userFirstName}`
										: " there"}
									,
								</h1>
								<p className="text-base text-zinc-500 sm:text-lg">
									{productivityPrompt}
								</p>
								<p className="mx-auto mt-2 max-w-xl text-xs text-zinc-400 sm:mt-3 sm:text-sm">
									{contextSummary}
								</p>
							</div>
						</div>
					) : (
						<>
							<div className="mb-6 flex items-center justify-between">
								<p className="text-xs text-zinc-400">
									{contextSummary}
								</p>
								<button
									onClick={resetConversation}
									className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
									type="button"
								>
									<RotateCcw size={12} strokeWidth={2} />
									Clear
								</button>
							</div>
							{messages.map((message) => (
								<ChatMessage
									key={message.id}
									message={message}
								/>
							))}
							{isLoading && <TypingIndicator />}
							<div ref={messagesEndRef} />
						</>
					)}
				</div>
			</div>

			<div
				className={`pointer-events-none absolute inset-x-4 z-10 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
					hasStartedConversation
						? "bottom-3 sm:bottom-5"
						: "top-1/2 -translate-y-1/2"
				}`}
			>
				<div
					className={`pointer-events-auto mx-auto transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
						hasStartedConversation
							? "max-w-[50rem]"
							: "max-w-[56rem]"
					}`}
				>
					<div className="overflow-hidden rounded-3xl border border-zinc-200/60 bg-white shadow-[0_18px_50px_rgba(0,0,0,0.12)]">
						<AssistantComposer
							input={input}
							onInputChange={setInput}
							onSubmit={() => void sendMessage(input)}
							isLoading={isLoading}
							placeholder={`Ask me to find a file, download matching files, or search ${spaceLabel}`}
							textareaRef={textareaRef}
							compact={hasStartedConversation}
						/>
						<div className="mx-4 h-px bg-zinc-100 sm:mx-5" />
						<div className="px-3 py-2 sm:px-5 sm:py-3">
							<QuickActions
								suggestions={suggestions}
								isLoading={isSuggestionsLoading}
								onSelect={(prompt) => void sendMessage(prompt)}
								spaceLabel={spaceLabel}
								compact
							/>
						</div>
					</div>
				</div>
			</div>

			{isDragUploadActive ? (
				<div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-zinc-950/20 backdrop-blur-[2px]">
					<div className="flex min-w-[18rem] max-w-md flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white/95 px-6 py-7 text-center shadow-xl">
						<span className="flex size-12 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-zinc-900">
							<UploadCloud className="size-6" />
						</span>
						<div>
							<p className="text-base font-semibold text-zinc-900">
								Drag and drop to upload
							</p>
							<p className="mt-1 text-sm text-zinc-500">
								Drop files anywhere to continue
							</p>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
