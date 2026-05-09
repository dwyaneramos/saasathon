import { Navigate } from "react-router-dom";

export default function Upload() {
  return <Navigate to="/graph?upload=1" replace />;
}
