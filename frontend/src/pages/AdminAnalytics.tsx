import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  AlertCircle,
  Clock,
  TrendingUp,
  ChevronDown,
  CalendarDays,
  Sunrise,
  Timer,
  Repeat,
} from 'lucide-react';

type Period = 'day' | 'week' | 'month';

interface Point {
  label: string;
  value: number;
}

const CHART_COLORS = {
  line: '#16a34a',
  lineAlt: '#06b6d4',
  bar: '#004a8d',
  axis: '#9ca3af',
};

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Last day' },
  { value: 'week', label: 'Last week' },
  { value: 'month', label: 'Last month' },
];

const SUMMARY_CARDS = [
  {
    title: 'Total Users',
    value: '1,250',
    trend: '+32% vs last month',
    icon: <Users className="w-6 h-6" />,
    accent: 'text-blue-600',
    iconBg: 'bg-blue-50',
  },
  {
    title: 'Active Users',
    value: '845',
    trend: '+5.4% vs last week',
    icon: <UserCheck className="w-6 h-6" />,
    accent: 'text-green-600',
    iconBg: 'bg-green-50',
  },
  {
    title: 'Open Alerts',
    value: '18',
    trend: '+12% vs last week',
    icon: <AlertCircle className="w-6 h-6" />,
    accent: 'text-red-600',
    iconBg: 'bg-red-50',
  },
  {
    title: 'Avg Usage Time',
    value: '45 min',
    trend: '+3.2% vs last week',
    icon: <Clock className="w-6 h-6" />,
    accent: 'text-amber-600',
    iconBg: 'bg-amber-50',
  },
];

const USER_GROWTH: Point[] = [
  { label: 'Jan', value: 420 },
  { label: 'Feb', value: 560 },
  { label: 'Mar', value: 690 },
  { label: 'Apr', value: 880 },
  { label: 'May', value: 1040 },
  { label: 'Jun', value: 1250 },
];

const DAILY_ACTIVE: Point[] = [
  { label: 'Mon', value: 620 },
  { label: 'Tue', value: 710 },
  { label: 'Wed', value: 845 },
  { label: 'Thu', value: 790 },
  { label: 'Fri', value: 910 },
  { label: 'Sat', value: 640 },
  { label: 'Sun', value: 700 },
];

const LOGIN_ACTIVITY: Record<Period, Point[]> = {
  day: [
    { label: '6AM', value: 120 },
    { label: '9AM', value: 320 },
    { label: '12PM', value: 480 },
    { label: '3PM', value: 410 },
    { label: '6PM', value: 560 },
    { label: '9PM', value: 300 },
  ],
  week: [
    { label: 'Mon', value: 1200 },
    { label: 'Tue', value: 1450 },
    { label: 'Wed', value: 1680 },
    { label: 'Thu', value: 1520 },
    { label: 'Fri', value: 1740 },
    { label: 'Sat', value: 980 },
    { label: 'Sun', value: 1100 },
  ],
  month: [
    { label: 'W1', value: 8200 },
    { label: 'W2', value: 9100 },
    { label: 'W3', value: 9800 },
    { label: 'W4', value: 9300 },
  ],
};

const AVG_USAGE_TREND: Point[] = [
  { label: 'Jan', value: 32 },
  { label: 'Feb', value: 36 },
  { label: 'Mar', value: 39 },
  { label: 'Apr', value: 41 },
  { label: 'May', value: 43 },
  { label: 'Jun', value: 45 },
];

const ALERT_BREAKDOWN = [
  { label: 'Open', value: 18, color: '#ef4444' },
  { label: 'In Progress', value: 9, color: '#3b82f6' },
  { label: 'Resolved', value: 142, color: '#22c55e' },
];

const INSIGHTS = [
  {
    title: 'Most Active Day',
    value: 'Friday',
    sub: '910 active users',
    icon: <CalendarDays className="w-5 h-5" />,
    accent: 'text-purple-600',
    iconBg: 'bg-purple-50',
  },
  {
    title: 'Peak Login Hours',
    value: '6PM – 9PM',
    sub: '560 logins at peak',
    icon: <Sunrise className="w-5 h-5" />,
    accent: 'text-amber-600',
    iconBg: 'bg-amber-50',
  },
  {
    title: 'Avg Session Duration',
    value: '45 min',
    sub: '+3.2% vs last week',
    icon: <Timer className="w-5 h-5" />,
    accent: 'text-cyan-600',
    iconBg: 'bg-cyan-50',
  },
  {
    title: 'User Retention Rate',
    value: '78.4%',
    sub: '30-day retention',
    icon: <Repeat className="w-5 h-5" />,
    accent: 'text-green-600',
    iconBg: 'bg-green-50',
  },
];

const CHART_HEIGHT = 220;

const getSmoothPath = (points: { x: number; y: number }[]) => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const cx = (current.x + next.x) / 2;
    path += ` C ${cx} ${current.y}, ${cx} ${next.y}, ${next.x} ${next.y}`;
  }
  return path;
};

const ChartCard: React.FC<{
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, action, children }) => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
      </div>
      {action}
    </div>
    {children}
  </div>
);

const PeriodPill: React.FC<{ value: Period; onChange: (p: Period) => void }> = ({
  value,
  onChange,
}) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Period)}
      className="appearance-none pl-4 pr-9 py-2 text-sm font-medium text-gray-600 dark:text-slate-200 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-full focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer"
    >
      {PERIOD_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
  </div>
);

