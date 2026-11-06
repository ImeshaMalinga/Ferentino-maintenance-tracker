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
  Download,
  Edit3,
  FileUp,
  LayoutDashboard,
  Menu,
  Trash2,
  X,
} from 'lucide-react';
import {
  AdditionalMaintenance,
  api,
  Activity,
  Machine,
  Summary,
} from './api';

const MECHANICAL_TYPES = ['MM', '3MM', '6MM', 'AM', 'WM'];
const ELECTRICAL_TYPES = ['ME', '3ME', '6ME', 'AE'];
const STATUS_COLORS = ['#25a244', '#f1c40f', '#e65618', '#1d4ed8'];

function MaintenancePie({
  title,
  types,
  counts,
  colors,
}: {
  title: string;
  types: string[];
  counts: Record<string, number>;
  colors: string[];
}) {
  const total = types.reduce((sum, type) => sum + (counts[type] ?? 0), 0);
  let offset = 0;
  const gradient = total
    ? types.map((type, index) => {
        const start = offset;
        offset += ((counts[type] ?? 0) / total) * 100;
        return `${colors[index]} ${start}% ${offset}%`;
      }).join(', ')
    : '#e5eaf0 0 100%';

  return (
    <div className="chart-card">
      <h3>{title}</h3>
      <div
        className="pie-chart"
        style={{ background: `conic-gradient(${gradient})` }}
        role="img"
        aria-label={`${title}: ${total} maintenance records`}
      />
      <div className="chart-legend">
        {types.map((type, index) => (
          <span key={type}>
            <i style={{ background: colors[index] }} />
            {type} <b>{counts[type] ?? 0}</b>
          </span>
        ))}
      </div>
      <strong className="chart-total">{total} records</strong>
    </div>
  );
}

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
  const now = new Date();
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [year, setYear] = useState(now.getUTCFullYear());

  useEffect(() => {
    api
      .get('/dashboard/summary', { params: { month, year } })
      .then((response) => setSummary(response.data))
      .catch(console.error);
  }, [month, year]);

  const changeMonth = (offset: number) => {
    const next = new Date(Date.UTC(year, month - 1 + offset, 1));
    setMonth(next.getUTCMonth() + 1);
    setYear(next.getUTCFullYear());
  };

  const reportMonth = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  const escapeHtml = (value: unknown) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const formatReportDate = (value: string | null) =>
    value ? date(value) : '—';

  const loadReport = async () => {
    const response = await api.get('/reports/monthly', {
      params: { month, year },
    });
    return response.data;
  };

  const reportMarkup = (report: any) => {
    const statuses = ['Done', 'Overdue', 'Not done', 'Scheduled maintenance'];
    const chartRows = (['mechanical', 'electrical', 'all'] as const)
      .map((discipline) => {
        const counts = summary?.maintenanceStatusCounts[discipline];
        return `<tr><th>${discipline[0].toUpperCase()}${discipline.slice(
          1,
        )}</th>${statuses
          .map(
            (status) =>
              `<td>${escapeHtml(counts?.[status] ?? 0)}</td>`,
          )
          .join('')}</tr>`;
      })
      .join('');
    const machineSections = report.machines
      .map(
        (machine: any) => `
          <section class="machine">
            <h2>${escapeHtml(machine.machineName)}</h2>
            <p class="meta">${escapeHtml(machine.machineCode ?? 'No machine code')} ·
              ${escapeHtml(machine.serialNumber ?? 'No serial number')}</p>
            <h3>Maintenance</h3>
            ${
              machine.maintenance.length
                ? `<table><thead><tr><th>Type</th><th>Status</th><th>Scheduled</th><th>Completion date</th><th>Completed by</th><th>Time</th></tr></thead><tbody>${machine.maintenance
                    .map(
                      (item: any) => `<tr>
                        <td>${escapeHtml(item.maintenanceType)}</td>
                        <td>${escapeHtml(item.maintenanceStatus === 'ACTUAL' ? 'Done' : 'Planned')}</td>
                        <td>${escapeHtml(formatReportDate(item.scheduledDate))}</td>
                        <td>${escapeHtml(formatReportDate(item.completionDate))}</td>
                        <td>${escapeHtml(item.completedBy ?? '—')}</td>
                        <td>${escapeHtml(
                          item.actualStartTime || item.actualEndTime
                            ? `${item.actualStartTime?.slice(11, 16) ?? '—'} - ${item.actualEndTime?.slice(11, 16) ?? '—'}`
                            : '—',
                        )}</td>
                      </tr>`,
                    )
                    .join('')}</tbody></table>`
                : '<p>No maintenance records.</p>'
            }
            <h3>Additional maintenance</h3>
            ${
              machine.additionalMaintenance.length
                ? `<table><thead><tr><th>Discipline</th><th>Description</th><th>Status</th><th>Completed by</th><th>Completion date</th></tr></thead><tbody>${machine.additionalMaintenance
                    .map(
                      (item: any) => `<tr>
                        <td>${escapeHtml(item.discipline)}</td>
                        <td>${escapeHtml(item.description)}</td>
                        <td>${item.isCompleted ? 'Done' : 'Open'}</td>
                        <td>${escapeHtml(item.completedBy ?? '—')}</td>
                        <td>${escapeHtml(formatReportDate(item.completionDate))}</td>
                      </tr>`,
                    )
                    .join('')}</tbody></table>`
                : '<p>No additional maintenance.</p>'
            }
          </section>`,
      )
      .join('');

    return `<!doctype html><html><head><meta charset="utf-8"><title>Maintenance report - ${escapeHtml(
      reportMonth,
    )}</title><style>
      body{font-family:Arial,sans-serif;color:#172b42;margin:32px}
      h1{margin-bottom:4px} h2{border-bottom:2px solid #dbe3eb;padding-bottom:6px}
      h3{margin-bottom:6px;color:#426078}.meta{color:#607085}
      table{border-collapse:collapse;width:100%;margin:8px 0 22px;font-size:12px}
      th,td{border:1px solid #dbe3eb;padding:7px;text-align:left}
      th{background:#f1f5f9}.machine{page-break-inside:avoid;margin-top:26px}
      .summary td,.summary th{text-align:center}.summary th:first-child{text-align:left}
      .note{color:#607085;font-size:12px}
      @media print{body{margin:18px}.machine{page-break-inside:avoid}}
    </style></head><body>
      <h1>Maintenance report</h1><p class="meta">${escapeHtml(reportMonth)}</p>
      <h2>Status summary</h2>
      <table class="summary"><thead><tr><th>Discipline</th>${statuses
        .map((status) => `<th>${status}</th>`)
        .join('')}</tr></thead><tbody>${chartRows}</tbody></table>
      <p class="note">Completion details include the user edits recorded for each maintenance item.</p>
      ${machineSections || '<p>No machines found for this month.</p>'}
    </body></html>`;
  };

  const downloadWordReport = async () => {
    try {
      const report = await loadReport();
      const blob = new Blob([reportMarkup(report)], {
        type: 'application/msword',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `maintenance-report-${year}-${String(month).padStart(2, '0')}.doc`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
    }
  };

  const printPdfReport = async () => {
    try {
      const report = await loadReport();
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      printWindow.document.write(reportMarkup(report));
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } catch (error) {
      console.error(error);
    }
  };
 
  const cards = summary
    ? [
        ['Machines', summary.machines, 'navy'],
        ['Scheduled', summary.scheduled, 'blue'],
        ['Completed', summary.done, 'green'],
        ['Overdue', summary.overdue, 'yellow'],
        ['not Done', summary.notDone, 'red'],
      ]
    : [];
  
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Operations overview</p>
          <h1>Good morning</h1>
          <p className="muted">Keep every machine ready for production.</p>
        </div>
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
            <p className="eyebrow" style={{fontSize:20, fontWeight:'bolder'}}>Maintenance status</p>
          </div>
        </div>
        {summary ? (
          <div className="chart-grid">
            <MaintenancePie
              title="Mechanical"
              types={['Done', 'Overdue', 'Not done', 'Scheduled maintenance']}
              counts={summary.maintenanceStatusCounts.mechanical}
              colors={STATUS_COLORS}
            />
            <MaintenancePie
              title="Electrical"
              types={['Done', 'Overdue', 'Not done', 'Scheduled maintenance']}
              counts={summary.maintenanceStatusCounts.electrical}
              colors={STATUS_COLORS}
            />
            <MaintenancePie
              title="All maintenance"
              types={['Done', 'Overdue', 'Not done', 'Scheduled maintenance']}
              counts={summary.maintenanceStatusCounts.all}
              colors={STATUS_COLORS}
            />
          </div>
        ) : (
          <Empty text="Loading work status..." />
        )}
      </section>
      <section className="panel report-panel">
        <div className="panel-title" >
          <div>
            <p className="eyebrow">Reports</p>
            <h2>Download maintenance report</h2>
          </div>
          <Download size={24} aria-hidden="true" />
        </div>
        <div className="report-actions">
          <button className="button" type="button" onClick={() => void downloadWordReport()}>
            Download Word
          </button>
          <button className="button secondary" type="button" onClick={() => void printPdfReport()}>
            Print / Save PDF
          </button>
        </div>
      </section>
      <div className="month-picker dashboard-month-picker" aria-label="Dashboard month" style={{marginTop:20}}>
        <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">
          ‹
        </button>
        <strong>
          {new Intl.DateTimeFormat(undefined, {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          }).format(new Date(Date.UTC(year, month - 1, 1)))}
        </strong>
        <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">
          ›
        </button>
      </div>
    </>
  );
}

