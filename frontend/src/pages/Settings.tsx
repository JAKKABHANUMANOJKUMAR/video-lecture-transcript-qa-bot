import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, KeyRound, RotateCcw, Save } from 'lucide-react';
import {
  api,
  formatDate,
  formatRelative,
  formatUsageMinutes,
  titleCaseStatus,
  type ApiUser,
} from '../lib/api';
import {
  Avatar,
  Button,
  Card,
  Dialog,
  Field,
  Input,
  Skeleton,
  SkeletonText,
  Switch,
  Tag,
  useToast,
  type Tone,
} from '../components/ui';

/* ------------------------------------------------------------------ helpers */

function statusTone(status: string): Tone {
  const s = status.toLowerCase();
  if (s === 'active') return 'mint';
  if (s === 'blocked') return 'rose';
  return 'neutral';
}

function providerLabel(provider: string): string {
  return provider.toLowerCase() === 'local' ? 'Email & password' : titleCaseStatus(provider);
}

const NOTIF_ROWS = [
  {
    key: 'email' as const,
    label: 'Email updates',
    desc: 'Occasional study tips and product news in your inbox.',
  },
  {
    key: 'complaint' as const,
    label: 'Help request updates',
    desc: 'Hear back the moment support replies to one of your requests.',
  },
  {
    key: 'transcript' as const,
    label: 'Transcript ready',
    desc: 'A nudge as soon as a lecture finishes transcribing.',
  },
];

/* --------------------------------------------------------------------- page */

/**
 * Settings — profile, notifications, security and account facts.
 * Profile name editing is wired to the backend; notification and password
 * controls are honest local-only previews, labelled "Coming soon".
 */
