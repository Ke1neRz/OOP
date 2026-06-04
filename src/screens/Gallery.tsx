import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { loadProjectIndex, saveProject, isTauriAvailable } from "../lib/projectStorage";

type Project = {
  id: string;
  name: string;
  date: string;
};

export default function Gallery() {
  const [projects, setProjects] = useState<Project[]>([]);
  const navigate = useNavigate();

  const refreshProjects = async () => {
    const index = await loadProjectIndex();
    setProjects(
      index.map((p) => ({
        id: p.id,
        name: p.name,
        date: new Date(p.updatedAt).toLocaleDateString(),
      }))
    );
  };

  useEffect(() => {
    refreshProjects();
  }, []);

  const addProject = async () => {
    const newId = Date.now().toString();
    const name = "New Project";
    await saveProject(newId, name, "bresenham", []);
    await refreshProjects();
    navigate(`/editor/${newId}`);
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
        {!isTauriAvailable() && (
          <div className="mb-4 p-2 bg-yellow-700/40 text-yellow-200 text-xs rounded border border-yellow-600/50">
            Приложение запущено в браузере. Для работы с файловой системой запустите <code className="bg-yellow-900/50 px-1 rounded">npm run tauri dev</code>.<br/>
            Сейчас проекты сохраняются во временное хранилище (localStorage).
          </div>
        )}
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
          {projects.length === 0 && (
            <div className="text-slate-400 text-sm col-span-full">
              Нет сохранённых проектов. Создайте первый проект!
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
