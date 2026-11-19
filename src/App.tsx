import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import * as data from "./lib/data";
import * as api from "./lib/api";
import { Sidebar, type Page } from "./components/bell-ui";
import Dashboard from "./screens/Dashboard";
import Jadwal from "./screens/Jadwal";
import JenisBel from "./screens/JenisBel";
import Pengaturan from "./screens/Pengaturan";
import Suara from "./screens/Suara";
import "./App.css";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function App() {
  const [appData, setAppData] = useState<data.AppData>();
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState<Page>("dashboard");

  // Latest saved data + a queue, so each edit is built on the result of the
  // previous one even when clicks come faster than saves finish.
  const dataRef = useRef<data.AppData | undefined>(undefined);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    api.loadData().then((d) => {
      dataRef.current = d;
      setAppData(d);
    }, (e) => setLoadError(message(e)));
    // Dev only: lets you try the store from DevTools, e.g. await bell.loadData()
    if (import.meta.env.DEV) Object.assign(window, { bell: { ...data, ...api } });
  }, []);

  // Error banner hides itself after a while.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 6000);
    return () => clearTimeout(t);
  }, [error]);

  /** Runs a backend call, showing any failure in the error banner. */
  const run = useCallback((p: Promise<unknown>) => {
    p.catch((e) => setError(message(e)));
  }, []);

  /** Applies `edit` to the latest data and saves it, after any save still in
   *  progress. Resolves to the saved data; rejects (nothing changes) when the
   *  edit is refused or saving fails. */
  const save = useCallback((edit: (d: data.AppData) => data.AppData) => {
    const job = queue.current.then(async () => {
      const next = edit(dataRef.current!);
      await api.saveData(next);
      dataRef.current = next;
      setAppData(next);
      return next;
    });
    queue.current = job.catch(() => {});
    return job;
  }, []);

  /** Like `save`, with errors shown in the banner. */
  const apply = useCallback((edit: (d: data.AppData) => data.AppData) => run(save(edit)), [run, save]);

  if (loadError) return <p className="p-8 font-bold text-coral">Gagal membaca data: {loadError}</p>;
  if (!appData) return null;

  return (
    <div className="flex h-screen">
      <Sidebar page={page} onNavigate={setPage} />
      <main className="relative flex min-w-0 flex-1 flex-col">
        {page === "dashboard" && <Dashboard data={appData} run={run} />}
        {page === "jadwal" && <Jadwal data={appData} save={save} apply={apply} />}
        {page === "jenis" && <JenisBel data={appData} save={save} />}
        {page === "suara" && <Suara data={appData} run={run} />}
        {page === "pengaturan" && <Pengaturan data={appData} save={save} apply={apply} run={run} />}
        {error && (
          <div
            role="alert"
            className="absolute right-7 bottom-6 flex max-w-[480px] items-start gap-3 rounded-xl bg-coral-soft px-4 py-3 text-sm font-bold text-coral shadow-md"
          >
            <span className="flex-1">{error}</span>
            <button type="button" aria-label="Tutup" onClick={() => setError("")}>
              <X className="size-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
