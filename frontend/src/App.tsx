import {
	Outlet,
	Route,
	Routes,
	BrowserRouter as Router,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Navbar } from "./components/Navbar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import GraphPage from "./pages/Graph";
import Landing from "./pages/Landing";
import Upload from "@/pages/Upload";
import FileView from "@/pages/FileView";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import AppNavbar from "@/components/AppNavbar";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/sonner";
import Footer from "./components/Footer";

function AppLayout() {
	return (
		<div className="[--header-height:73px]">
			<SidebarProvider
				defaultOpen={false}
				style={{ "--header-height": "65px" } as React.CSSProperties}
			>
				<AppNavbar />
				<AppSidebar />
				<SidebarInset className="mx-auto mt-[65px] w-full min-w-0 max-w-full px-4 md:max-w-[min(70vw,calc(100vw-34rem))] md:px-0">
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
			<Footer />
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
							<Route
								path="/upload"
								element={
									<ProtectedRoute>
										<Upload />
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
			</TooltipProvider>
			<Toaster
				toastOptions={{
					classNames: {
						error: "!bg-red-100 !text-red-800 !border-red-300",
						success:
							"!bg-green-100 !text-green-800 !border-green-300",
						warning: "!bg-yellow-100",
						info: "!bg-blue-100",
					},
				}}
			/>
		</AuthProvider>
	);
}

export default App;
