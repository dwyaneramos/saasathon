import { Link } from "react-router-dom";
import kibiLogo from "../assets/kibi.svg";

const Footer = () => {
	return (
		<footer className="border-t border-zinc-100 bg-white/80 backdrop-blur-md text-zinc-900">
			<div className="max-w-7xl mx-auto px-8 py-8">
				{/* TOP ROW */}
				<div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
					{/* BRAND */}
					<div className="flex flex-col gap-3">
						<Link
							to="/"
							className="flex items-center gap-2 hover:opacity-80 transition-opacity w-fit"
						>
							<img
								src={kibiLogo}
								className="w-8 h-8"
								alt="Kibi"
							/>
							<span className="font-semibold tracking-tight text-xl text-zinc-900">
								Kibi
							</span>
						</Link>
						<p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
							Your personal knowledge graph. Connect ideas,
							surface insights.
						</p>
					</div>

					{/* NAV COLUMNS */}
					<div className="flex gap-12 text-sm">
						<div className="flex flex-col gap-3">
							<span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
								Company
							</span>
							<Link
								to="/about"
								className="text-zinc-500 hover:text-zinc-900 transition-colors"
							>
								About
							</Link>
							<Link
								to="/privacy"
								className="text-zinc-500 hover:text-zinc-900 transition-colors"
							>
								Privacy
							</Link>
						</div>
					</div>
				</div>

				{/* BOTTOM ROW */}
				<div className="mt-8 pt-6 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-4">
					<p className="text-xs text-muted-foreground">
						© {new Date().getFullYear()} Kibi. All rights reserved.
					</p>
					<div className="flex gap-4">
						<Link
							to="/contact"
							className="text-xs text-zinc-500 hover:text-zinc-900"
						>
							Contact
						</Link>
					</div>
				</div>
			</div>
		</footer>
	);
};

export default Footer;
