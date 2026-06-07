import React, { useState } from 'react';
import {
  TrendingUp,
  Users,
  Activity,
  Clock,
  AlertCircle,
  User,
  ChevronDown,
  UserRound,
} from 'lucide-react';

type ChartPeriod = 'day' | 'week' | 'month';

interface GroupedBarPoint {
  label: string;
  active: number;
  returning: number;
  newUsers: number;
}

interface LineSeriesPoint {
  label: string;
  users: number;
}

const CHART_COLORS = {
  barDark: '#004a8d',
  barTeal: '#4db6ac',
  barGreen: '#9ccc65',
  line: '#66c2d1',
  axis: '#9ca3af',
};

interface StatCard {
  title: string;
  value: string | number;
  trend: string;
  trendType: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  bgColor: string;
}

interface Alert {
  id: string;
  alert_type: string;
  message: string;
  status: string;
  created_at: string;
}

interface QuickAction {
  label: string;
  bgColor: string;
  icon: React.ReactNode;
}

const DEMO_STATS: StatCard[] = [
  {
    title: 'Total Users',
    value: 1250,
    trend: '+32 % vs Last Month',
    trendType: 'up',
    icon: <Users className="w-6 h-6" />,
    bgColor: 'bg-blue-50',
  },
  {
    title: 'Online Users',
    value: 845,
    trend: '5 Completed',
    trendType: 'neutral',
    icon: <Activity className="w-6 h-6" />,
    bgColor: 'bg-green-50',
  },
  {
    title: 'Avg Usage Time',
    value: '45 min',
    trend: '+3.2 % vs Last Week',
    trendType: 'up',
    icon: <Clock className="w-6 h-6" />,
    bgColor: 'bg-yellow-50',
  },
  {
    title: 'Pending Alerts',
    value: 12,
    trend: '4 Urgent',
    trendType: 'down',
    icon: <AlertCircle className="w-6 h-6" />,
    bgColor: 'bg-red-50',
  },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DEMO_ALERTS: Alert[] = [
  {
    id: '1',
    alert_type: 'new_user',
    message: 'New user registered: john@example.com',
    status: 'unresolved',
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    alert_type: 'transcript_failure',
    message: 'Failed to generate transcript for video_123',
    status: 'unresolved',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '3',
    alert_type: 'system_warning',
    message: 'System memory usage above 80%',
    status: 'unresolved',
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: '4',
    alert_type: 'complaint_resolved',
    message: 'User complaint #45 has been resolved',
    status: 'resolved',
    created_at: new Date(Date.now() - 10800000).toISOString(),
  },
];

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Review Alerts',
    bgColor: 'bg-purple-500 hover:bg-purple-600',
    icon: <AlertCircle className="w-5 h-5" />,
  },
  {
    label: 'View Analytics',
    bgColor: 'bg-emerald-500 hover:bg-emerald-600',
    icon: <TrendingUp className="w-5 h-5" />,
  },
  {
    label: 'Usage Report',
    bgColor: 'bg-blue-500 hover:bg-blue-600',
    icon: <Activity className="w-5 h-5" />,
  },
  {
    label: 'Export Report',
    bgColor: 'bg-amber-500 hover:bg-amber-600',
    icon: <Activity className="w-5 h-5" />,
  },
  {
    label: 'Configure System',
    bgColor: 'bg-red-500 hover:bg-red-600',
    icon: <AlertCircle className="w-5 h-5" />,
  },
];

const PERIOD_OPTIONS: { value: ChartPeriod; label: string }[] = [
  { value: 'day', label: 'Last day' },
  { value: 'week', label: 'Last week' },
  { value: 'month', label: 'Last month' },
];

const USERS_FLOW_SUMMARY_DATA: Record<ChartPeriod, GroupedBarPoint[]> = {
  day: [
    { label: '6AM', active: 12, returning: 18, newUsers: 10 },
    { label: '9AM', active: 22, returning: 28, newUsers: 16 },
    { label: '12PM', active: 28, returning: 32, newUsers: 20 },
    { label: '3PM', active: 24, returning: 26, newUsers: 18 },
    { label: '6PM', active: 30, returning: 34, newUsers: 22 },
    { label: '9PM', active: 18, returning: 22, newUsers: 14 },
  ],
  week: [
    { label: 'Mon', active: 17, returning: 24, newUsers: 17 },
    { label: 'Tue', active: 12, returning: 21, newUsers: 13 },
    { label: 'Wed', active: 25, returning: 18, newUsers: 16 },
    { label: 'Thu', active: 14, returning: 21, newUsers: 14 },
    { label: 'Fri', active: 8, returning: 24, newUsers: 13 },
    { label: 'Sat', active: 16, returning: 21, newUsers: 17 },
    { label: 'Sun', active: 26, returning: 22, newUsers: 17 },
  ],
  month: [
    { label: 'W1', active: 38, returning: 42, newUsers: 35 },
    { label: 'W2', active: 44, returning: 46, newUsers: 40 },
    { label: 'W3', active: 48, returning: 45, newUsers: 42 },
    { label: 'W4', active: 41, returning: 43, newUsers: 38 },
  ],
};

