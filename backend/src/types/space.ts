export interface Space {
	id: number;
	created_by: number | null;
	name: string;
	created_at: Date;
}

export interface PublicSpace {
	id: number;
	createdBy: number | null;
	name: string;
	createdAt: Date;
}
