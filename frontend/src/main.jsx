import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Activity, AlertTriangle, ArrowLeft, BarChart3, Bell, Building2, CalendarDays, CheckCircle2, ClipboardList, Clock3, Eye, EyeOff, FileText, Filter, Home, LayoutDashboard, LogOut, Menu, Package, Plus, RefreshCw, Search, Settings2, ShieldCheck, Timer, UserRound, UsersRound, Wrench, X } from 'lucide-react'
import campusUk1 from './assets/campus-uk1.jpg'
import './styles.css'
import './brand-theme.css'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
const roleLabels = { ADMIN: 'Admin', TEKNISI: 'Teknisi', KEPALA_UNIT: 'Kepala Unit', KEUANGAN: 'Bagian Keuangan', PELAPOR: 'Pelapor' }
const statusLabels = { BARU: 'Baru', DITUGASKAN: 'Ditugaskan', DIKERJAKAN: 'Dikerjakan', MENUNGGU_KONFIRMASI: 'Menunggu Konfirmasi', DITAHAN: 'Ditahan', SELESAI: 'Selesai', SELESAI_OTOMATIS: 'Selesai Otomatis', DIBUKA_KEMBALI: 'Dibuka Kembali' }
const priorityLabels = { DARURAT: 'Darurat', TINGGI: 'Tinggi', NORMAL: 'Normal' }

function token() { return localStorage.getItem('helpdesk_token') }
async function api(path, options = {}) {
  const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) }
  if (token()) headers.Authorization = `Bearer ${token()}`
  const res = await fetch(`${API}${path}`, { ...options, headers })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body.success === false) throw new Error(body.message || 'Layanan tidak dapat diakses')
  return body
}
function fmtDate(value) { if (!value) return '-'; return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function money(value) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0) }
function shortStatus(s) { return statusLabels[s] || String(s || '').replaceAll('_', ' ') }

function PasswordField({ label, value, onChange, autoComplete, minLength }) { const [visible, setVisible] = useState(false); return <label className="password-field">{label}<span className="password-control"><input type={visible ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} minLength={minLength} required/><button type="button" aria-label={visible ? `Sembunyikan ${label.toLowerCase()}` : `Lihat ${label.toLowerCase()}`} onClick={() => setVisible(current => !current)}>{visible ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label> }

function Login({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' }); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  async function submit(e) { e.preventDefault(); setBusy(true); setError(''); try { const r = await api('/auth/login', { method: 'POST', body: JSON.stringify(form) }); localStorage.setItem('helpdesk_token', r.data.token); localStorage.setItem('helpdesk_user', JSON.stringify(r.data.user)); onLogin(r.data.user) } catch (err) { setError(err.message) } finally { setBusy(false) } }
  return <div className="login-shell"><div className="login-hero"><div className="brand-mark">HF</div><p className="eyebrow">UNIT SARANA & PRASARANA</p><h1>Semua fasilitas,<br/><span>satu layanan.</span></h1><p className="hero-copy">Catat, pantau, dan selesaikan laporan fasilitas kampus dengan alur yang lebih tertata.</p><div className="hero-metrics"><div><strong>8</strong><span>Gedung terhubung</span></div><div><strong>24/7</strong><span>Pemantauan laporan</span></div></div></div><div className="login-panel"><div className="login-heading"><p className="eyebrow">PORTAL INTERNAL</p><h2>Selamat datang kembali</h2><p>Masuk untuk melanjutkan ke ruang kerja Anda.</p></div><form onSubmit={submit} className="stack-form"><label>Username<input autoComplete="username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="Masukkan username" required /></label><PasswordField label="Password" autoComplete="current-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />{error && <div className="inline-error">{error}</div>}<button className="primary full" disabled={busy}>{busy ? 'Memeriksa...' : 'Masuk ke dashboard'} <ArrowLeft size={17} className="flip-x" /></button></form><div className="demo-hint"><ShieldCheck size={16}/><span>Gunakan akun yang disiapkan administrator.</span></div></div></div>
}

function StatusBadge({ value, priority = false }) { const key = value || 'UNKNOWN'; return <span className={`badge ${priority ? 'priority-' : 'status-'}${key.toLowerCase()}`}>{priority ? priorityLabels[key] || key : shortStatus(key)}</span> }
function Toast({ toast, onClose }) { if (!toast) return null; return <div className={`toast ${toast.type || 'success'}`}><CheckCircle2 size={18}/><span>{toast.message}</span><button onClick={onClose}><X size={16}/></button></div> }
function Empty({ title = 'Belum ada data', text = 'Data dari server akan tampil di sini saat tersedia.', action }) { return <div className="empty"><div className="empty-icon"><ClipboardList size={24}/></div><h3>{title}</h3><p>{text}</p>{action}</div> }
function Loading() { return <div className="skeleton-loading" role="status" aria-label="Memuat data"><div className="skeleton-kpis"><i/><i/><i/><i/></div><div className="skeleton-content"><i/><i/><i/><i/></div><span className="sr-only">Memuat data...</span></div> }

function Sidebar({ user, page, setPage, collapsed, setCollapsed, onLogout }) {
  const items = [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN','KEPALA_UNIT','KEUANGAN','PELAPOR'] }, { id: 'laporan', label: 'Laporan Kerusakan', icon: ClipboardList, roles: ['ADMIN','KEPALA_UNIT','PELAPOR'] }, { id: 'pekerjaan', label: 'Pekerjaan Saya', icon: Wrench, roles: ['TEKNISI'] }, { id: 'pengajuan', label: 'Pengajuan Suku Cadang', icon: Package, roles: ['ADMIN','KEPALA_UNIT','KEUANGAN'] }, { id: 'manajemen', label: 'Laporan Manajemen', icon: BarChart3, roles: ['ADMIN','KEPALA_UNIT'] }, { id: 'master', label: 'Data Master', icon: Settings2, roles: ['ADMIN'] }].filter(i => i.roles.includes(user.role))
  return <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}><div className="side-brand"><div className="brand-mark small">HF</div><div className="brand-copy"><strong>Helpdesk</strong><span>Fasilitas Kampus</span></div><button className="icon-button side-toggle" aria-label="Perkecil sidebar" onClick={() => setCollapsed(!collapsed)}><Menu size={19}/></button></div><div className="side-label">WORKSPACE</div><nav>{items.map(item => { const Icon = item.icon; return <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}><Icon size={19}/><span>{item.label}</span></button> })}</nav><div className="side-bottom"><div className="side-label">AKUN</div><button onClick={() => setPage('profil')}><UserRound size={19}/><span>Profil & Keamanan</span></button><button className="logout" onClick={onLogout}><LogOut size={19}/><span>Keluar</span></button></div></aside>
}
function Topbar({ user, page, onMenu, onRefresh, onNavigate, onProfile = () => document.querySelector('.side-bottom button')?.click() }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    let active = true
    async function loadAlerts() {
      try {
        if (['ADMIN', 'KEPALA_UNIT'].includes(user.role)) {
          const r = await api('/manajemen/dashboard')
          const list = (r.data?.peringatanTerlambat || []).slice(0, 5).map(x => ({
            id: `late-${x.id}`,
            title: `${x.kode} terlambat`,
            subtitle: `${x.gedung} · ${x.ruang} (${Math.max(1, Math.floor((x.terlambatMenit || 0) / 60))} jam)`,
            target: ['detail', x.id],
          }))
          if (active) setAlerts(list)
        } else if (user.role === 'TEKNISI') {
          const r = await api('/pekerjaan-saya?status=aktif')
          const list = (r.data || []).slice(0, 5).map(x => ({
            id: `job-${x.penugasanId}`,
            title: `${x.laporan.kode} · ${priorityLabels[x.laporan.prioritas] || 'Normal'}`,
            subtitle: `${x.laporan.ruang?.gedung?.namaGedung || '-'} · ${shortStatus(x.laporan.status)}`,
            target: ['detail', x.laporan.id],
          }))
          if (active) setAlerts(list)
        } else if (user.role === 'KEUANGAN') {
          const r = await api('/pengajuan?status=MENUNGGU')
          const list = (r.data || []).slice(0, 5).map(x => ({
            id: `req-${x.id}`,
            title: `${x.namaBarang} (${money(x.nilai)})`,
            subtitle: x.laporan?.kode || 'Menunggu tindak lanjut',
            target: ['pengajuan'],
          }))
          if (active) setAlerts(list)
        } else if (user.role === 'PELAPOR') {
          const r = await api('/laporan?status=MENUNGGU_KONFIRMASI&limit=5')
          const list = (r.data || []).map(x => ({
            id: `conf-${x.id}`,
            title: `${x.kode} menunggu konfirmasi`,
            subtitle: x.jenis?.namaJenis || 'Konfirmasi hasil perbaikan',
            target: ['detail', x.id],
          }))
          if (active) setAlerts(list)
        }
      } catch {
        if (active) setAlerts([])
      }
    }
    loadAlerts()
    return () => { active = false }
  }, [user.role, page])

  return <header className="topbar"><div className="mobile-menu"><button className="icon-button" onClick={onMenu}><Menu size={21}/></button></div><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{page === 'dashboard' ? 'Dashboard' : page === 'laporan' ? 'Laporan Kerusakan' : page === 'pekerjaan' ? 'Pekerjaan Saya' : page === 'manajemen' ? 'Laporan Manajemen' : page === 'pengajuan' ? 'Pengajuan Suku Cadang' : page === 'master' ? 'Data Master' : 'Profil'}</strong></div><div className="top-actions"><button className="icon-button" aria-label="Muat ulang" onClick={onRefresh}><RefreshCw size={18}/></button><button className="icon-button notification" aria-label="Notifikasi" onClick={() => setNotificationsOpen(open => !open)}><Bell size={18}/>{alerts.length > 0 && <i/>}</button>{notificationsOpen && <div className="notification-panel"><div className="notification-panel-head"><strong>Notifikasi</strong><span>{alerts.length ? `${alerts.length} item` : 'Terbaru'}</span></div>{alerts.length ? <div className="notification-list">{alerts.map(a => <button key={a.id} className="notification-item" onClick={() => { setNotificationsOpen(false); onNavigate?.(...a.target) }}><strong>{a.title}</strong><span>{a.subtitle}</span></button>)}</div> : <div className="notification-empty"><Bell size={20}/><strong>Tidak ada notifikasi</strong><span>Belum ada aktivitas baru untuk akun ini.</span></div>}</div>}<button className="user-chip" aria-label="Buka Profil & Keamanan" onClick={onProfile}><div className="avatar">{user.nama?.slice(0,1).toUpperCase()}</div><div><strong>{user.nama}</strong><span>{roleLabels[user.role]}</span></div></button></div></header>
}

