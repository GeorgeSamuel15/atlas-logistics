import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, NavLink, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Package, Truck, Route as RouteIcon, Warehouse, Users, Receipt, LifeBuoy, BarChart3, Settings, ShieldCheck, Bell, LogOut, Menu, ArrowUpRight, Search } from 'lucide-react';
import type { Role, User } from '@atlas/shared';
import { api, post, setCsrf, AppContext, Form, ErrorBox, Loading } from './lib';
import { Dashboard } from './pages/Dashboard';
import { Shipments, Booking, ShipmentDetail } from './pages/Shipments';
import { Fleet, Hubs, RoutesPage, Directory } from './pages/Operations';
import { Billing, InvoiceDetail, Support, Notifications, Reports, SettingsPage, Audit, Account } from './pages/Management';
import { Tracking } from './pages/Tracking';
import './style.css';
import { ThemeToggle } from './theme';
const nav = [{ path: '/', label: 'Overview', icon: LayoutDashboard, roles: ['ADMIN', 'DISPATCHER', 'WAREHOUSE', 'FINANCE', 'DRIVER', 'CUSTOMER'] }, { path: '/shipments', label: 'Shipments', icon: Package, roles: ['ADMIN', 'DISPATCHER', 'WAREHOUSE', 'FINANCE', 'DRIVER', 'CUSTOMER'] }, { path: '/dispatch', label: 'Dispatch board', icon: Truck, roles: ['ADMIN', 'DISPATCHER'] }, { path: '/routes', label: 'Routes & manifests', icon: RouteIcon, roles: ['ADMIN', 'DISPATCHER', 'DRIVER'] }, { path: '/fleet', label: 'Fleet management', icon: Truck, roles: ['ADMIN', 'DISPATCHER'] }, { path: '/hubs', label: 'Hubs & warehouse', icon: Warehouse, roles: ['ADMIN', 'DISPATCHER', 'WAREHOUSE'] }, { path: '/customers', label: 'Customers', icon: Users, roles: ['ADMIN', 'DISPATCHER', 'FINANCE'] }, { path: '/billing', label: 'Invoices & payments', icon: Receipt, roles: ['ADMIN', 'FINANCE', 'CUSTOMER'] }, { path: '/support', label: 'Support desk', icon: LifeBuoy, roles: ['ADMIN', 'DISPATCHER', 'CUSTOMER'] }, { path: '/reports', label: 'Reports', icon: BarChart3, roles: ['ADMIN', 'DISPATCHER', 'FINANCE'] }, { path: '/team', label: 'Team & access', icon: ShieldCheck, roles: ['ADMIN'] }, { path: '/settings', label: 'Settings & pricing', icon: Settings, roles: ['ADMIN'] }, { path: '/audit', label: 'Audit trail', icon: ShieldCheck, roles: ['ADMIN'] }];
function Login({ done }: {
    done: (data: {
        user: User;
        csrf: string;
    }) => void;
}) { const [register, setRegister] = useState(false); return <div className="auth-page"><ThemeToggle floating/><section className="auth-brand"><Link className="logo" to="/">A<span>ATLAS<small>LOGISTICS PLATFORM</small></span></Link><div><span className="eyebrow">EVERY MILE. CONNECTED.</span><h1>Keep your world<br />moving.</h1><p>One workspace for the people, parcels, and decisions behind every delivery.</p><div className="auth-tags"><span>Operations</span><span>Fleet</span><span>Customer experience</span></div></div><small>Built for connected logistics teams.</small></section><section className="auth-form"><div><span className="eyebrow">WELCOME TO ATLAS</span><h2>{register ? 'Create your customer account' : 'Sign in to your workspace'}</h2><p>Manage deliveries from booking to the final handoff.</p><Form key={String(register)} submit={register ? 'Create account' : 'Sign in'} fields={[...(register ? [{ name: 'name', label: 'Your name' }, { name: 'phone', label: 'Phone number' }] : []), { name: 'email', label: 'Email address', type: 'email' }, { name: 'password', label: 'Password', type: 'password' }]} onSubmit={async (v) => { const data = await post<{
    user: User;
    csrf: string;
}>('/auth/' + (register ? 'register' : 'login'), v); done(data); }}/><button className="text-button" onClick={() => setRegister(!register)}>{register ? 'Already have an account? Sign in' : 'New customer? Create an account'}</button><Link className="tracking-link" to="/track">Track a shipment without signing in <ArrowUpRight size={16}/></Link><p className="muted">Sign in with your account. New customers can register above.</p></div></section></div>; }
function App() {
    const [user, setUser] = useState<User | null>(null), [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0), [toast, setToast] = useState(''), [open, setOpen] = useState(false);
    const location = useLocation();
    useEffect(() => { api<{
        user: User;
        csrf: string;
    }>('/auth/me').then(d => { setUser(d.user); setCsrf(d.csrf); }).catch(() => { }).finally(() => setLoading(false)); }, []);
    useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [location.pathname]);
    useEffect(() => { if (toast) {
        const t = setTimeout(() => setToast(''), 4500);
        return () => clearTimeout(t);
    } }, [toast]);
    if (location.pathname.startsWith('/track'))
        return <Tracking />;
    if (loading)
        return <Loading />;
    if (!user)
        return <Login done={d => { setUser(d.user); setCsrf(d.csrf); }}/>;
    const allowed = (roleList: Role[], element: React.ReactNode) => roleList.includes(user.role) ? element : <Navigate to="/" replace/>;
    return <AppContext.Provider value={{ user, refresh, reload: () => setRefresh(v => v + 1), toast: setToast }}><div className="app-shell"><aside className={'sidebar ' + (open ? 'open' : '')}><Link className="logo" to="/">A<span>ATLAS<small>LOGISTICS PLATFORM</small></span></Link><div className="workspace-name"><span className="workspace-icon">AL</span><div>Atlas workspace<small>{user.role.replaceAll('_', ' ')} ACCESS</small></div></div><p className="nav-label">WORKSPACE</p><nav>{nav.filter(n => n.roles.includes(user.role)).map(n => <NavLink key={n.path} to={n.path} end={n.path === '/'}><n.icon size={18}/>{n.path === '/shipments' && user.role === 'DRIVER' ? 'My deliveries' : n.label}</NavLink>)}</nav><div className="sidebar-bottom"><Link to="/account" className="profile"><span className="avatar">{user.name.slice(0, 2).toUpperCase()}</span><div>{user.name}<small>{user.email}</small></div></Link><button aria-label="Sign out" onClick={async () => { try {
        await post('/auth/logout', {});
        setUser(null);
        setCsrf('');
    }
    catch (e) {
        setToast((e as Error).message);
    } }}><LogOut size={18}/></button></div></aside>{open && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setOpen(false)}/>}<div className="main-shell"><header className="topbar"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setOpen(!open)}><Menu /></button><span>Workspace <span className="slash">/</span> <strong>{nav.find(n => n.path === location.pathname || (n.path !== '/' && location.pathname.startsWith(n.path + '/')))?.label || 'Workspace'}</strong></span><div><ThemeToggle/><Link to="/track" className="top-link"><Search size={16}/> Track parcel</Link><Link to="/notifications" className="icon-button" aria-label="Notifications"><Bell size={19}/></Link></div></header><main className="content"><Routes><Route path="/" element={<Dashboard />}/><Route path="/shipments" element={<Shipments />}/><Route path="/shipments/new" element={allowed(['ADMIN', 'DISPATCHER', 'CUSTOMER'], <Booking />)}/><Route path="/shipments/:id" element={<ShipmentDetail />}/><Route path="/dispatch" element={allowed(['ADMIN', 'DISPATCHER'], <Shipments dispatch/>)}/><Route path="/routes" element={allowed(['ADMIN', 'DISPATCHER', 'DRIVER'], <RoutesPage />)}/><Route path="/fleet" element={allowed(['ADMIN', 'DISPATCHER'], <Fleet />)}/><Route path="/hubs" element={allowed(['ADMIN', 'DISPATCHER', 'WAREHOUSE'], <Hubs />)}/><Route path="/customers" element={allowed(['ADMIN', 'DISPATCHER', 'FINANCE'], <Directory customers/>)}/><Route path="/team" element={allowed(['ADMIN'], <Directory />)}/><Route path="/billing" element={allowed(['ADMIN', 'FINANCE', 'CUSTOMER'], <Billing />)}/><Route path="/billing/:id" element={allowed(['ADMIN', 'FINANCE', 'CUSTOMER'], <InvoiceDetail />)}/><Route path="/support" element={allowed(['ADMIN', 'DISPATCHER', 'CUSTOMER'], <Support />)}/><Route path="/reports" element={allowed(['ADMIN', 'DISPATCHER', 'FINANCE'], <Reports />)}/><Route path="/settings" element={allowed(['ADMIN'], <SettingsPage />)}/><Route path="/audit" element={allowed(['ADMIN'], <Audit />)}/><Route path="/notifications" element={<Notifications />}/><Route path="/account" element={<Account logout={() => setUser(null)}/>}/><Route path="*" element={<Navigate to="/"/>}/></Routes></main><footer className="app-footer"><span>Atlas Logistics</span><span>All times shown in your local timezone · USD</span></footer></div>{toast && <div className="toast" role="status">{toast}</div>}</div></AppContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><App /></BrowserRouter>);
