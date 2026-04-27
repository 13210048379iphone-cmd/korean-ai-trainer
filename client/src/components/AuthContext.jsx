import { createContext, useContext, useMemo, useState } from "react";
import { api, clearSession, getUser, setSession } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getUser());

  async function login(email, password) {
    const session = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    setSession(session);
    setUser(session.user);
    return session.user;
  }

  function logout() {
    clearSession();
    setUser(null);
  }

  const value = useMemo(() => ({ user, login, logout }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