function Dashboard({ user, onNavigate }) {
  const [data, setData] = useState(null); const [error, setError] = useState('')
  useEffect(() => { if (!['ADMIN', 'KEPALA_UNIT'].includes(user.role)) return; (async () => { try { setData((await api('/manajemen/dashboard')).data) } catch (e) { setError(e.message) } })() }, [user.role])
  if (user.role === 'TEKNISI') return <TechnicianHome onNavigate={onNavigate}/>
  if (user.role === 'PELAPOR') return <ReporterHome onNavigate={onNavigate}/>
  if (user.role === 'KEUANGAN') return <FinanceDashboard onNavigate={onNavigate} />
  return <PageFrame title={`Selamat pagi, ${user.nama?.split(' ')[0] || 'Pengguna'} 👋`} subtitle="Pantau operasional fasilitas kampus hari ini." action={<button className="primary" onClick={() => onNavigate('laporan', true)}><Plus size={17}/> Catat laporan</button>}>{error ? <ErrorBox text={error}/> : !data ? <Loading/> : <><div className="kpi-grid"><Kpi icon={ClipboardList} tone="blue" label="Belum selesai" value={data.ringkasan?.belumSelesai} note={`${data.ringkasan?.belumDitugaskan || 0} belum ditugaskan`} onClick={() => onNavigate('laporan')}/><Kpi icon={AlertTriangle} tone="orange" label="Terlambat" value={data.ringkasan?.terlambat} note="Perlu perhatian segera" onClick={() => onNavigate('laporan', false, { terlambat: 'true' })}/><Kpi icon={Timer} tone="purple" label="Menunggu konfirmasi" value={data.ringkasan?.menungguKonfirmasi} note="Menunggu tanggapan pelapor" onClick={() => onNavigate('laporan', false, { status: 'MENUNGGU_KONFIRMASI' })}/><Kpi icon={CheckCircle2} tone="green" label="Laporan bulan ini" value={data.ringkasan?.laporanBulanIni} note="Total laporan tercatat" onClick={() => onNavigate('manajemen')}/></div><div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><h3>Perlu perhatian</h3><p>Laporan melewati target SLA</p></div><button className="text-button" onClick={() => onNavigate('laporan', false, { terlambat: 'true' })}>Lihat semua</button></div>{data.peringatanTerlambat?.length ? <div className="attention-list">{data.peringatanTerlambat.slice(0,5).map(item => <button className="attention-item" key={item.id} onClick={() => onNavigate('detail', item.id)}><div className="attention-icon"><AlertTriangle size={16}/></div><div><strong>{item.kode}</strong><span>{item.gedung} · {item.ruang}</span></div><div className="attention-meta"><StatusBadge value={item.status}/><small>{Math.floor((item.terlambatMenit || 0) / 60)} jam terlambat</small></div></button>)}</div> : <Empty title="Semua masih terkendali" text="Tidak ada laporan yang melewati target SLA."/>}</section><section className="panel"><div className="panel-head"><div><h3>Distribusi status</h3><p>Ringkasan seluruh laporan</p></div><Activity size={19} className="muted"/></div><div className="status-bars">{Object.entries(data.perStatus || {}).filter(([,v]) => v > 0).map(([key, value]) => <div className="bar-row" key={key}><div><span>{shortStatus(key)}</span><b>{value}</b></div><div className="bar-track"><i className={`bar-${key.toLowerCase()}`} style={{ width: `${Math.max(7, Math.round(value / Math.max(...Object.values(data.perStatus || { x: 1 })) * 100))}%` }}/></div></div>)}</div></section></div></>}</PageFrame>
}
function TechnicianHome({ onNavigate }) { return <PageFrame title="Pekerjaan Saya" subtitle="Prioritas pekerjaan yang ditugaskan kepada Anda." action={<button className="primary" onClick={() => onNavigate('pekerjaan')}><Wrench size={17}/> Buka pekerjaan</button>}><JobsPage compact onNavigate={onNavigate}/></PageFrame> }
function ReporterHome({ onNavigate }) { const [items, setItems] = useState(null); const [error, setError] = useState(''); useEffect(() => { api('/laporan?limit=50').then(r => setItems(r.data || [])).catch(e => setError(e.message)) }, []); if (error) return <PageFrame title="Dashboard Pelapor" subtitle="Ringkasan laporan yang Anda sampaikan."><ErrorBox text={error}/></PageFrame>; if (!items) return <PageFrame title="Dashboard Pelapor" subtitle="Ringkasan laporan yang Anda sampaikan."><Loading/></PageFrame>; const active = items.filter(x => !['SELESAI', 'SELESAI_OTOMATIS'].includes(x.status)).length; const waiting = items.filter(x => x.status === 'MENUNGGU_KONFIRMASI').length; return <PageFrame title="Dashboard Pelapor" subtitle="Ringkasan laporan yang Anda sampaikan." action={<button className="primary" onClick={() => onNavigate('laporan')}><ClipboardList size={17}/> Lihat laporan saya</button>}><div className="kpi-grid compact"><Kpi icon={ClipboardList} tone="blue" label="Total laporan" value={items.length} note="Laporan Anda"/><Kpi icon={Clock3} tone="orange" label="Masih berjalan" value={active} note="Belum selesai"/><Kpi icon={CheckCircle2} tone="purple" label="Menunggu konfirmasi" value={waiting} note="Perlu tanggapan Anda"/></div><section className="panel reporter-dashboard-list"><div className="panel-head"><div><h3>Perkembangan terbaru</h3><p>Ringkasan laporan yang terakhir diperbarui</p></div><button className="text-button" onClick={() => onNavigate('laporan')}>Lihat semua</button></div>{items.length ? <div className="attention-list">{items.slice(0, 5).map(item => <button className="attention-item" key={item.id} onClick={() => onNavigate('detail', item.id)}><div className="attention-icon"><ClipboardList size={16}/></div><div><strong>{item.kode}</strong><span>{item.jenis?.namaJenis || '-'} · {item.ruang?.gedung?.namaGedung || '-'}</span></div><div className="attention-meta"><StatusBadge value={item.status}/><small>{fmtDate(item.updatedAt || item.tanggalLapor)}</small></div></button>)}</div> : <Empty title="Belum ada laporan" text="Laporan yang Anda sampaikan akan muncul di sini."/>}</section></PageFrame> }
function Kpi({ icon: Icon, tone, label, value, note, onClick }) { const Tag = onClick ? 'button' : 'div'; return <Tag className={`kpi ${tone}`} onClick={onClick}><div className="kpi-top"><div className="kpi-icon"><Icon size={20}/></div><span>{label}</span></div><strong>{value ?? '-'}</strong><small>{note}</small></Tag> }
function ErrorBox({ text }) { return <div className="error-box"><AlertTriangle size={20}/><div><strong>Layanan belum dapat diakses</strong><p>{text}</p><small>Pastikan backend berjalan dan VITE_API_BASE_URL sudah sesuai.</small></div></div> }
function CampusHero() { return <section className="campus-hero"><div className="campus-hero-copy"><p className="eyebrow">HELPDESK FASILITAS KAMPUS</p><h2>Satu ruang kerja untuk menjaga kampus tetap berjalan.</h2><p>Pantau laporan, penugasan teknisi, dan tindak lanjut fasilitas dari satu tempat.</p></div><div className="campus-hero-media"><img src={campusUk1} alt="Area kampus Universitas Klabat"/><span className="campus-hero-caption">Universitas Klabat · Unit Sarana & Prasarana</span></div></section> }
function PageFrame({ title, subtitle, action, hero = false, children }) { const showHero = hero || title.startsWith('Selamat pagi') || ['Dashboard Keuangan', 'Dashboard Pelapor', 'Pekerjaan Saya', 'Laporan Saya'].includes(title); return <div className="page"><div className="page-head"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>{showHero && <><CampusHero/><div className="campus-ticker" aria-label="Informasi sistem"><span>Pusat layanan fasilitas kampus · Pantau status laporan dan koordinasikan tindak lanjut teknisi secara terpusat</span></div></>}{children}</div> }

