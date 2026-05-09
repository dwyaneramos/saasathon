import AppRoutes from "./routes/AppRoutes";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from "./components/ui/sonner";

function App() {
	return (
		<div className="h-screen w-screen">
			<AuthProvider>
				<AppRoutes />
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
		</div>
	);
}

export default App;
