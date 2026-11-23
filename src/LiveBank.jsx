
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Chip, MenuItem, TextField } from '@mui/material';
import {
  ArrowLeftRight, Crown, Globe2, Landmark, List, LogOut, Moon,
  RefreshCw, Send, ShieldCheck, Sun,
} from 'lucide-react';
import { toPaise } from './amount';
import {
  configuredEndpoint,
  liveApi,
  parseEndpoint,
  readStorage,
  saveStorage,
} from './live-api';
import { signInWithEmail, listDocuments } from './firebase-api';
import AdminDashboard from './AdminDashboard';
import './live.css';

const money = minor => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
}).format(minor / 100);

const time = value => value ? new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Kolkata',
}).format(new Date(value)) : '—';

const statusNames = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  MANUAL_REVIEW: 'Manual review',
};

const rejectionNames = {
  INSUFFICIENT_FUNDS: 'Insufficient available balance',
  LIMIT_EXCEEDED: 'Transfer limit exceeded',
  DESTINATION_ACCOUNT_UNAVAILABLE: 'The destination is unavailable',
};

const byId = (directory, id) =>
  directory.find(bank => bank.bankId === id)?.bankName || id;

function TransferForm({ bank, accounts, directory, send }) {
  const [type, setType] = useState('interbank');
  const [from, setFrom] = useState('');
  const [destination, setDestination] = useState('');
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('200');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const sources = accounts.filter(account => account.status === 'ACTIVE');

  const fromId = sources.some(item => item.accountId === from)
    ? from
    : (sources[0]?.accountId || '');

  const routes = directory.filter(item =>
    item.bankId !== bank.id && item.status === 'ACTIVE'
  );

  const route = destination
    ? (routes.find(item => item.ifsc === destination)?.ifsc || '')
    : (routes[0]?.ifsc || '');

  const target = type === 'internal' ? bank.ifsc : route;

  async function submit(event) {
    event.preventDefault();
    setError('');

    const amountMinor = toPaise(amount);

    if (!fromId || !target || !number.trim() || amountMinor === null) {
      setError(
        'Choose a source, destination and positive amount with at most two decimal places.'
      );
      return;
    }

    setBusy(true);

    try {
      await send({
        fromAccountId: fromId,
        destinationIfsc: target,
        destinationAccountNumber: number.trim(),
        amountMinor,
        currency: 'INR',
      });

      setNumber('');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel live-transfer">
      <header className="panel-head">
        <div>
          <span className="eyebrow">Payments</span>
          <h2>Send a test transfer</h2>
          <p>Transfers use synthetic balances stored in Firestore.</p>
        </div>

        <span className="head-icon">
          <Send size={18} strokeWidth={1.6} />
        </span>
      </header>

      <form className="transfer-form" onSubmit={submit}>
        <div className="type-switch" role="group" aria-label="Transfer type">
          {[['interbank', 'Interbank'], ['internal', 'Same bank']].map(
            ([value, label]) => (
              <Button
                key={value}
                type="button"
                aria-pressed={type === value}
                variant={type === value ? 'contained' : 'outlined'}
                disabled={busy}
                onClick={() => setType(value)}
              >
                {label}
              </Button>
            )
          )}
        </div>

        <TextField
          select
          label="From account"
          required
          value={fromId}
          onChange={e => setFrom(e.target.value)}
          disabled={busy || !sources.length}
        >
          {sources.map(account => (
            <MenuItem key={account.accountId} value={account.accountId}>
              {account.accountNumber} · {money(account.availableMinor)} available
            </MenuItem>
          ))}
        </TextField>

        {type === 'interbank' && (
          <TextField
            select
            label="Destination bank"
            required
            value={route}
            onChange={e => setDestination(e.target.value)}
            disabled={busy || !routes.length}
          >
            {routes.map(item => (
              <MenuItem key={item.ifsc} value={item.ifsc}>
                {item.bankName} · {item.ifsc}
              </MenuItem>
            ))}
          </TextField>
        )}

        <TextField
          label="Destination account number"
          required
          value={number}
          onChange={e => setNumber(e.target.value)}
          disabled={busy}
        />

        <TextField
          label="Amount in INR"
          required
          value={amount}
          onChange={e => setAmount(e.target.value)}
          disabled={busy}
          slotProps={{ htmlInput: { inputMode: 'decimal' } }}
        />

        {error && <Alert severity="error">{error}</Alert>}

        <div>
          <Button
            type="submit"
            variant="contained"
            disabled={busy || !fromId || !target}
            startIcon={<Send size={16} />}
          >
            {busy ? 'Submitting…' : 'Submit transfer'}
          </Button>
        </div>
      </form>
    </section>
  );
}

function Activity({ rows, directory }) {
  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <span className="eyebrow">Ledger</span>
          <h2>Transfer activity</h2>
          <p>Latest 50 transfers for this user</p>
        </div>

        <span className="head-icon">
          <List size={18} strokeWidth={1.6} />
        </span>
      </header>

      {rows.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Transfer</th>
                <th>Route</th>
                <th className="num">Amount</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {rows.map(row => (
                <tr key={row.transferId}>
                  <td>
                    <strong className="mono">{row.transferId}</strong>
                    <small>{time(row.createdAt)}</small>
                  </td>

                  <td>
                    <strong>
                      {byId(directory, row.sourceBankId)} →{' '}
                      {byId(directory, row.destinationBankId)}
                    </strong>
                    <small>
                      {row.type === 'INTERNAL'
                        ? 'Same bank'
                        : row.direction === 'CREDIT'
                          ? 'Incoming'
                          : 'Outgoing'}
                    </small>
                  </td>

                  <td
                    className={
                      row.direction === 'CREDIT'
                        ? 'incoming amount num'
                        : 'amount num'
                    }
                  >
                    {row.direction === 'CREDIT' ? '+ ' : '− '}
                    {money(row.amountMinor)}
                  </td>

                  <td>
                    <Chip
                      size="small"
                      label={statusNames[row.status] || row.status}
                      className={
                        row.status === 'COMPLETED'
                          ? 'completed'
                          : 'live-' + row.status?.toLowerCase()
                      }
                    />

                    {row.code && (
                      <small>
                        {rejectionNames[row.code] ||
                          row.code.toLowerCase().replaceAll('_', ' ')}
                      </small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <ArrowLeftRight size={23} strokeWidth={1.5} />
          <strong>No transfers yet</strong>
          <p>Your transfers appear here when the Worker accepts them.</p>
        </div>
      )}
    </section>
  );
}

export default function LiveBank({
  bank,
  switchUrl,
  openDemo,
  mode,
  onToggleMode,
}) {
  const urlKey = 'x42-cloudflare-worker-url';

  const [base, setBase] = useState(() =>
    configuredEndpoint || readStorage(localStorage, urlKey, '')
  );

  const [session, setSession] = useState(null);

  // Separate Firebase Admin authentication state.
  const [adminSession, setAdminSession] = useState(null);
  const [authMode, setAuthMode] = useState('customer');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const prefix = '/banks/' + bank.id;

  const [url, setUrl] = useState(base);
  const [editUrl, setEditUrl] = useState(!base);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [data, setData] = useState({ accounts: [], transfers: [] });
  const [directory, setDirectory] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const activeToken = useRef(null);
  activeToken.current = session?.token;

  const pending = useRef(new Map());

  const refresh = useCallback(async signal => {
    if (!session) return;

    try {
      const value = await liveApi(base, prefix + '/dashboard', {
        token: session.token,
        signal,
      });

      if (signal?.aborted || activeToken.current !== session.token) return;

      setData(value);
      setLoaded(true);
      setError('');
    } catch (failure) {
      if (signal?.aborted || activeToken.current !== session.token) return;

      if (failure.status === 401) {
        setSession(null);
        setData({ accounts: [], transfers: [] });
        setLoaded(false);
      }

      setError(failure.message);
    }
  }, [base, prefix, session]);

  useEffect(() => {
    if (!session) return undefined;

    const controller = new AbortController();

    const update = () => {
      if (document.visibilityState === 'visible') {
        refresh(controller.signal);
      }
    };

    refresh(controller.signal);

    const timer = setInterval(update, 12_000);
    document.addEventListener('visibilitychange', update);

    return () => {
      clearInterval(timer);
      controller.abort();
      document.removeEventListener('visibilitychange', update);
    };
  }, [session, refresh]);

  useEffect(() => {
    if (!session) return undefined;

    const controller = new AbortController();

    liveApi(base, '/directory/banks', {
      signal: controller.signal,
    })
      .then(value => setDirectory(value.banks || []))
      .catch(failure => {
        if (!controller.signal.aborted) {
          setError(failure.message);
        }
      });

    return () => controller.abort();
  }, [base, session]);

  function logout() {
    setSession(null);
    setLoaded(false);
    setData({ accounts: [], transfers: [] });
    setNote('');
    setError('');
    setAuthMode('customer');
  }

  async function signIn(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const value = await liveApi(base, prefix + '/sign-in', {
        data: {
          email: email.trim(),
          password,
        },
      });

      setSession(value);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPassword('');
      setBusy(false);
    }
  }

  // Authenticate using Firebase and verify Admin-only Firestore access.
  async function signInAdmin(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNote('');

    try {
      const value = await signInWithEmail(
        adminEmail.trim(),
        adminPassword
      );

      if (!value.idToken || !value.localId) {
        throw new Error(
          'Firebase did not return the required authentication details.'
        );
      }

      // Firestore rules allow this collection to be read by the Admin only.
      await listDocuments('rrb_audit_logs', value.idToken);

      setAdminSession({
        idToken: value.idToken,
        uid: value.localId,
        email: value.email || adminEmail.trim(),
      });

      setAdminPassword('');
    } catch (failure) {
      setAdminSession(null);
      setError(
        failure.message ||
        'Admin sign-in failed. Check your credentials and Firestore permissions.'
      );
    } finally {
      setAdminPassword('');
      setBusy(false);
    }
  }

  function connect(event) {
    event.preventDefault();
    setError('');

    try {
      const endpoint = parseEndpoint(url);

      if (endpoint !== base) {
        logout();
        setDirectory([]);
      }

      saveStorage(localStorage, urlKey, endpoint);
      setBase(endpoint);
      setEditUrl(false);
    } catch (failure) {
      setError(failure.message);
    }
  }

  async function send(transfer) {
    const raw = JSON.stringify([bank.id, base, session.uid, transfer]);

    const bytes = new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(raw)
      )
    );

    const hash = Array.from(bytes, byte =>
      byte.toString(16).padStart(2, '0')
    ).join('');

    const keyName = 'x42-pending-' + hash;

    const key =
      pending.current.get(keyName) ||
      readStorage(sessionStorage, keyName, null) ||
      crypto.randomUUID();

    pending.current.set(keyName, key);
    saveStorage(sessionStorage, keyName, key);

    const row = await liveApi(base, prefix + '/transfers', {
      token: session.token,
      data: transfer,
      key,
    });

    pending.current.delete(keyName);
    saveStorage(sessionStorage, keyName, null);

    const verb =
      row.status === 'COMPLETED' ? 'Completed' :
      row.status === 'REJECTED' ? 'Rejected' :
      row.status === 'MANUAL_REVIEW' ? 'Manual review' :
      'Accepted';

    setNote(verb + ' · ' + row.transferId);

    await refresh();
  }

  const totalAvailable = data.accounts.reduce(
    (sum, account) => sum + account.availableMinor,
    0
  );

  const totalHeld = data.accounts.reduce(
    (sum, account) => sum + account.heldMinor,
    0
  );

  const themeButton = (
    <button
      type="button"
      className="icon-button"
      onClick={onToggleMode}
      aria-label={
        mode === 'dark'
          ? 'Switch to light mode'
          : 'Switch to dark mode'
      }
    >
      {mode === 'dark'
        ? <Sun size={17} strokeWidth={1.7} />
        : <Moon size={17} strokeWidth={1.7} />}
    </button>
  );

  const brandMark = (
    <div className="brand">
      <span className="brand-icon">
        <Crown size={20} strokeWidth={1.5} />
      </span>

      <span>
        <strong>{bank.wordmark}</strong>
        <small>PRIVATE BANKING</small>
      </span>
    </div>
  );

  const notices = (
    <>
      {error && <Alert severity="error">{error}</Alert>}

      {note && (
        <Alert severity="info" onClose={() => setNote('')}>
          {note}
        </Alert>
      )}
    </>
  );

  const connection = editUrl && (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>Worker connection</h2>
          <p>Use the same Cloudflare Worker URL across the bank pages.</p>
        </div>
      </header>

      <form className="transfer-form" onSubmit={connect}>
        <TextField
          label="Cloudflare Worker URL"
          fullWidth
          required
          value={url}
          onChange={e => setUrl(e.target.value)}
        />

        <div>
          <Button type="submit" variant="contained">
            Save connection
          </Button>
        </div>
      </form>
    </section>
  );

  // Admin Dashboard is available only after Firebase Admin verification.
  if (adminSession) {
    return (
      <AdminDashboard
        mode={mode}
        onToggleMode={onToggleMode}
        onExit={() => {
          setAdminSession(null);
          setAdminPassword('');
          setAuthMode('customer');
          setError('');
        }}
        idToken={adminSession.idToken}
        adminUid={adminSession.uid}
        adminEmail={adminSession.email}
      />
    );
  }

  // Show either the customer sign-in or the separate Admin sign-in.
  if (!session || authMode === 'admin') {
    return (
      <div className="auth-shell">
        <section className="auth-hero">
          {brandMark}

          <div className="auth-copy">
            <span className="eyebrow">Welcome</span>
            <h1>Banking, held to a higher standard.</h1>
            <p>
              Sign in to review your accounts and move funds across the SharedBank network.
            </p>
          </div>

          <a className="switch-link" href={switchUrl}>
            <Globe2 size={16} strokeWidth={1.6} />
            SharedBank switch
          </a>
        </section>

        <section className="auth-panel">
          <div className="auth-tools">
            {!configuredEndpoint && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setUrl(base);
                  setEditUrl(!editUrl);
                }}
              >
                <Globe2 size={16} strokeWidth={1.6} />
                Worker connection
              </button>
            )}

            {openDemo && (
              <button
                type="button"
                className="text-button"
                onClick={openDemo}
              >
                <ArrowLeftRight size={16} strokeWidth={1.6} />
                Browser demo
              </button>
            )}

            <button
              type="button"
              className="text-button"
              onClick={() => {
                setAuthMode(authMode === 'admin' ? 'customer' : 'admin');
                setError('');
                setPassword('');
                setAdminPassword('');
              }}
            >
              <ShieldCheck size={16} />
              {authMode === 'admin' ? 'Customer sign in' : 'Admin sign in'}
            </button>

            {themeButton}
          </div>

          <div className="auth-stack">
            <div className="page-head">
              <div>
                <span className="eyebrow">Secure access</span>
                <h1>Access your bank</h1>
                <p>
                  {authMode === 'admin'
                    ? 'Use your registered Administrator Firebase account.'
                    : 'Connect to the Worker and use your bank customer login.'}
                </p>
              </div>
            </div>

            {notices}
            {connection}

            {authMode === 'customer' && base && !editUrl && (
              <section className="panel live-sign-in">
                <header className="panel-head">
                  <div>
                    <h2>Sign in to {bank.name}</h2>
                    <p>Use a customer enabled in this bank's network.</p>
                  </div>

                  <span className="head-icon">
                    <ShieldCheck size={18} strokeWidth={1.6} />
                  </span>
                </header>

                <form className="transfer-form" onSubmit={signIn}>
                  <TextField
                    label="Email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                  />

                  <TextField
                    label="Password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                  />

                  <div>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={busy}
                    >
                      {busy ? 'Signing in…' : 'Sign in'}
                    </Button>
                  </div>
                </form>
              </section>
            )}

            {authMode === 'admin' && (
              <section className="panel live-sign-in">
                <header className="panel-head">
                  <div>
                    <h2>Administrator sign in</h2>
                    <p>Sign in using your registered Admin Firebase account.</p>
                  </div>

                  <span className="head-icon">
                    <ShieldCheck size={18} strokeWidth={1.6} />
                  </span>
                </header>

                <form className="transfer-form" onSubmit={signInAdmin}>
                  <TextField
                    label="Admin email"
                    type="email"
                    autoComplete="username"
                    required
                    value={adminEmail}
                    onChange={event => setAdminEmail(event.target.value)}
                    disabled={busy}
                  />

                  <TextField
                    label="Admin password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={adminPassword}
                    onChange={event => setAdminPassword(event.target.value)}
                    disabled={busy}
                  />

                  <div>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={busy}
                      startIcon={<ShieldCheck size={16} />}
                    >
                      {busy ? 'Verifying Admin…' : 'Sign in as Admin'}
                    </Button>
                  </div>
                </form>
              </section>
            )}

            <p className="fineprint">
              {bank.name} · {bank.id} · Firestore test network. Balances are synthetic.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="layout live-bank-layout">
      <aside className="sidebar">
        {brandMark}

        <nav aria-label="Bank actions">
          <button className="active" onClick={() => refresh()}>
            <RefreshCw size={17} strokeWidth={1.6} />
            Refresh balances
          </button>

          <button
            onClick={() => {
              setAuthMode('admin');
              setError('');
            }}
          >
            <ShieldCheck size={17} strokeWidth={1.6} />
            Admin sign in
          </button>

          {!configuredEndpoint && (
            <button
              onClick={() => {
                setUrl(base);
                setEditUrl(!editUrl);
              }}
            >
              <Globe2 size={17} strokeWidth={1.6} />
              Worker connection
            </button>
          )}

          {openDemo && (
            <button onClick={openDemo}>
              <ArrowLeftRight size={17} strokeWidth={1.6} />
              Browser demo
            </button>
          )}

          <button onClick={logout}>
            <LogOut size={17} strokeWidth={1.6} />
            Sign out
          </button>
        </nav>

        <a className="switch-link" href={switchUrl}>
          <Globe2 size={16} strokeWidth={1.6} />
          SharedBank switch
        </a>
      </aside>

      <div className="main">
        <header className="topbar">
          <strong>{bank.name} · {bank.id}</strong>

          <div className="topbar-end">
            <Chip
              label="Firestore test network"
              size="small"
              className="demo"
            />
            {themeButton}
          </div>
        </header>

        <main className="content live-bank-content">
          <div className="page-head">
            <div>
              <span className="eyebrow">Account overview</span>
              <h1>Accounts and transfers</h1>
              <p>Signed in as {session.email}</p>
            </div>
          </div>

          {notices}
          {connection}

          {loaded && !data.accounts.length && (
            <Alert severity="info">
              This Firebase user has no synthetic account in this bank.
              Attach an account to this Firebase UID.
            </Alert>
          )}

          {!loaded && (
            <Alert severity="info">
              Loading your accounts and activity…
            </Alert>
          )}

          {data.accounts.length > 0 && (
            <section className="summary">
              <div>
                <span>Total available</span>
                <strong>{money(totalAvailable)}</strong>
              </div>

              <div>
                <span>Held</span>
                <strong>{money(totalHeld)}</strong>
              </div>

              <div>
                <span>Accounts</span>
                <strong>{data.accounts.length}</strong>
              </div>
            </section>
          )}

          <div className="accounts">
            {data.accounts.map((account, i) => (
              <section
                key={account.accountId}
                className={
                  'account-card ' +
                  (i === 0 ? 'primary-account' : 'light-account')
                }
              >
                <div className="account-head">
                  <span>{account.accountNumber}</span>
                  <Landmark size={18} strokeWidth={1.5} />
                </div>

                <div>
                  <small className="account-label">Available balance</small>
                  <div className="account-value">
                    {money(account.availableMinor)}
                  </div>
                </div>

                <div className="account-foot">
                  <span>Held {money(account.heldMinor)}</span>
                  <span>{account.accountId}</span>
                </div>
              </section>
            ))}
          </div>

          {data.accounts.length > 0 && (
            <TransferForm
              bank={bank}
              accounts={data.accounts}
              directory={directory}
              send={send}
            />
          )}

          {data.accounts.length > 0 && (
            <Activity
              rows={data.transfers}
              directory={directory}
            />
          )}
        </main>
      </div>
    </div>
  );
}
