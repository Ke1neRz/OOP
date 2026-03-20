import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Gallery from "./screens/Gallery";
import Editor from "./screens/Editor";
import NavBar from "./components/NavBar";

function AppRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Gallery />} />
        <Route path="/editor/:id" element={<Editor />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-white">
        <NavBar />
        <AppRoutes />
      </div>
    </BrowserRouter>
  );
}

export default App;