function Machines() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [search, setSearch] = useState('');
  const now = new Date();
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [year, setYear] = useState(now.getUTCFullYear());

  useEffect(() => {
    api
      .get('/machines', { params: { search, month, year } })
      .then((response) => setMachines(response.data))
      .catch(console.error);
  }, [search, month, year]);

  const changeMonth = (offset: number) => {
    const next = new Date(Date.UTC(year, month - 1 + offset, 1));
    setMonth(next.getUTCMonth() + 1);
    setYear(next.getUTCFullYear());
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Asset register</p>
          <h1>Machines</h1>
          <p className="muted">{machines.length} machines in your register</p>
        </div>
        <div className="month-picker" aria-label="Machine schedule month">
          <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">
            ‹
          </button>
          <strong>
            {new Intl.DateTimeFormat(undefined, {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            }).format(new Date(Date.UTC(year, month - 1, 1)))}
          </strong>
          <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">
            ›
          </button>
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
          <MachineCard machine={machine} key={machine.id} />
        ))}
      </div>
      {!machines.length && <Empty text="No machines match your search." />}
    </>
  );
}

function MachineCard({ machine }: { machine: Machine }) {
  const [discipline, setDiscipline] = useState<'Mechanical' | 'Electrical'>(
    'Mechanical',
  );
  const isMechanical = discipline === 'Mechanical';
  const types = isMechanical ? MECHANICAL_TYPES : ELECTRICAL_TYPES;
  const count = isMechanical ? machine.mechanicalCount : machine.electricalCount;
  const hasRecords = types.some(
    (type) => (machine.maintenanceTypeCounts[type] ?? 0) > 0,
  );

  return (
    <Link className="machine-card" to={`/machines/${machine.id}`}>
      <div className="machine-icon">⚙</div>
      <div>
        <h3>{machine.machineName}</h3>
        <p>
          {machine.machineCode ?? 'No machine code'} ·{' '}
          {machine.serialNumber ?? 'No serial number'}
        </p>
      </div>
    </Link>
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
              {items.slice(0, 50).map((item) => (
                <span
                  className={(() => {
                    if (item.maintenanceStatus === 'ACTUAL') return 'actual';
                    const currentMonth = new Date();
                    const recordMonth = new Date(item.scheduledDate);
                    const recordMonthKey =
                      recordMonth.getUTCFullYear() * 12 + recordMonth.getUTCMonth();
                    const currentMonthKey =
                      currentMonth.getUTCFullYear() * 12 + currentMonth.getUTCMonth();
                    if (recordMonthKey < currentMonthKey) return 'not-done';
                    const today = new Date(
                      Date.UTC(
                        currentMonth.getUTCFullYear(),
                        currentMonth.getUTCMonth(),
                        currentMonth.getUTCDate(),
                      ),
                    );
                    if (new Date(item.scheduledDate) < today) return 'overdue';
                    return 'plan';
                  })()}
                  key={item.id}
                >
                  {item.maintenanceType}
                </span>
              ))}
              {items.length > 50 && <small>+{items.length - 50} more</small>}
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
  const [additionalMaintenance, setAdditionalMaintenance] = useState<
    AdditionalMaintenance[]
  >([]);
  const [discipline, setDiscipline] = useState<'Mechanical' | 'Electrical'>(
    'Mechanical',
  );
  const [additionalDiscipline, setAdditionalDiscipline] =
    useState<AdditionalMaintenance['discipline']>('MECHANICAL');
  const [editingAdditional, setEditingAdditional] =
    useState<AdditionalMaintenance | null>(null);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!id) return;

    Promise.all([api.get('/machines'), api.get(`/machines/${id}`)])
      .then(([machines, records]) => {
        setMachine(
          machines.data.find((item: Machine) => item.id === id) ?? null,
        );
        setActivities(records.data);
      })
      .catch(console.error);

    api
      .get(`/machines/${id}/additional-maintenance`)
      .then((response) => setAdditionalMaintenance(response.data))
      .catch(() => {
        setMessage('Additional maintenance could not be loaded.');
      });
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

  const maintenanceTypes =
    discipline === 'Mechanical' ? MECHANICAL_TYPES : ELECTRICAL_TYPES;
  const visibleActivities = activities.filter((item) =>
    maintenanceTypes.includes(item.maintenanceType),
  );

  const addAdditionalMaintenance = async (
    event: React.FormEvent<HTMLFormElement>,
    additionalDiscipline: AdditionalMaintenance['discipline'],
  ) => {
    event.preventDefault();
    if (!id) return;
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const description = String(form.get('description') ?? '').trim();
    if (!description) return;

    try {
      const response = await api.post(`/machines/${id}/additional-maintenance`, {
        discipline: additionalDiscipline,
        description,
        isCompleted: form.get('isCompleted') === 'on',
      });
      setAdditionalMaintenance((current) => [...current, response.data]);
      formElement.reset();
      setMessage('Additional maintenance added.');
    } catch (error: any) {
      setMessage(
        error.response?.data?.error ??
          'Could not add additional maintenance.',
      );
    }
  };

  const saveAdditionalMaintenance = async (
    event: React.FormEvent<HTMLFormElement>,
    item: AdditionalMaintenance,
  ) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const description = String(form.get('description') ?? '').trim();
    if (!description) return;

    try {
      const response = await api.patch(`/additional-maintenance/${item.id}`, {
        description,
        isCompleted: form.get('isCompleted') === 'on',
      });
      setAdditionalMaintenance((current) =>
        current.map((record) => (record.id === item.id ? response.data : record)),
      );
      setEditingAdditional(null);
      setMessage('Additional maintenance updated.');
    } catch (error: any) {
      setMessage(
        error.response?.data?.error ?? 'Could not update additional maintenance.',
      );
    }
  };

  const removeAdditionalMaintenance = async (item: AdditionalMaintenance) => {
    if (!window.confirm('Remove this additional maintenance item?')) return;
    try {
      await api.delete(`/additional-maintenance/${item.id}`);
      setAdditionalMaintenance((current) =>
        current.filter((record) => record.id !== item.id),
      );
      setMessage('Additional maintenance removed.');
    } catch (error: any) {
      setMessage(
        error.response?.data?.error ?? 'Could not remove additional maintenance.',
      );
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
          <div>
            <h2>{discipline} maintenance details</h2>
            <span className="muted">
              {visibleActivities.length} records
            </span>
          </div>
          <div
            className="discipline-toggle"
            role="group"
            aria-label="Maintenance discipline"
          >
            {(['Mechanical', 'Electrical'] as const).map((value) => (
              <button
                className={discipline === value ? 'selected' : ''}
                key={value}
                type="button"
                onClick={() => setDiscipline(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        {visibleActivities.length ? (
          <div className="activity-list">
            {visibleActivities.map((item) => (
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
          <Empty
            text={`No ${discipline.toLowerCase()} maintenance history is available for this machine.`}
          />
        )}
      </section>
      <section className="panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">Additional maintenance</p>
          </div>
        </div>
        <div className="additional-maintenance-section">
          <div className="panel-title">
            <div
              className="discipline-toggle"
              role="group"
              aria-label="Additional maintenance discipline"
            >
              {(['MECHANICAL', 'ELECTRICAL'] as const).map((value) => (
                <button
                  className={additionalDiscipline === value ? 'selected' : ''}
                  key={value}
                  type="button"
                  onClick={() => setAdditionalDiscipline(value)}
                >
                  {value === 'MECHANICAL' ? 'Mechanical' : 'Electrical'}
                </button>
              ))}
            </div>
          </div>
          {(() => {
            const existing = additionalMaintenance.find(
              (item) => item.discipline === additionalDiscipline,
            );
            const title =
              additionalDiscipline === 'MECHANICAL' ? 'mechanical' : 'electrical';
            return (
              <>
                {existing ? (
                  editingAdditional?.id === existing.id ? (
                    <form
                      className="additional-maintenance-form"
                      onSubmit={(event) =>
                        void saveAdditionalMaintenance(event, existing)
                      }
                    >
                      <input
                        name="description"
                        type="text"
                        defaultValue={existing.description}
                        maxLength={500}
                        aria-label={`${title} additional maintenance description`}
                        required
                      />
                      <button className="button" type="submit">
                        Save
                      </button>
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => setEditingAdditional(null)}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div className="additional-maintenance-item">
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{existing.description}</div>
                      </div>
                      <div className="additional-maintenance-actions">
                        <button
                          className="icon-button"
                          type="button"
                          onClick={() => setEditingAdditional(existing)}
                        >
                          <Edit3 size={17}/>
                        </button>
                        <button
                          className="icon-button"
                          type="button"
                          onClick={() => void removeAdditionalMaintenance(existing)}
                        >
                          <Trash2 size={17} color='#e85454'/>
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <form
                    className="additional-maintenance-form"
                    onSubmit={(event) =>
                      void addAdditionalMaintenance(event, additionalDiscipline)
                    }
                  >
                    <input
                      name="description"
                      type="text"
                      placeholder={`Describe ${title} additional maintenance`}
                      aria-label={`${title} additional maintenance description`}
                      maxLength={1000}
                      style={{ height: '50px',borderRadius: '10px', padding: '10px', fontSize: '14px',border: '3px solid #ccc',outline: 'none'}}
                      required
                    />
                    <button className="button" type="submit">
                      Add
                    </button>
                  </form>
                )}
              </>
            );
          })()}
        </div>
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
