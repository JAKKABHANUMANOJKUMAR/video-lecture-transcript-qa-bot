import React, { useState } from 'react';
import {
  Palette,
  Bell,
  ShieldCheck,
  UserCog,
  Info,
  Sun,
  Moon,
  Monitor,
  KeyRound,
  Camera,
  Save,
  RotateCcw,
  X,
} from 'lucide-react';
import { useTheme, type Theme } from '../lib/theme-context';

interface SettingsState {
  compactView: boolean;
  animations: boolean;
  complaintNotif: boolean;
  systemNotif: boolean;
  emailNotif: boolean;
  securityNotif: boolean;
  twoFactor: boolean;
  sessionTimeout: string;
  maxLoginAttempts: number;
  fullName: string;
  email: string;
}

const DEFAULT_SETTINGS: SettingsState = {
  compactView: false,
  animations: true,
  complaintNotif: true,
  systemNotif: true,
  emailNotif: false,
  securityNotif: true,
  twoFactor: false,
  sessionTimeout: '30',
  maxLoginAttempts: 5,
  fullName: 'Admin User',
  email: 'admin@example.com',
};

const SESSION_OPTIONS = [
  { value: '15', label: '15 Minutes' },
  { value: '30', label: '30 Minutes' },
  { value: '60', label: '1 Hour' },
  { value: '120', label: '2 Hours' },
];

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({
  checked,
  onChange,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
      checked ? 'bg-green-600' : 'bg-slate-300 dark:bg-slate-600'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

const SettingRow: React.FC<{
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ title, description, checked, onChange }) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <div>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{title}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
    </div>
    <Toggle checked={checked} onChange={onChange} />
  </div>
);

const SectionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  iconBg: string;
  accent: string;
  children: React.ReactNode;
}> = ({ icon, title, iconBg, accent, children }) => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
    <div className="flex items-center gap-3 mb-5">
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center ${accent}`}>
        {icon}
      </div>
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

export const AdminSettings: React.FC = () => {
  const { theme, setTheme, isDark } = useTheme();
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [editingProfile, setEditingProfile] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);

  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    setEditingProfile(false);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setTheme('light');
    setEditingProfile(false);
  };

  const previewDark = isDark;

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen transition-colors">
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-6">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage appearance, notifications, security, and profile</p>
      </div>

      {savedBanner && (
        <div className="mx-8 mt-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm font-medium text-green-700">
          Your changes have been saved.
        </div>
      )}

      <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appearance Settings */}
        <SectionCard
          icon={<Palette className="w-5 h-5" />}
          title="Appearance Settings"
          iconBg="bg-purple-50"
          accent="text-purple-600"
        >
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Theme Preferences</p>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {THEME_OPTIONS.map((opt) => {
              const active = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition ${
                    active
                      ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400'
                      : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  {opt.icon}
                  <span className="text-xs font-medium text-center">{opt.label}</span>
                  <span
                    className={`w-3 h-3 rounded-full border-2 ${
                      active ? 'border-green-500 bg-green-500' : 'border-slate-300'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700 pt-2">
            <SettingRow
              title="Compact View"
              description="Reduce spacing to fit more content on screen"
              checked={settings.compactView}
              onChange={(v) => update('compactView', v)}
            />
            <SettingRow
              title="Enable Animations"
              description="Show transitions and motion effects across the UI"
              checked={settings.animations}
              onChange={(v) => update('animations', v)}
            />
          </div>

          {/* Live preview */}
          <div className="mt-5">
            <p className="text-xs font-medium text-slate-400 mb-2">Live Preview</p>
            <div
              className={`rounded-xl border p-4 transition-colors ${
                previewDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600" />
                <div className="flex-1">
                  <div
                    className={`h-2.5 rounded-full w-24 ${previewDark ? 'bg-slate-600' : 'bg-slate-200'}`}
                  />
                  <div
                    className={`h-2 rounded-full w-16 mt-1.5 ${
                      previewDark ? 'bg-slate-700' : 'bg-slate-100'
                    }`}
                  />
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium">
                  Button
                </div>
              </div>
              <p className={`text-xs mt-3 ${previewDark ? 'text-slate-300' : 'text-slate-500'}`}>
                {theme === 'system'
                  ? 'Matches your system theme'
                  : previewDark
                    ? 'Dark theme preview'
                    : 'Light theme preview'}
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Notification Settings */}
        <SectionCard
          icon={<Bell className="w-5 h-5" />}
          title="Notification Settings"
          iconBg="bg-amber-50"
          accent="text-amber-600"
        >
          <div className="divide-y divide-slate-100">
            <SettingRow
              title="Complaint Notifications"
              description="Get notified when users submit new complaints"
              checked={settings.complaintNotif}
              onChange={(v) => update('complaintNotif', v)}
            />
            <SettingRow
              title="System Alert Notifications"
              description="Alerts about system warnings and failures"
              checked={settings.systemNotif}
              onChange={(v) => update('systemNotif', v)}
            />
            <SettingRow
              title="Email Notifications"
              description="Receive a summary of important events by email"
              checked={settings.emailNotif}
              onChange={(v) => update('emailNotif', v)}
            />
            <SettingRow
              title="Security Notifications"
              description="Notify on suspicious logins and security events"
              checked={settings.securityNotif}
              onChange={(v) => update('securityNotif', v)}
            />
          </div>
        </SectionCard>

        {/* Security Settings */}
        <SectionCard
          icon={<ShieldCheck className="w-5 h-5" />}
          title="Security Settings"
          iconBg="bg-red-50"
          accent="text-red-600"
        >
          <button
            onClick={() => setShowPasswordModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mb-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg transition"
          >
            <KeyRound className="w-4 h-4" />
            Change Password
          </button>

          <SettingRow
            title="Two-Factor Authentication"
            description="Add an extra layer of security at login"
            checked={settings.twoFactor}
            onChange={(v) => update('twoFactor', v)}
          />

          <div className="py-3 border-t border-slate-100 dark:border-slate-700">
            <label className="text-sm font-medium text-slate-800 dark:text-slate-200">Session Timeout Duration</label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-2">
              Automatically log out after a period of inactivity
            </p>
            <select
              value={settings.sessionTimeout}
              onChange={(e) => update('sessionTimeout', e.target.value)}
              className="w-full px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none cursor-pointer"
            >
              {SESSION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="py-3 border-t border-slate-100 dark:border-slate-700">
            <label className="text-sm font-medium text-slate-800 dark:text-slate-200">Maximum Login Attempts</label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-2">
              Lock the account after this many failed attempts
            </p>
            <input
              type="number"
              min={1}
              max={10}
              value={settings.maxLoginAttempts}
              onChange={(e) => update('maxLoginAttempts', Number(e.target.value))}
              className="w-full px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>
        </SectionCard>

        {/* Admin Profile */}
        <SectionCard
          icon={<UserCog className="w-5 h-5" />}
          title="Admin Profile"
          iconBg="bg-blue-50"
          accent="text-blue-600"
        >
          <div className="flex items-center gap-4 mb-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xl font-bold">
                {settings.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-slate-700 shadow-sm">
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900 dark:text-white">{settings.fullName}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{settings.email}</p>
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                Administrator
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-400">Full Name</label>
              <input
                type="text"
                value={settings.fullName}
                disabled={!editingProfile}
                onChange={(e) => update('fullName', e.target.value)}
                className="w-full mt-1 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400">Email Address</label>
              <input
                type="email"
                value={settings.email}
                disabled={!editingProfile}
                onChange={(e) => update('email', e.target.value)}
                className="w-full mt-1 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400">Role</label>
              <input
                type="text"
                value="Administrator"
                disabled
                className="w-full mt-1 px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-5">
            <button
              onClick={() => setEditingProfile((e) => !e)}
              className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
            >
              {editingProfile ? 'Done Editing' : 'Edit Profile'}
            </button>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition"
            >
              Change Password
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition"
            >
              Save Changes
            </button>
          </div>
        </SectionCard>

        {/* System Information */}
        <SectionCard
          icon={<Info className="w-5 h-5" />}
          title="System Information"
          iconBg="bg-slate-100"
          accent="text-slate-600"
        >
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">Application Name</span>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Askora — Lecture Q&amp;A</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">Current Version</span>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">v1.0.0</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">Last Updated</span>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">June 7, 2026</span>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Action Buttons */}
      <div className="px-8 pb-10">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5 flex flex-col sm:flex-row sm:justify-end gap-3">
          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Default
          </button>
          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowPasswordModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Change Password</h2>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition"
              >
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
                    className="w-full mt-1 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 p-6 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  handleSave();
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition"
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
