import { useState } from "react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export default function Register() {
	const navigate = useNavigate();

	// Form State
	const [formData, setFormData] = useState({
		firstName: "",
		lastName: "",
		email: "",
		password: "",
		repeatPassword: "",
	});

	// Error/Loading States
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleChange = (e) => {
		setFormData({ ...formData, [e.target.name]: e.target.value });
		if (error) setError("");
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setIsLoading(true);

		if (formData.password !== formData.repeatPassword) {
			setError("Passwords do not match");
			setIsLoading(false);
			return;
		}

		try {
			const response = await fetch(
				"http://localhost:3000/api/v1/users/register",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						firstName: formData.firstName,
						lastName: formData.lastName,
						email: formData.email,
						password: formData.password,
					}),
				},
			);

			const data = await response.json();

			if (response.ok) {
				navigate("/login");
				toast.success("Registration successful!", {
					position: "bottom-center",
				});
			} else {
				setError(data.error || data.message || "Registration failed");
			}
		} catch (err) {
			setError("Server connection failed");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="register-page min-h-screen flex flex-col">
			<main className="flex-1 flex items-center justify-center p-4">
				<Card className="w-full max-w-md">
					<CardHeader>
						<CardTitle>Register to Kibi</CardTitle>
						<CardDescription>
							Create your account to get started
						</CardDescription>
						{error && (
							<p className="text-sm text-red-500 mt-2">{error}</p>
						)}
					</CardHeader>

					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="firstName">First Name</Label>
								<Input
									type="text"
									id="firstName"
									name="firstName"
									placeholder="Enter your first name"
									required
									value={formData.firstName}
									onChange={handleChange}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="lastName">Last Name</Label>
								<Input
									type="text"
									id="lastName"
									name="lastName"
									placeholder="Enter your last name"
									required
									value={formData.lastName}
									onChange={handleChange}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="email">Email</Label>
								<Input
									type="email"
									id="email"
									name="email"
									placeholder="Enter your email"
									required
									value={formData.email}
									onChange={handleChange}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="password">Password</Label>
								<Input
									type="password"
									id="password"
									name="password"
									placeholder="Enter your password"
									required
									value={formData.password}
									onChange={handleChange}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="repeatPassword">
									Repeat Password
								</Label>
								<Input
									type="password"
									id="repeatPassword"
									name="repeatPassword"
									placeholder="Confirm your password"
									required
									value={formData.repeatPassword}
									onChange={handleChange}
								/>
							</div>

							<div className="flex gap-2 pt-2">
								<Button
									type="button"
									variant="outline"
									asChild
									className="flex-1"
								>
									<Link to="/">Cancel</Link>
								</Button>

								<Button
									type="submit"
									disabled={isLoading}
									className="flex-1 items-center gap-1.5 bg-zinc-900 text-white px-4 py-2 rounded-lg hover:bg-zinc-800 transition-all transform active:scale-95 shadow-lg shadow-zinc-200"
								>
									{isLoading ? "Loading..." : "Register"}
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			</main>

			<footer className="p-4 text-center">
				<small className="text-muted-foreground">
					&copy; 2026 My App
				</small>
			</footer>
		</div>
	);
}
