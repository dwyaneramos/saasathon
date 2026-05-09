export type ZipArchiveFile = {
	name: string;
	data: Buffer;
	modifiedAt?: Date;
};

const utf8Flag = 1 << 11;
const storedCompression = 0;
const crcTable = buildCrcTable();

export function createZipArchive(files: ZipArchiveFile[]) {
	const localParts: Buffer[] = [];
	const centralParts: Buffer[] = [];
	let offset = 0;

	for (const file of files) {
		const nameBuffer = Buffer.from(normalizeZipEntryName(file.name), "utf8");
		const { date, time } = toDosDateTime(file.modifiedAt ?? new Date());
		const crc = crc32(file.data);
		const size = file.data.length;

		const localHeader = Buffer.alloc(30);
		localHeader.writeUInt32LE(0x04034b50, 0);
		localHeader.writeUInt16LE(20, 4);
		localHeader.writeUInt16LE(utf8Flag, 6);
		localHeader.writeUInt16LE(storedCompression, 8);
		localHeader.writeUInt16LE(time, 10);
		localHeader.writeUInt16LE(date, 12);
		localHeader.writeUInt32LE(crc, 14);
		localHeader.writeUInt32LE(size, 18);
		localHeader.writeUInt32LE(size, 22);
		localHeader.writeUInt16LE(nameBuffer.length, 26);
		localHeader.writeUInt16LE(0, 28);

		localParts.push(localHeader, nameBuffer, file.data);

		const centralHeader = Buffer.alloc(46);
		centralHeader.writeUInt32LE(0x02014b50, 0);
		centralHeader.writeUInt16LE(20, 4);
		centralHeader.writeUInt16LE(20, 6);
		centralHeader.writeUInt16LE(utf8Flag, 8);
		centralHeader.writeUInt16LE(storedCompression, 10);
		centralHeader.writeUInt16LE(time, 12);
		centralHeader.writeUInt16LE(date, 14);
		centralHeader.writeUInt32LE(crc, 16);
		centralHeader.writeUInt32LE(size, 20);
		centralHeader.writeUInt32LE(size, 24);
		centralHeader.writeUInt16LE(nameBuffer.length, 28);
		centralHeader.writeUInt16LE(0, 30);
		centralHeader.writeUInt16LE(0, 32);
		centralHeader.writeUInt16LE(0, 34);
		centralHeader.writeUInt16LE(0, 36);
		centralHeader.writeUInt32LE(0, 38);
		centralHeader.writeUInt32LE(offset, 42);

		centralParts.push(centralHeader, nameBuffer);
		offset += localHeader.length + nameBuffer.length + file.data.length;
	}

	const centralDirectoryOffset = offset;
	const centralDirectorySize = centralParts.reduce(
		(total, part) => total + part.length,
		0,
	);
	const endOfCentralDirectory = Buffer.alloc(22);
	endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
	endOfCentralDirectory.writeUInt16LE(0, 4);
	endOfCentralDirectory.writeUInt16LE(0, 6);
	endOfCentralDirectory.writeUInt16LE(files.length, 8);
	endOfCentralDirectory.writeUInt16LE(files.length, 10);
	endOfCentralDirectory.writeUInt32LE(centralDirectorySize, 12);
	endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);
	endOfCentralDirectory.writeUInt16LE(0, 20);

	return Buffer.concat([
		...localParts,
		...centralParts,
		endOfCentralDirectory,
	]);
}

function normalizeZipEntryName(name: string) {
	const normalized = name.replace(/\\/g, "/").split("/").filter(Boolean).join("/");
	return normalized || "document";
}

function toDosDateTime(date: Date) {
	const year = Math.max(1980, date.getFullYear());
	const dosDate =
		((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
	const dosTime =
		(date.getHours() << 11) |
		(date.getMinutes() << 5) |
		Math.floor(date.getSeconds() / 2);

	return { date: dosDate, time: dosTime };
}

function buildCrcTable() {
	const table = new Uint32Array(256);

	for (let index = 0; index < 256; index += 1) {
		let value = index;
		for (let bit = 0; bit < 8; bit += 1) {
			value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
		}
		table[index] = value >>> 0;
	}

	return table;
}

function crc32(data: Buffer) {
	let crc = 0xffffffff;

	for (const byte of data) {
		crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	}

	return (crc ^ 0xffffffff) >>> 0;
}
