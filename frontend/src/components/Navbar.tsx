import { Link } from "react-router-dom";

const links = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/services", label: "Services" },
  { to: "/work", label: "Work" },
  { to: "/contact", label: "Contact" },
];

export const Navbar = () => {
  return (
    <div className="flex flex-row justify-between w-full bg-jet-black text-white px-5 py-2">
      <Link className="text-xl" to="/">
        Kibi
      </Link>
      <div className="flex flex-row gap-3">
        <Link className="text-lg" to="/">
          Search
        </Link>
        <Link className="text-lg" to="/">
          Register
        </Link>
        <Link className="text-lg" to="/view-profile">
          View Profile
        </Link>
        <Link className="text-lg" to="/upload">
          Upload
        </Link>
      </div>
    </div>
  );
};

export default Navbar;