function FinanceDashboard({ onNavigate }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { Promise.all([api('/pengajuan?status=MENUNGGU'), api('/pengajuan?status=DITINDAKLANJUTI')]).then(([menunggu, selesai]) => setData({ menunggu: menunggu.data || [], selesai: selesai.data || [] })).catch(e => setError(e.message)) }, [])
  if (error) return <PageFrame title="Dashboard Keuangan" subtitle="Ringkasan pengajuan suku cadang yang diterima."><ErrorBox text={error}/></PageFrame>
  if (!data) return <PageFrame title="Dashboard Keuangan" subtitle="Ringkasan pengajuan suku cadang yang diterima."><Loading/></PageFrame>
  const totalMenunggu = data.menunggu.reduce((sum, item) => sum + Number(item.nilai || 0), 0)
  return <PageFrame title="Dashboard Keuangan" subtitle="Pantau pengajuan suku cadang yang perlu ditindaklanjuti." action={<button className="primary" onClick={() => onNavigate('pengajuan')}><Package size={17}/> Buka pengajuan</button>}><div className="kpi-grid compact finance-kpis"><Kpi icon={Clock3} tone="orange" label="Menunggu tindak lanjut" value={data.menunggu.length} note="Pengajuan aktif" onClick={() => onNavigate('pengajuan')}/><Kpi icon={Package} tone="purple" label="Nilai menunggu" value={money(totalMenunggu)} note="Total nilai pengajuan"/><Kpi icon={CheckCircle2} tone="green" label="Sudah ditindaklanjuti" value={data.selesai.length} note="Riwayat terselesaikan" onClick={() => onNavigate('pengajuan')}/></div><div className="dashboard-grid finance-dashboard-grid"><section className="panel"><div className="panel-head"><div><h3>Perlu ditindaklanjuti</h3><p>Pengajuan terbaru dari Admin</p></div><button className="text-button" onClick={() => onNavigate('pengajuan')}>Lihat semua</button></div>{data.menunggu.length ? <div className="attention-list">{data.menunggu.slice(0, 5).map(item => <button className="attention-item" key={item.id} onClick={() => onNavigate('pengajuan')}><div className="attention-icon"><Package size={16}/></div><div><strong>{item.namaBarang}</strong><span>{item.laporan?.kode || 'Laporan'} · {item.laporan?.ruang?.gedung?.namaGedung || 'Lokasi belum tersedia'}</span></div><div className="attention-meta"><strong className="finance-price">{money(item.nilai)}</strong><StatusBadge value={item.status}/></div></button>)}</div> : <Empty title="Tidak ada pengajuan menunggu" text="Semua pengajuan sudah ditindaklanjuti."/>}</section><section className="panel finance-guide"><div className="panel-head"><div><h3>Alur tindak lanjut</h3><p>Informasi singkat untuk Bagian Keuangan</p></div><ShieldCheck size={19} className="muted"/></div><div className="finance-steps"><div><b>1</b><span>Periksa nama barang, nilai, dan catatan kebutuhan.</span></div><div><b>2</b><span>Koordinasikan tindak lanjut sesuai prosedur internal.</span></div><div><b>3</b><span>Isi catatan tindak lanjut agar pekerjaan dapat dilanjutkan.</span></div></div></section></div></PageFrame>
}

function ReportsPage({ reporter = JSON.parse(localStorage.getItem('helpdesk_user') || '{}').role !== 'ADMIN', onNavigate, initialFilters = {}, refreshKey = 0 }) {
  const [items, setItems] = useState(null); const [filters, setFilters] = useState({ q: '', status: '', prioritas: '', terlambat: '', ...initialFilters }); const [error, setError] = useState(''); const [showForm, setShowForm] = useState(false)
  async function load(nextFilters = filters) { setError(''); try { const qs = new URLSearchParams(Object.entries({ ...nextFilters, page: 1, limit: 50 }).filter(([,v]) => v)); const r = await api(`/laporan?${qs}`); setItems(r.data || []) } catch (e) { setError(e.message); setItems([]) } }
  useEffect(() => { load() }, [JSON.stringify(initialFilters), refreshKey])
  return <><div className="toolbar"><div className="searchbox"><Search size={17}/><input value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} onKeyDown={e => e.key === 'Enter' && load()} placeholder="Cari kode, deskripsi, pelapor..." /></div><select value={filters.status} onChange={e => { const next = { ...filters, status: e.target.value }; setFilters(next); load(next) }}><option value="">Semua status</option>{Object.keys(statusLabels).map(k => <option key={k} value={k}>{statusLabels[k]}</option>)}</select><select value={filters.prioritas} onChange={e => { const next = { ...filters, prioritas: e.target.value }; setFilters(next); load(next) }}><option value="">Semua prioritas</option>{Object.keys(priorityLabels).map(k => <option key={k} value={k}>{priorityLabels[k]}</option>)}</select><button className="secondary" onClick={load}><Filter size={16}/> Terapkan</button></div>{error ? <ErrorBox text={error}/> : <section className="panel table-panel"><div className="panel-head"><div><h3>Daftar laporan</h3><p>{items ? `${items.length} laporan ditampilkan` : 'Memuat data terbaru'}</p></div>{!reporter && <button className="primary" onClick={() => setShowForm(true)}><Plus size={17}/> Catat laporan</button>}</div>{items === null ? <Loading/> : items.length === 0 ? <Empty title="Belum ada laporan" text="Laporan dari server akan tampil setelah tersedia." action={!reporter && <button className="secondary" onClick={() => setShowForm(true)}>Catat laporan pertama</button>}/> : <div className="table-wrap"><table><thead><tr><th>Kode laporan</th><th>Lokasi</th><th>Jenis kerusakan</th><th>Prioritas</th><th>Status</th><th>Dilaporkan</th><th/></tr></thead><tbody>{items.map(item => <tr key={item.id} onClick={() => onNavigate('detail', item.id)}><td><strong className="linkish">{item.kode}</strong><small>{item.pelapor?.nama || 'Pelapor tidak tercatat'}</small></td><td>{item.ruang?.gedung?.namaGedung || '-'}<small>{item.ruang?.namaRuang || '-'}</small></td><td>{item.jenis?.namaJenis || '-'}</td><td>{item.prioritas ? <StatusBadge value={item.prioritas} priority/> : <span className="muted">Belum ditetapkan</span>}</td><td><StatusBadge value={item.status}/>{item.terlambat && <small className="danger-text">Terlambat</small>}</td><td>{fmtDate(item.tanggalLapor)}</td><td><button className="icon-button" onClick={e => { e.stopPropagation(); onNavigate('detail', item.id) }}><ArrowLeft size={16} className="rotate-180"/></button></td></tr>)}</tbody></table></div>}</section>}{showForm && <ReportForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }}/>}</>
}

