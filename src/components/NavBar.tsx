import { NavLink } from "react-router-dom";

export default function NavBar() {
  return (
    <nav className="p-4 flex gap-4 border-b border-slate-800">
      <NavLink to="/" className="hover:text-blue-400">
        Gallery
      </NavLink>

      <NavLink to="/editor/new" className="hover:text-blue-400">
        Create
      </NavLink>
    </nav>
  );
}