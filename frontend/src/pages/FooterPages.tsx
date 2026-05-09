import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle";

type FooterPageContent = {
	title: string;
	description: string;
	sections: Array<{
		heading: string;
		body: string;
	}>;
	action?: {
		label: string;
		to: string;
	};
};

const pages = {
	about: {
		title: "About Kibi",
		description:
			"Kibi helps people turn scattered documents into a connected workspace that is easier to browse, search, and understand.",
		sections: [
			{
				heading: "Built for personal knowledge",
				body: "Kibi organizes files into spaces, categories, and graph views so documents feel less like storage and more like something you can move through.",
			},
			{
				heading: "AI with context",
				body: "The assistant is designed to use the files, categories, and structure already in your workspace rather than answering from a blank slate.",
			},
		],
		action: {
			label: "Open dashboard",
			to: "/dashboard",
		},
	},
	privacy: {
		title: "Privacy",
		description:
			"Kibi is built around personal files, so privacy needs to be plain, practical, and easy to reason about.",
		sections: [
			{
				heading: "Your workspace data",
				body: "Files and generated metadata are used to power upload analysis, categorization, search, graph views, and the dashboard assistant inside your account.",
			},
			{
				heading: "Access",
				body: "Authenticated app routes and file endpoints require a valid session. We avoid exposing uploaded files through public unauthenticated URLs.",
			},
		],
		action: {
			label: "Contact us",
			to: "/contact",
		},
	},
	contact: {
		title: "Contact",
		description:
			"Need help, have feedback, or want to talk through how Kibi should fit your workflow?",
		sections: [
			{
				heading: "Get in touch",
				body: "Send questions, product feedback, and support notes to the team. We are especially interested in places where your document workflow still feels slow or unclear.",
			},
		],
	},
} satisfies Record<string, FooterPageContent>;

function FooterInfoPage({ page }: { page: FooterPageContent }) {
	usePageTitle(`${page.title} | Kibi`);
	const isMailAction = page.action?.to.startsWith("mailto:");

	return (
		<main className="mx-auto flex min-h-[calc(100svh-var(--header-height))] w-full max-w-3xl flex-col justify-center px-6 py-16">
			<div>
				<p className="text-sm font-medium text-muted-foreground">
					Kibi
				</p>
				<h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
					{page.title}
				</h1>
				<p className="mt-4 text-base leading-7 text-zinc-600">
					{page.description}
				</p>
			</div>

			<div className="mt-10 space-y-8 border-t border-zinc-200 pt-8">
				{page.sections.map((section) => (
					<section key={section.heading}>
						<h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
							{section.heading}
						</h2>
						<p className="mt-3 text-sm leading-7 text-zinc-700">
							{section.body}
						</p>
					</section>
				))}
			</div>

			{page.action ? (
				<div className="mt-10">
					<Button variant="accent" asChild>
						{isMailAction ? (
							<a href={page.action.to}>
								<Mail className="size-4" />
								{page.action.label}
							</a>
						) : (
							<Link to={page.action.to}>{page.action.label}</Link>
						)}
					</Button>
				</div>
			) : null}
		</main>
	);
}

export function AboutPage() {
	return <FooterInfoPage page={pages.about} />;
}

export function PrivacyPage() {
	return <FooterInfoPage page={pages.privacy} />;
}

export function ContactPage() {
	return <FooterInfoPage page={pages.contact} />;
}
