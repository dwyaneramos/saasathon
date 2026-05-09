import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type KeyboardEvent,
} from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import {
	ArrowUp,
	FileClock,
	Bot,
	FolderClosed,
	LayoutGrid,
	RotateCcw,
	UploadCloud,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { openUploadModalEvent } from "@/components/app-sidebar";
import { apiBaseUrl } from "@/lib/api";
import { fileIconFor } from "@/lib/file-icons";
import type { CategorySummary, DocumentSummary } from "@/types/graph";

const fileTreeUpdatedEvent = "kibi:file-tree-updated";

type AppLayoutContext = {
	activeSpaceId: number | null;
	activeSpaceName: string | null;
};

type Message = {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: Date;
};

type Suggestion = {
	label: string;
	sub: string;
	prompt: string;
};

function quickActionIconForSuggestion(suggestion: Suggestion) {
	const normalizedLabel = suggestion.label.toLowerCase();
	const normalizedPrompt = suggestion.prompt.toLowerCase();
	const normalizedSub = suggestion.sub.toLowerCase();

	if (
		normalizedLabel.includes("recent file") ||
		normalizedPrompt.includes("recent file")
	) {
		return FileClock;
	}

	if (
		normalizedLabel.includes("upload") ||
		normalizedPrompt.includes("upload") ||
		normalizedPrompt.includes("import")
	) {
		return UploadCloud;
	}

	if (
		normalizedLabel.includes("dashboard") ||
		normalizedPrompt.includes("dashboard") ||
		normalizedPrompt.includes("assistant home")
	) {
		return LayoutGrid;
	}

	if (
		normalizedLabel.includes("category") ||
		normalizedLabel.includes("categories") ||
		normalizedPrompt.includes("category") ||
		normalizedPrompt.includes("categories") ||
		normalizedPrompt.includes("files in")
	) {
		return FolderClosed;
	}

	const fileLikeName =
		normalizedSub.includes(".") || normalizedLabel.includes("open")
			? suggestion.sub
			: suggestion.label;

	return fileIconFor({
		name: fileLikeName,
		filename: fileLikeName,
		mimeType: "",
	});
}

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

function TypingIndicator() {
	return (
		<div className="mb-3 flex items-end gap-2">
			<div className="flex size-7 flex-shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white">
				<Bot size={13} strokeWidth={1.5} className="text-zinc-400" />
			</div>
			<div className="rounded-xl rounded-bl-md border border-zinc-200 bg-white px-3 py-2">
				<div className="flex h-4 items-center gap-1.5">
					<span
						className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300"
						style={{ animationDelay: "0ms" }}
					/>
					<span
						className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300"
						style={{ animationDelay: "150ms" }}
					/>
					<span
						className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300"
						style={{ animationDelay: "300ms" }}
					/>
				</div>
			</div>
		</div>
	);
}

function InlineMarkdown({ text }: { text: string }) {
	const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);

	return (
		<>
			{parts.map((part, index) => {
				if (part.startsWith("**") && part.endsWith("**")) {
					return (
						<strong key={index} className="font-semibold">
							{part.slice(2, -2)}
						</strong>
					);
				}

				if (part.startsWith("`") && part.endsWith("`")) {
					return (
						<code
							key={index}
							className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.85em] text-zinc-800"
						>
							{part.slice(1, -1)}
						</code>
					);
				}

				if (part.startsWith("*") && part.endsWith("*")) {
					return <em key={index}>{part.slice(1, -1)}</em>;
				}

				return <span key={index}>{part}</span>;
			})}
		</>
	);
}

function ChatContent({ content }: { content: string }) {
	const lines = content.split("\n");

	return (
		<p className="whitespace-pre-wrap">
			{lines.map((line, index) => (
				<span key={index}>
					{index > 0 ? "\n" : null}
					<InlineMarkdown text={line} />
				</span>
			))}
		</p>
	);
}

function ChatMessage({ message }: { message: Message }) {
	const isUser = message.role === "user";

	return (
		<div
			className={`mb-3 flex items-end gap-2 ${isUser ? "flex-row-reverse" : ""}`}
		>
			{!isUser && (
				<div className="flex size-7 flex-shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white">
					<Bot
						size={13}
						strokeWidth={1.5}
						className="text-zinc-400"
					/>
				</div>
			)}
			<div
				className={`max-w-[78%] px-3 py-2 text-sm leading-relaxed ${
					isUser
						? "rounded-xl rounded-br-md border border-emerald-300/80 bg-(--color-accent) text-black"
						: "rounded-xl rounded-bl-md border border-zinc-200 bg-white text-zinc-700"
				}`}
			>
				<ChatContent content={message.content} />
				<p
					className={`mt-1 text-[10px] leading-none ${isUser ? "text-right text-black/55" : "text-zinc-400"}`}
				>
					{message.timestamp.toLocaleTimeString([], {
						hour: "2-digit",
						minute: "2-digit",
					})}
				</p>
			</div>
		</div>
	);
}