const USERS_FLOW_LINE_DATA: Record<ChartPeriod, LineSeriesPoint[]> = {
  day: [
    { label: '6AM', users: 420 },
    { label: '10AM', users: 780 },
    { label: '2PM', users: 1050 },
    { label: '6PM', users: 920 },
    { label: '10PM', users: 650 },
  ],
  week: [
    { label: '10AM', users: 1100 },
    { label: '2PM', users: 1350 },
    { label: '6PM', users: 700 },
    { label: '10PM', users: 1150 },
  ],
  month: [
    { label: 'W1', users: 3100 },
    { label: 'W2', users: 3650 },
    { label: 'W3', users: 4020 },
    { label: 'W4', users: 3880 },
  ],
};

const BAR_Y_MAX: Record<ChartPeriod, number> = {
  day: 50,
  week: 50,
  month: 50,
};

const LINE_Y_MAX: Record<ChartPeriod, number> = {
  day: 1250,
  week: 1250,
  month: 4500,
};

const getSmoothPath = (points: { x: number; y: number }[]) => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const controlX = (current.x + next.x) / 2;
    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }
  return path;
};

const PeriodPillDropdown: React.FC<{
  id: string;
  value: ChartPeriod;
  onChange: (period: ChartPeriod) => void;
}> = ({ id, value, onChange }) => (
  <div className="relative">
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as ChartPeriod)}
      className="appearance-none pl-4 pr-9 py-2 text-sm font-medium text-gray-600 dark:text-slate-200 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-full focus:ring-2 focus:ring-blue-100 focus:border-gray-300 outline-none cursor-pointer"
    >
      {PERIOD_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
  </div>
);

const ChartCardHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  dropdownId: string;
  period: ChartPeriod;
  onPeriodChange: (period: ChartPeriod) => void;
}> = ({ icon, title, dropdownId, period, onPeriodChange }) => (
  <div className="flex items-center justify-between mb-8">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-600 dark:text-slate-300">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">{title}</h3>
    </div>
    <PeriodPillDropdown id={dropdownId} value={period} onChange={onPeriodChange} />
  </div>
);

const CHART_HEIGHT = 224;

