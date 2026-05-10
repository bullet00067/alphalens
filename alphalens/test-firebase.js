import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
};

try {
  const app = initializeApp(firebaseConfig);
  console.log("App initialized");
  const auth = getAuth(app);
  console.log("Auth initialized");
} catch(e) {
  console.error("CRASH:", e.message);
}