function QuickActions({
	suggestions,
	isLoading,
	onSelect,
	spaceLabel,
	compact = false,
}: {
	suggestions: Suggestion[];
	isLoading: boolean;
	onSelect: (prompt: string) => void;
	spaceLabel: string;
	compact?: boolean;
}) {
	const visibleSuggestions = suggestions.slice(0, 3);

	if (!isLoading && suggestions.length === 0) {
		return null;
	}

	if (compact) {
		return (
			<div className="grid grid-cols-3 gap-1.5 sm:gap-2">
				{isLoading
					? Array.from({ length: 3 }).map((_, index) => (
							<div
								key={index}
								className="flex min-h-12 w-full flex-col justify-center rounded-xl border border-zinc-200 bg-white px-2 py-2 text-left sm:min-h-16 sm:rounded-2xl sm:px-4 sm:py-3"
							>
								<div className="h-3 w-16 animate-pulse rounded bg-zinc-100 sm:h-4 sm:w-28" />
								<div className="mt-1.5 hidden h-3 w-full animate-pulse rounded bg-zinc-100 sm:block" />
								<div className="mt-1 hidden h-3 w-4/5 animate-pulse rounded bg-zinc-100 sm:block" />
								<p className="mt-1 hidden text-[11px] text-zinc-400 sm:block">
									Generating actions for {spaceLabel}...
								</p>
							</div>
						))
					: visibleSuggestions.map((suggestion) => (
							<button
								key={suggestion.prompt}
								onClick={() => onSelect(suggestion.prompt)}
								className="inline-flex min-h-12 w-full min-w-0 flex-col items-start justify-center rounded-xl border border-zinc-200 bg-white px-2 py-2 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50 sm:min-h-20 sm:rounded-2xl sm:px-4 sm:py-3"
								title={suggestion.sub}
							>
								<span className="flex items-start gap-2">
									{(() => {
										const Icon =
											quickActionIconForSuggestion(
												suggestion,
											);
										return (
											<Icon className="mt-0.5 size-3.5 shrink-0 text-zinc-500 sm:size-4" />
										);
									})()}
									<span className="line-clamp-2 text-[11px] font-medium leading-tight text-zinc-800 sm:text-sm sm:leading-snug">
										{suggestion.label}
									</span>
								</span>
								<span className="mt-1 hidden line-clamp-2 text-xs leading-snug text-zinc-500 sm:block">
									{suggestion.sub}
								</span>
							</button>
						))}
			</div>
		);
	}

	return (
		<div className="grid w-full max-w-3xl gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 sm:grid-cols-3">
			{isLoading
				? Array.from({ length: 3 }).map((_, index) => (
						<div key={index} className="bg-white p-3">
							<div className="h-3.5 w-24 animate-pulse rounded bg-zinc-100" />
							<div className="mt-1.5 h-3 w-32 animate-pulse rounded bg-zinc-100" />
						</div>
					))
				: visibleSuggestions.map((suggestion) => (
						<button
							key={suggestion.prompt}
							onClick={() => onSelect(suggestion.prompt)}
							className={`group bg-white text-left transition-colors hover:bg-zinc-50 ${
								compact ? "p-3" : "p-4"
							}`}
						>
							<p className="text-xs font-semibold leading-snug text-zinc-900">
								{suggestion.label}
							</p>
							<p className="mt-1 line-clamp-2 text-[11px] text-zinc-400">
								{suggestion.sub}
							</p>
						</button>
					))}
		</div>
	);
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
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const isEmpty = messages.length === 0;
	const hasStartedConversation = messages.length > 0 || isLoading;
	const userFirstName = user?.firstName ?? null;
	const spaceLabel = activeSpaceName ?? "this workspace";

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

	const sendMessage = async (text: string) => {
		const trimmedText = text.trim();
		if (!trimmedText || isLoading) return;

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

	const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			void sendMessage(input);
		}
	};

	const resetConversation = () => {
		if (isLoading) return;
		setMessages([]);
	};

	return (
		<div className="relative flex h-[calc(100svh-var(--header-height)-1rem)] max-h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
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
									How can I help inside {spaceLabel}?
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
						<div
							className={`flex items-end gap-3 transition-all duration-700 ${
								hasStartedConversation
									? "px-4 pb-3 pt-3 sm:px-5 sm:pb-4 sm:pt-4"
									: "px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5 md:px-7 md:pb-6 md:pt-6"
							}`}
						>
							<textarea
								ref={textareaRef}
								rows={1}
								value={input}
								onChange={(event) =>
									setInput(event.target.value)
								}
								onKeyDown={handleKeyDown}
								placeholder={`Ask me to find a file, open an image, or search ${spaceLabel}`}
								className={`flex-1 resize-none overflow-hidden bg-transparent py-2 leading-relaxed text-zinc-800 outline-none placeholder:text-zinc-400 transition-all duration-700 ${
									hasStartedConversation
										? "text-base md:text-[1.05rem]"
										: "text-base md:text-lg"
								}`}
								style={{ maxHeight: "140px" }}
							/>

							<div className="flex flex-shrink-0 items-center self-center">
								<button
									onClick={() => void sendMessage(input)}
									disabled={!input.trim() || isLoading}
									className={`flex items-center justify-center rounded-full bg-(--color-accent) transition-all hover:bg-(--color-accent-hover) active:scale-95 disabled:cursor-not-allowed disabled:scale-100 disabled:bg-gray-300 disabled:opacity-30 ${
										hasStartedConversation
											? "h-9 w-9"
											: "h-10 w-10 md:h-11 md:w-11"
									}`}
								>
									<ArrowUp
										size={hasStartedConversation ? 14 : 16}
										strokeWidth={2.5}
										className="text-black"
									/>
								</button>
							</div>
						</div>
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
		</div>
	);
}
