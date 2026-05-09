import * as React from "react";

export function highlightSearchText(text: string, query: string) {
	const trimmedQuery = query.trim();
	if (!trimmedQuery) {
		return text;
	}

	const tokens = [
		trimmedQuery,
		...trimmedQuery
			.split(/\s+/)
			.map((token) => token.trim())
			.filter((token) => token.length >= 2),
	]
		.sort((a, b) => b.length - a.length)
		.map(escapeRegExp);
	const pattern = new RegExp(`(${tokens.join("|")})`, "ig");
	const parts = text.split(pattern);

	return parts.map((part, index) =>
		index % 2 === 1 ? (
			<mark
				key={`${part}-${index}`}
				className="rounded-sm bg-(--color-accent)/25 px-0.5 text-foreground"
			>
				{part}
			</mark>
		) : (
			<React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
		),
	);
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
