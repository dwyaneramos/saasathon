import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext"; // Import the hook
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const Navbar = () => {
  const { user, logout } = useAuth(); // Access user state

  console.log(user);

  return (
    <div className="flex flex-row justify-between w-full bg-bg-secondary text-bg px-5 border-b-2 border-primary py-4">
      <Link className="text-2xl" to="/">
        Kibi
      </Link>
      <div className="flex flex-row gap-3 items-center">
        <Link className="text-lg" to="/graph">
          Search
        </Link>

        {!user ? (
          <>
            <Link className="text-lg cursor" to="/login">
              Login
            </Link>
            <Link className="text-lg" to="/register">
              Register
            </Link>
          </>
        ) : (
          <Popover>
            <PopoverTrigger asChild>
              <img
                className="w-8 h-8 cursor-pointer rounded-full border-2 border-bg p-1"
                src="/default.svg"
                alt="User Profile"
              />
            </PopoverTrigger>
            <PopoverContent className="w-64 mr-3 mt-3">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">
                    First name
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {user.firstName}
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">
                    Last name
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {user.lastName}
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">
                    Email
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {user.email}
                  </p>
                </div>
                <button
                  onClick={logout}
                  className="w-full text-left text-sm text-red-500 hover:underline pt-2 border-t"
                >
                  Log out
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
};

export default Navbar;
