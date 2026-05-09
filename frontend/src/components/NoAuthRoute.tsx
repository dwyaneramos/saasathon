import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const NoAuthRoute = ({ children }: { children: React.ReactNode }) => {
	const { user, isLoading } = useAuth();
	const location = useLocation();

	if (isLoading) {
		return (
			<div className="min-h-screen bg-bg flex items-center justify-center">
				<div className="text-white opacity-50">Loading...</div>
			</div>
		);
	}

	if (user) {
		return <Navigate to="/" state={{ from: location }} replace />;
	}

	return <>{children}</>;
};
