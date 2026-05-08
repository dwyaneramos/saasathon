import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "../pages/Home";
import Graph from "../pages/Graph";
import Login from "../pages/Login";
import ViewProfile from "../pages/ViewProfile";
import Navbar from "../components/Navbar";

const AppRoutes = () => (
  <BrowserRouter>
    <Navbar />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/graph" element={<Graph />} />
      <Route path="/login" element={<Login />} />
      <Route path="/view-profile" element={<ViewProfile />} />
    </Routes>
  </BrowserRouter>
);

export default AppRoutes;
