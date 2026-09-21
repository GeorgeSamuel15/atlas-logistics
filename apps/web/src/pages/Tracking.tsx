import { ThemeToggle } from '../theme';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Package, ArrowRight } from 'lucide-react';
import { api, Badge, date, ErrorBox } from '../lib';
interface Track {
    tracking: string;
    status: string;
    service: string;
    dueAt: string;
    createdAt: string;
    events: {
        status: string;
        created_at: string;
    }[];
}
export function Tracking() { const [params] = useSearchParams(); const [number, setNumber] = useState(params.get('number') || ''), [data, setData] = useState<Track | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false); return <div className="tracking-page"><header><Link className="logo dark" to="/">A<span>ATLAS<small>LOGISTICS PLATFORM</small></span></Link><div className="button-row"><ThemeToggle/><Link className="button" to="/">Back to workspace</Link></div></header><main><span className="eyebrow">STAY CONNECTED TO YOUR DELIVERY</span><h1>Where’s your parcel?</h1><p>Enter your tracking number to see the latest shipment updates.</p><form className="tracking-form" onSubmit={async (e) => { e.preventDefault(); setError(''); setData(null); setBusy(true); try {
    setData(await api<Track>('/track/' + encodeURIComponent(number.trim())));
}
catch (e) {
    setError((e as Error).message);
}
finally {
    setBusy(false);
} }}><Package size={21}/><input aria-label="Tracking number" required placeholder="ATL-…" value={number} onChange={e => setNumber(e.target.value)}/><button className="primary" disabled={busy}>{busy ? 'Searching…' : 'Track shipment'}<ArrowRight size={17}/></button></form><ErrorBox message={error}/>{data && <section className="panel"><div className="panel-heading"><h2>{data.tracking}</h2><Badge value={data.status}/></div><p>Service: {data.service.replaceAll('_', ' ')} · Expected by {date(data.dueAt)}</p><ol className="timeline">{data.events.map((e, i) => <li key={i}><span /><div><strong>{e.status.replaceAll('_', ' ')}</strong><p>{date(e.created_at)}</p></div></li>)}</ol><p className="muted">Refresh by submitting the tracking number again. Personal details are visible only in the signed-in workspace.</p></section>}</main></div>; }
