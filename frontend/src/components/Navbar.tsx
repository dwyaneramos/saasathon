import { Link, NavLink } from "react-router-dom";
import {
	Share2,
	LogIn,
	UserPlus,
	LogOut,
	Gauge,
	MessageCircle,
	MessageSquareMore,
	Bot,
	MessageSquareQuote,
	CircuitBoard,
	Sparkles,
} from "lucide-react";
import kibiLogo from "../assets/kibi.svg";
import { useAuth } from "@/context/AuthContext";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export const NavbarContent = () => {
	const { user, logout } = useAuth();

	const navigate = useNavigate();
	const handleLogout = () => {
		toast.success("Logout was successful!", { position: "bottom-center" });
		navigate("/");
		logout();
	};

	return (
		<>
			{/* NAV LINKS */}
			<div className="flex items-center gap-8 text-sm font-medium">
				{user ? (
					<div className="hidden md:flex gap-6 text-zinc-500">
						<NavLink
							to="/dashboard"
							className={({ isActive }) =>
								`flex items-center gap-1.5 hover:text-zinc-900 transition-colors ${
									isActive ? "text-zinc-900" : ""
								}`
							}
						>
							<Sparkles size={16} strokeWidth={2.25} />
							Dashboard
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
				) : (
					<></>
				)}
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
								className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-(--color-accent) text-zinc-900 hover:bg-(--color-accent-hover) transition-all transform active:scale-95 "
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
							<PopoverContent className="w-32 mr-3 mt-3 p-2">
								<div className="flex flex-col gap-1">
									<div className="px-2 py-1.5">
										<p className="text-sm font-semibold break-all">
											{user.firstName} {user.lastName}
										</p>
										<p className="text-xs text-muted-foreground break-all">
											{user.email}
										</p>
									</div>

									<div className="border-t my-1 border-zinc-100" />

									<button
										onClick={handleLogout}
										className="flex items-center gap-1.5 w-full text-left text-sm px-2 py-1.5 rounded-md text-red-600 hover:bg-zinc-200"
										style={{ transition: "none" }}
									>
										<LogOut size={16} strokeWidth={2.25} />
										Log out
									</button>
								</div>
							</PopoverContent>
						</Popover>
					</>
				)}
			</div>
		</>
	);
};

export const Navbar = () => {
	return (
		<nav className="flex items-center justify-between px-8 py-4 mx-auto w-full relative z-50 text-zinc-900 border-b border-zinc-100 bg-white/80 backdrop-blur-md sticky top-0">
			<div className="flex items-center justify-between max-w-7xl mx-auto w-full">
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

				<NavbarContent />
			</div>
		</nav>
	);
};
