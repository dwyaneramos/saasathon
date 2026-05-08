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
import { Link } from "react-router-dom";

export default function Register() {
	return (
		<div className="register-page min-h-screen flex flex-col">
			<main className="flex-1 flex items-center justify-center p-4">
				<Card className="w-full max-w-md">
					<CardHeader>
						<CardTitle>Register to Kibi</CardTitle>
						<CardDescription>
							Create your account to get started
						</CardDescription>
					</CardHeader>

					<CardContent>
						<form
							onSubmit={(e) => {
								e.preventDefault();
							}}
							className="space-y-4"
						>
							<div className="space-y-2">
								<Label htmlFor="firstName">First Name</Label>
								<Input
									type="text"
									id="firstName"
									name="firstName"
									placeholder="Enter your first name"
									required
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
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="repeat-password">
									Repeat Password
								</Label>
								<Input
									type="password"
									id="repeat-password"
									name="repeat-password"
									placeholder="Confirm your password"
									required
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
									className="flex-1 !bg-bg-accent text-white"
								>
									Register
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
