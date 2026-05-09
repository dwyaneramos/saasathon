import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// Define exactly what a User looks like
export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (userData: User, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [isLoading, setIsLoading] = useState(() => {
    return typeof window !== "undefined" && !!localStorage.getItem("token");
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const login = (userData: any, token: string) => {
    const mappedUser: User = {
      id: userData.id,
      email: userData.email,
      firstName: userData.first_name || userData.firstName,
      lastName: userData.last_name || userData.lastName,
    };

    setUser(mappedUser);

    localStorage.setItem("user", JSON.stringify(mappedUser));
    localStorage.setItem("token", token);

    setIsLoading(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setIsLoading(false);
  };
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    fetch("http://localhost:3000/api/v1/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json();
      })
      .then((data) => {
        if (data.user) {
          const mappedUser: User = {
            id: data.user.id,
            email: data.user.email,
            firstName: data.user.first_name,
            lastName: data.user.last_name,
          };

          setUser(mappedUser);
          localStorage.setItem("user", JSON.stringify(mappedUser));
        }
      })
      .catch(() => {
        logout();
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