function ReportForm({ onClose, onSaved }) {
  const [refs, setRefs] = useState({ gedung: [], jenis: [], pelapor: [] }); const [form, setForm] = useState({ sumberLaporan: 'WHATSAPP', ruangId: '', jenisId: '', deskripsi: '', prioritas: '', pelaporId: '', pelaporNama: '', pelaporKontak: '' }); const [rooms, setRooms] = useState([]); const [file, setFile] = useState(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  useEffect(() => { Promise.all([api('/master/gedung'), api('/master/jenis-kerusakan'), api('/master/pelapor')]).then(([gedung, jenis, pelapor]) => setRefs({ gedung: gedung.data || [], jenis: jenis.data || [], pelapor: pelapor.data || [] })).catch(err => setError(err.message)) }, [])
  async function roomChange(gedungId) { setForm({ ...form, gedungId, ruangId: '' }); if (!gedungId) { setRooms([]); return } try { setRooms((await api(`/master/ruang?gedungId=${gedungId}`)).data || []) } catch (err) { setError(err.message); setRooms([]) } }
  async function submit(e) { e.preventDefault(); setBusy(true); setError(''); const body = new FormData(); Object.entries(form).forEach(([k, v]) => { if (k === 'sumberLaporan' && v === 'LANGSUNG') v = 'DATANG_LANGSUNG'; if (!v || k === 'gedungId') return; if (form.pelaporId && ['pelaporNama', 'pelaporKontak'].includes(k)) return; body.append(k, v) }); if (file) body.append('foto', file); try { await api('/laporan', { method: 'POST', body }); onSaved() } catch (err) { setError(err.message) } finally { setBusy(false) } }
  return <Modal title="Catat laporan kerusakan" onClose={onClose}><form className="modal-form" onSubmit={submit}><div className="form-grid"><label>Sumber laporan<select value={form.sumberLaporan} onChange={e => setForm({ ...form, sumberLaporan: e.target.value })}><option value="WHATSAPP">WhatsApp</option><option value="TELEPON">Telepon</option><option value="DATANG_LANGSUNG">Datang langsung</option></select></label><label>Prioritas<select value={form.prioritas} onChange={e => setForm({ ...form, prioritas: e.target.value })}><option value="">Tetapkan nanti</option><option value="DARURAT">Darurat</option><option value="TINGGI">Tinggi</option><option value="NORMAL">Normal</option></select></label><label>Gedung<select value={form.gedungId || ''} onChange={e => roomChange(e.target.value)} required><option value="">Pilih gedung</option>{refs.gedung.map(x => <option key={x.id} value={x.id}>{x.namaGedung}</option>)}</select></label><label>Ruang<select value={form.ruangId} onChange={e => setForm({ ...form, ruangId: e.target.value })} required><option value="">Pilih ruang</option>{rooms.map(x => <option key={x.id} value={x.id}>{x.namaRuang}</option>)}</select></label><label>Jenis kerusakan<select value={form.jenisId} onChange={e => setForm({ ...form, jenisId: e.target.value })} required><option value="">Pilih jenis</option>{refs.jenis.map(x => <option key={x.id} value={x.id}>{x.namaJenis} · {x.bidang}</option>)}</select></label><label>Pelapor terdaftar<select value={form.pelaporId} onChange={e => setForm({ ...form, pelaporId: e.target.value, pelaporNama: '', pelaporKontak: '' })}><option value="">Pelapor baru / tidak terdaftar</option>{refs.pelapor.map(x => <option key={x.id} value={x.id}>{x.nama}{x.kontak ? ` · ${x.kontak}` : ''}</option>)}</select></label>{!form.pelaporId && <><label>Nama pelapor<input value={form.pelaporNama} onChange={e => setForm({ ...form, pelaporNama: e.target.value })} placeholder="Nama pelapor" required/></label><label>Kontak pelapor<input value={form.pelaporKontak} onChange={e => setForm({ ...form, pelaporKontak: e.target.value })} placeholder="Nomor telepon atau WhatsApp"/></label></>}<label className="span-2">Deskripsi kerusakan<textarea value={form.deskripsi} onChange={e => setForm({ ...form, deskripsi: e.target.value })} rows="4" placeholder="Jelaskan kondisi kerusakan dan dampaknya..." required/></label><label className="span-2 upload"><span>Foto kondisi <small>(wajib sesuai aturan backend)</small></span><input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0])}/>{file && <em>{file.name}</em>}</label></div>{error && <div className="inline-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Batal</button><button className="primary" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan laporan'} <CheckCircle2 size={16}/></button></div></form></Modal>
}

