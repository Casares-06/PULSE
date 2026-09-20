import { useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Compass,
  DatabaseZap,
  Disc3,
  FileArchive,
  Flame,
  Headphones,
  History,
  ListMusic,
  LockKeyhole,
  Music2,
  Podcast,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import {
  breakdown,
  daily,
  discoveries,
  longestStreak,
  percentage,
  ranking,
  sessions,
  sumMinutes,
  timeSeries,
} from "./analytics";
import { processSpotifyExport } from "./spotify";
import type { ImportResult, Play, RankingRow } from "./types";

type Page = "Resumen" | "Rankings" | "Historia" | "Hábitos" | "Sesiones" | "Descubrimiento" | "Podcasts" | "Explorar" | "Calidad";

const pages: { name: Page; icon: typeof Activity }[] = [
  { name: "Resumen", icon: Activity },
  { name: "Rankings", icon: BarChart3 },
  { name: "Historia", icon: History },
  { name: "Hábitos", icon: Clock3 },
  { name: "Sesiones", icon: Flame },
  { name: "Descubrimiento", icon: Compass },
  { name: "Podcasts", icon: Podcast },
  { name: "Explorar", icon: Search },
  { name: "Calidad", icon: ShieldCheck },
];

const number = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
const compactDate = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" });
const fullDate = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" });
const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const logoUrl = `${import.meta.env.BASE_URL}logo.svg`;

function formatMinutes(minutes: number) {
  if (minutes >= 60) return `${decimal.format(minutes / 60)} h`;
  return `${decimal.format(minutes)} min`;
}

function Stat({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon: ReactNode }) {
  return (
    <article className="stat-card">
      <div className="stat-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </article>
  );
}

function MiniBars({ data, labels = true }: { data: { label: string; value: number }[]; labels?: boolean }) {
  const visible = data.slice(-18);
  const max = Math.max(...visible.map((point) => point.value), 1);
  return (
    <div className="mini-chart" role="img" aria-label="Gráfico de minutos escuchados">
      {visible.map((point) => (
        <div className="mini-column" key={point.label} title={`${point.label}: ${decimal.format(point.value)} min`}>
          <span className="bar-value">{point.value > max * 0.35 ? number.format(point.value) : ""}</span>
          <div className="bar" style={{ height: `${Math.max(3, (point.value / max) * 100)}%` }} />
          {labels && <small>{point.label.length > 7 ? point.label.slice(2) : point.label}</small>}
        </div>
      ))}
    </div>
  );
}

function RankList({ rows, limit = 10 }: { rows: RankingRow[]; limit?: number }) {
  const top = rows.slice(0, limit);
  const max = top[0]?.minutes || 1;
  return (
    <div className="rank-list">
      {top.map((row, index) => (
        <div className="rank-row" key={row.key}>
          <span className="rank-position">{String(index + 1).padStart(2, "0")}</span>
          <div className="rank-copy">
            <strong>{row.name}</strong>
            {row.secondary && <small>{row.secondary}</small>}
            <div className="rank-track"><span style={{ width: `${(row.minutes / max) * 100}%` }} /></div>
          </div>
          <div className="rank-value">
            <strong>{formatMinutes(row.minutes)}</strong>
            <small>{number.format(row.streams)} reproducciones</small>
          </div>
        </div>
      ))}
    </div>
  );
}

function UploadScreen({ onFile, busy, progress, error }: { onFile: (file: File) => void; busy: boolean; progress: string; error: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const choose = (event: ChangeEvent<HTMLInputElement>) => event.target.files?.[0] && onFile(event.target.files[0]);
  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <main className="welcome-shell">
      <header className="welcome-header">
        <div className="brand"><span className="brand-mark"><img src={logoUrl} alt="" /></span><strong>PULSE</strong></div>
        <div className="privacy-pill"><LockKeyhole size={15} /> Sin cuentas · Sin servidores · 0 €</div>
      </header>
      <section className="welcome-grid">
        <div className="intro-copy">
          <div className="eyebrow"><Sparkles size={15} /> Tu historial, bajo tu control</div>
          <h1>Todo lo que Spotify sabe de tu música. <em>Solo para ti.</em></h1>
          <p>Selecciona tu historial ampliado y descubre años de escucha. El archivo se procesa en la memoria de este navegador: nunca se sube, nunca se guarda.</p>
          <div className="trust-grid">
            <div><ShieldCheck /><span><strong>Privado de verdad</strong><small>Tu archivo nunca se transfiere</small></span></div>
            <div><DatabaseZap /><span><strong>Sin ocupar espacio</strong><small>Se borra al cerrar la pestaña</small></span></div>
            <div><BarChart3 /><span><strong>Análisis completo</strong><small>Rankings, hábitos y evolución</small></span></div>
          </div>
        </div>
        <div
          className={`drop-zone ${dragging ? "dragging" : ""} ${busy ? "busy" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
        >
          <input ref={input} type="file" accept=".zip,application/zip" onChange={choose} hidden />
          <div className="upload-orbit"><FileArchive size={36} /></div>
          <h2>{busy ? "Creando tu Pulse" : "Abre tu exportación de Spotify"}</h2>
          <p>{busy ? progress : "Arrastra aquí el ZIP original o selecciónalo en tu dispositivo."}</p>
          {busy ? <div className="loader"><span /></div> : <button className="primary-button" onClick={() => input.current?.click()}><UploadCloud size={18} /> Seleccionar ZIP</button>}
          <small className="local-note"><LockKeyhole size={13} /> Procesamiento 100 % local · Límite seguro: 250 MB</small>
          {error && <div className="error-box" role="alert">{error}</div>}
        </div>
      </section>
      <footer className="welcome-footer"><span>Creado por <strong>Iñigo Casares</strong></span><span>Código abierto, cálculos transparentes y ningún rastreador.</span></footer>
    </main>
  );
}

function Overview({ plays }: { plays: Play[] }) {
  const music = plays.filter((play) => play.contentType === "track");
  const artists = ranking(music, (p) => p.creator, (p) => p.creator, undefined, (p) => p.uri);
  const tracks = ranking(music, (p) => p.uri, (p) => p.item, (p) => p.creator);
  const days = daily(plays);
  const streak = longestStreak(plays);
  const uniqueTracks = new Set(music.map((play) => play.uri)).size;
  return (
    <>
      <section className="hero-summary">
        <div><span>Tu universo sonoro</span><h1>{number.format(sumMinutes(plays))} <em>minutos</em></h1><p>Entre {compactDate.format(plays[0].at)} y {compactDate.format(plays.at(-1)!.at)}</p></div>
        <div className="pulse-disc"><Disc3 /><span>{plays.at(-1)!.year}</span></div>
      </section>
      <div className="stats-grid">
        <Stat label="Tiempo total" value={`${number.format(sumMinutes(plays) / 60)} h`} hint={`${number.format(sumMinutes(plays) / 60 / 24)} días seguidos`} icon={<Clock3 />} />
        <Stat label="Reproducciones" value={number.format(plays.filter((p) => p.ms >= 30_000).length)} hint="De al menos 30 segundos" icon={<Headphones />} />
        <Stat label="Canciones únicas" value={number.format(uniqueTracks)} hint={`${number.format(artists.length)} artistas`} icon={<Music2 />} />
        <Stat label="Mejor racha" value={`${streak.longest} días`} hint={streak.bestStart ? `${streak.bestStart} — ${streak.bestEnd}` : "—"} icon={<Flame />} />
      </div>
      <section className="panel chart-panel"><div className="panel-heading"><div><span className="kicker">Ritmo histórico</span><h2>Tu escucha por mes</h2></div><CalendarDays /></div><MiniBars data={timeSeries(plays, "month")} /></section>
      <div className="two-column">
        <section className="panel"><div className="panel-heading"><div><span className="kicker">Top artistas</span><h2>Las voces de tu historia</h2></div><span className="panel-total">{artists.length}</span></div><RankList rows={artists} /></section>
        <section className="panel"><div className="panel-heading"><div><span className="kicker">Top canciones</span><h2>Las que más han sonado</h2></div><span className="panel-total">{tracks.length}</span></div><RankList rows={tracks} /></section>
      </div>
      <section className="panel record-day"><span className="kicker">Tu día récord</span><h2>{days[0]?.day}</h2><strong>{formatMinutes(days[0]?.minutes ?? 0)}</strong><p>{number.format(days[0]?.events ?? 0)} eventos registrados</p></section>
    </>
  );
}

function Rankings({ plays }: { plays: Play[] }) {
  const music = plays.filter((play) => play.contentType === "track");
  const artists = ranking(music, (p) => p.creator, (p) => p.creator, undefined, (p) => p.uri);
  const tracks = ranking(music, (p) => p.uri, (p) => p.item, (p) => p.creator);
  const albums = ranking(music, (p) => `${p.creator}\u001f${p.collection}`, (p) => p.collection, (p) => p.creator, (p) => p.uri);
  return <><PageTitle eyebrow="Rankings" title="Tus imprescindibles" copy="Ordenados por tiempo real de escucha, no por simples aperturas." /><div className="three-column"><section className="panel"><h2>Artistas</h2><RankList rows={artists} limit={15} /></section><section className="panel"><h2>Canciones</h2><RankList rows={tracks} limit={15} /></section><section className="panel"><h2>Álbumes</h2><RankList rows={albums} limit={15} /></section></div></>;
}

function HistoryPage({ plays }: { plays: Play[] }) {
  const years = timeSeries(plays, "year");
  const byYear = years.map(({ label, value }) => ({ year: label, minutes: value, artists: new Set(plays.filter((p) => String(p.year) === label).map((p) => p.creator)).size, tracks: new Set(plays.filter((p) => String(p.year) === label && p.contentType === "track").map((p) => p.uri)).size }));
  return <><PageTitle eyebrow="Historia" title="Tu música a través del tiempo" copy="Cada año cuenta una etapa distinta de tu vida musical." /><section className="panel chart-panel"><MiniBars data={years} /></section><section className="panel table-wrap"><table><thead><tr><th>Año</th><th>Minutos</th><th>Horas</th><th>Artistas</th><th>Canciones</th></tr></thead><tbody>{byYear.map((row) => <tr key={row.year}><td><strong>{row.year}</strong></td><td>{number.format(row.minutes)}</td><td>{number.format(row.minutes / 60)}</td><td>{number.format(row.artists)}</td><td>{number.format(row.tracks)}</td></tr>)}</tbody></table></section></>;
}

function Habits({ plays }: { plays: Play[] }) {
  const byHour = timeSeries(plays, "hour").map((p) => ({ ...p, label: `${p.label}h` }));
  const byWeekday = timeSeries(plays, "weekday").map((p) => ({ ...p, label: weekdays[Number(p.label)] }));
  const cards = [{ title: "Plataformas", rows: breakdown(plays, "platform") }, { title: "Países", rows: breakdown(plays, "country") }, { title: "Cómo empiezas", rows: breakdown(plays, "reasonStart") }, { title: "Cómo terminas", rows: breakdown(plays, "reasonEnd") }];
  return <><PageTitle eyebrow="Hábitos" title="Cómo, cuándo y dónde escuchas" copy="Patrones construidos a partir de todas tus reproducciones." /><div className="stats-grid"><Stat label="Modo aleatorio" value={`${decimal.format(percentage(plays, "shuffle"))} %`} icon={<ListMusic />} /><Stat label="Saltadas" value={`${decimal.format(percentage(plays, "skipped"))} %`} icon={<Activity />} /><Stat label="Modo offline" value={`${decimal.format(percentage(plays, "offline"))} %`} icon={<DatabaseZap />} /><Stat label="Sesión privada" value={`${decimal.format(percentage(plays, "incognito"))} %`} icon={<LockKeyhole />} /></div><div className="two-column"><section className="panel"><h2>Horas del día</h2><MiniBars data={byHour} /></section><section className="panel"><h2>Días de la semana</h2><MiniBars data={byWeekday} /></section></div><div className="four-column">{cards.map((card) => <section className="panel breakdown" key={card.title}><h2>{card.title}</h2>{card.rows.slice(0, 6).map((row) => <div key={row.name}><span>{row.name}</span><strong>{formatMinutes(row.minutes)}</strong></div>)}</section>)}</div></>;
}

function SessionsPage({ plays }: { plays: Play[] }) {
  const rows = sessions(plays);
  const days = daily(plays);
  const streak = longestStreak(plays);
  return <><PageTitle eyebrow="Sesiones" title="Rachas y maratones" copy="Una sesión nueva comienza después de 30 minutos sin actividad." /><div className="stats-grid"><Stat label="Sesiones" value={number.format(rows.length)} icon={<Headphones />} /><Stat label="Mejor racha" value={`${streak.longest} días`} icon={<Flame />} /><Stat label="Sesión más larga" value={formatMinutes(rows[0]?.minutes ?? 0)} icon={<Clock3 />} /><Stat label="Día más intenso" value={formatMinutes(days[0]?.minutes ?? 0)} hint={days[0]?.day} icon={<CalendarDays />} /></div><div className="two-column"><section className="panel"><h2>Sesiones principales</h2><div className="simple-list">{rows.slice(0, 15).map((row, i) => <div key={row.id}><span>{i + 1}</span><p><strong>{fullDate.format(row.start)}</strong><small>{row.events} eventos · {row.artists.size} artistas</small></p><b>{formatMinutes(row.minutes)}</b></div>)}</div></section><section className="panel"><h2>Días principales</h2><div className="simple-list">{days.slice(0, 15).map((row, i) => <div key={row.day}><span>{i + 1}</span><p><strong>{row.day}</strong><small>{row.events} eventos</small></p><b>{formatMinutes(row.minutes)}</b></div>)}</div></section></div></>;
}

function Discovery({ plays }: { plays: Play[] }) {
  const music = plays.filter((p) => p.contentType === "track");
  const artists = discoveries(music, "creator");
  const tracks = discoveries(music, "uri");
  const first = [...new Map(music.map((p) => [p.creator, p])).values()].slice(0, 20);
  return <><PageTitle eyebrow="Descubrimiento" title="Cuándo creció tu universo musical" copy="La primera aparición registrada de cada artista y canción." /><div className="two-column"><section className="panel"><h2>Nuevos artistas por mes</h2><MiniBars data={artists} /></section><section className="panel"><h2>Nuevas canciones por mes</h2><MiniBars data={tracks} /></section></div><section className="panel"><h2>Tus primeros artistas registrados</h2><div className="artist-cloud">{first.map((play, i) => <span key={play.creator}><b>{i + 1}</b>{play.creator}<small>{play.day}</small></span>)}</div></section></>;
}

function Podcasts({ plays }: { plays: Play[] }) {
  const podcasts = plays.filter((p) => p.contentType === "episode");
  const shows = ranking(podcasts, (p) => p.creator, (p) => p.creator, undefined, (p) => p.uri);
  const episodes = ranking(podcasts, (p) => p.uri, (p) => p.item, (p) => p.creator);
  return <><PageTitle eyebrow="Podcasts" title="Tus historias habladas" copy={podcasts.length ? `${number.format(podcasts.length)} eventos de podcast encontrados.` : "No hay episodios de podcast en este período."} /><div className="stats-grid"><Stat label="Tiempo en podcasts" value={formatMinutes(sumMinutes(podcasts))} icon={<Podcast />} /><Stat label="Programas" value={number.format(shows.length)} icon={<ListMusic />} /><Stat label="Episodios" value={number.format(episodes.length)} icon={<Headphones />} /></div>{podcasts.length > 0 && <div className="two-column"><section className="panel"><h2>Programas</h2><RankList rows={shows} limit={15} /></section><section className="panel"><h2>Episodios</h2><RankList rows={episodes} limit={15} /></section></div>}</>;
}

function Explorer({ plays }: { plays: Play[] }) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("es");
  const matches = normalized ? plays.filter((p) => `${p.item} ${p.creator} ${p.collection}`.toLocaleLowerCase("es").includes(normalized)).slice().reverse().slice(0, 100) : plays.slice().reverse().slice(0, 100);
  return <><PageTitle eyebrow="Explorar" title="Busca dentro de tu historia" copy="Los resultados permanecen únicamente en la memoria de esta pestaña." /><label className="search-box"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Canción, artista, álbum o podcast…" /></label><section className="panel table-wrap"><table><thead><tr><th>Fecha</th><th>Contenido</th><th>Artista / programa</th><th>Escucha</th></tr></thead><tbody>{matches.map((play) => <tr key={play.id}><td>{fullDate.format(play.at)}</td><td><strong>{play.item}</strong><small className="table-sub">{play.collection}</small></td><td>{play.creator}</td><td>{formatMinutes(play.minutes)}</td></tr>)}</tbody></table></section></>;
}

function Quality({ result }: { result: ImportResult }) {
  const ratio = result.compressedBytes ? result.expandedBytes / result.compressedBytes : 0;
  return <><PageTitle eyebrow="Calidad" title="Qué hemos contado y cómo" copy="Pulse elimina duplicados exactos y conserva reproducciones cortas para que puedas distinguir tiempo, eventos y streams de 30 segundos." /><div className="stats-grid"><Stat label="Registros originales" value={number.format(result.rawAudioRecords)} icon={<FileArchive />} /><Stat label="Registros analizados" value={number.format(result.plays.length)} icon={<CheckCircle2 />} /><Stat label="Duplicados retirados" value={number.format(result.duplicateRecords)} icon={<DatabaseZap />} /><Stat label="Fechas no válidas" value={number.format(result.invalidRecords)} icon={<Activity />} /></div><div className="two-column"><section className="panel methodology"><h2>Privacidad verificable</h2><ul><li>El ZIP no se envía a ninguna dirección.</li><li>No utilizamos cookies, cuentas ni herramientas de seguimiento.</li><li>No escribimos el historial en almacenamiento local.</li><li>Al cerrar o recargar, los datos desaparecen de la memoria.</li></ul></section><section className="panel methodology"><h2>Archivo importado</h2><dl><div><dt>JSON detectados</dt><dd>{result.sourceFiles.length}</dd></div><div><dt>Vídeos separados</dt><dd>{number.format(result.videoRecords)}</dd></div><div><dt>Tamaño del ZIP</dt><dd>{decimal.format(result.compressedBytes / 1_048_576)} MB</dd></div><div><dt>Expansión declarada</dt><dd>{decimal.format(ratio)}×</dd></div><div><dt>Zona horaria</dt><dd>{Intl.DateTimeFormat().resolvedOptions().timeZone}</dd></div></dl></section></div><section className="panel file-list"><h2>Archivos de historial encontrados</h2>{result.sourceFiles.map((name) => <span key={name}><CheckCircle2 />{name}</span>)}</section></>;
}

function PageTitle({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <header className="page-title"><span className="kicker">{eyebrow}</span><h1>{title}</h1><p>{copy}</p></header>;
}

function Dashboard({ result, onReset }: { result: ImportResult; onReset: () => void }) {
  const [page, setPage] = useState<Page>("Resumen");
  const years = useMemo(() => [...new Set(result.plays.map((p) => p.year))].sort((a, b) => b - a), [result.plays]);
  const [year, setYear] = useState("all");
  const filtered = useMemo(() => year === "all" ? result.plays : result.plays.filter((p) => p.year === Number(year)), [result.plays, year]);
  const content: Record<Page, ReactNode> = {
    Resumen: <Overview plays={filtered} />,
    Rankings: <Rankings plays={filtered} />,
    Historia: <HistoryPage plays={filtered} />,
    Hábitos: <Habits plays={filtered} />,
    Sesiones: <SessionsPage plays={filtered} />,
    Descubrimiento: <Discovery plays={filtered} />,
    Podcasts: <Podcasts plays={filtered} />,
    Explorar: <Explorer plays={filtered} />,
    Calidad: <Quality result={result} />,
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><img src={logoUrl} alt="" /></span><strong>PULSE</strong></div>
        <nav>{pages.map(({ name, icon: Icon }) => <button key={name} className={page === name ? "active" : ""} onClick={() => setPage(name)}><Icon /> <span>{name}</span></button>)}</nav>
        <div className="sidebar-foot"><p className="creator-credit">Creado por<br /><strong>Iñigo Casares</strong></p><div><LockKeyhole /><span><strong>Solo en memoria</strong><small>Nada se ha subido</small></span></div><button onClick={onReset}><RotateCcw /> Cerrar historial</button></div>
      </aside>
      <main className="dashboard">
        <header className="topbar"><div><span className="live-dot" /> Historial listo <small>{number.format(result.plays.length)} registros</small></div><label>Período<select value={year} onChange={(e) => setYear(e.target.value)}><option value="all">Todo el historial</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></header>
        <div className="mobile-nav">{pages.map(({ name, icon: Icon }) => <button aria-label={name} title={name} key={name} className={page === name ? "active" : ""} onClick={() => setPage(name)}><Icon /></button>)}</div>
        <div className="content">{filtered.length ? content[page] : <div className="empty-state"><Music2 /><h2>No hay escuchas en este período</h2><p>Prueba con otro año.</p></div>}</div>
      </main>
    </div>
  );
}

export default function App() {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const handleFile = async (file: File) => {
    setError("");
    if (!file.name.toLocaleLowerCase().endsWith(".zip")) {
      setError("Selecciona el archivo ZIP original que te entregó Spotify.");
      return;
    }
    setBusy(true);
    setProgress("Comprobando el archivo…");
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      setResult(await processSpotifyExport(file, setProgress));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo analizar el archivo.");
    } finally {
      setBusy(false);
    }
  };

  return result ? <Dashboard result={result} onReset={() => setResult(null)} /> : <UploadScreen onFile={handleFile} busy={busy} progress={progress} error={error} />;
}
