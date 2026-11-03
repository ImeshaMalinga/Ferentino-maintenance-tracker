import { useEffect, useState } from 'react';
import {
  Link,
  NavLink,
  Route,
  Routes,
  useParams,
} from 'react-router-dom';
import {
  CalendarDays,
  ClipboardList,
  Edit3,
  FileUp,
  LayoutDashboard,
  Menu,
  X,
} from 'lucide-react';
import { api, Activity, Machine, Summary } from './api';

const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(value))
    : '—';

function Layout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const links = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/machines', label: 'Machines', icon: ClipboardList },
    { to: '/calendar', label: 'Calendar', icon: CalendarDays },
    { to: '/import', label: 'Import schedule', icon: FileUp },
  ];

  return (
    <div className="app">
      <header>
        <Link to="/" className="brand">
          <span className="brand-mark">F</span>
          <span>Ferentino PM Tracker</span>
        </Link>
        <button
          className="menu"
          onClick={() => setOpen(!open)}
          aria-label="Toggle navigation"
        >
          {open ? <X /> : <Menu />}
        </button>
      </header>
      <aside className={open ? 'open' : ''}>
        <nav>
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main>{children}</main>
      <footer>
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}>
            <Icon size={19} />
            <small>{label.split(' ')[0]}</small>
          </NavLink>
        ))}
      </footer>
    </div>
  );
}

function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  useEffect(() => {
    api
      .get('/dashboard/summary')
      .then((response) => setSummary(response.data))
      .catch(console.error);
  }, []);
 
  const cards = summary
    ? [
        ['Machines', summary.machines, 'navy'],
        ['Scheduled', summary.scheduled, 'blue'],
        ['Completed', summary.done, 'green'],
        ['Overdue', summary.overdue, 'red'],
      ]
    : [];
  const total=summary
    ? summary.scheduled + summary.done + summary.overdue
    : 0;
  
  
  const radius = 50;
  const circumference = 2 * Math.PI * radius; // Approx 314.16

  // 3. Define the slices array with your metrics
  const slices = summary ? [
    { label: "Scheduled", value: summary.scheduled, color: "blue" }, // Replace colors as needed
    { label: "Completed", value: summary.done, color: "green" },
    { label: "Overdue", value: summary.overdue, color: "red" },
  ]: [];

  let accumulatedLength = 0;
  
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Operations overview</p>
          <h1>Good morning</h1>
          <p className="muted">Keep every machine ready for production.</p>
        </div>
        <Link className="button" to="/import">
          <FileUp size={17} />
          Import Excel
        </Link>
      </div>
      <section className="cards">
        {cards.map(([label, value, tone]) => (
          <div className={`stat ${tone}`} key={label}>
            <span style={{fontSize:20, fontWeight:'bolder'}}>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">Work status</p>
            <h2>Scheduled, done and to do</h2>
          </div>
        </div>
        {summary ? (
          <svg
            viewBox="0 0 140 140"
            width="140"
            height="140"
            style={{ transform: 'rotate(-90deg)' }}
            display='flex'
            justify-content= 'center'
          >
            {slices.map((slice) => {
              const percentage = slice.value / total;
              const strokeLength = percentage * circumference;

              const strokeOffset = -accumulatedLength;

              accumulatedLength += strokeLength;

              return (
                <circle
                  key={slice.label}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth="20"
                  strokeDasharray={`${strokeLength} ${circumference}`}
                  strokeDashoffset={strokeOffset}
                />
              );
            })}
          </svg>
        ) : (
          <Empty text="Loading work status..." />
        )}
      </section>
    </>
  );
}

function Machines() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api
      .get('/machines', { params: { search } })
      .then((response) => setMachines(response.data))
      .catch(console.error);
  }, [search]);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Asset register</p>
          <h1>Machines</h1>
          <p className="muted">{machines.length} machines in your register</p>
        </div>
      </div>
      <input
        className="search"
        placeholder="Search by machine, code, or serial number"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="machine-grid">
        {machines.map((machine) => (
          <Link
            className="machine-card"
            to={`/machines/${machine.id}`}
            key={machine.id}
          >
            <div className="machine-icon">⚙</div>
            <div>
              <h3>{machine.machineName}</h3>
              <p>
                {machine.machineCode ?? 'No machine code'} ·{' '}
                {machine.serialNumber ?? 'No serial number'}
              </p>
            </div>
            <div className="machine-meta">
              <span>{machine.scheduledCount} scheduled</span>
              <span>Next: {date(machine.nextDate)}</span>
            </div>
          </Link>
        ))}
      </div>
      {!machines.length && <Empty text="No machines match your search." />}
    </>
  );
}

