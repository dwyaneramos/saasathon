import type { User } from "@/context/AuthContext";

interface DashboardProps {
	user: User;
}

function Dashboard({ user }: DashboardProps) {
	return (
		<div className="upload-page max-w-6xl mx-auto p-6 mt-12">
			<h2 className="text-xl text-center text-zinc-500">Hi there,</h2>
			<h1 className="text-2xl font-bold text-center">How can I help?</h1>
		</div>
	);
}

export default Dashboard;
