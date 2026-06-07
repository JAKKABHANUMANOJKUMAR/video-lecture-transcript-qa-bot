import React, { useState } from 'react';
import {
  UserCog,
  Palette,
  Bell,
  ShieldCheck,
  Info,
  Sun,
  Moon,
  Monitor,
  Camera,
  KeyRound,
  Save,
  X,
  Monitor as Desktop,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { useTheme, type Theme } from '../lib/theme-context';

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
      checked ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'
    }`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

const SettingRow: React.FC<{ title: string; description: string; checked: boolean; onChange: (v: boolean) => void }> = ({
  title,
  description,
  checked,
  onChange,
}) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <div>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{title}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
    </div>
    <Toggle checked={checked} onChange={onChange} />
  </div>
);

const SectionCard: React.FC<{ icon: React.ReactNode; title: string; iconBg: string; accent: string; children: React.ReactNode }> = ({
  icon,
  title,
  iconBg,
  accent,
  children,
}) => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
    <div className="flex items-center gap-3 mb-5">
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center ${accent}`}>{icon}</div>
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
    </div>
    {children}
  </div>
);

const THEME_OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light Mode', icon: <Sun className="w-5 h-5" /> },
  { value: 'dark', label: 'Dark Mode', icon: <Moon className="w-5 h-5" /> },
  { value: 'system', label: 'System Default', icon: <Monitor className="w-5 h-5" /> },
];

const ACTIVE_SESSIONS = [
  { id: 1, device: 'Windows · Chrome', location: 'Hyderabad, IN', current: true, icon: <Desktop className="w-4 h-4" /> },
  { id: 2, device: 'iPhone · Safari', location: 'Hyderabad, IN', current: false, icon: <Smartphone className="w-4 h-4" /> },
];

export const UserSettings: React.FC = () => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  const [fullName, setFullName] = useState('Demo User');
  const [email, setEmail] = useState(user?.email ?? 'user@example.com');
  const [editing, setEditing] = useState(false);
  const [banner, setBanner] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [emailNotif, setEmailNotif] = useState(true);
  const [complaintNotif, setComplaintNotif] = useState(true);
  const [transcriptNotif, setTranscriptNotif] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);

  const save = () => {
    setEditing(false);
    setBanner(true);
    setTimeout(() => setBanner(false), 2500);
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen transition-colors">
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-6">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your profile, appearance, and account</p>
      </div>

      {banner && (
        <div className="mx-8 mt-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm font-medium text-green-700 dark:bg-green-500/15 dark:border-green-500/30 dark:text-green-400">
          Changes saved successfully.
        </div>
      )}

      <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Settings */}
        <SectionCard icon={<UserCog className="w-5 h-5" />} title="Profile Settings" iconBg="bg-indigo-50 dark:bg-indigo-500/15" accent="text-indigo-600 dark:text-indigo-400">
          <div className="flex items-center gap-4 mb-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xl font-bold">
                {fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-slate-700 shadow-sm">
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900 dark:text-white">{fullName}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{email}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-400">Full Name</label>
              <input
                type="text"
                value={fullName}
                disabled={!editing}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400">Email Address</label>
              <input
                type="email"
                value={email}
                disabled={!editing}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-5">
            <button
              onClick={() => setEditing((e) => !e)}
              className="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/15 hover:bg-indigo-100 rounded-lg transition"
            >
              {editing ? 'Done Editing' : 'Edit Profile'}
            </button>
            <button
              onClick={save}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </SectionCard>

        {/* Appearance */}
        <SectionCard icon={<Palette className="w-5 h-5" />} title="Appearance" iconBg="bg-purple-50 dark:bg-purple-500/15" accent="text-purple-600 dark:text-purple-400">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Theme Selector</p>
          <div className="grid grid-cols-3 gap-3">
            {THEME_OPTIONS.map((opt) => {
              const active = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition ${
                    active
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400'
                      : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  {opt.icon}
                  <span className="text-xs font-medium text-center">{opt.label}</span>
                  <span className={`w-3 h-3 rounded-full border-2 ${active ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`} />
                </button>
              );
            })}
          </div>
        </SectionCard>

        {/* Notifications */}
        <SectionCard icon={<Bell className="w-5 h-5" />} title="Notifications" iconBg="bg-amber-50 dark:bg-amber-500/15" accent="text-amber-600 dark:text-amber-400">
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            <SettingRow title="Email Notifications" description="Receive important updates via email" checked={emailNotif} onChange={setEmailNotif} />
            <SettingRow title="Complaint Status Updates" description="Get notified when your complaints change status" checked={complaintNotif} onChange={setComplaintNotif} />
            <SettingRow title="Transcript Processing Notifications" description="Alert me when a video transcript is ready" checked={transcriptNotif} onChange={setTranscriptNotif} />
          </div>
        </SectionCard>

        {/* Security */}
        <SectionCard icon={<ShieldCheck className="w-5 h-5" />} title="Security" iconBg="bg-red-50 dark:bg-red-500/15" accent="text-red-600 dark:text-red-400">
          <button
            onClick={() => setShowPassword(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mb-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg transition"
          >
            <KeyRound className="w-4 h-4" />
            Change Password
          </button>

          <SettingRow
            title="Two-Factor Authentication"
            description="Add an extra layer of security to your account"
            checked={twoFactor}
            onChange={setTwoFactor}
          />

          <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-3">Active Sessions</p>
            <div className="space-y-3">
              {ACTIVE_SESSIONS.map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300">
                    {s.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{s.device}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{s.location}</p>
                  </div>
                  {s.current ? (
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">This device</span>
                  ) : (
                    <button className="text-xs font-medium text-red-600 hover:text-red-700">Sign out</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* Account Information */}
        <SectionCard icon={<Info className="w-5 h-5" />} title="Account Information" iconBg="bg-slate-100 dark:bg-slate-700" accent="text-slate-600 dark:text-slate-300">
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">Member Since</span>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">January 12, 2026</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">Last Login</span>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Today, 2:15 PM</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">Account Status</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400">
                Active
              </span>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Change Password Modal */}
      {showPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowPassword(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Change Password</h2>
              <button onClick={() => setShowPassword(false)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {['Current Password', 'New Password', 'Confirm New Password'].map((label) => (
                <div key={label}>
                  <label className="text-xs font-medium text-slate-400">{label}</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full mt-1 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 p-6 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowPassword(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowPassword(false);
                  save();
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition"
              >
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
