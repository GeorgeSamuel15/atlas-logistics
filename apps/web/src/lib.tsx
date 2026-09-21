import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@atlas/shared';
export let csrf = '';
export function setCsrf(value: string) { csrf = value; }
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> { const response = await fetch('/api' + path, { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf, ...options.headers } }); const data = await response.json(); if (!response.ok)
    throw new Error(data.error || 'Request failed'); return data as T; }
export const post = <T,>(path: string, body: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const patch = <T,>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const AppContext = createContext<{
    user: User;
    refresh: number;
    reload: () => void;
    toast: (m: string) => void;
}>({ user: null!, refresh: 0, reload: () => { }, toast: () => { } });
export const useApp = () => useContext(AppContext);
export function useData<T>(path: string | null) { const { refresh } = useApp(); const [state, setState] = useState<{
    data: T | null;
    error: string;
    loading: boolean;
}>({ data: null, error: '', loading: true }); useEffect(() => { let active = true; if (!path) {
    setState({ data: null, error: '', loading: false });
    return;
} setState(s => ({ ...s, error: '', loading: true })); api<T>(path).then(data => { if (active)
    setState({ data, error: '', loading: false }); }).catch(e => { if (active)
    setState(s => ({ ...s, error: e.message, loading: false })); }); return () => { active = false; }; }, [path, refresh]); return state; }
export function date(value: string | null | undefined) { return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'; }
export function ErrorBox({ message }: {
    message: string;
}) { return message ? <div className="alert error" role="alert">{message}</div> : null; }
export function Loading() { return <div className="loading" role="status">Loading your workspace…</div>; }
export function Empty({ children }: {
    children: ReactNode;
}) { return <div className="empty">{children}</div>; }
export function Badge({ value }: {
    value: string;
}) { return <span className={'badge ' + value.toLowerCase()}>{value.replaceAll('_', ' ')}</span>; }
export function PageTitle({ eyebrow, title, subtitle, action }: {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    action?: ReactNode;
}) { return <div className="page-heading"><div><span className="eyebrow">{eyebrow || 'ATLAS WORKSPACE'}</span><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>; }
export function Panel({ title, children, action }: {
    title?: string;
    children: ReactNode;
    action?: ReactNode;
}) { return <section className="panel">{(title || action) && <div className="panel-heading"><h2>{title}</h2>{action}</div>}{children}</section>; }
export type Field = {
    name: string;
    label: string;
    type?: string;
    value?: string | number;
    options?: {
        value: string;
        label: string;
    }[];
    required?: boolean;
    min?: number;
    max?: number;
    step?: string;
    placeholder?: string;
};
export function Form({ fields, submit, onSubmit, children }: {
    fields: Field[];
    submit: string;
    onSubmit: (values: Record<string, string>) => Promise<unknown>;
    children?: ReactNode;
}) { const [busy, setBusy] = useState(false), [error, setError] = useState(''); return <form onSubmit={async (e) => { e.preventDefault(); setError(''); setBusy(true); const values = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>; try {
    await onSubmit(values);
}
catch (e) {
    setError((e as Error).message);
}
finally {
    setBusy(false);
} }}><div className="form-grid">{fields.map(f => <label key={f.name} className={f.type === 'textarea' ? 'wide' : ''}>{f.label}{f.type === 'select' ? <select aria-label={f.label} name={f.name} required={f.required !== false} defaultValue={f.value ?? ''}><option value="">Select…</option>{f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : f.type === 'textarea' ? <textarea aria-label={f.label} name={f.name} defaultValue={f.value} required={f.required !== false} rows={3} maxLength={3000}/> : <input aria-label={f.label} name={f.name} type={f.type || 'text'} defaultValue={f.value} required={f.required !== false} min={f.min} max={f.max} step={f.step} maxLength={f.type === 'password' ? 128 : 250} placeholder={f.placeholder}/>}</label>)}</div>{children}<ErrorBox message={error}/><button className="primary" disabled={busy}>{busy ? 'Saving…' : submit}</button></form>; }
export function Action({ children, run, className = 'secondary', confirm }: {
    children: ReactNode;
    run: () => Promise<unknown>;
    className?: string;
    confirm?: string;
}) { const [busy, setBusy] = useState(false), [error, setError] = useState(''); const { reload } = useApp(); return <><button className={className} disabled={busy} onClick={async () => { if (confirm && !window.confirm(confirm))
    return; setBusy(true); setError(''); try {
    await run();
    reload();
}
catch (e) {
    setError((e as Error).message);
}
finally {
    setBusy(false);
} }}>{busy ? 'Working…' : children}</button><ErrorBox message={error}/></>; }
export const options = (values: readonly string[]) => values.map(value => ({ value, label: value.replaceAll('_', ' ') }));
