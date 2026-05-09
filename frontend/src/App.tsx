import {
	Outlet,
	Route,
	Routes,
	BrowserRouter as Router,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import GraphPage from "./pages/Graph";
import Landing from "./pages/Landing";
import Upload from "@/pages/Upload";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import AppNavbar from "@/components/AppNavbar";
import { TooltipProvider } from "./components/ui/tooltip";

function AppLayout() {
	return (
		<div className="[--header-height:73px]">
			<SidebarProvider
				defaultOpen={false}
				style={{ "--header-height": "65px" } as React.CSSProperties}
			>
				<AppNavbar />
				<AppSidebar />
				<SidebarInset className="mt-[65px]">
					<Outlet />
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
		</>
	);
}

function App() {
	return (
		<AuthProvider>
			<TooltipProvider>
				<Router>
					<Routes>
						<Route element={<PublicLayout />}>
							<Route path="/" element={<Landing />} />
							<Route path="/login" element={<Login />} />
							<Route path="/register" element={<Register />} />
						</Route>

						<Route element={<AppLayout />}>
							<Route path="/upload" element={<Upload />} />
							<Route
								path="/graph"
								element={
									<ProtectedRoute>
										<GraphPage />
									</ProtectedRoute>
								}
							/>
						</Route>
					</Routes>
				</Router>
			</TooltipProvider>
		</AuthProvider>
	);
}

export default App;
