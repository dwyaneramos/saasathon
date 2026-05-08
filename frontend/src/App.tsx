import AppRoutes from "./routes/AppRoutes";
import { AuthProvider } from "./context/AuthContext";

function App() {
	return (
		<div className="h-screen w-screen">
			<AuthProvider>
				<AppRoutes />
			</AuthProvider>
		</div>
	);
}

export default App;
