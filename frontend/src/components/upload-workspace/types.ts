export type CreatedCategory = {
	id?: number;
	name: string;
	description: string;
};

export type CompactAnalysisStatus = {
	currentFileName: string;
	currentStatus: "Analyzing" | "Finished" | "Failed";
	remainingCount: number;
	totalCount: number;
};
