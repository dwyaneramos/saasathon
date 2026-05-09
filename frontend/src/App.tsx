import { AuthProvider } from "./context/AuthContext";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/sonner";
import { AppRoutes } from "./Routes";

function App() {
	return (
		<AuthProvider>
			<TooltipProvider>
				<AppRoutes />
			</TooltipProvider>
			<Toaster richColors />
		</AuthProvider>
	);
}

export default App;
