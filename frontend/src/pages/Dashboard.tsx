import { useState, useRef, useEffect } from "react";
import {
	ArrowUp,
	Sparkles,
	RotateCcw,
	Plus,
	Mic,
	X,
	Image,
	BookOpen,
	Bot,
	FlaskConical,
	Globe,
} from "lucide-react";
import type { User } from "@/context/AuthContext";

interface DashboardProps {
	user: User;
}

interface Message {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: Date;
}

interface ModeChip {
	id: string;
	label: string;
	icon: React.ReactNode;
	active: boolean;
}

const DEFAULT_MODES: ModeChip[] = [
	{
		id: "image",
		label: "Image",
		icon: <Image size={13} strokeWidth={1.8} />,
		active: true,
	},
	{
		id: "study",
		label: "Study",
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
		id: "research",
		label: "Research",
		icon: <FlaskConical size={13} strokeWidth={1.8} />,
		active: true,
	},
	{
		id: "search",
		label: "Search",
		icon: <Globe size={13} strokeWidth={1.8} />,
		active: true,
	},
];

function TypingIndicator() {
	return (
		<div className="flex items-end gap-3 mb-6">
			<div className="w-8 h-8 rounded-xl bg-white border border-zinc-200 flex items-center justify-center flex-shrink-0 shadow-sm">
				<Sparkles
					size={13}
					strokeWidth={1.5}
					className="text-zinc-400"
				/>
			</div>
			<div className="bg-white border border-zinc-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
				<div className="flex gap-1.5 items-center h-5">
					<span
						className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-bounce"
						style={{ animationDelay: "0ms" }}
					/>
					<span
						className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-bounce"
						style={{ animationDelay: "150ms" }}
					/>
					<span
						className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-bounce"
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
			className={`flex items-end gap-3 mb-5 ${isUser ? "flex-row-reverse" : ""}`}
		>
			{!isUser && (
				<div className="w-8 h-8 rounded-xl bg-white border border-zinc-200 flex items-center justify-center flex-shrink-0 shadow-sm">
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
						? "bg-zinc-900 text-white rounded-2xl rounded-br-md shadow-sm"
						: "bg-white border border-zinc-200 text-zinc-700 rounded-2xl rounded-bl-md shadow-sm"
				}`}
			>
				<p className="whitespace-pre-wrap">{message.content}</p>
				<p
					className={`text-[10px] mt-1.5 ${isUser ? "text-zinc-500 text-right" : "text-zinc-400"}`}
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

const SUGGESTIONS = [
	{ label: "How do I get started?", sub: "Onboarding guide" },
	{ label: "What can you help me with?", sub: "Capabilities overview" },
	{ label: "Show me an example", sub: "See it in action" },
];

function Dashboard({ user }: DashboardProps) {
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [modes, setModes] = useState<ModeChip[]>(DEFAULT_MODES);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const isEmpty = messages.length === 0;

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isLoading]);

	useEffect(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
	}, [input]);

	const sendMessage = async (text: string) => {
		if (!text.trim() || isLoading) return;
		const userMsg: Message = {
			id: crypto.randomUUID(),
			role: "user",
			content: text.trim(),
			timestamp: new Date(),
		};
		setMessages((prev) => [...prev, userMsg]);
		setInput("");
		setIsLoading(true);
		try {
			const response = await fetch(
				"https://api.anthropic.com/v1/messages",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						model: "claude-sonnet-4-20250514",
						max_tokens: 1000,
						system: "You are a helpful AI assistant built into this app. Be concise, friendly, and practical.",
						messages: [
							...messages.map((m) => ({
								role: m.role,
								content: m.content,
							})),
							{ role: "user", content: text.trim() },
						],
					}),
				},
			);
			const data = await response.json();
			const assistantText =
				data.content?.find((b: { type: string }) => b.type === "text")
					?.text ?? "Sorry, I couldn't generate a response.";
			setMessages((prev) => [
				...prev,
				{
					id: crypto.randomUUID(),
					role: "assistant",
					content: assistantText,
					timestamp: new Date(),
				},
			]);
		} catch {
			setMessages((prev) => [
				...prev,
				{
					id: crypto.randomUUID(),
					role: "assistant",
					content: "Something went wrong. Please try again.",
					timestamp: new Date(),
				},
			]);
		} finally {
			setIsLoading(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage(input);
		}
	};

	const removeMode = (id: string) => {
		setModes((prev) => prev.filter((m) => m.id !== id));
	};

	return (
		<div className="relative flex-1 overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
			{/* Messages */}
			<div className="flex-1 overflow-y-auto px-6 py-8">
				<div className="max-w-2xl mx-auto">
					{isEmpty ? (
						<div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-8">
							<div>
								<h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-gradient-to-b from-zinc-900 to-zinc-400 bg-clip-text text-transparent leading-[0.9] pb-3">
									Hi there,
								</h1>
								<p className="text-lg text-zinc-500">
									How can I help?
								</p>
							</div>

							<div className="grid sm:grid-cols-3 gap-px bg-zinc-200 border border-zinc-200 rounded-2xl overflow-hidden shadow-sm w-full max-w-lg">
								{SUGGESTIONS.map((s) => (
									<button
										key={s.label}
										onClick={() => sendMessage(s.label)}
										className="p-5 bg-white group hover:bg-zinc-50 transition-colors text-left"
									>
										<p className="text-sm font-medium text-zinc-900 leading-snug">
											{s.label}
										</p>
										<p className="text-xs text-zinc-400 mt-1">
											{s.sub} →
										</p>
									</button>
								))}
							</div>
						</div>
					) : (
						<>
							{messages.map((msg) => (
								<ChatMessage key={msg.id} message={msg} />
							))}
							{isLoading && <TypingIndicator />}
							<div ref={messagesEndRef} />
						</>
					)}
				</div>
			</div>

			{/* Input area — styled after the uploaded screenshot */}
			<div className="px-4 pb-5 pt-3">
				<div className="max-w-2xl mx-auto">
					{/* The main floating input card */}
					<div className="bg-white rounded-3xl shadow-md border border-zinc-200/60 overflow-hidden">
						{/* Text input row */}
						<div className="flex items-end gap-2 px-4 pt-3 pb-3">
							{/* Plus button */}
							<button className="w-7 h-7 rounded-full border border-zinc-200 flex items-center justify-center flex-shrink-0 text-zinc-400 hover:bg-zinc-50 transition-colors mb-0.5">
								<Plus size={14} strokeWidth={2} />
							</button>

							{/* Textarea */}
							<textarea
								ref={textareaRef}
								rows={1}
								value={input}
								onChange={(e) => setInput(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="Ask anything"
								className="flex-1 resize-none outline-none text-sm text-zinc-800 placeholder:text-zinc-400 leading-relaxed bg-transparent py-0.5"
								style={{ maxHeight: "140px" }}
							/>

							{/* Mic + Send */}
							<div className="flex items-center gap-2 flex-shrink-0 mb-0.5">
								<button className="text-zinc-400 hover:text-zinc-600 transition-colors">
									<Mic size={16} strokeWidth={1.8} />
								</button>
								<button
									onClick={() => sendMessage(input)}
									disabled={!input.trim() || isLoading}
									className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center hover:bg-zinc-700 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:scale-100"
								>
									<ArrowUp
										size={14}
										strokeWidth={2.5}
										className="text-white"
									/>
								</button>
							</div>
						</div>

						{/* Divider */}
						<div className="h-px bg-zinc-100 mx-4" />

						{/* Mode chips row */}
						<div className="px-3 py-2.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
							{modes.map((mode) => (
								<div
									key={mode.id}
									className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600 text-xs font-medium whitespace-nowrap flex-shrink-0 hover:border-zinc-300 transition-colors"
								>
									{mode.icon}
									<span>{mode.label}</span>
									<button
										onClick={() => removeMode(mode.id)}
										className="text-zinc-400 hover:text-zinc-600 transition-colors ml-0.5"
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
