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
	prompt: string;
	label: string;
	sub: string;
};

type DashboardAssistantContext = {
	activeSpaceId: number | null;
	categories: CategorySummary[];
	documents: DocumentSummary[];
	isContextLoading: boolean;
	pathname: string;
	userFirstName: string | null;
};

type AssistantReply = {
	message: string;
	navigateTo?: string;
};

type CategoriesResponse = { categories?: CategorySummary[] };
type DocumentsResponse = { documents?: DocumentSummary[] };

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

function normalizeText(value: string) {
	return value.toLowerCase().replace(/[^\w\s.-]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string) {
	return normalizeText(value)
		.split(" ")
		.filter((token) => token.length > 1);
}

function documentDisplayName(document: DocumentSummary) {
	return document.originalFileName || document.fileName || document.filename;
}

function sortDocumentsByNewest(documents: DocumentSummary[]) {
	return [...documents].sort((left, right) => {
		return (
			new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
		);
	});
}

function formatNameList(names: string[]) {
	if (names.length === 0) return "";
	if (names.length === 1) return names[0];
	if (names.length === 2) return `${names[0]} and ${names[1]}`;

	return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function findBestDocumentMatch(
	input: string,
	documents: DocumentSummary[],
): DocumentSummary | null {
	const normalizedInput = normalizeText(input);
	const inputTokens = tokenize(input);

	let bestMatch: DocumentSummary | null = null;
	let bestScore = 0;

	for (const document of documents) {
		const name = documentDisplayName(document);
		const normalizedName = normalizeText(name);
		const nameTokens = tokenize(name);
		let score = 0;

		if (normalizedInput.includes(normalizedName)) {
			score += 12;
		}

		if (normalizedName.includes(normalizedInput) && normalizedInput.length > 2) {
			score += 8;
		}

		for (const token of inputTokens) {
			if (normalizedName.includes(token)) {
				score += 2;
			}
		}

		for (const token of nameTokens) {
			if (inputTokens.includes(token)) {
				score += 1;
			}
		}

		if (score > bestScore) {
			bestScore = score;
			bestMatch = document;
		}
	}

	return bestScore >= 3 ? bestMatch : null;
}

function findBestCategoryMatch(
	input: string,
	categories: CategorySummary[],
): CategorySummary | null {
	const normalizedInput = normalizeText(input);
	const inputTokens = tokenize(input);

	let bestMatch: CategorySummary | null = null;
	let bestScore = 0;

	for (const category of categories) {
		const normalizedName = normalizeText(category.name);
		const nameTokens = tokenize(category.name);
		let score = 0;

		if (normalizedInput.includes(normalizedName)) {
			score += 10;
		}

		if (normalizedName.includes(normalizedInput) && normalizedInput.length > 2) {
			score += 6;
		}

		for (const token of inputTokens) {
			if (normalizedName.includes(token)) {
				score += 2;
			}
		}

		for (const token of nameTokens) {
			if (inputTokens.includes(token)) {
				score += 1;
			}
		}

		if (score > bestScore) {
			bestScore = score;
			bestMatch = category;
		}
	}

	return bestScore >= 3 ? bestMatch : null;
}

function buildSuggestions(
	context: DashboardAssistantContext,
): Suggestion[] {
	const { activeSpaceId, categories, documents, isContextLoading } = context;
	const suggestions: Suggestion[] = [];
	const documentsByNewest = sortDocumentsByNewest(documents);

	if (!activeSpaceId) {
		return [
			{
				prompt: "Take me to the upload page",
				label: "Open uploads",
				sub: "Start adding files",
			},
			{
				prompt: "Show me the category view",
				label: "View categories",
				sub: "Browse the graph",
			},
			{
				prompt: "What can you help me with here?",
				label: "Get oriented",
				sub: "See what the assistant can do",
			},
		];
	}

	if (isContextLoading) {
		return [
			{
				prompt: "What can you help me with here?",
				label: "Assistant help",
				sub: "Context is updating",
			},
		];
	}

	suggestions.push({
		prompt: "Take me to the upload page",
		label: "Open uploads",
		sub: documents.length === 0 ? "Add your first file" : "Add more files",
	});

	if (categories.length > 0) {
		suggestions.push({
			prompt: "Show me the categories in this space",
			label: "View categories",
			sub: `${categories.length} available`,
		});
	}

	const busiestCategory = [...categories]
		.map((category) => ({
			category,
			fileCount: documents.filter(
				(document) => document.categoryId === category.id,
			).length,
		}))
		.sort((left, right) => right.fileCount - left.fileCount)[0];

	if (busiestCategory && busiestCategory.fileCount > 0) {
		suggestions.push({
			prompt: `Show me the files in ${busiestCategory.category.name}`,
			label: `Open ${busiestCategory.category.name}`,
			sub: `${busiestCategory.fileCount} files inside`,
		});
	}

	if (documentsByNewest[0]) {
		suggestions.push({
			prompt: `Open ${documentDisplayName(documentsByNewest[0])}`,
			label: "Open recent file",
			sub: documentDisplayName(documentsByNewest[0]),
		});
	}

	if (documents.length > 1) {
		suggestions.push({
			prompt: "Show me my most recent files",
			label: "Recent files",
			sub: `${documents.length} files in this space`,
		});
	}

	return suggestions
		.filter(
			(suggestion, index, all) =>
				all.findIndex((candidate) => candidate.prompt === suggestion.prompt) ===
				index,
		)
		.slice(0, 4);
}

function resolveAssistantPrompt(
	input: string,
	context: DashboardAssistantContext,
): AssistantReply {
	const normalizedInput = normalizeText(input);
	const documentsByNewest = sortDocumentsByNewest(context.documents);
	const matchedDocument = findBestDocumentMatch(input, context.documents);
	const matchedCategory = findBestCategoryMatch(input, context.categories);
	const categoryDocuments = matchedCategory
		? documentsByNewest.filter(
				(document) => document.categoryId === matchedCategory.id,
			)
		: [];

	if (!context.activeSpaceId) {
		return {
			message:
				"Choose a space from the sidebar first, then I can open uploads, surface files, and guide you through the categories in that space.",
		};
	}

	if (
		normalizedInput.includes("upload") ||
		normalizedInput.includes("add file") ||
		normalizedInput.includes("import")
	) {
		return {
			navigateTo: "/upload",
			message:
				context.documents.length === 0
					? "Opening the upload page so we can bring your first files in."
					: "Taking you to uploads so you can add more files.",
		};
	}

	if (
		normalizedInput.includes("dashboard") ||
		normalizedInput.includes("home")
	) {
		return {
			navigateTo: "/dashboard",
			message:
				context.pathname === "/dashboard"
					? "You are already on the dashboard."
					: "Bringing the dashboard back up.",
		};
	}

	if (
		normalizedInput.includes("graph") ||
		normalizedInput.includes("view categories") ||
		normalizedInput.includes("show categories") ||
		normalizedInput.includes("category view")
	) {
		const categorySummary =
			context.categories.length === 0
				? "There are no categories in this space yet."
				: `You currently have ${context.categories.length} categor${context.categories.length === 1 ? "y" : "ies"}.`;

		return {
			navigateTo: "/graph",
			message: `Opening the category view. ${categorySummary}`,
		};
	}

	if (
		normalizedInput.includes("recent files") ||
		normalizedInput.includes("recent file") ||
		normalizedInput.includes("show files") ||
		normalizedInput.includes("list files") ||
		normalizedInput.includes("what files")
	) {
		if (matchedCategory) {
			const fileNames = categoryDocuments
				.slice(0, 4)
				.map((document) => documentDisplayName(document));
			return {
				navigateTo: "/graph",
				message:
					categoryDocuments.length === 0
						? `${matchedCategory.name} is empty right now. I opened the category view so you can keep browsing.`
						: `${matchedCategory.name} has ${categoryDocuments.length} file${categoryDocuments.length === 1 ? "" : "s"}, including ${formatNameList(fileNames)}. I opened the category view for you too.`,
			};
		}

		if (documentsByNewest.length === 0) {
			return {
				message:
					"I do not see any files in this space yet. I can take you straight to uploads whenever you are ready.",
			};
		}

		const recentNames = documentsByNewest
			.slice(0, 4)
			.map((document) => documentDisplayName(document));
		return {
			message: `The newest files in this space are ${formatNameList(recentNames)}.`,
		};
	}

	if (
		documentsByNewest[0] &&
		(normalizedInput.includes("latest") ||
			normalizedInput.includes("most recent")) &&
		(normalizedInput.includes("open") ||
			normalizedInput.includes("view") ||
			normalizedInput.includes("show") ||
			normalizedInput.includes("edit"))
	) {
		const latestDocument = documentsByNewest[0];
		const displayName = documentDisplayName(latestDocument);
		const isEditingRequest = normalizedInput.includes("edit");

		return {
			navigateTo: `/file/${latestDocument.id}`,
			message: isEditingRequest
				? `Opening ${displayName}. Direct editing is not wired in yet, but I brought the newest file up so you can review it right away.`
				: `Opening your most recent file, ${displayName}.`,
		};
	}

	if (
		matchedDocument &&
		(normalizedInput.includes("open") ||
			normalizedInput.includes("view") ||
			normalizedInput.includes("show") ||
			normalizedInput.includes("edit") ||
			normalizedInput.includes("read") ||
			normalizedInput.includes("file") ||
			normalizedInput.includes("document"))
	) {
		const displayName = documentDisplayName(matchedDocument);
		const isEditingRequest = normalizedInput.includes("edit");

		return {
			navigateTo: `/file/${matchedDocument.id}`,
			message: isEditingRequest
				? `Opening ${displayName}. The app does not support direct file editing yet, but I brought the file viewer up so you can inspect it right away.`
				: `Opening ${displayName} now.`,
		};
	}

	if (
		matchedCategory &&
		(normalizedInput.includes("category") ||
			normalizedInput.includes("folder") ||
			normalizedInput.includes("collection"))
	) {
		const fileNames = categoryDocuments
			.slice(0, 3)
			.map((document) => documentDisplayName(document));
		return {
			navigateTo: "/graph",
			message:
				categoryDocuments.length === 0
					? `${matchedCategory.name} exists, but it does not have files yet. I opened the category view so you can keep moving from there.`
					: `${matchedCategory.name} has ${categoryDocuments.length} file${categoryDocuments.length === 1 ? "" : "s"}, including ${formatNameList(fileNames)}. I opened the category view for you.`,
		};
	}

	if (
		normalizedInput.includes("what can you do") ||
		normalizedInput.includes("help") ||
		normalizedInput.includes("suggest")
	) {
		return {
			message:
				"I can navigate you to uploads, categories, and files in the current space, summarize what is already here, and open the closest matching document when you mention it by name.",
		};
	}

	if (matchedDocument) {
		return {
			navigateTo: `/file/${matchedDocument.id}`,
			message: `I found ${documentDisplayName(matchedDocument)} and opened it for you.`,
		};
	}

	if (context.categories.length === 0 && context.documents.length === 0) {
		return {
			navigateTo: "/upload",
			message:
				"This space is still empty, so I am taking you to uploads. Once files are in, I can help surface categories and jump you into specific documents.",
		};
	}

	return {
		message:
			"I can open uploads, bring up the category view, list recent files, or open a file by name. Try something like 'take me to uploads', 'show categories', or 'open the latest contract'.",
	};
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

function Dashboard() {
	const { user } = useAuth();
	const { activeSpaceId } = useOutletContext<AppLayoutContext>();
	const navigate = useNavigate();
	const location = useLocation();
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isContextLoading, setIsContextLoading] = useState(false);
	const [modes, setModes] = useState<ModeChip[]>(DEFAULT_MODES);
	const [categories, setCategories] = useState<CategorySummary[]>([]);
	const [documents, setDocuments] = useState<DocumentSummary[]>([]);
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
				const [categoriesResponse, documentsResponse] = await Promise.all([
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

				const [categoriesPayload, documentsPayload] = (await Promise.all([
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

	const assistantContext = useMemo<DashboardAssistantContext>(
		() => ({
			activeSpaceId,
			categories,
			documents,
			isContextLoading,
			pathname: location.pathname,
			userFirstName,
		}),
		[activeSpaceId, categories, documents, isContextLoading, location.pathname, userFirstName],
	);

	const suggestions = useMemo(
		() => buildSuggestions(assistantContext),
		[assistantContext],
	);

	const contextSummary = useMemo(() => {
		if (!activeSpaceId) {
			return "Choose a space from the sidebar to unlock file-aware suggestions.";
		}

		if (isContextLoading) {
			return "Refreshing your files and categories for this space.";
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
			const reply = resolveAssistantPrompt(trimmedText, assistantContext);
			await new Promise((resolve) => window.setTimeout(resolve, 220));

			if (reply.navigateTo && reply.navigateTo !== location.pathname) {
				navigate(reply.navigateTo);
			}

			setMessages((currentMessages) => [
				...currentMessages,
				{
					id: crypto.randomUUID(),
					role: "assistant",
					content: reply.message,
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
		setModes((currentModes) => currentModes.filter((mode) => mode.id !== id));
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
									Hi{userFirstName ? ` ${userFirstName}` : " there"},
								</h1>
								<p className="text-lg text-zinc-500">
									How can I help inside this workspace?
								</p>
								<p className="mx-auto mt-3 max-w-xl text-sm text-zinc-400">
									{contextSummary}
								</p>
							</div>

							<div className="grid w-full max-w-3xl gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 shadow-sm sm:grid-cols-2">
								{suggestions.map((suggestion) => (
									<button
										key={suggestion.prompt}
										onClick={() => void sendMessage(suggestion.prompt)}
										className="group bg-white p-5 text-left transition-colors hover:bg-zinc-50"
									>
										<p className="text-sm font-medium leading-snug text-zinc-900">
											{suggestion.label}
										</p>
										<p className="mt-1 text-xs text-zinc-400">
											{suggestion.sub} -
										</p>
									</button>
								))}
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
								<ChatMessage key={message.id} message={message} />
							))}
							{isLoading && <TypingIndicator />}
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
								onChange={(event) => setInput(event.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="Ask me to open uploads, show categories, or find a file"
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
									className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 transition-all hover:bg-zinc-700 active:scale-95 disabled:cursor-not-allowed disabled:scale-100 disabled:opacity-30"
								>
									<ArrowUp
										size={14}
										strokeWidth={2.5}
										className="text-white"
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

export default Dashboard;
