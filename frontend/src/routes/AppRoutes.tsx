import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "../pages/Home";
import Graph from "../pages/Graph";
import Login from "../pages/Login";
import ViewProfile from "../pages/ViewProfile";
import Navbar from "../components/Navbar";
import Landing from "../pages/Landing";

const AppRoutes = () => (
  <BrowserRouter>
    <Navbar />
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/graph" element={<Graph />} />
      <Route path="/login" element={<Login />} />
      <Route path="/view-profile" element={<ViewProfile />} />
    </Routes>
  </BrowserRouter>
);

export default AppRoutes;
