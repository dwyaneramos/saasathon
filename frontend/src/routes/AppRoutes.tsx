import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "../pages/Home";
import Graph from "../pages/Graph";
import Login from "../pages/Login";
import Upload from "../pages/Upload";
import ViewProfile from "../pages/ViewProfile";
import Navbar from "../components/Navbar";
import Landing from "../pages/Landing";
import Register from "../pages/Register";

const AppRoutes = () => (
	<BrowserRouter>
		<Navbar />
		<Routes>
			<Route path="/" element={<Landing />} />
			<Route path="/graph" element={<Graph />} />
			<Route path="/login" element={<Login />} />
			<Route path="/register" element={<Register />} />
			<Route path="/view-profile" element={<ViewProfile />} />
			<Route path="/upload" element={<Upload />} />
		</Routes>
	</BrowserRouter>
);

export default AppRoutes;
