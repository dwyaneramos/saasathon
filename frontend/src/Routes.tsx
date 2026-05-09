import * as React from "react";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { Navbar } from "./components/Navbar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import GraphPage from "./pages/Graph";
import Landing from "./pages/Landing";
import FileView from "@/pages/FileView";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import AppNavbar from "@/components/AppNavbar";
import Footer from "./components/Footer";
import { NoAuthRoute } from "./components/NoAuthRoute";
import Dashboard from "./pages/Dashboard";

import {
	Outlet,
	Route,
	Routes,
	BrowserRouter as Router,
	Navigate,
} from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { usePageTitle } from "@/hooks/usePageTitle";

type Space = { id: number; name: string };
type AppLayoutContext = {
	activeSpaceId: number | null;
	activeSpaceName: string | null;
};

function AppLayout() {
	const [activeSpaceId, setActiveSpaceId] = React.useState<number | null>(
		() => {
			const stored = localStorage.getItem("activeSpaceId");
			if (stored) {
				const n = Number(stored);
				return Number.isInteger(n) ? n : null;
			}
			return null;
		},
	);
	const [spaces, setSpaces] = React.useState<Space[]>([]);

	const activeSpace = spaces.find((s) => s.id === activeSpaceId) ?? null;

	usePageTitle(activeSpace ? `${activeSpace.name} | Kibi` : "Kibi");

	React.useEffect(() => {
		if (activeSpaceId === null || activeSpaceId === undefined) {
			localStorage.removeItem("activeSpaceId");
			return;
		}
		localStorage.setItem("activeSpaceId", String(activeSpaceId));
	}, [activeSpaceId]);

	return (
		<div className="[--header-height:73px]">
			<SidebarProvider
				defaultOpen={false}
				style={{ "--header-height": "65px" } as React.CSSProperties}
			>
				<AppNavbar />
				<AppSidebar
					activeSpaceId={activeSpaceId}
					onSpaceChange={setActiveSpaceId}
					onSpacesLoaded={setSpaces}
				/>
				<SidebarInset className="mx-auto mt-[65px] w-full min-w-0 max-w-full p-2">
					<Outlet
						context={
							{
								activeSpaceId,
								activeSpaceName: activeSpace?.name ?? null,
							} satisfies AppLayoutContext
						}
					/>
				</SidebarInset>
			</SidebarProvider>
		</div>
	);
}

function PublicLayout() {
	return (
		<>
			<Navbar />
			<Outlet />
			<Footer />
		</>
	);
}

export function AppRoutes() {
	const { user } = useAuth();

	return (
		<Router>
			<Routes>
				<Route element={<PublicLayout />}>
					<Route
						path="/"
						element={
							user ? (
								<Navigate to="/dashboard" replace />
							) : (
								<Landing />
							)
						}
					/>

					<Route
						path="/login"
						element={
							<NoAuthRoute>
								<Login />
							</NoAuthRoute>
						}
					/>
					<Route
						path="/register"
						element={
							<NoAuthRoute>
								<Register />
							</NoAuthRoute>
						}
					/>
				</Route>

				<Route element={<AppLayout />}>
					<Route
						path="/dashboard"
						element={
							<ProtectedRoute>
								<Dashboard />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/graph"
						element={
							<ProtectedRoute>
								<GraphPage />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/file/:documentId"
						element={
							<ProtectedRoute>
								<FileView />
							</ProtectedRoute>
						}
					/>
				</Route>
			</Routes>
		</Router>
	);
}