function Calendar() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [month, setMonth] = useState(11);
  const [year, setYear] = useState(2026);

  useEffect(() => {
    api
      .get('/calendar', { params: { month, year } })
      .then((response) => setActivities(response.data))
      .catch(console.error);
  }, [month, year]);

  const days = new Map<string, Activity[]>();
  activities.forEach((item) => {
    const key = item.scheduledDate.slice(0, 10);
    days.set(key, [...(days.get(key) ?? []), item]);
  });

  const total = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Planning</p>
          <h1>Calendar</h1>
          <p className="muted">Planned and actual work by date.</p>
        </div>
        <div className="month-picker">
          <button
            onClick={() =>
              month === 1
                ? (setMonth(12), setYear(year - 1))
                : setMonth(month - 1)
            }
          >
            ‹
          </button>
          <strong>
            {new Intl.DateTimeFormat(undefined, {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            }).format(new Date(Date.UTC(year, month - 1, 1)))}
          </strong>
          <button
            onClick={() =>
              month === 12
                ? (setMonth(1), setYear(year + 1))
                : setMonth(month + 1)
            }
          >
            ›
          </button>
        </div>
      </div>
      <div className="calendar">
        {Array.from({ length: total }, (_, i) => {
          const key = `${year}-${String(month).padStart(2, '0')}-${String(
            i + 1,
          ).padStart(2, '0')}`;
          const items = days.get(key) ?? [];

          return (
            <div
              className={`day ${items.length ? 'has-items' : ''}`}
              key={key}
            >
              <b>{i + 1}</b>
              {items.slice(0, 3).map((item) => (
                <span
                  className={item.maintenanceStatus.toLowerCase()}
                  key={item.id}
                >
                  {item.maintenanceType}
                </span>
              ))}
              {items.length > 3 && <small>+{items.length - 3} more</small>}
            </div>
          );
        })}
      </div>
    </>
  );
}
function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [message, setMessage] = useState('');

  const previewFile = async () => {
    if (!file) return;

    const form = new FormData();
    form.append('file', file);

    try {
      setPreview((await api.post('/import/preview', form)).data);
    } catch (error: any) {
      setMessage(
        error.response?.data?.error ?? 'Could not parse workbook.',
      );
    }
  };

  const confirm = async () => {
    try {
      await api.post('/import/confirm', {
        fileName: file?.name,
        parsed: preview,
        replace: window.confirm('Replace this month if it already exists?'),
      });
      setMessage('Schedule imported successfully.');
      setPreview(null);
    } catch (error: any) {
      setMessage(error.response?.data?.error ?? 'Import failed.');
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Data management</p>
          <h1>Import schedule</h1>
          <p className="muted">
            Upload a monthly Excel schedule and preview it before saving.
          </p>
        </div>
      </div>
      <section className="panel upload-panel">
        <label className="dropzone">
          <FileUp size={32} />
          <strong>{file ? file.name : 'Drop an Excel file here'}</strong>
          <span>or choose a .xlsx file from your device</span>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(event) =>
              setFile(event.target.files?.[0] ?? null)
            }
          />
        </label>
        <button className="button" disabled={!file} onClick={previewFile}>
          Process workbook
        </button>
        {message && <p className="message">{message}</p>}
        {preview && (
          <div className="preview">
            <h2>Import preview</h2>
            <div className="preview-stats">
              <span>
                <strong>{preview.machines.length}</strong> machines
              </span>
              <span>
                <strong>
                  {
                    preview.activities.filter(
                      (x: Activity) => x.status === 'PLAN',
                    ).length
                  }
                </strong>{' '}
                planned
              </span>
              <span>
                <strong>
                  {
                    preview.activities.filter(
                      (x: Activity) => x.status === 'ACTUAL',
                    ).length
                  }
                </strong>{' '}
                actual
              </span>
            </div>
            {preview.warnings.map((warning: { message: string }) => (
              <p className="warning" key={warning.message}>
                ⚠ {warning.message}
              </p>
            ))}
            <button className="button success" onClick={confirm}>
              Confirm import
            </button>
          </div>
        )}
      </section>
    </>
  );
}

