import { Link } from "react-router-dom";
import kibiLogo from "../assets/kibi-logo.png";
import { SidebarTrigger } from "./ui/sidebar";
import { NavbarContent } from "./Navbar";

const AppNavbar = () => {
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

			<NavbarContent />
		</nav>
	);
};

export default AppNavbar;
