import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "../pages/Home";
import Graph from "../pages/Graph";
import Login from "../pages/Login";
import Upload from "../pages/Upload";
import ViewProfile from "../pages/ViewProfile";
import Navbar from "../components/Navbar";
import Landing from "../pages/Landing";

const AppRoutes = () => (
	<BrowserRouter>
		<div className="min-h-screen bg-[#fafafa] text-zinc-900 selection:bg-emerald-100 selection:text-emerald-900">
			<Navbar />
			<Routes>
				<Route path="/" element={<Landing />} />
				<Route path="/graph" element={<Graph />} />
				<Route path="/login" element={<Login />} />
				<Route path="/view-profile" element={<ViewProfile />} />
				<Route path="/upload" element={<Upload />} />
			</Routes>
		</div>
	</BrowserRouter>
);

export default AppRoutes;