function AssignmentPanel({ item, user, onToast, onSaved }) {
  const [technicians, setTechnicians] = useState([])
  const [selected, setSelected] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const activeIds = (item.penugasan || []).filter(p => p.statusTugas === 'AKTIF').map(p => p.teknisiId)

  useEffect(() => {
    if (user.role !== 'ADMIN' || !item.jenis?.bidang) return
    api('/master/teknisi?aktif=true&bidang=' + encodeURIComponent(item.jenis.bidang))
      .then(r => setTechnicians(r.data || []))
      .catch(e => setError(e.message))
  }, [item.jenis?.bidang, user.role])

  useEffect(() => {
    setSelected(activeIds)
  }, [item.id, item.penugasan?.length])

  function toggle(id) {
    setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
  }

  async function save() {
    if (!selected.length) return
    setBusy(true)
    setError('')
    try {
      await api('/laporan/' + item.id + '/penugasan', {
        method: 'POST',
        body: JSON.stringify({ teknisiIds: selected }),
      })
      onToast('Penugasan berhasil disimpan')
      await onSaved()
    } catch (e) {
      setError(e.message)
      onToast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function cancelAssignment(penugasanId) {
    setBusy(true)
    setError('')
    try {
      await api(`/laporan/${item.id}/penugasan/${penugasanId}`, { method: 'DELETE' })
      onToast('Penugasan dibatalkan')
      await onSaved()
    } catch (e) {
      setError(e.message)
      onToast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return <section className="panel assignment-panel">
    <div className="panel-head">
      <div><h3>Penugasan</h3><p>Teknisi sesuai bidang {item.jenis?.bidang || '-'}</p></div>
      {item.status === 'BARU' && <Wrench size={19} className="muted" />}
    </div>
    {item.penugasan?.length ? item.penugasan.map(p => <div className="assignee" key={p.id}>
      <div className="avatar soft">{p.teknisi?.nama?.slice(0, 1)}</div>
      <div style={{ flex: 1 }}><strong>{p.teknisi?.nama}</strong><span>{p.teknisi?.bidang} · {p.statusTugas}</span></div>
      {user.role === 'ADMIN' && p.statusTugas === 'AKTIF' && !['SELESAI', 'SELESAI_OTOMATIS'].includes(item.status) && <button type="button" className="icon-button" title="Batalkan penugasan" disabled={busy} onClick={() => cancelAssignment(p.id)}><X size={15} /></button>}
    </div>) : <p className="muted">Belum ada teknisi ditugaskan.</p>}
    {user.role === 'ADMIN' && !['SELESAI', 'SELESAI_OTOMATIS'].includes(item.status) && <div className="assignment-form">
      <div className="assignment-options">
        {technicians.length ? technicians.map(t => <label className="technician-option" key={t.id}>
          <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} />
          <span><strong>{t.nama}</strong><small>{t.bidang} · {t.aktif ? 'Aktif' : 'Tidak aktif'}</small></span>
        </label>) : <small className="muted">Belum ada teknisi aktif pada bidang ini.</small>}
      </div>
      {error && <div className="inline-error">{error}</div>}
      <button className="primary full" onClick={save} disabled={busy || !selected.length}>
        {busy ? 'Menyimpan...' : 'Simpan penugasan'} <CheckCircle2 size={16} />
      </button>
    </div>}
  </section>
}



function ReporterConfirmation({ item, user, onToast, onSaved }) {
  const [hasil, setHasil] = useState('SELESAI')
  const [catatan, setCatatan] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!['PELAPOR', 'ADMIN'].includes(user.role) || item.status !== 'MENUNGGU_KONFIRMASI') return null

  async function submit() {
    setBusy(true)
    setError('')
    try {
      await api('/laporan/' + item.id + '/konfirmasi', {
        method: 'POST',
        body: JSON.stringify({ hasil, catatan }),
      })
      onToast(hasil === 'SELESAI' ? 'Laporan dikonfirmasi selesai' : 'Laporan dibuka kembali')
      await onSaved()
    } catch (e) {
      setError(e.message)
      onToast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return <section className="panel confirmation-panel">
    <div className="panel-head"><div><h3>Konfirmasi hasil perbaikan</h3><p>Pastikan hasil pekerjaan sesuai kondisi di lapangan.</p></div><CheckCircle2 size={19} className="muted" /></div>
    <div className="confirmation-options">
      <label className={hasil === 'SELESAI' ? 'selected' : ''}><input type="radio" name={'konfirmasi-' + item.id} checked={hasil === 'SELESAI'} onChange={() => setHasil('SELESAI')} /><span><strong>Sudah selesai</strong><small>Pekerjaan sudah sesuai.</small></span></label>
      <label className={hasil === 'BELUM_SELESAI' ? 'selected' : ''}><input type="radio" name={'konfirmasi-' + item.id} checked={hasil === 'BELUM_SELESAI'} onChange={() => setHasil('BELUM_SELESAI')} /><span><strong>Belum selesai</strong><small>Laporan akan dibuka kembali untuk ditangani.</small></span></label>
    </div>
    <textarea value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Catatan tambahan (opsional)" rows="3" />
    {error && <div className="inline-error">{error}</div>}
    <button className="primary full" onClick={submit} disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan konfirmasi'} <CheckCircle2 size={16} /></button>
  </section>
}



function EditReportModal({ item, onClose, onSaved, onToast }) {
  const [refs, setRefs] = useState({ gedung: [], jenis: [] })
  const [rooms, setRooms] = useState([])
  const [form, setForm] = useState({
    sumberLaporan: item.sumberLaporan || 'WHATSAPP',
    gedungId: item.ruang?.gedungId ? String(item.ruang.gedungId) : '',
    ruangId: item.ruangId ? String(item.ruangId) : '',
    jenisId: item.jenisId ? String(item.jenisId) : '',
    deskripsi: item.deskripsi || '',
  })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api('/master/gedung'), api('/master/jenis-kerusakan')])
      .then(([g, j]) => setRefs({ gedung: g.data || [], jenis: j.data || [] }))
      .catch(e => setError(e.message))
  }, [])

  useEffect(() => {
    if (!form.gedungId) { setRooms([]); return }
    api(`/master/ruang?gedungId=${form.gedungId}`).then(r => setRooms(r.data || [])).catch(() => setRooms([]))
  }, [form.gedungId])

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await api(`/laporan/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          sumberLaporan: form.sumberLaporan,
          ruangId: Number(form.ruangId),
          jenisId: Number(form.jenisId),
          deskripsi: form.deskripsi,
        }),
      })
      if (file) {
        const fd = new FormData()
        fd.append('foto', file)
        await api(`/laporan/${item.id}/foto`, { method: 'PUT', body: fd })
      }
      onToast('Laporan berhasil diperbarui')
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return <Modal title={`Edit ${item.kode}`} onClose={onClose}>
    <form className="modal-form" onSubmit={submit}>
      <div className="form-grid">
        <label>Sumber laporan<select value={form.sumberLaporan} onChange={e => setForm({ ...form, sumberLaporan: e.target.value })}><option value="WHATSAPP">WhatsApp</option><option value="TELEPON">Telepon</option><option value="DATANG_LANGSUNG">Datang langsung</option></select></label>
        <label>Jenis kerusakan<select value={form.jenisId} onChange={e => setForm({ ...form, jenisId: e.target.value })} required>{refs.jenis.map(x => <option key={x.id} value={x.id}>{x.namaJenis} · {x.bidang}</option>)}</select></label>
        <label>Gedung<select value={form.gedungId} onChange={e => setForm({ ...form, gedungId: e.target.value, ruangId: '' })} required><option value="">Pilih gedung</option>{refs.gedung.map(x => <option key={x.id} value={x.id}>{x.namaGedung}</option>)}</select></label>
        <label>Ruang<select value={form.ruangId} onChange={e => setForm({ ...form, ruangId: e.target.value })} required><option value="">Pilih ruang</option>{rooms.map(x => <option key={x.id} value={x.id}>{x.namaRuang}</option>)}</select></label>
        <label className="span-2">Deskripsi kerusakan<textarea value={form.deskripsi} onChange={e => setForm({ ...form, deskripsi: e.target.value })} rows="4" required/></label>
        <label className="span-2 upload"><span>Ganti foto kondisi <small>(opsional)</small></span><input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0])}/>{file && <em>{file.name}</em>}</label>
      </div>
      {error && <div className="inline-error">{error}</div>}
      <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Batal</button><button className="primary" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan perubahan'} <CheckCircle2 size={16}/></button></div>
    </form>
  </Modal>
}

function DetailPage({ id, user, onBack, onToast }) {
  const [item, setItem] = useState(null); const [error, setError] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [editOpen, setEditOpen] = useState(false)
  const canWork = ['ADMIN', 'TEKNISI'].includes(user.role)
  const isFinal = item && ['SELESAI', 'SELESAI_OTOMATIS'].includes(item.status)
  async function reload() { const r = await api(`/laporan/${id}`); setItem(r.data) }
  useEffect(() => { api(`/laporan/${id}`).then(r => setItem(r.data)).catch(e => setError(e.message)) }, [id])
  async function act(path, body) { setBusy(true); try { await api(`/laporan/${id}/${path}`, { method: 'POST', body: JSON.stringify(body) }); onToast('Perubahan berhasil disimpan'); await reload(); setNote('') } catch (e) { onToast(e.message, 'error') } finally { setBusy(false) } }
  async function updatePriority(prioritas) { if (!prioritas) return; setBusy(true); try { await api(`/laporan/${id}/prioritas`, { method: 'PATCH', body: JSON.stringify({ prioritas }) }); onToast('Prioritas & target SLA diperbarui'); await reload() } catch (e) { onToast(e.message, 'error') } finally { setBusy(false) } }
  async function deleteWorkLog(jamId) { setBusy(true); try { await api(`/jam-kerja/${jamId}`, { method: 'DELETE' }); onToast('Catatan jam kerja dihapus'); await reload() } catch (e) { onToast(e.message, 'error') } finally { setBusy(false) } }
  if (error) return <PageFrame title="Detail laporan" subtitle=""><ErrorBox text={error}/></PageFrame>
  if (!item) return <Loading/>
  const workLogs = item.penugasan?.flatMap(p => (p.jamKerja || []).map(j => ({ ...j, teknisiNama: p.teknisi?.nama, teknisiId: p.teknisiId }))) || []
  return <PageFrame title={item.kode} subtitle={`${item.ruang?.gedung?.namaGedung || '-'} · ${item.ruang?.namaRuang || '-'}`} action={<div className="row-actions">{user.role === 'ADMIN' && !isFinal && <button className="secondary" onClick={() => setEditOpen(true)}>Edit laporan</button>}<button className="secondary" onClick={onBack}><ArrowLeft size={16}/> Kembali</button></div>}><div className="detail-grid"><div className="detail-main"><section className="panel detail-summary"><div className="detail-title"><div><p className="eyebrow">LAPORAN KERUSAKAN</p><h2>{item.deskripsi}</h2></div><StatusBadge value={item.status}/></div><div className="meta-grid"><div><span>Jenis kerusakan</span><b>{item.jenis?.namaJenis || '-'}</b></div><div><span>Prioritas</span>{user.role === 'ADMIN' && !isFinal ? <select className="inline-select" aria-label="Ubah prioritas" disabled={busy} value={item.prioritas || ''} onChange={e => updatePriority(e.target.value)}><option value="">Belum ditetapkan</option>{Object.entries(priorityLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select> : <b>{item.prioritas ? <StatusBadge value={item.prioritas} priority/> : 'Belum ditetapkan'}</b>}</div><div><span>Pelapor</span><b>{item.pelapor?.nama || '-'}</b></div><div><span>Target SLA</span><b>{fmtDate(item.targetSla)}</b></div></div>{item.fotoUrl && <img className="report-photo" src={item.fotoUrl} alt="Foto kondisi fasilitas"/>}</section><section className="panel"><div className="panel-head"><div><h3>Riwayat perkembangan</h3><p>Catatan aktivitas laporan</p></div></div><div className="timeline">{(item.perkembangan || []).map((x, i) => <div className="timeline-item" key={x.id || i}><div className="timeline-dot"/><div><strong>{shortStatus(x.status)} · {x.jenis}</strong><p>{x.catatan}</p><small>{fmtDate(x.waktu || x.tanggal)} · {x.user?.nama || 'Sistem'}</small></div></div>)}</div>{canWork && !isFinal && <div className="quick-update"><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Tambahkan catatan perkembangan..."/><div><button className="secondary" disabled={busy || !note.trim()} onClick={() => act('perkembangan', { jenis: 'PROGRES', catatan: note.trim() })}>Simpan progres</button><button className="primary" disabled={busy || !note.trim()} onClick={() => act('selesai-teknisi', { catatan: note.trim() })}>Tandai selesai</button></div></div>}</section><ReporterConfirmation item={item} user={user} onToast={onToast} onSaved={reload} /></div><aside className="detail-side"><AssignmentPanel item={item} user={user} onToast={onToast} onSaved={reload} /><section className="panel"><h3>Jam kerja</h3><div className="big-number">{(item.jamKerja || workLogs).reduce((s, x) => s + Number(x.durasiJam || 0), 0).toFixed(1)} <small>jam</small></div><p className="muted">Total dari seluruh catatan teknisi.</p><WorkDurationSummary item={item}/>{workLogs.length > 0 && <div className="worklog-list">{workLogs.map(j => <div className="request-line" key={j.id}><div><strong>{j.teknisiNama || 'Teknisi'} · {j.durasiJam} jam</strong><span>{fmtDate(j.tanggal)}{j.catatan ? ` · ${j.catatan}` : ''}</span></div>{!isFinal && (user.role === 'ADMIN' || (user.role === 'TEKNISI' && Number(j.teknisiId) === Number(user.teknisiId))) && <button type="button" className="icon-button" title="Hapus jam kerja" disabled={busy} onClick={() => deleteWorkLog(j.id)}><X size={14}/></button>}</div>)}</div>}<WorkLogForm item={item} user={user} onToast={onToast} onSaved={reload} /></section><section className="panel"><h3>Pengajuan suku cadang</h3>{item.pengajuan?.length ? item.pengajuan.map(x => <div className="request-line" key={x.id}><div><strong>{x.namaBarang}</strong><span>{money(x.nilai)}</span></div><StatusBadge value={x.status}/></div>) : <p className="muted">Belum ada pengajuan.</p>}</section></aside></div>{editOpen && <EditReportModal item={item} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); reload() }} onToast={onToast}/>}</PageFrame>
}

function JobsPage({ compact = false, onNavigate }) { const [items, setItems] = useState(null); const [tab, setTab] = useState('aktif'); const [error, setError] = useState(''); async function load() { try { setItems((await api(`/pekerjaan-saya?status=${tab}`)).data || []) } catch (e) { setError(e.message); setItems([]) } } useEffect(() => { load() }, [tab]); if (error) return <ErrorBox text={error}/>; return <div>{!compact && <div className="tabs"><button className={tab === 'aktif' ? 'active' : ''} onClick={() => setTab('aktif')}>Aktif</button><button className={tab === 'selesai' ? 'active' : ''} onClick={() => setTab('selesai')}>Selesai</button><button className={tab === 'semua' ? 'active' : ''} onClick={() => setTab('semua')}>Semua</button></div>}{items === null ? <Loading/> : items.length === 0 ? <Empty title="Belum ada pekerjaan" text="Penugasan dari admin akan muncul di sini."/> : <section className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>Laporan</th><th>Lokasi</th><th>Prioritas</th><th>Status</th><th>Jam saya</th><th/></tr></thead><tbody>{items.map(x => <tr key={x.penugasanId} onClick={() => onNavigate('detail', x.laporan.id)}><td><strong className="linkish">{x.laporan.kode}</strong><small>{x.laporan.jenis?.namaJenis}</small></td><td>{x.laporan.ruang?.gedung?.namaGedung}<small>{x.laporan.ruang?.namaRuang}</small></td><td><StatusBadge value={x.laporan.prioritas} priority/></td><td><StatusBadge value={x.laporan.status}/></td><td>{x.totalJamSaya ?? x.totalJam ?? 0} jam</td><td><ArrowLeft size={16} className="rotate-180"/></td></tr>)}</tbody></table></div></section>}</div> }

function Management({ user, onToast }) {
  const [tab, setTab] = useState('monthly'); const [data, setData] = useState(null); const [month, setMonth] = useState(new Date().toISOString().slice(0,7)); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  async function load() {
    setError('')
    try {
      const path = tab === 'monthly' ? `/manajemen/laporan-bulanan?bulan=${month}` : `/manajemen/rekap-jam-kerja?bulan=${month}`
      setData((await api(path)).data)
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [tab, month])
  async function runAutoClose() {
    setBusy(true)
    try {
      const r = await api('/manajemen/auto-close/jalankan', { method: 'POST' })
      onToast?.(`Auto-close dijalankan (${r.data?.ditutup ?? 0} laporan ditutup)`)
      load()
    } catch (e) { onToast?.(e.message, 'error') } finally { setBusy(false) }
  }
  function exportCsv() {
    if (!data) return
    const esc = v => `"${String(v ?? '').replaceAll('"', '""')}"`
    let headers = []
    let rows = []
    if (tab === 'monthly') {
      headers = ['Nama Gedung', 'Total', 'Selesai', 'Terlambat']
      rows = (data.perGedung || []).map(x => [x.nama, x.total, x.selesai, x.terlambat])
    } else {
      headers = ['Teknisi', 'Bidang', 'Total Jam', 'Jumlah Pekerjaan']
      rows = (data.perTeknisi || []).map(x => [x.namaTeknisi, x.bidang, x.totalJam, x.jumlahPekerjaan])
    }
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(esc).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${tab === 'monthly' ? 'laporan-bulanan' : 'rekap-jam-kerja'}-${month}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return <PageFrame title="Laporan Manajemen" subtitle="Gunakan data operasional untuk rapat dan evaluasi bulanan." action={<div className="row-actions"><button className="secondary" disabled={!data} onClick={exportCsv}><FileText size={16}/> Export CSV</button><button className="secondary" onClick={() => window.print()}>Cetak</button>{user?.role === 'ADMIN' && <button className="secondary" disabled={busy} onClick={runAutoClose}><RefreshCw size={16}/> {busy ? 'Memproses...' : 'Jalankan Auto-Close'}</button>}</div>}><div className="report-tabs"><button className={tab === 'monthly' ? 'active' : ''} onClick={() => setTab('monthly')}><BarChart3 size={17}/> Laporan bulanan</button><button className={tab === 'hours' ? 'active' : ''} onClick={() => setTab('hours')}><Clock3 size={17}/> Rekap jam kerja</button><label><CalendarDays size={16}/><input type="month" value={month} onChange={e => setMonth(e.target.value)}/></label></div>{error ? <ErrorBox text={error}/> : !data ? <Loading/> : tab === 'monthly' ? <><div className="kpi-grid compact"><Kpi icon={FileText} tone="blue" label="Total laporan" value={data.total} note={`Periode ${data.bulan}`}/><Kpi icon={CheckCircle2} tone="green" label="Selesai" value={(data.perGedung || []).reduce((s,x) => s + x.selesai, 0)} note="Sudah terselesaikan"/><Kpi icon={AlertTriangle} tone="orange" label="Terlambat" value={(data.perGedung || []).reduce((s,x) => s + x.terlambat, 0)} note="Perlu evaluasi"/></div><div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><h3>Per gedung</h3><p>Jumlah laporan dan penyelesaiannya</p></div></div><MiniTable rows={data.perGedung} labels={['Nama gedung','Total','Selesai','Terlambat']}/></section><section className="panel"><div className="panel-head"><div><h3>Per jenis kerusakan</h3><p>Distribusi kategori kerusakan</p></div></div><MiniTable rows={data.perJenis} labels={['Jenis','Total','Selesai','Terlambat']}/></section></div></> : <div className="panel table-panel"><div className="panel-head"><div><h3>Rekap jam kerja teknisi</h3><p>Periode {data.periode}</p></div></div><MiniTable rows={data.perTeknisi} labels={['Teknisi','Bidang','Total jam','Pekerjaan']} hours/></div>}</PageFrame>
}
function MiniTable({ rows = [], labels, hours }) { if (!rows.length) return <Empty title="Belum ada data periode ini" text="Coba pilih periode lain atau pastikan catatan sudah tersedia."/>; return <div className="table-wrap"><table><thead><tr>{labels.map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map((x,i) => <tr key={i}><td><strong>{hours ? x.namaTeknisi : x.nama}</strong></td><td>{hours ? x.bidang : x.total}</td><td>{hours ? `${x.totalJam} jam` : x.selesai}</td><td>{hours ? x.jumlahPekerjaan : x.terlambat}</td></tr>)}</tbody></table></div> }

function WorkDurationSummary({ item }) {
  const assignments = item.penugasan || []
  const startedAt = assignments.map(p => p.tglTugas).filter(Boolean).sort()[0]
  const finishedAt = item.tglSelesaiTeknisi || (['SELESAI', 'SELESAI_OTOMATIS'].includes(item.status) ? item.tglDitutup : null)
  const elapsed = startedAt ? Math.max(0, ((finishedAt ? new Date(finishedAt) : new Date()) - new Date(startedAt)) / 3600000) : 0
  const target = item.prioritas === 'DARURAT' ? '4 jam' : item.prioritas === 'TINGGI' ? '1 hari' : item.prioritas === 'NORMAL' ? '3 hari kerja' : 'Belum ditetapkan'
  return <div className="work-duration"><div><span>Durasi sejak ditugaskan</span><strong>{elapsed.toFixed(1)} jam</strong></div><small>{finishedAt ? 'Sampai teknisi menyatakan selesai' : 'Berjalan sejak penugasan'} · Target {target}</small></div>
}

function WorkLogForm({ item, user, onToast, onSaved }) {
  const activeAssignments = (item.penugasan || []).filter(p => p.statusTugas === 'AKTIF')
  const mine = activeAssignments.filter(p => user.role !== 'TEKNISI' || Number(p.teknisiId) === Number(user.teknisiId))
  const [assignmentId, setAssignmentId] = useState(mine[0]?.id ? String(mine[0].id) : '')
  const [durasiJam, setDurasiJam] = useState('')
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10))
  const [catatan, setCatatan] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (!assignmentId && mine[0]?.id) setAssignmentId(String(mine[0].id)) }, [item.id, item.penugasan?.length, user.teknisiId])
  if (!['ADMIN', 'TEKNISI'].includes(user.role) || !mine.length) return null
  async function submit(e) {
    e.preventDefault(); const value = Number(durasiJam)
    if (!assignmentId || !Number.isFinite(value) || value <= 0 || value > 24) { setError('Isi durasi jam lebih dari 0 dan maksimal 24 jam.'); return }
    setBusy(true); setError('')
    try { await api(`/penugasan/${assignmentId}/jam-kerja`, { method: 'POST', body: JSON.stringify({ durasiJam: value, tanggal, catatan }) }); onToast('Jam kerja berhasil dicatat'); setDurasiJam(''); setCatatan(''); await onSaved() } catch (e) { setError(e.message); onToast(e.message, 'error') } finally { setBusy(false) }
  }
  return <form className="worklog-form" onSubmit={submit}><div className="worklog-form-head"><strong>Catat jam kerja</strong><small>{user.role === 'TEKNISI' ? 'Untuk penugasan Anda' : 'Admin dapat memilih teknisi'}</small></div><div className="worklog-fields">{user.role === 'ADMIN' && <label>Penugasan<select value={assignmentId} onChange={e => setAssignmentId(e.target.value)} required>{mine.map(p => <option key={p.id} value={p.id}>{p.teknisi?.nama || 'Teknisi'} · {p.teknisi?.bidang || '-'}</option>)}</select></label>}<label>Durasi (jam)<input type="number" min="0.1" max="24" step="0.1" value={durasiJam} onChange={e => setDurasiJam(e.target.value)} placeholder="Contoh: 2.5" required /></label><label>Tanggal<input type="date" value={tanggal} max={new Date().toISOString().slice(0, 10)} onChange={e => setTanggal(e.target.value)} required /></label><label className="worklog-note">Catatan<input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Opsional" /></label></div>{error && <div className="inline-error">{error}</div>}<button className="primary" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan jam kerja'} <CheckCircle2 size={16}/></button></form>
}

