export type CreatedCategory = {
	id?: number;
	name: string;
	description: string;
};

export type CompactAnalysisStatus = {
	currentFileName: string;
	currentStatus: "Analysing" | "Finished" | "Failed";
	remainingCount: number;
	totalCount: number;
};
