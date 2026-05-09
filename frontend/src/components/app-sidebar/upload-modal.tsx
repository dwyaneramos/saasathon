import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadWorkspace } from "@/components/upload-workspace";
import { cn } from "@/lib/utils";

export function UploadModal({
	open,
	onOpenChange,
	spaceId,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	spaceId?: number | null;
}) {
	const [isUploadLocked, setIsUploadLocked] = React.useState(false);
	const [hasAnalysisStarted, setHasAnalysisStarted] = React.useState(false);

	const handleBusyChange = React.useCallback((isBusy: boolean) => {
		setIsUploadLocked(isBusy);
		if (isBusy) {
			setHasAnalysisStarted(true);
		}
	}, []);

	const requestClose = React.useCallback(() => {
		if (isUploadLocked) {
			return;
		}

		onOpenChange(false);
	}, [isUploadLocked, onOpenChange]);

	React.useEffect(() => {
		if (!open) {
			setIsUploadLocked(false);
			setHasAnalysisStarted(false);
		}
	}, [open]);

	React.useEffect(() => {
		if (!open) {
			return;
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !isUploadLocked) {
				onOpenChange(false);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isUploadLocked, onOpenChange, open]);

	if (!open) {
		return null;
	}

	return createPortal(
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="upload-files-title"
			className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/20 p-4 supports-backdrop-filter:backdrop-blur-sm"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget && !isUploadLocked) {
					onOpenChange(false);
				}
			}}
		>
			<Card className="relative z-[201] max-h-[88vh] w-full max-w-2xl gap-0 overflow-hidden rounded-xl bg-card !py-0">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="absolute top-4 right-4 z-10 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
					onClick={requestClose}
					disabled={isUploadLocked}
				>
					<X className="size-4" />
					<span className="sr-only">Close upload modal</span>
				</Button>
				<CardHeader className="border-b border-border px-6 py-5 pr-14">
					<CardTitle
						id="upload-files-title"
						className="text-lg font-semibold text-foreground"
					>
						Upload files
					</CardTitle>
					<CardDescription className="max-w-xl">
						Add PDFs or images to analyse and organize them into
						categories.
					</CardDescription>
				</CardHeader>
				<CardContent
					className={cn(
						"max-h-[calc(88vh-9rem)] overflow-y-auto bg-card px-6 pt-6",
						hasAnalysisStarted ? "pb-0" : "pb-6",
					)}
				>
					<UploadWorkspace
						detailMode="compact"
						showHeading={false}
						onBusyChange={handleBusyChange}
						spaceId={spaceId}
					/>
				</CardContent>
				{hasAnalysisStarted ? (
					<div className="flex items-center justify-between gap-4 border-t border-border bg-muted/50 px-6 py-4 text-muted-foreground">
						<span className="min-w-0 text-sm leading-relaxed">
							{isUploadLocked
								? "Analysis is running. Keep this window open until it finishes."
								: "Analysis complete. New files are ready in the sidebar."}
						</span>
						<Button
							type="button"
							variant="accent"
							className="shrink-0"
							size="default"
							onClick={requestClose}
							disabled={isUploadLocked}
						>
							Done
						</Button>
					</div>
				) : null}
			</Card>
		</div>,
		document.body,
	);
}
