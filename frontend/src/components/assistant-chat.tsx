import { type RefObject, type KeyboardEvent } from "react";
import {
	ArrowUp,
	Bot,
	FileClock,
	FolderClosed,
	LayoutGrid,
	UploadCloud,
} from "lucide-react";
import { fileIconFor } from "@/lib/file-icons";

export type AssistantMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: Date;
};

export type AssistantSuggestion = {
	label: string;
	sub: string;
	prompt: string;
};

function quickActionIconForSuggestion(suggestion: AssistantSuggestion) {
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

export function AssistantTypingIndicator() {
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
							className="inline-block max-w-full truncate rounded bg-zinc-100 px-1 py-0.5 align-bottom font-mono text-[0.85em] text-zinc-800"
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

export function AssistantChatContent({ content }: { content: string }) {
	const lines = content.split("\n");

	return (
		<p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
			{lines.map((line, index) => (
				<span key={index}>
					{index > 0 ? "\n" : null}
					<InlineMarkdown text={line} />
				</span>
			))}
		</p>
	);
}

export function AssistantChatMessage({
	message,
	compact = false,
}: {
	message: AssistantMessage;
	compact?: boolean;
}) {
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
				className={`min-w-0 overflow-hidden px-3 py-2 text-sm leading-relaxed ${
					compact ? "max-w-[86%]" : "max-w-[78%]"
				} ${
					isUser
						? "rounded-xl rounded-br-md border border-emerald-300/80 bg-[var(--color-accent)] text-black"
						: "rounded-xl rounded-bl-md border border-zinc-200 bg-white text-zinc-700"
				}`}
			>
				<AssistantChatContent content={message.content} />
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

export function AssistantQuickActions({
	suggestions,
	isLoading,
	onSelect,
	spaceLabel,
	compact = false,
}: {
	suggestions: AssistantSuggestion[];
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
					: visibleSuggestions.map((suggestion) => {
							const Icon = quickActionIconForSuggestion(suggestion);
							return (
								<button
									key={suggestion.prompt}
									onClick={() => onSelect(suggestion.prompt)}
									className="inline-flex min-h-12 w-full min-w-0 flex-col items-start justify-center rounded-xl border border-zinc-200 bg-white px-2 py-2 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50 sm:min-h-20 sm:rounded-2xl sm:px-4 sm:py-3"
									title={suggestion.sub}
									type="button"
								>
									<span className="flex w-full min-w-0 items-start gap-2">
										<Icon className="mt-0.5 size-3.5 shrink-0 text-zinc-500 sm:size-4" />
										<span className="min-w-0 truncate text-[11px] font-medium leading-tight text-zinc-800 sm:text-sm sm:leading-snug">
											{suggestion.label}
										</span>
									</span>
									<span className="mt-1 hidden w-full min-w-0 truncate text-xs leading-snug text-zinc-500 sm:block">
										{suggestion.sub}
									</span>
								</button>
							);
						})}
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
							className="group min-w-0 bg-white p-4 text-left transition-colors hover:bg-zinc-50"
							type="button"
						>
							<p className="truncate text-xs font-semibold leading-snug text-zinc-900">
								{suggestion.label}
							</p>
							<p className="mt-1 truncate text-[11px] text-zinc-400">
								{suggestion.sub}
							</p>
						</button>
					))}
		</div>
	);
}

export function AssistantComposer({
	input,
	onInputChange,
	onSubmit,
	isLoading,
	placeholder,
	textareaRef,
	compact = false,
}: {
	input: string;
	onInputChange: (value: string) => void;
	onSubmit: () => void;
	isLoading: boolean;
	placeholder: string;
	textareaRef?: RefObject<HTMLTextAreaElement | null>;
	compact?: boolean;
}) {
	const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			onSubmit();
		}
	};

	return (
		<div
			className={`flex items-end gap-3 ${
				compact ? "px-4 pb-3 pt-3" : "px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5 md:px-7 md:pb-6 md:pt-6"
			}`}
		>
			<textarea
				ref={textareaRef}
				rows={1}
				value={input}
				onChange={(event) => onInputChange(event.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				className={`flex-1 resize-none overflow-hidden bg-transparent py-2 leading-relaxed text-zinc-800 outline-none placeholder:text-zinc-400 ${
					compact ? "text-sm" : "text-base md:text-lg"
				}`}
				style={{ maxHeight: compact ? "96px" : "140px" }}
			/>
			<div className="flex flex-shrink-0 items-center self-center">
				<button
					onClick={onSubmit}
					disabled={!input.trim() || isLoading}
					className={`flex items-center justify-center rounded-full bg-[var(--color-accent)] transition-all hover:bg-[var(--color-accent-hover)] active:scale-95 disabled:cursor-not-allowed disabled:scale-100 disabled:bg-gray-300 disabled:opacity-30 ${
						compact ? "h-8 w-8" : "h-10 w-10 md:h-11 md:w-11"
					}`}
					type="button"
				>
					<ArrowUp
						size={compact ? 13 : 16}
						strokeWidth={2.5}
						className="text-black"
					/>
				</button>
			</div>
		</div>
	);
}
