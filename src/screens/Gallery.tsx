import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

type Project = {
  id: string;
  name: string;
  date: string;
};

export default function Gallery() {
  const [projects, setProjects] = useState<Project[]>([]);

  const addProject = () => {
    const newProject = {
      id: Date.now().toString(),
      name: "New Project",
      date: new Date().toLocaleDateString(),
    };

    setProjects([...projects, newProject]);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="p-6"
    >
      <div className="p-6">
      <button
          onClick={addProject}
          className="mb-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-500"
      >
          Создать проект
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {projects.map((p) => (
          <Link key={p.id} to={`/editor/${p.id}`}>
              <motion.div
              whileHover={{ scale: 1.05 }}
              className="p-4 bg-slate-800 rounded-lg"
              >
              <h2>{p.name}</h2>
              <p className="text-slate-400 text-sm">{p.date}</p>
              </motion.div>
          </Link>
          ))}
      </div>
      </div>
    </motion.div>
  );
}