function SparePartForm({ onClose, onSaved, onToast }) {
  const [reports, setReports] = useState(null)
  const [form, setForm] = useState({ laporanId: '', namaBarang: '', nilai: '', catatan: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { api('/laporan?limit=100').then(r => setReports((r.data || []).filter(x => !['SELESAI', 'SELESAI_OTOMATIS'].includes(x.status)))).catch(e => setError(e.message)) }, [])
  async function submit(e) {
    e.preventDefault()
    const nilai = Number(form.nilai)
    if (!form.laporanId || !form.namaBarang.trim() || !Number.isInteger(nilai) || nilai <= 500000) { setError('Pilih laporan, isi nama suku cadang, dan masukkan nilai lebih dari Rp500.000.'); return }
    setBusy(true); setError('')
    try { await api(`/laporan/${form.laporanId}/pengajuan`, { method: 'POST', body: JSON.stringify({ namaBarang: form.namaBarang, nilai, catatan: form.catatan }) }); onToast('Pengajuan suku cadang dicatat dan laporan ditahan'); onSaved() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <Modal title="Ajukan suku cadang" onClose={onClose}><form className="modal-form" onSubmit={submit}><div className="form-grid"><label className="span-2">Pilih laporan<select value={form.laporanId} onChange={e => setForm({ ...form, laporanId: e.target.value })} required><option value="">Pilih laporan yang membutuhkan suku cadang</option>{reports?.map(x => <option key={x.id} value={x.id}>{x.kode} · {x.deskripsi || 'Tanpa deskripsi'} · {x.namaPelapor || x.pelapor?.nama || 'Pelapor'}</option>)}</select>{reports && !reports.length && <small className="form-help">Tidak ada laporan aktif yang tersedia.</small>}</label><label>Nama suku cadang<input value={form.namaBarang} onChange={e => setForm({ ...form, namaBarang: e.target.value })} placeholder="Contoh: Kompresor AC" required /></label><label>Nilai pengajuan<input type="number" min="500001" step="1" value={form.nilai} onChange={e => setForm({ ...form, nilai: e.target.value })} placeholder="Lebih dari 500000" required /><small className="form-help">Sesuai business rule: harus di atas Rp500.000.</small></label><label className="span-2">Catatan kebutuhan<textarea value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} rows="3" placeholder="Jelaskan hasil pemeriksaan atau alasan kebutuhan suku cadang..." /></label></div>{error && <div className="inline-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Batal</button><button className="primary" disabled={busy || !reports}>{busy ? 'Menyimpan...' : 'Simpan pengajuan'} <CheckCircle2 size={16} /></button></div></form></Modal>
}

function Requests({ user, onToast }) { const [items, setItems] = useState(null); const [filter, setFilter] = useState('MENUNGGU'); const [note, setNote] = useState({}); const [showForm, setShowForm] = useState(false); async function load() { try { setItems((await api(`/pengajuan?status=${filter}`)).data || []) } catch (e) { onToast(e.message, 'error'); setItems([]) } } useEffect(() => { load() }, [filter]); async function follow(id) { const text = (note[id] || '').trim(); if (!text) return; try { await api(`/pengajuan/${id}/tindak-lanjut`, { method: 'PATCH', body: JSON.stringify({ catatan: text }) }); onToast('Pengajuan ditindaklanjuti'); setNote(prev => ({ ...prev, [id]: '' })); load() } catch(e) { onToast(e.message, 'error') } } return <PageFrame title="Pengajuan Suku Cadang" subtitle="Pantau kebutuhan suku cadang di atas ambang Rp500.000." action={user.role === 'ADMIN' && <button className="primary" onClick={() => setShowForm(true)}><Plus size={17}/> Ajukan suku cadang</button>}><div className="info-banner"><Package size={18}/><span>Pengajuan dicatat Admin berdasarkan hasil pemeriksaan kebutuhan pekerjaan. Nilai harus lebih dari Rp500.000 dan laporan akan ditahan sampai ditindaklanjuti.</span></div><div className="toolbar"><div className="tabs"><button className={filter === 'MENUNGGU' ? 'active' : ''} onClick={() => setFilter('MENUNGGU')}>Menunggu</button><button className={filter === 'DITINDAKLANJUTI' ? 'active' : ''} onClick={() => setFilter('DITINDAKLANJUTI')}>Ditindaklanjuti</button></div></div>{items === null ? <Loading/> : items.length === 0 ? <Empty title="Tidak ada pengajuan" text="Pengajuan suku cadang dari laporan akan tampil di sini."/> : <div className="request-cards">{items.map(x => <section className="panel request-card" key={x.id}><div className="request-head"><div><span className="eyebrow">{x.laporan?.kode}</span><h3>{x.namaBarang}</h3><p>{x.laporan?.ruang?.gedung?.namaGedung} · {x.laporan?.ruang?.namaRuang}</p></div><strong className="price">{money(x.nilai)}</strong></div><p>{x.catatan || 'Tidak ada catatan tambahan.'}</p><StatusBadge value={x.status}/>{x.status === 'MENUNGGU' && ['ADMIN','KEUANGAN'].includes(user.role) && <div className="follow-form"><input value={note[x.id] || ''} onChange={e => setNote({ ...note, [x.id]: e.target.value })} placeholder="Catatan tindak lanjut wajib diisi"/><button className="primary" disabled={!note[x.id]?.trim()} onClick={() => follow(x.id)}>Tandai selesai</button></div>}</section>)}</div>}{showForm && <SparePartForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} onToast={onToast}/>}</PageFrame> }

function MasterModal({ tab, editing, buildings, onClose, onSaved, onToast }) {
  const [form, setForm] = useState(() => ({
    nama: editing?.nama || '',
    bidang: editing?.bidang || 'LISTRIK',
    namaGedung: editing?.namaGedung || '',
    gedungId: editing?.gedungId ? String(editing.gedungId) : (buildings[0]?.id ? String(buildings[0].id) : ''),
    namaRuang: editing?.namaRuang || '',
    namaJenis: editing?.namaJenis || '',
    username: '',
    password: '',
    role: 'PELAPOR',
    kontak: '',
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      if (tab === 'teknisi') {
        if (editing) await api(`/master/teknisi/${editing.id}`, { method: 'PUT', body: JSON.stringify({ nama: form.nama, bidang: form.bidang }) })
        else {
          const payload = { nama: form.nama, bidang: form.bidang }
          if (form.username.trim()) { payload.username = form.username.trim(); payload.password = form.password }
          await api('/master/teknisi', { method: 'POST', body: JSON.stringify(payload) })
        }
      } else if (tab === 'gedung') {
        if (editing) await api(`/master/gedung/${editing.id}`, { method: 'PUT', body: JSON.stringify({ namaGedung: form.namaGedung }) })
        else await api('/master/gedung', { method: 'POST', body: JSON.stringify({ namaGedung: form.namaGedung }) })
      } else if (tab === 'ruang') {
        const payload = { namaRuang: form.namaRuang, gedungId: Number(form.gedungId) }
        if (editing) await api(`/master/ruang/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        else await api('/master/ruang', { method: 'POST', body: JSON.stringify(payload) })
      } else if (tab === 'jenis-kerusakan') {
        const payload = { namaJenis: form.namaJenis, bidang: form.bidang }
        if (editing) await api(`/master/jenis-kerusakan/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        else await api('/master/jenis-kerusakan', { method: 'POST', body: JSON.stringify(payload) })
      } else if (tab === 'users') {
        const payload = { username: form.username, password: form.password, nama: form.nama, role: form.role }
        if (form.kontak.trim()) payload.kontak = form.kontak.trim()
        await api('/master/users', { method: 'POST', body: JSON.stringify(payload) })
      }
      onToast(editing ? 'Data master diperbarui' : 'Data master ditambahkan')
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const titles = { teknisi: 'Teknisi', gedung: 'Gedung', ruang: 'Ruang', 'jenis-kerusakan': 'Jenis Kerusakan', users: 'Pengguna' }
  return <Modal title={`${editing ? 'Edit' : 'Tambah'} ${titles[tab]}`} onClose={onClose}>
    <form className="modal-form" onSubmit={submit}>
      <div className="form-grid">
        {tab === 'teknisi' && <>
          <label>Nama teknisi<input value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} required /></label>
          <label>Bidang<select value={form.bidang} onChange={e => setForm({ ...form, bidang: e.target.value })}><option value="LISTRIK">LISTRIK</option><option value="AC">AC</option><option value="BANGUNAN">BANGUNAN</option><option value="AIR">AIR</option></select></label>
          {!editing && <>
            <label>Username akun (opsional)<input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} minLength={3} placeholder="Minimal 3 karakter" /></label>
            <label>Password akun<input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} minLength={6} required={Boolean(form.username.trim())} placeholder="Minimal 6 karakter" /></label>
          </>}
        </>}
        {tab === 'gedung' && <label className="span-2">Nama gedung<input value={form.namaGedung} onChange={e => setForm({ ...form, namaGedung: e.target.value })} required /></label>}
        {tab === 'ruang' && <>
          <label>Gedung<select value={form.gedungId} onChange={e => setForm({ ...form, gedungId: e.target.value })} required>{buildings.map(b => <option key={b.id} value={b.id}>{b.namaGedung}</option>)}</select></label>
          <label>Nama ruang<input value={form.namaRuang} onChange={e => setForm({ ...form, namaRuang: e.target.value })} required /></label>
        </>}
        {tab === 'jenis-kerusakan' && <>
          <label>Nama jenis kerusakan<input value={form.namaJenis} onChange={e => setForm({ ...form, namaJenis: e.target.value })} required /></label>
          <label>Bidang<select value={form.bidang} onChange={e => setForm({ ...form, bidang: e.target.value })}><option value="LISTRIK">LISTRIK</option><option value="AC">AC</option><option value="BANGUNAN">BANGUNAN</option><option value="AIR">AIR</option></select></label>
        </>}
        {tab === 'users' && <>
          <label>Nama lengkap<input value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} required /></label>
          <label>Peran<select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="PELAPOR">Pelapor</option><option value="KEUANGAN">Bagian Keuangan</option><option value="KEPALA_UNIT">Kepala Unit</option><option value="ADMIN">Admin</option></select></label>
          <label>Username<input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} minLength={3} required /></label>
          <label>Password<input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} minLength={6} required /></label>
          {form.role === 'PELAPOR' && <label className="span-2">Kontak (opsional)<input value={form.kontak} onChange={e => setForm({ ...form, kontak: e.target.value })} placeholder="Nomor HP / WhatsApp" /></label>}
        </>}
      </div>
      {error && <div className="inline-error">{error}</div>}
      <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Batal</button><button className="primary" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan'} <CheckCircle2 size={16} /></button></div>
    </form>
  </Modal>
}

