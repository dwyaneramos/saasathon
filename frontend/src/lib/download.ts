export async function downloadResponseBlob(
	response: Response,
	fallbackFilename: string,
) {
	const blob = await response.blob();
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	const filename =
		filenameFromContentDisposition(
			response.headers.get("Content-Disposition"),
		) ?? fallbackFilename;

	anchor.href = url;
	anchor.download = filename;
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);

	return filename;
}

function filenameFromContentDisposition(header: string | null) {
	if (!header) {
		return null;
	}

	const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
	if (utf8Match?.[1]) {
		return decodeURIComponent(utf8Match[1]);
	}

	const quotedMatch = header.match(/filename="([^"]+)"/i);
	if (quotedMatch?.[1]) {
		return quotedMatch[1];
	}

	const plainMatch = header.match(/filename=([^;]+)/i);
	return plainMatch?.[1]?.trim() ?? null;
}
