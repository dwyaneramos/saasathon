import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "../components/ProtectedRoute";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Login from "../pages/Login";
import Register from "../pages/Register";
import GraphPage from "../pages/Graph";
import Landing from "../pages/Landing";
import Upload from "@/pages/Upload";

function App() {
	return (
		<Router>
			<Navbar />
			<Routes>
				<Route path="/" element={<Landing />} />
				<Route path="/login" element={<Login />} />
				<Route path="/register" element={<Register />} />
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
			<Footer />
		</Router>
	);
}

export default App;