function Master({ user, onToast }) {
  const [tab, setTab] = useState('teknisi'); const [items, setItems] = useState(null); const [buildings, setBuildings] = useState([]); const [modal, setModal] = useState(null)
  async function load(activeTab = tab) {
    try {
      const [r, g] = await Promise.all([api(`/master/${activeTab}`), activeTab === 'ruang' ? api('/master/gedung') : Promise.resolve(null)])
      setItems(r.data || [])
      if (g) setBuildings(g.data || [])
    } catch (e) { onToast(e.message, 'error'); setItems([]) }
  }
  useEffect(() => { load(tab) }, [tab])

  async function toggleActive(x) {
    try {
      if (tab === 'teknisi') await api(`/master/teknisi/${x.id}`, { method: 'PUT', body: JSON.stringify({ aktif: !x.aktif }) })
      else if (tab === 'users') await api(`/master/users/${x.id}/aktif`, { method: 'PATCH', body: JSON.stringify({ aktif: !x.aktif }) })
      onToast('Status diperbarui'); load()
    } catch (e) { onToast(e.message, 'error') }
  }
  async function removeItem(x) {
    try { await api(`/master/${tab}/${x.id}`, { method: 'DELETE' }); onToast('Data dihapus'); load() } catch (e) { onToast(e.message, 'error') }
  }

  const tabs = [['teknisi','Teknisi'],['gedung','Gedung'],['ruang','Ruang'],['jenis-kerusakan','Jenis kerusakan'],['users','Pengguna']]
  return <PageFrame title="Data Master" subtitle="Kelola referensi operasional sistem helpdesk." action={<button className="primary" onClick={() => setModal({ editing: null })}><Plus size={17}/> Tambah</button>}><div className="report-tabs master-tabs">{tabs.map(([id,label]) => <button className={tab === id ? 'active' : ''} key={id} onClick={() => { setTab(id); setItems(null) }}><Settings2 size={16}/>{label}</button>)}</div>{items === null ? <Loading/> : items.length === 0 ? <Empty title="Data belum tersedia"/> : <div className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>Nama</th><th>Informasi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{items.map(x => <tr key={x.id}><td><strong>{x.nama || x.namaGedung || x.namaRuang || x.namaJenis || x.username}</strong>{tab === 'users' && <small>@{x.username}</small>}</td><td>{tab === 'ruang' ? (x.gedung?.namaGedung || '-') : (x.bidang || x.kontak || roleLabels[x.role] || '-')}</td><td>{x.aktif === false ? 'Nonaktif' : 'Aktif'}</td><td className="row-actions">{['teknisi', 'gedung', 'ruang', 'jenis-kerusakan'].includes(tab) && <button className="text-button" onClick={() => setModal({ editing: x })}>Edit</button>}{['teknisi', 'users'].includes(tab) && <button className="text-button" disabled={tab === 'users' && x.id === user?.id} onClick={() => toggleActive(x)}>{x.aktif === false ? 'Aktifkan' : 'Nonaktifkan'}</button>}{['gedung', 'ruang'].includes(tab) && <button className="text-button danger-text" onClick={() => removeItem(x)}>Hapus</button>}</td></tr>)}</tbody></table></div></div>}{modal && <MasterModal tab={tab} editing={modal.editing} buildings={buildings} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} onToast={onToast} />}</PageFrame>
}
function Modal({ title, children, onClose }) { return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="modal"><div className="modal-head"><div><p className="eyebrow">FORM OPERASIONAL</p><h2>{title}</h2></div><button className="icon-button" onClick={onClose}><X size={19}/></button></div>{children}</div></div> }
function Profile({ user, onToast }) { const [form, setForm] = useState({ passwordLama: '', passwordBaru: '' }); async function submit(e) { e.preventDefault(); try { await api('/auth/ganti-password', { method: 'POST', body: JSON.stringify(form) }); onToast('Password berhasil diganti'); setForm({ passwordLama: '', passwordBaru: '' }) } catch(e) { onToast(e.message, 'error') } } return <PageFrame title="Profil & Keamanan" subtitle="Kelola informasi akun dan kredensial Anda."><section className="panel profile-card"><div className="profile-cover"><div className="avatar large">{user.nama?.slice(0,1)}</div><div><h2>{user.nama}</h2><p>{roleLabels[user.role]} · @{user.username}</p></div></div><form className="password-form" onSubmit={submit}><h3>Ganti password</h3><div className="form-grid"><PasswordField label="Password lama" value={form.passwordLama} onChange={e => setForm({ ...form, passwordLama: e.target.value })} /><PasswordField label="Password baru" minLength="6" value={form.passwordBaru} onChange={e => setForm({ ...form, passwordBaru: e.target.value })} /></div><button className="primary">Simpan password</button></form></section></PageFrame> }

