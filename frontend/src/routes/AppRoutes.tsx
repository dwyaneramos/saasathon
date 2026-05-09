import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "../components/ProtectedRoute";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Login from "../pages/Login";
import Register from "../pages/Register";
import GraphPage from "../pages/Graph";
import Landing from "../pages/Landing";
import Upload from "@/pages/Upload";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

function App() {
	return (
		<AuthProvider>
			<SidebarProvider>
				<Router>
					<AppSidebar />
					<SidebarInset>
						<Routes>
							<>
								<Navbar />
								<Route path="/" element={<Landing />} />
								<Route path="/login" element={<Login />} />
								<Route
									path="/register"
									element={<Register />}
								/>
							</>

							<Route path="/upload" element={<Upload />} />

							<Route
								path="/graph"
								element={
									<ProtectedRoute>
										<GraphPage />
									</ProtectedRoute>
								}
							/>
						</Routes>
					</SidebarInset>
				</Router>
			</SidebarProvider>
		</AuthProvider>
	);
}

export default App;
