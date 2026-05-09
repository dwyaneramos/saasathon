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
