import { Link } from "react-router-dom";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"


export const Navbar = () => {
  return (
    <div className="flex flex-row justify-between w-full bg-bg-secondary text-primary px-5 py-2">
      <Link className="text-xl" to="/">
        Kibi
      </Link>
      <div className="flex flex-row gap-3">

        <Link className="text-lg" to="/">Search</Link>
        <Link className="text-lg" to="/">Register</Link>

        <Popover>
          <PopoverTrigger asChild>
            <img className="w-8 h-8 cursor-pointer" src="/default.svg" />
          </PopoverTrigger>
          <PopoverContent className="w-64 mr-3 mt-3">
            <div className="space-y-4">

              <div className="space-y-1">
                <h4 className="text-sm font-medium">First name</h4>
                <p className="text-sm text-muted-foreground">
                  Insert name
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-medium">Last name</h4>
                <p className="text-sm text-muted-foreground">
                  Insert name
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-medium">Email</h4>
                <p className="text-sm text-muted-foreground">
                  Insert email
                </p>
              </div>

            </div>
          </PopoverContent>        </Popover >
      </div >

    </div >
  );
};

export default Navbar;
