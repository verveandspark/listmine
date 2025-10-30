import { useState, useEffect } from "react";
import {
  firebaseLogin,
  firebaseRegister,
  firebaseLogout,
  onAuthChange,
} from "@/lib/firebaseAuth";
import { auth } from "@/lib/firebase";

export function FirebaseTest() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthChange((firebaseUser) => {
      console.log("[FirebaseTest] Auth state changed:", firebaseUser?.uid);
      setUser(firebaseUser);
    });

    return () => unsubscribe();
  }, []);

  const handleRegister = async () => {
    setLoading(true);
    setMessage("");
    try {
      await firebaseRegister(email, password);
      setMessage("✅ Registration successful!");
      setEmail("");
      setPassword("");
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setMessage("");
    try {
      await firebaseLogin(email, password);
      setMessage("✅ Login successful!");
      setEmail("");
      setPassword("");
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await firebaseLogout();
      setMessage("✅ Logged out!");
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", border: "1px solid blue", margin: "20px" }}>
      <h2>Firebase Test</h2>

      {user ? (
        <div>
          <p>
            ✅ Logged in as: <strong>{user.email}</strong>
          </p>
          <button onClick={handleLogout} disabled={loading}>
            Logout
          </button>
        </div>
      ) : (
        <div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={handleLogin} disabled={loading}>
            Login
          </button>
          <button onClick={handleRegister} disabled={loading}>
            Register
          </button>
        </div>
      )}

      {message && <p>{message}</p>}
    </div>
  );
}