const UsersFlowSummaryChart: React.FC<{ data: GroupedBarPoint[]; maxY: number }> = ({
  data,
  maxY,
}) => {
  const yTicks = Array.from({ length: 6 }, (_, i) => maxY - i * (maxY / 5));
  const barHeight = (value: number) => `${(value / maxY) * CHART_HEIGHT}px`;

  return (
    <div className="flex gap-3">
      <div
        className="flex flex-col justify-between pr-1 text-xs font-medium text-gray-400"
        style={{ height: CHART_HEIGHT }}
      >
        {yTicks.map((tick) => (
          <span key={tick}>{Math.round(tick)}</span>
        ))}
      </div>
      <div className="flex-1">
        <div
          className="flex items-end justify-between gap-2 border-b border-gray-100 dark:border-slate-700 pb-1"
          style={{ height: CHART_HEIGHT }}
        >
          {data.map((point, i) => (
            <div key={i} className="flex flex-col items-center flex-1 min-w-0 h-full justify-end">
              <div className="flex items-end justify-center gap-1 w-full">
                <div
                  className="w-2.5 sm:w-3 rounded-t-sm transition-all duration-300"
                  style={{
                    height: barHeight(point.active),
                    backgroundColor: CHART_COLORS.barDark,
                  }}
                  title={`Active: ${point.active}`}
                />
                <div
                  className="w-2.5 sm:w-3 rounded-t-sm transition-all duration-300"
                  style={{
                    height: barHeight(point.returning),
                    backgroundColor: CHART_COLORS.barTeal,
                  }}
                  title={`Returning: ${point.returning}`}
                />
                <div
                  className="w-2.5 sm:w-3 rounded-t-sm transition-all duration-300"
                  style={{
                    height: barHeight(point.newUsers),
                    backgroundColor: CHART_COLORS.barGreen,
                  }}
                  title={`New: ${point.newUsers}`}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-3 text-xs font-medium text-gray-500">
          {data.map((point, i) => (
            <span key={i} className="flex-1 text-center truncate">
              {point.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

const UsersFlowLineChart: React.FC<{
  data: LineSeriesPoint[];
  maxY: number;
}> = ({ data, maxY }) => {
  const yTicks = Array.from({ length: 6 }, (_, i) => maxY - i * (maxY / 5));

  const points = data.map((d, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * 100 : 50;
    const y = 100 - (d.users / maxY) * 100;
    return { x, y, value: d.users };
  });

  const linePath = getSmoothPath(points);
  const areaPath = `${linePath} L 100 100 L 0 100 Z`;

  return (
    <div>
      <div className="flex gap-3">
        <div
          className="flex flex-col justify-between pr-1 text-xs font-medium text-gray-400"
          style={{ height: CHART_HEIGHT }}
        >
          {yTicks.map((tick) => (
            <span key={tick}>{Math.round(tick).toLocaleString()}</span>
          ))}
        </div>
        <div className="flex-1 border-b border-gray-100 dark:border-slate-700" style={{ height: CHART_HEIGHT }}>
          <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="usersAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.line} stopOpacity="0.35" />
                <stop offset="100%" stopColor={CHART_COLORS.line} stopOpacity="0" />
              </linearGradient>
              <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow
                  dx="0"
                  dy="3"
                  stdDeviation="3"
                  floodColor={CHART_COLORS.line}
                  floodOpacity="0.45"
                />
              </filter>
            </defs>
            <path d={areaPath} fill="url(#usersAreaGradient)" />
            <path
              d={linePath}
              fill="none"
              stroke={CHART_COLORS.line}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              filter="url(#lineGlow)"
            />
          </svg>
        </div>
      </div>
      <div className="flex justify-between mt-3 ml-8 text-xs font-medium text-gray-500">
        {data.map((point, i) => (
          <span key={i} className="flex-1 text-center truncate">
            {point.label}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-center gap-6 mt-5">
        <div className="flex items-center gap-2">
          <span
            className="w-8 h-0.5 rounded-full"
            style={{ backgroundColor: CHART_COLORS.line }}
          />
          <span className="text-sm font-medium text-gray-600">Users</span>
        </div>
      </div>
    </div>
  );
};

export const AdminDashboard: React.FC = () => {
  const [barPeriod, setBarPeriod] = useState<ChartPeriod>('week');
  const [linePeriod, setLinePeriod] = useState<ChartPeriod>('week');
  const stats = DEMO_STATS;
  const barChartData = USERS_FLOW_SUMMARY_DATA[barPeriod];
  const lineChartData = USERS_FLOW_LINE_DATA[linePeriod];
  // alerts kept for future alerts panel expansion
  void DEMO_ALERTS;

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen transition-colors">
      {/* Header with Profile Icon */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Welcome back, Admin!</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Supporting your decisions with precision and speed</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {new Date().toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="p-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div key={index} className={`${stat.bgColor} dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700`}>
              <div className="flex items-start justify-between mb-4">
                <div className="text-slate-600 dark:text-slate-300">{stat.icon}</div>
                <TrendingUp
                  className={`w-5 h-5 ${
                    stat.trendType === 'up'
                      ? 'text-green-600'
                      : stat.trendType === 'down'
                        ? 'text-red-600'
                        : 'text-slate-400'
                  }`}
                />
              </div>
              <h3 className="text-slate-600 dark:text-slate-300 text-sm font-medium mb-2">{stat.title}</h3>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{stat.value}</p>
              <p
                className={`text-xs font-medium ${
                  stat.trendType === 'up'
                    ? 'text-green-600'
                    : stat.trendType === 'down'
                      ? 'text-red-600'
                      : 'text-slate-500'
                }`}
              >
                {stat.trend}
              </p>
            </div>
          ))}
        </div>

        {/* Charts Section - matching reference design */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm">
            <ChartCardHeader
              icon={<Users className="w-5 h-5" />}
              title="Users Flow Summary"
              dropdownId="bar-chart-period"
              period={barPeriod}
              onPeriodChange={setBarPeriod}
            />
            <UsersFlowSummaryChart data={barChartData} maxY={BAR_Y_MAX[barPeriod]} />
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm">
            <ChartCardHeader
              icon={<UserRound className="w-5 h-5" />}
              title="Users flow"
              dropdownId="line-chart-period"
              period={linePeriod}
              onPeriodChange={setLinePeriod}
            />
            <UsersFlowLineChart data={lineChartData} maxY={LINE_Y_MAX[linePeriod]} />
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-8 border border-slate-200 dark:border-slate-700 shadow-sm mb-8">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {QUICK_ACTIONS.map((action, i) => (
              <button
                key={i}
                className={`${action.bgColor} text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition duration-200 transform hover:scale-105 active:scale-95`}
              >
                {action.icon}
                <span className="text-sm">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Users Table */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Users</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300">
                    User Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {[
                  { name: 'John Doe', email: 'john@example.com', login: '2 hours ago', status: 'Online' },
                  { name: 'Jane Smith', email: 'jane@example.com', login: '5 hours ago', status: 'Offline' },
                  { name: 'Mike Johnson', email: 'mike@example.com', login: '1 day ago', status: 'Offline' },
                  { name: 'Sarah Williams', email: 'sarah@example.com', login: 'Just now', status: 'Online' },
                ].map((user, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{user.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{user.email}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{user.login}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          user.status === 'Online'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
