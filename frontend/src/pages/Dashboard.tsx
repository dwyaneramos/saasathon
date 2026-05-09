import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type KeyboardEvent,
} from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { ArrowUp, RotateCcw, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { openUploadModalEvent } from "@/components/app-sidebar";
import type { CategorySummary, DocumentSummary } from "@/types/graph";

const apiBaseUrl = "http://localhost:3000/api/v1";
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
		<div className="mb-6 flex items-end gap-3">
			<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm">
				<Sparkles
					size={13}
					strokeWidth={1.5}
					className="text-zinc-400"
				/>
			</div>
			<div className="rounded-2xl rounded-bl-md border border-zinc-200 bg-white px-4 py-3 shadow-sm">
				<div className="flex h-5 items-center gap-1.5">
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

function ChatMessage({ message }: { message: Message }) {
	const isUser = message.role === "user";

	return (
		<div
			className={`mb-5 flex items-end gap-3 ${isUser ? "flex-row-reverse" : ""}`}
		>
			{!isUser && (
				<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm">
					<Sparkles
						size={13}
						strokeWidth={1.5}
						className="text-zinc-400"
					/>
				</div>
			)}
			<div
				className={`max-w-[75%] px-4 py-3 text-sm leading-relaxed ${
					isUser
						? "rounded-2xl rounded-br-md border border-emerald-300/80 bg-(--color-accent) text-black"
						: "rounded-2xl rounded-bl-md border border-zinc-200 bg-white text-zinc-700"
				}`}
			>
				<p className="whitespace-pre-wrap">{message.content}</p>
				<p
					className={`mt-1.5 text-[10px] ${isUser ? "text-right text-black/55" : "text-zinc-400"}`}
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
			<div className="grid gap-2 sm:grid-cols-3">
				{isLoading
					? Array.from({ length: 3 }).map((_, index) => (
							<div
								key={index}
								className="flex min-h-16 w-full flex-col justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm"
							>
								<div className="h-4 w-28 animate-pulse rounded bg-zinc-100" />
								<div className="mt-2 h-3 w-full animate-pulse rounded bg-zinc-100" />
								<div className="mt-1 h-3 w-4/5 animate-pulse rounded bg-zinc-100" />
								<p className="mt-2 text-[11px] text-zinc-400">
									Generating actions for {spaceLabel}...
								</p>
							</div>
						))
					: visibleSuggestions.map((suggestion) => (
							<button
								key={suggestion.prompt}
								onClick={() => onSelect(suggestion.prompt)}
								className="inline-flex min-h-20 w-full min-w-0 flex-col items-start justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50"
								title={suggestion.sub}
							>
								<span className="text-sm font-medium leading-snug text-zinc-800">
									{suggestion.label}
								</span>
								<span className="mt-1 line-clamp-2 text-xs leading-snug text-zinc-500">
									{suggestion.sub}
								</span>
							</button>
						))}
			</div>
		);
	}

	return (
		<div className="grid w-full max-w-3xl gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 shadow-sm sm:grid-cols-3">
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
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const isEmpty = messages.length === 0;
	const hasStartedConversation = messages.length > 0 || isLoading;
	const userFirstName = user?.firstName ?? null;
	const spaceLabel = activeSpaceName ?? "this workspace";

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isLoading]);

	useEffect(() => {
		const element = textareaRef.current;
		if (!element) return;
		element.style.height = "auto";
		element.style.height = `${Math.min(element.scrollHeight, 140)}px`;
		element.style.overflowY = element.scrollHeight > 140 ? "auto" : "hidden";
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
				window.dispatchEvent(new Event(openUploadModalEvent));
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
		<div className="relative flex-1 overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
			<div className="flex-1 overflow-y-auto px-6 pb-64 pt-8">
				<div className="mx-auto max-w-3xl">
					{isEmpty ? (
						<div className="pointer-events-none flex min-h-[50vh] flex-col items-center justify-start gap-6 pt-10 text-center">
							<div>
								<h1 className="bg-gradient-to-b from-zinc-900 to-zinc-400 bg-clip-text pb-3 text-5xl font-bold leading-[0.9] tracking-tighter text-transparent md:text-7xl">
									Hi
									{userFirstName
										? ` ${userFirstName}`
										: " there"}
									,
								</h1>
								<p className="text-lg text-zinc-500">
									How can I help inside {spaceLabel}?
								</p>
								<p className="mx-auto mt-3 max-w-xl text-sm text-zinc-400">
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
						? "bottom-5"
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
									? "px-5 pb-4 pt-4"
									: "px-6 pb-5 pt-5 md:px-7 md:pb-6 md:pt-6"
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
					</div>
					<div className="mt-3">
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
	);
}
