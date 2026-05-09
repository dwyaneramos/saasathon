const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const apiBaseUrl = (
	configuredApiBaseUrl && configuredApiBaseUrl.length > 0
		? configuredApiBaseUrl
		: import.meta.env.DEV
			? "http://localhost:3000/api/v1"
			: "/api/v1"
).replace(/\/+$/, "");