function MachineDetails() {
  const { id } = useParams();
  const [machine, setMachine] = useState<Machine | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!id) return;

    Promise.all([
      api.get('/machines'),
      api.get(`/machines/${id}/maintenance`),
    ])
      .then(([machines, records]) => {
        setMachine(
          machines.data.find((item: Machine) => item.id === id) ?? null,
        );
        setActivities(records.data);
      })
      .catch(console.error);
  }, [id]);

  const save = async (item: Activity, form: FormData) => {
    setSaving(item.id);
    setMessage('');

    const payload = {
      completionDate: form.get('completionDate') || null,
      completedBy: form.get('completedBy') || null,
      actualStartTime: form.get('actualStartTime') || null,
      actualEndTime: form.get('actualEndTime') || null,
    };

    try {
      const response = await api.patch(`/maintenance/${item.id}`, payload);
      setActivities((current) =>
        current.map((activity) =>
          activity.id === item.id ? response.data : activity,
        ),
      );
      setEditing(null);
      setMessage('Maintenance details saved.');
    } catch (error: any) {
      setMessage(
        error.response?.data?.error ??
          'Could not save maintenance details.',
      );
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Asset history</p>
          <h1>{machine?.machineName ?? 'Machine details'}</h1>
          <p className="muted">
            {machine?.machineCode ?? 'No machine code'} ·{' '}
            {machine?.serialNumber ?? 'No serial number'}
          </p>
        </div>
        <Link className="button" to="/machines">
          Back to machines
        </Link>
      </div>
      {message && <p className="message">{message}</p>}
      <section className="panel">
        <div className="panel-title">
          <h2>Maintenance timeline</h2>
          <span className="muted">{activities.length} records</span>
        </div>
        {activities.length ? (
          <div className="activity-list">
            {activities.map((item) => (
              <div className="maintenance-editor" key={item.id}>
                <div className="activity">
                  <span
                    className={`status-dot ${item.maintenanceStatus.toLowerCase()}`}
                  />
                  <div>
                    <strong>{item.maintenanceType}</strong>
                    <small>
                      Scheduled: {date(item.scheduledDate)} ·{' '}
                      {item.maintenanceStatus === 'ACTUAL'
                        ? 'Completed'
                        : 'Planned'}
                    </small>
                    {(item.completionDate ||
                      item.completedBy ||
                      item.actualStartTime ||
                      item.actualEndTime) && (
                      <div className="completion-details">
                        <span>
                          <b>Done:</b>{' '}
                          {item.completionDate
                            ? date(item.completionDate)
                            : 'Date not set'}
                        </span>
                        {item.completedBy && (
                          <span>
                            <b>By:</b> {item.completedBy}
                          </span>
                        )}
                        {(item.actualStartTime || item.actualEndTime) && (
                          <span>
                            <b>Time:</b>{' '}
                            {item.actualStartTime?.slice(11, 16) ?? '—'} -{' '}
                            {item.actualEndTime?.slice(11, 16) ?? '—'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => setEditing(item)}
                    aria-label={`Edit ${item.maintenanceType} maintenance`}
                    title="Edit maintenance"
                  >
                    <Edit3 size={17} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty text="No maintenance history is available for this machine." />
        )}
      </section>
      {editing && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditing(null);
          }}
        >
          <form
            className="modal"
            onSubmit={(event) => {
              event.preventDefault();
              void save(editing, new FormData(event.currentTarget));
            }}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Edit maintenance</p>
                <h2>{editing.maintenanceType}</h2>
                <p className="muted">
                  Scheduled: {date(editing.scheduledDate)}
                </p>
              </div>
              <button
                className="close-button"
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="editor-grid">
              <label>
                Done date
                <input
                  name="completionDate"
                  type="date"
                  defaultValue={editing.completionDate?.slice(0, 10) ?? ''}
                />
              </label>
              <label>
                Done by
                <input
                  name="completedBy"
                  type="text"
                  defaultValue={editing.completedBy ?? ''}
                  placeholder="Person or team"
                />
              </label>
              <label>
                From time
                <input
                  name="actualStartTime"
                  type="time"
                  defaultValue={editing.actualStartTime?.slice(11, 16) ?? ''}
                />
              </label>
              <label>
                To time
                <input
                  name="actualEndTime"
                  type="time"
                  defaultValue={editing.actualEndTime?.slice(11, 16) ?? ''}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                className="button secondary"
                type="button"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                className="button"
                disabled={saving === editing.id}
                type="submit"
              >
                {saving === editing.id ? 'Saving…' : 'Save details'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/machines" element={<Machines />} />
        <Route path="/machines/:id" element={<MachineDetails />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/import" element={<ImportPage />} />
      </Routes>
    </Layout>
  );
}
