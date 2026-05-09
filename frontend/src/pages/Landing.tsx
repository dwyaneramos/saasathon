import LandingAnimation from "@/components/LandingAnimation";
import { CloudSync, Database, Zap } from "lucide-react";

export const Landing = () => {
	return (
		<>
			{/* HERO */}
			<main className="relative min-h-screen flex items-center px-6 py-24 overflow-hidden">
				<div className="max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-20 items-center">
					
					{/* LEFT SIDE - CONTENT */}
					<div className="text-center lg:text-left flex flex-col items-center lg:items-start">
						<h1 className="max-w-4xl text-6xl md:text-8xl font-bold tracking-tighter bg-gradient-to-b from-zinc-900 to-zinc-500 bg-clip-text text-transparent leading-[0.9] pb-8">
							Document digitisation <br /> for the next generation.
						</h1>

						<p className="max-w-xl text-lg md:text-xl text-zinc-500 leading-relaxed mb-10">
							Store, query, and sync data in real time. Simple
							interface, powered by purpose-built AI.
						</p>

						<div className="flex flex-col sm:flex-row gap-4 items-center">
							<button className="bg-zinc-900 text-white px-8 py-4 rounded-lg font-semibold hover:bg-zinc-800 transition-all transform active:scale-95 shadow-xl shadow-zinc-200">
								Get Started for Free
							</button>

							<button className="text-zinc-600 border border-zinc-200 bg-white px-8 py-4 rounded-lg font-medium hover:bg-zinc-50 transition-all">
								Read Documentation →
							</button>
						</div>
					</div>

					<div className="relative flex items-center justify-center">
						<LandingAnimation></LandingAnimation>
					</div>
				</div>
			</main>

			{/* FEATURES */}
			<section className="max-w-7xl mx-auto px-6 pb-32">
				<div className="grid md:grid-cols-3 gap-px bg-zinc-200 border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
					
					<div className="p-10 bg-white group hover:bg-zinc-50 transition-colors text-zinc-500">
						<div className="w-10 h-10 mb-6 rounded-lg bg-white border border-zinc-200 flex items-center justify-center group-hover:shadow-sm transition-all">
							<Zap strokeWidth={1.5} />
						</div>

						<h3 className="text-lg font-semibold mb-3 text-zinc-900">
							Simple by Design
						</h3>

						<p className="text-sm text-zinc-500 leading-relaxed">
							Intuitive interface that gets out of your way. Built
							for speed and focus.
						</p>
					</div>

					<div className="p-10 bg-white group hover:bg-zinc-50 transition-colors text-zinc-500">
						<div className="w-10 h-10 mb-6 rounded-lg bg-white border border-zinc-200 flex items-center justify-center group-hover:shadow-sm transition-all">
							<CloudSync strokeWidth={1.5} />
						</div>

						<h3 className="text-lg font-semibold mb-3 text-zinc-900">
							Instant Sync
						</h3>

						<p className="text-sm text-zinc-500 leading-relaxed">
							Data accessible across all clients, instantly. Never
							worry about versioning.
						</p>
					</div>

					<div className="p-10 bg-white group hover:bg-zinc-50 transition-colors text-zinc-500">
						<div className="w-10 h-10 mb-6 rounded-lg bg-white border border-zinc-200 flex items-center justify-center group-hover:shadow-sm transition-all">
							<Database strokeWidth={1.5} />
						</div>

						<h3 className="text-lg font-semibold mb-3 text-zinc-900">
							Enterprise Scale
						</h3>

						<p className="text-sm text-zinc-500 leading-relaxed">
							From side projects to production workloads.
							Scalability comes standard.
						</p>
					</div>
				</div>
			</section>

		</>
	);
};

export default Landing;