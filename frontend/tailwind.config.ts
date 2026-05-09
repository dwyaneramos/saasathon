import type { Config } from "tailwindcss";

export default {
	content: ["./index.html", "./src/**/*.{ts,tsx}"],
	theme: {
		extend: {
			fontFamily: {
				sans: ["Geist Sans", "sans-serif"],
			},
		},
	},
} satisfies Config;
