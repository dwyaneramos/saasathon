import { Link, NavLink } from "react-router-dom";
import { Sparkles, Share2, LogIn, UserPlus } from "lucide-react";
import kibiLogo from "../assets/kibi-logo.png";
import { useAuth } from "@/context/AuthContext";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { SidebarTrigger } from "./ui/sidebar";

const AppNavbar = () => {
	const { user, logout } = useAuth();

	return (
		<nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 pl-4 py-4 w-full text-zinc-900 border-b border-zinc-100 bg-white/80 backdrop-blur-md">
			<div className="flex items-center gap-2">
				<SidebarTrigger className="-ml-1" />
				{/* LOGO SECTION */}
				<Link
					to="/"
					className="flex items-center gap-2 hover:opacity-80 transition-opacity"
				>
					<img src={kibiLogo} className="w-8 h-8" alt="Kibi" />
					<span className="font-semibold tracking-tight text-xl">
						Kibi
					</span>
				</Link>
			</div>

			{/* NAV LINKS */}
			<div className="flex items-center gap-8 text-sm font-medium">
				<div className="hidden md:flex gap-6 text-zinc-500">
					<NavLink
						to="/features"
						className={({ isActive }) =>
							`flex items-center gap-1.5 hover:text-zinc-900 transition-colors ${
								isActive ? "text-zinc-900" : ""
							}`
						}
					>
						<Sparkles size={16} strokeWidth={2.25} />
						Features
					</NavLink>
					<NavLink
						to="/graph"
						className={({ isActive }) =>
							`flex items-center gap-1.5 hover:text-zinc-900 transition-colors ${
								isActive ? "text-zinc-900" : ""
							}`
						}
					>
						<Share2 size={16} strokeWidth={2.25} />
						Graph
					</NavLink>
				</div>

				{/* AUTH ACTIONS */}

				{!user ? (
					<>
						<div className="flex items-center gap-4">
							<Link
								to="/login"
								className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 transition-colors"
							>
								<LogIn size={16} strokeWidth={2.25} />
								Log in
							</Link>
							<Link
								to="/register"
								className="flex items-center gap-1.5 bg-zinc-900 text-white px-4 py-2 rounded-lg hover:bg-zinc-800 transition-all transform active:scale-95 shadow-lg shadow-zinc-200"
							>
								<UserPlus size={16} strokeWidth={2.25} />
								Sign up
							</Link>
						</div>
					</>
				) : (
					<>
						<Popover>
							<PopoverTrigger asChild>
								<img
									className="w-8 h-8 cursor-pointer rounded-full border-1 border-zinc-400"
									src="/default.png"
									alt="User Profile"
								/>
							</PopoverTrigger>
							<PopoverContent className="w-64 mr-3 mt-3">
								<div className="space-y-4">
									<div className="space-y-1">
										<h4 className="text-sm font-medium">
											First name
										</h4>
										<p className="text-sm text-muted-foreground">
											{user.firstName}
										</p>
									</div>
									<div className="space-y-1">
										<h4 className="text-sm font-medium">
											Last name
										</h4>
										<p className="text-sm text-muted-foreground">
											{user.lastName}
										</p>
									</div>
									<div className="space-y-1">
										<h4 className="text-sm font-medium">
											Email
										</h4>
										<p className="text-sm text-muted-foreground">
											{user.email}
										</p>
									</div>
									<button
										onClick={logout}
										className="w-full text-left text-sm text-red-500 hover:underline pt-2 border-t"
									>
										Log out
									</button>
								</div>
							</PopoverContent>
						</Popover>
					</>
				)}
			</div>
		</nav>
	);
};

export default AppNavbar;
