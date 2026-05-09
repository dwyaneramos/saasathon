import { Link, NavLink } from "react-router-dom";
import { Sparkles, Share2, LogIn, UserPlus } from "lucide-react";
import kibiLogo from "../assets/kibi-logo.png";

const Navbar = () => {
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
				</div>
			</div>
		</nav>
	);
};

export default Navbar;