export function Settings() {
  const { toast } = useToast();

  const [user, setUser] = useState<ApiUser | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);

  // Local-only preview state — nothing here is persisted yet.
  const [notif, setNotif] = useState({ email: true, complaint: true, transcript: true });

  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNext, setPwNext] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');

  const load = useCallback(() => {
    setLoadError(null);
    setUser(null);
    api
      .me()
      .then((me) => {
        setUser(me);
        setFullName(me.full_name);
      })
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : 'Something went wrong loading your profile.');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const trimmed = fullName.trim();
  const dirty = user !== null && trimmed !== '' && trimmed !== user.full_name;

  const saveName = async () => {
    if (!user || !dirty || saving) return;
    setSaving(true);
    try {
      const updated = await api.updateMe({ full_name: trimmed });
      setUser(updated);
      setFullName(updated.full_name);
      toast('ok', 'Name updated', `Your profile now reads “${updated.full_name}”.`);
    } catch (e) {
      toast(
        'danger',
        'Couldn’t save your name',
        e instanceof Error ? e.message : 'Please try again in a moment.',
      );
    } finally {
      setSaving(false);
    }
  };

  const closePasswordDialog = () => {
    setPwOpen(false);
    setPwCurrent('');
    setPwNext('');
    setPwConfirm('');
  };

  const submitPassword = () => {
    closePasswordDialog();
    toast(
      'info',
      'Password change is coming soon',
      'We’re still wiring this up — your current password stays as it is.',
    );
  };

  /* ------------------------------------------------------------- rendering */

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-8">
      <header>
        <h1 className="font-display text-h1 text-ink">Your study, your way</h1>
        <p className="mt-1 text-sm text-ink-2">Your profile, preferences and account details.</p>
      </header>

      {/* Loading — skeleton shaped like the identity card + section cards */}
      {user === null && loadError === null && (
        <div className="space-y-5" aria-hidden>
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3.5 w-60" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <SkeletonText lines={3} />
          </Card>
          <Card className="p-6">
            <SkeletonText lines={4} />
          </Card>
        </div>
      )}

      {/* Error — readable message + retry */}
      {loadError !== null && (
        <Card className="p-6" role="alert">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ctl bg-rose-tint text-rose-ink">
              <AlertTriangle size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">Couldn’t load your profile</p>
              <p className="mt-0.5 text-sm text-ink-2">{loadError}</p>
              <Button
                variant="secondary"
                size="sm"
                icon={<RotateCcw size={13} />}
                onClick={load}
                className="mt-3"
              >
                Try again
              </Button>
            </div>
          </div>
        </Card>
      )}

      {user !== null && (
        <>
          {/* Identity */}
          <Card className="p-6 animate-rise">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Avatar name={user.full_name} src={user.avatar_url} size={64} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-h3 text-ink">{user.full_name}</p>
                  <Tag tone={user.role === 'admin' ? 'accent' : 'sky'}>
                    {user.role === 'admin' ? 'Admin' : 'Student'}
                  </Tag>
                </div>
                <p className="mt-0.5 truncate text-sm text-ink-2">{user.email}</p>
                <p className="mt-1 text-cap text-ink-3">
                  Member since {formatDate(user.created_at)}
                </p>
              </div>
            </div>
          </Card>

          {/* Profile */}
          <Card className="p-6">
            <h2 className="text-h3 text-ink">Profile</h2>
            <p className="mt-0.5 text-cap text-ink-3">
              How your name appears across Lekta.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field
                label="Full name"
                htmlFor="settings-full-name"
                className="flex-1"
                hint="Shown on your sessions and help requests."
              >
                <Input
                  id="settings-full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveName();
                  }}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </Field>
              <Button
                icon={<Save size={15} />}
                loading={saving}
                disabled={!dirty}
                onClick={() => void saveName()}
                className="sm:mb-[26px]"
              >
                Save
              </Button>
            </div>
          </Card>

          {/* Notifications — honest local-only preview */}
          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-h3 text-ink">Notifications</h2>
              <Tag tone="neutral">Coming soon</Tag>
            </div>
            <p className="mt-0.5 text-cap text-ink-3">
              These switches are a preview — they aren’t saved anywhere yet.
            </p>
            <div className="mt-4 divide-y divide-line">
              {NOTIF_ROWS.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{row.label}</p>
                    <p className="mt-0.5 text-cap text-ink-3">{row.desc}</p>
                  </div>
                  <Switch
                    checked={notif[row.key]}
                    onChange={(v) => setNotif((prev) => ({ ...prev, [row.key]: v }))}
                    label={row.label}
                  />
                </div>
              ))}
            </div>
          </Card>

          {/* Security — honest local-only preview */}
          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-h3 text-ink">Security</h2>
              <Tag tone="neutral">Coming soon</Tag>
            </div>
            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Password</p>
                <p className="mt-0.5 text-cap text-ink-3">
                  Set a new password for signing in to Lekta.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={<KeyRound size={13} />}
                onClick={() => setPwOpen(true)}
              >
                Change password
              </Button>
            </div>
          </Card>

          {/* Account — the real facts */}
          <Card className="p-6">
            <h2 className="text-h3 text-ink">Account</h2>
            <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-micro uppercase text-ink-3">Member since</dt>
                <dd className="mt-1 text-sm text-ink">{formatDate(user.created_at)}</dd>
              </div>
              <div>
                <dt className="text-micro uppercase text-ink-3">Last sign-in</dt>
                <dd className="mt-1 text-sm text-ink">{formatRelative(user.last_login)}</dd>
              </div>
              <div>
                <dt className="text-micro uppercase text-ink-3">Status</dt>
                <dd className="mt-1">
                  <Tag tone={statusTone(user.status)}>{titleCaseStatus(user.status)}</Tag>
                </dd>
              </div>
              <div>
                <dt className="text-micro uppercase text-ink-3">Study time</dt>
                <dd className="mt-1 font-mono text-sm text-ink">
                  {formatUsageMinutes(user.usage_minutes)}
                </dd>
              </div>
              <div>
                <dt className="text-micro uppercase text-ink-3">Sign-in method</dt>
                <dd className="mt-1 text-sm text-ink">{providerLabel(user.auth_provider)}</dd>
              </div>
            </dl>
          </Card>
        </>
      )}

      {/* Change password — closes with an honest "coming soon" toast */}
      <Dialog
        open={pwOpen}
        onClose={closePasswordDialog}
        title="Change password"
        footer={
          <>
            <Button variant="ghost" onClick={closePasswordDialog}>
              Cancel
            </Button>
            <Button onClick={submitPassword}>Update password</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Current password" htmlFor="settings-pw-current">
            <Input
              id="settings-pw-current"
              type="password"
              value={pwCurrent}
              onChange={(e) => setPwCurrent(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Field label="New password" htmlFor="settings-pw-next">
            <Input
              id="settings-pw-next"
              type="password"
              value={pwNext}
              onChange={(e) => setPwNext(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password" htmlFor="settings-pw-confirm">
            <Input
              id="settings-pw-confirm"
              type="password"
              value={pwConfirm}
              onChange={(e) => setPwConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
