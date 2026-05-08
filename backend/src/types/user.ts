export interface User {
	id: number;
	email: string;
	firstName: string;
	lastName: string;
	password_hash: string;
	created_at: Date;
}

export type PublicUser = Omit<User, "password_hash">;

export type CreateUserInput = Pick<User, "email" | "firstName" | "lastName"> & {
	password: string;
};
