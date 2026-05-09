import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
	Download,
	ExternalLink,
	FileText,
	Maximize2,
	Minimize2,
	Minus,
	Plus,
} from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { fileIconFor, type KibiFile } from "@/components/app-sidebar";
import React from "react";

const apiBaseUrl = "http://localhost:3000/api/v1";

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

export default function FileView() {
	const { documentId } = useParams();
	const [document, setDocument] = useState<PublicDocument | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	const fileUrl = useMemo(() => {
		return documentId ? `${apiBaseUrl}/documents/${documentId}/file` : "";
	}, [documentId]);
	const downloadUrl = `${fileUrl}?download=1`;

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
				);
				const payload = (await response
					.json()
					.catch(() => null)) as DocumentResponse | null;

				if (!response.ok) {
					throw new Error(payload?.error ?? "Could not load file.");
				}

				if (!ignore) {
					setDocument(payload?.document ?? null);
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
	}, [documentId]);

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
					className="text-sm font-medium text-zinc-900 hover:underline"
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
		document.mimeType.startsWith("text/") ||
		document.mimeType.includes("json") ||
		document.mimeType.includes("xml");

	return (
		<main className="min-h-[calc(100svh-var(--header-height))] bg-zinc-50/60">
			<header className="border-b border-zinc-100 bg-white px-6 py-4">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="min-w-0">
						<h1 className="truncate text-lg font-semibold text-zinc-950">
							{displayName}
						</h1>
						<p className="mt-1 text-xs text-muted-foreground">
							{document.mimeType} ·{" "}
							{formatFileSize(document.fileSize)}
						</p>
					</div>
					<div className="flex shrink-0 gap-2">
						<a
							href={fileUrl}
							target="_blank"
							rel="noreferrer"
							className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
						>
							<ExternalLink className="size-4" />
							Open
						</a>
						<a
							href={downloadUrl}
							className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800"
						>
							<Download className="size-4" />
							Download
						</a>
					</div>
				</div>
			</header>

			<section className="h-[calc(100svh-var(--header-height)-73px)] p-4 md:p-6">
				{canPreview ? (
					<FilePreview
						document={document}
						fileUrl={fileUrl}
						displayName={displayName}
					/>
				) : (
					<div className="flex h-full flex-col items-center justify-center rounded-lg border border-zinc-200 bg-white p-8 text-center">
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
		<div className="h-full overflow-hidden rounded-lg border border-zinc-200 bg-white">
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
					? "flex h-[90svh] w-[90vw] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 shadow-2xl"
					: "flex h-full flex-col overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 shadow-sm"
			}
		>
			<div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-3">
				<div className="flex min-w-0 items-center gap-2">
					<div className="flex size-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-600">
						{React.createElement(fileIconFor(file), {
							className:
								"size-3.5 shrink-0 text-muted-foreground/80",
						})}
					</div>
					<span className="truncate text-sm font-medium text-zinc-800">
						{displayName}
					</span>
				</div>
				<div className="flex shrink-0 items-center gap-1">
					<button
						type="button"
						className="inline-flex size-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
						onClick={() =>
							setZoom((value) => Math.max(50, value - 10))
						}
						aria-label="Zoom out"
					>
						<Minus className="size-4" />
					</button>
					<button
						type="button"
						className="h-8 w-12 rounded-md text-center text-xs tabular-nums text-muted-foreground hover:bg-zinc-100 hover:text-zinc-900"
						onClick={() => setZoom(100)}
						aria-label="Reset zoom"
					>
						{zoom}%
					</button>
					<button
						type="button"
						className="inline-flex size-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
						onClick={() =>
							setZoom((value) => Math.min(250, value + 10))
						}
						aria-label="Zoom in"
					>
						<Plus className="size-4" />
					</button>
					<button
						type="button"
						className="ml-1 inline-flex size-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
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
			<div className="flex-1 overflow-auto bg-zinc-100">
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
						<div className="rounded-md border border-zinc-200 bg-white shadow-sm">
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
							className="block rounded-md border border-zinc-200 bg-white shadow-sm"
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
			<div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/30 p-6 backdrop-blur-sm">
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
