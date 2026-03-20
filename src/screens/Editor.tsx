import { useNavigate, useParams } from "react-router-dom";
import { MousePointer, Square, Circle, Type } from "lucide-react";
import { motion } from "framer-motion";

export default function Editor() {
  const navigate = useNavigate();
  const { id } = useParams();

  return (  
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="h-screen flex flex-col"
    >
      <div className="h-screen flex flex-col">
        <header className="h-14 border-b border-slate-800 flex items-center justify-between px-4">
          <button className="g-blue-600 hover:bg-blue-500 hover:scale-110 active:scale-95 transition-all px-4 py-2 rounded" onClick={() => navigate(-1)}>Назад</button>
          <h1>Редактирование проекта #{id}</h1>
          <button className="g-blue-600 hover:bg-blue-500 hover:scale-110 active:scale-95 transition-all px-4 py-2 rounded" onClick={() => navigate("/")}>Сохранить</button>
        </header>

        <div className="flex flex-1">
          <aside className="w-16 border-r border-slate-800">
            <p>Tools</p>

            <button className="p-2 hover:bg-slate-700 rounded">
              <MousePointer size={20} />
            </button>

            <button className="p-2 hover:bg-slate-700 rounded">
              <Square size={20} />
            </button>

            <button className="p-2 hover:bg-slate-700 rounded">
              <Circle size={20} />
            </button>

            <button className="p-2 hover:bg-slate-700 rounded">
              <Type size={20} />
            </button>
          </aside>

          <main className="flex-1 bg-slate-100 flex items-center justify-center">
            <div className="w-[400px] h-[300px] bg-white shadow" />
          </main>

          <aside className="w-64 border-l border-slate-800">Props</aside>
        </div>
      </div>
    </motion.div>
  );
}