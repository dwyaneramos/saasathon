import { useState, type ChangeEvent, type FormEvent } from "react";
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

const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

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

	const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
		setFormData({ ...formData, [e.target.name]: e.target.value });
		if (error) setError("");
	};

	const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const firstName = formData.firstName.trim();
		const lastName = formData.lastName.trim();
		const email = formData.email.trim().toLowerCase();
		const password = formData.password;
		const repeatPassword = formData.repeatPassword;

		if (!firstName) {
			setError("Enter your first name.");
			return;
		}

		if (!lastName) {
			setError("Enter your last name.");
			return;
		}

		if (!email) {
			setError("Enter your email address.");
			return;
		}

		if (!emailPattern.test(email)) {
			setError("Enter a valid email address.");
			return;
		}

		if (!password) {
			setError("Create a password.");
			return;
		}

		if (!repeatPassword) {
			setError("Repeat your password.");
			return;
		}

		setIsLoading(true);

		if (password !== repeatPassword) {
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
						firstName,
						lastName,
						email,
						password,
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
		} catch {
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
						<form onSubmit={handleSubmit} noValidate className="space-y-4">
							<div className="flex flex-row gap-4">
								<div className="space-y-2 flex-1">
									<Label htmlFor="firstName">
										First Name
									</Label>
									<Input
										type="text"
										id="firstName"
										name="firstName"
										placeholder="Enter your first name"
										value={formData.firstName}
										onChange={handleChange}
									/>
								</div>

								<div className="space-y-2 flex-1">
									<Label htmlFor="lastName">Last Name</Label>
									<Input
										type="text"
										id="lastName"
										name="lastName"
										placeholder="Enter your last name"
										value={formData.lastName}
										onChange={handleChange}
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="email">Email</Label>
								<Input
									type="email"
									id="email"
									name="email"
									placeholder="Enter your email"
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
									variant="accent"
									disabled={isLoading}
									className="flex-1 items-center gap-1.5 px-4 py-2 rounded-lg transition-all transform active:scale-95"
								>
									{isLoading ? "Loading..." : "Register"}
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			</main>
		</div>
	);
}