const LineChart: React.FC<{ data: Point[]; color: string; valueSuffix?: string }> = ({
  data,
  color,
  valueSuffix = '',
}) => {
  const maxValue = Math.max(...data.map((d) => d.value)) * 1.1;
  const yTicks = Array.from({ length: 5 }, (_, i) => maxValue - i * (maxValue / 4));
  const points = data.map((d, i) => ({
    x: data.length > 1 ? (i / (data.length - 1)) * 100 : 50,
    y: 100 - (d.value / maxValue) * 100,
  }));
  const linePath = getSmoothPath(points);
  const areaPath = `${linePath} L 100 100 L 0 100 Z`;
  const gradId = `grad-${color.replace('#', '')}`;
  const glowId = `glow-${color.replace('#', '')}`;

  return (
    <div>
      <div className="flex gap-3">
        <div
          className="flex flex-col justify-between pr-1 text-xs font-medium text-gray-400"
          style={{ height: CHART_HEIGHT }}
        >
          {yTicks.map((t) => (
            <span key={t}>
              {Math.round(t).toLocaleString()}
              {valueSuffix}
            </span>
          ))}
        </div>
        <div className="flex-1 border-b border-gray-100" style={{ height: CHART_HEIGHT }}>
          <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
              <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor={color} floodOpacity="0.4" />
              </filter>
            </defs>
            <path d={areaPath} fill={`url(#${gradId})`} />
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              filter={`url(#${glowId})`}
            />
          </svg>
        </div>
      </div>
      <div className="flex justify-between mt-3 ml-8 text-xs font-medium text-gray-500">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center truncate">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
};

const BarChart: React.FC<{ data: Point[]; color: string }> = ({ data, color }) => {
  const maxValue = Math.max(...data.map((d) => d.value)) * 1.1;
  const yTicks = Array.from({ length: 5 }, (_, i) => maxValue - i * (maxValue / 4));

  return (
    <div className="flex gap-3">
      <div
        className="flex flex-col justify-between pr-1 text-xs font-medium text-gray-400"
        style={{ height: CHART_HEIGHT }}
      >
        {yTicks.map((t) => (
          <span key={t}>{Math.round(t).toLocaleString()}</span>
        ))}
      </div>
      <div className="flex-1">
        <div
          className="flex items-end justify-between gap-2 border-b border-gray-100"
          style={{ height: CHART_HEIGHT }}
        >
          {data.map((d, i) => (
            <div key={i} className="flex flex-col items-center justify-end flex-1 h-full">
              <div
                className="w-full max-w-[28px] rounded-t-md transition-all duration-300"
                style={{
                  height: `${(d.value / maxValue) * CHART_HEIGHT}px`,
                  backgroundColor: color,
                }}
                title={`${d.label}: ${d.value.toLocaleString()}`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-3 text-xs font-medium text-gray-500">
          {data.map((d, i) => (
            <span key={i} className="flex-1 text-center truncate">
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

const DonutChart: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({
  data,
}) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-44 h-44 flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          {data.map((d, i) => {
            const fraction = d.value / total;
            const dash = fraction * circumference;
            const circle = (
              <circle
                key={i}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={d.color}
                strokeWidth="14"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return circle;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-900 dark:text-white">{total}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">Total Alerts</span>
        </div>
      </div>
      <div className="space-y-3 w-full">
        {data.map((d, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-sm text-slate-600 dark:text-slate-300">{d.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">{d.value}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {Math.round((d.value / total) * 100)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AdminAnalytics: React.FC = () => {
  const [loginPeriod, setLoginPeriod] = useState<Period>('week');

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen transition-colors">
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-6">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Analytics</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Platform performance, engagement, and trends</p>
      </div>

      <div className="p-8 space-y-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {SUMMARY_CARDS.map((card) => (
            <div key={card.title} className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl ${card.iconBg} flex items-center justify-center ${card.accent}`}>
                  {card.icon}
                </div>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{card.value}</p>
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1">{card.title}</h3>
              <p className="text-xs font-medium text-green-600 mt-2">{card.trend}</p>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="User Growth Trend" subtitle="New user registrations over time">
            <LineChart data={USER_GROWTH} color={CHART_COLORS.line} />
          </ChartCard>

          <ChartCard title="Daily Active Users" subtitle="Active users per day">
            <LineChart data={DAILY_ACTIVE} color={CHART_COLORS.lineAlt} />
          </ChartCard>

          <ChartCard
            title="Login Activity"
            subtitle="User logins by time period"
            action={<PeriodPill value={loginPeriod} onChange={setLoginPeriod} />}
          >
            <BarChart data={LOGIN_ACTIVITY[loginPeriod]} color={CHART_COLORS.bar} />
          </ChartCard>

          <ChartCard title="Average Usage Time Trend" subtitle="Average session duration over time (min)">
            <LineChart data={AVG_USAGE_TREND} color={CHART_COLORS.line} valueSuffix="m" />
          </ChartCard>
        </div>

        {/* Alert Analytics */}
        <ChartCard title="Alert Analytics" subtitle="Distribution of alerts by status">
          <DonutChart data={ALERT_BREAKDOWN} />
        </ChartCard>

        {/* Insights Section */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Key Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {INSIGHTS.map((insight) => (
              <div key={insight.title} className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
                <div className={`w-11 h-11 rounded-xl ${insight.iconBg} flex items-center justify-center ${insight.accent} mb-4`}>
                  {insight.icon}
                </div>
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{insight.title}</h3>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{insight.value}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{insight.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
