import {
	FileArchive,
	FileAudio,
	FileCode,
	FileImage,
	FileSpreadsheet,
	FileText,
	FileVideo,
} from "lucide-react";

type FileIconInput = {
	id?: number;
	name: string;
	filename: string;
	mimeType: string;
};

function fileExtension(file: FileIconInput) {
	const name = file.filename || file.name;
	const extension = name.split(".").pop();
	return extension && extension !== name ? extension.toLowerCase() : "";
}

export function fileIconFor(file: FileIconInput) {
	const mimeType = file.mimeType.toLowerCase();
	const extension = fileExtension(file);

	if (mimeType === "application/pdf" || extension === "pdf") return FileText;
	if (mimeType.startsWith("image/")) return FileImage;
	if (mimeType.startsWith("audio/")) return FileAudio;
	if (mimeType.startsWith("video/")) return FileVideo;
	if (
		mimeType.includes("spreadsheet") ||
		mimeType.includes("excel") ||
		["csv", "tsv", "xls", "xlsx"].includes(extension)
	) {
		return FileSpreadsheet;
	}
	if (
		mimeType.includes("zip") ||
		mimeType.includes("compressed") ||
		["zip", "rar", "7z", "tar", "gz"].includes(extension)
	) {
		return FileArchive;
	}
	if (
		mimeType.includes("json") ||
		mimeType.includes("xml") ||
		["js", "jsx", "ts", "tsx", "json", "html", "css", "md", "xml"].includes(
			extension,
		)
	) {
		return FileCode;
	}

	return FileText;
}
