import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type KeyboardEvent,
	type ReactNode,
} from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import {
	ArrowUp,
	BookOpen,
	Bot,
	FlaskConical,
	Globe,
	Image,
	Mic,
	Plus,
	RotateCcw,
	Sparkles,
	X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { CategorySummary, DocumentSummary } from "@/types/graph";

const apiBaseUrl = "http://localhost:3000/api/v1";
const fileTreeUpdatedEvent = "kibi:file-tree-updated";

type AppLayoutContext = {
	activeSpaceId: number | null;
};

type Message = {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: Date;
};

type ModeChip = {
	id: string;
	label: string;
	icon: ReactNode;
	active: boolean;
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

const DEFAULT_MODES: ModeChip[] = [
	{
		id: "files",
		label: "Files",
		icon: <Image size={13} strokeWidth={1.8} />,
		active: true,
	},
	{
		id: "categories",
		label: "Categories",
		icon: <BookOpen size={13} strokeWidth={1.8} />,
		active: true,
	},
	{
		id: "agent",
		label: "Agent",
		icon: <Bot size={13} strokeWidth={1.8} />,
		active: true,
	},
	{
		id: "tasks",
		label: "Tasks",
		icon: <FlaskConical size={13} strokeWidth={1.8} />,
		active: true,
	},
	{
		id: "navigation",
		label: "Navigation",
		icon: <Globe size={13} strokeWidth={1.8} />,
		active: true,
	},
];

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
						? "rounded-2xl rounded-br-md bg-zinc-900 text-white shadow-sm"
						: "rounded-2xl rounded-bl-md border border-zinc-200 bg-white text-zinc-700 shadow-sm"
				}`}
			>
				<p className="whitespace-pre-wrap">{message.content}</p>
				<p
					className={`mt-1.5 text-[10px] ${isUser ? "text-right text-zinc-500" : "text-zinc-400"}`}
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
	compact = false,
}: {
	suggestions: Suggestion[];
	isLoading: boolean;
	onSelect: (prompt: string) => void;
	compact?: boolean;
}) {
	if (!isLoading && suggestions.length === 0) {
		return (
			<div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-400 shadow-sm">
				No suggestions yet.
			</div>
		);
	}

	return (
		<div
			className={`grid gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 shadow-sm ${
				compact ? "grid-cols-1 md:grid-cols-2" : "w-full max-w-3xl sm:grid-cols-2"
			}`}
		>
			{isLoading
				? Array.from({ length: compact ? 2 : 4 }).map((_, index) => (
						<div
							key={index}
							className="bg-white p-5"
						>
							<div className="h-4 w-32 animate-pulse rounded bg-zinc-100" />
							<div className="mt-2 h-3 w-40 animate-pulse rounded bg-zinc-100" />
						</div>
					))
				: suggestions.map((suggestion) => (
						<button
							key={suggestion.prompt}
							onClick={() => onSelect(suggestion.prompt)}
							className={`group bg-white text-left transition-colors hover:bg-zinc-50 ${
								compact ? "p-4" : "p-5"
							}`}
						>
							<p className="text-sm font-medium leading-snug text-zinc-900">
								{suggestion.label}
							</p>
							<p className="mt-1 text-xs text-zinc-400">
								{suggestion.sub}
							</p>
						</button>
					))}
		</div>
	);
}

export default function Dashboard() {
	const { user } = useAuth();
	const { activeSpaceId } = useOutletContext<AppLayoutContext>();
	const navigate = useNavigate();
	const location = useLocation();
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isContextLoading, setIsContextLoading] = useState(false);
	const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
	const [modes, setModes] = useState<ModeChip[]>(DEFAULT_MODES);
	const [categories, setCategories] = useState<CategorySummary[]>([]);
	const [documents, setDocuments] = useState<DocumentSummary[]>([]);
	const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
	const [contextRefreshKey, setContextRefreshKey] = useState(0);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const isEmpty = messages.length === 0;
	const userFirstName = user?.firstName ?? null;

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isLoading]);

	useEffect(() => {
		const element = textareaRef.current;
		if (!element) return;
		element.style.height = "auto";
		element.style.height = `${Math.min(element.scrollHeight, 140)}px`;
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

			if (
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

	const removeMode = (id: string) => {
		setModes((currentModes) =>
			currentModes.filter((mode) => mode.id !== id),
		);
	};

	const resetConversation = () => {
		if (isLoading) return;
		setMessages([]);
	};

	return (
		<div className="relative flex-1 overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
			<div className="flex-1 overflow-y-auto px-6 py-8">
				<div className="mx-auto max-w-3xl">
					{isEmpty ? (
						<div className="flex min-h-[50vh] flex-col items-center justify-center gap-8 text-center">
							<div>
								<h1 className="bg-gradient-to-b from-zinc-900 to-zinc-400 bg-clip-text pb-3 text-5xl font-bold leading-[0.9] tracking-tighter text-transparent md:text-7xl">
									Hi
									{userFirstName
										? ` ${userFirstName}`
										: " there"}
									,
								</h1>
								<p className="text-lg text-zinc-500">
									How can I help inside this workspace?
								</p>
								<p className="mx-auto mt-3 max-w-xl text-sm text-zinc-400">
									{contextSummary}
								</p>
							</div>

							<QuickActions
								suggestions={suggestions}
								isLoading={isSuggestionsLoading}
								onSelect={(prompt) => void sendMessage(prompt)}
							/>
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
							<div className="mt-8">
								<p className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">
									Quick Actions
								</p>
								<QuickActions
									suggestions={suggestions}
									isLoading={isSuggestionsLoading}
									onSelect={(prompt) =>
										void sendMessage(prompt)
									}
									compact
								/>
							</div>
							<div ref={messagesEndRef} />
						</>
					)}
				</div>
			</div>

			<div className="px-4 pb-5 pt-3">
				<div className="mx-auto max-w-3xl">
					<div className="overflow-hidden rounded-3xl border border-zinc-200/60 bg-white shadow-md">
						<div className="flex items-end gap-2 px-4 pb-3 pt-3">
							<button className="mb-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-400 transition-colors hover:bg-zinc-50">
								<Plus size={14} strokeWidth={2} />
							</button>

							<textarea
								ref={textareaRef}
								rows={1}
								value={input}
								onChange={(event) =>
									setInput(event.target.value)
								}
								onKeyDown={handleKeyDown}
								placeholder="Ask me to find a file, open an image, or search this workspace"
								className="flex-1 resize-none bg-transparent py-0.5 text-sm leading-relaxed text-zinc-800 outline-none placeholder:text-zinc-400"
								style={{ maxHeight: "140px" }}
							/>

							<div className="mb-0.5 flex flex-shrink-0 items-center gap-2">
								<button className="text-zinc-400 transition-colors hover:text-zinc-600">
									<Mic size={16} strokeWidth={1.8} />
								</button>
								<button
									onClick={() => void sendMessage(input)}
									disabled={!input.trim() || isLoading}
									className="flex h-8 w-8 items-center justify-center rounded-full bg-(--color-accent) transition-all hover:bg-(--color-accent-hover) active:scale-95 disabled:cursor-not-allowed disabled:scale-100 disabled:bg-gray-300 disabled:opacity-30"
								>
									<ArrowUp
										size={14}
										strokeWidth={2.5}
										className="text-black"
									/>
								</button>
							</div>
						</div>

						<div className="mx-4 h-px bg-zinc-100" />

						<div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto px-3 py-2.5">
							{modes.map((mode) => (
								<div
									key={mode.id}
									className="flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300"
								>
									{mode.icon}
									<span>{mode.label}</span>
									<button
										onClick={() => removeMode(mode.id)}
										className="ml-0.5 text-zinc-400 transition-colors hover:text-zinc-600"
									>
										<X size={10} strokeWidth={2.5} />
									</button>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