function App() { const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('helpdesk_user') || 'null')); const [page, setPage] = useState('dashboard'); const [detailId, setDetailId] = useState(null); const [collapsed, setCollapsed] = useState(false); const [toast, setToast] = useState(null); const [filter, setFilter] = useState({}); const [createOpen, setCreateOpen] = useState(false); const [reportsRefreshKey, setReportsRefreshKey] = useState(0); const navigate = (p, idOrNew, f = {}) => { if (p === 'detail') setDetailId(idOrNew); if (p === 'laporan' && idOrNew === true) setCreateOpen(true); setFilter(f); setPage(p) }; const notify = (message, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 4500) }; if (!user) return <Login onLogin={setUser}/>; function logout() { localStorage.removeItem('helpdesk_token'); localStorage.removeItem('helpdesk_user'); setUser(null) } function content() { if (page === 'dashboard') return <Dashboard user={user} onNavigate={navigate}/>; if (page === 'laporan') return <PageFrame title="Laporan Kerusakan" subtitle="Kelola laporan fasilitas dari pencatatan hingga penyelesaian." action={user.role === 'ADMIN' ? <button className="primary" onClick={() => setCreateOpen(true)}><Plus size={17}/> Catat laporan</button> : null}><ReportsPage onNavigate={navigate} initialFilters={filter} refreshKey={reportsRefreshKey}/></PageFrame>; if (page === 'detail') return <DetailPage id={detailId} user={user} onBack={() => setPage(user.role === 'TEKNISI' ? 'pekerjaan' : 'laporan')} onToast={notify}/>; if (page === 'pekerjaan') return <PageFrame title="Pekerjaan Saya" subtitle="Tugas yang ditugaskan kepada Anda."><JobsPage onNavigate={navigate}/></PageFrame>; if (page === 'manajemen') return <Management user={user} onToast={notify}/>; if (page === 'pengajuan') return <Requests user={user} onToast={notify}/>; if (page === 'master') return <Master user={user} onToast={notify}/>; return <Profile user={user} onToast={notify}/> } return <div className="app-shell"><Sidebar user={user} page={page} setPage={setPage} collapsed={collapsed} setCollapsed={setCollapsed} onLogout={logout}/><main className="main"><Topbar user={user} page={page} onMenu={() => setCollapsed(!collapsed)} onRefresh={() => window.location.reload()} onNavigate={navigate}/>{content()}</main>{createOpen && <ReportForm onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); setReportsRefreshKey(k => k + 1); notify('Laporan berhasil disimpan'); setPage('laporan') }}/>}<Toast toast={toast} onClose={() => setToast(null)}/></div> }

createRoot(document.getElementById('root')).render(<App />)
