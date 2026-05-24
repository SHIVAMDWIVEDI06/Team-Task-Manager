import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  FormControl,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Typography,
} from '@mui/material';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FolderKanban,
  TrendingUp,
  Users,
} from 'lucide-react';
import axios from 'axios';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { API_BASE_URL } from '../config';
import PremiumIcon from '../components/PremiumIcon';

const StatCard = ({ title, value, helper, icon, tone, loading }) => (
  <Paper className="glass-panel hover-lift premium-shadow" sx={{ p: 2.75, height: '100%', borderRadius: '16px' }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
      <Box>
        <Typography sx={{ color: 'var(--text-secondary)', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase' }}>
          {title}
        </Typography>
        <Typography variant="h4" sx={{ color: 'var(--text-primary)', fontWeight: 900, mt: 0.75 }}>
          {loading ? <Skeleton width={72} /> : value}
        </Typography>
      </Box>
      <PremiumIcon tone={tone} size={60} radius="50%">
        {icon}
      </PremiumIcon>
    </Box>
    <Typography sx={{ color: 'var(--text-tertiary)', fontWeight: 600, mt: 2 }}>
      <Box component="span" sx={{ color: helper?.startsWith('-') ? '#f43f5e' : '#22c98a', fontWeight: 900 }}>
        {helper?.split(' ')[0]}
      </Box>{' '}
      {helper?.split(' ').slice(1).join(' ')}
    </Typography>
  </Paper>
);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_BASE_URL}/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProjects(res.data);
        if (res.data.length > 0) {
          setSelectedProjectId(res.data[0].id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_BASE_URL}/dashboard/${selectedProjectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(res.data);
      } catch (err) {
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [selectedProjectId]);

  const completion = data?.completionRate || {};
  const totalTasks = Number(completion.totalTasks) || 0;
  const doneTasks = Number(completion.doneTasks) || 0;
  const todoTasks = Number(completion.todoTasks) || 0;
  const inProgressTasks = Number(completion.inprogressTasks) || 0;
  const efficiency = Number(completion.percentage) || 0;
  const activeRisks = data?.overdueHighPriority?.length || 0;

  const distribution = [
    { name: 'To Do', value: todoTasks, color: '#8795ad' },
    { name: 'In Progress', value: inProgressTasks, color: '#ff8a4c' },
    { name: 'Done', value: doneTasks, color: '#22c98a' },
  ].filter((item) => item.value > 0);

  const chartData = useMemo(() => {
    const total = Math.max(totalTasks, 1);
    return [
      { label: 'To Do', tasks: todoTasks },
      { label: 'Active', tasks: inProgressTasks },
      { label: 'Done', tasks: doneTasks },
      { label: 'Health', tasks: Math.round((efficiency / 100) * total) },
    ];
  }, [doneTasks, efficiency, inProgressTasks, todoTasks, totalTasks]);

  const safeDistribution = distribution.length
    ? distribution
    : [{ name: 'No tasks', value: 1, color: '#eef2f7' }];

  return (
    <Box sx={{ pb: 4 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', md: 'center' },
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
          mb: 3.5,
        }}
      >
        <Box>
          <Typography sx={{ color: '#fff', opacity: 0.86, fontWeight: 700 }}>
            Live task analytics for your selected project
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 260 } }}>
          <Select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            displayEmpty
            sx={{
              bgcolor: '#fff',
              borderRadius: '8px',
              boxShadow: '0 12px 24px rgba(47, 67, 103, 0.12)',
              fontWeight: 800,
            }}
          >
            <MenuItem value="" disabled>
              Select a project
            </MenuItem>
            {projects.map((project) => (
              <MenuItem key={project.id} value={project.id}>
                {project.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {projects.length === 0 && !loading ? (
        <Alert severity="info" sx={{ borderRadius: '8px', mb: 3 }}>
          Create a project first to see dashboard analytics.
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
          gap: 3,
          mb: 3,
        }}
      >
        <StatCard
          title="Total Tasks"
          value={totalTasks}
          helper={`${data?.trends?.taskTrend >= 0 ? '+' : ''}${data?.trends?.taskTrend || 0}% vs last week`}
          icon={<Clock3 size={25} />}
          tone="coral"
          loading={loading}
        />
        <StatCard
          title="Completed"
          value={doneTasks}
          helper={`${data?.trends?.doneTrend >= 0 ? '+' : ''}${data?.trends?.doneTrend || 0}% vs last week`}
          icon={<CheckCircle2 size={25} />}
          tone="green"
          loading={loading}
        />
        <StatCard
          title="Active Risks"
          value={activeRisks}
          helper={activeRisks ? '-Needs attention' : '+No overdue risks'}
          icon={<AlertCircle size={25} />}
          tone="rose"
          loading={loading}
        />
        <StatCard
          title="Efficiency"
          value={`${efficiency}%`}
          helper="+Based on done tasks"
          icon={<TrendingUp size={25} />}
          tone="amber"
          loading={loading}
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1.05fr' }, gap: 3 }}>
        <Box sx={{ minWidth: 0 }}>
          <Paper className="glass-panel premium-shadow" sx={{ p: 3, height: 430, borderRadius: '16px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Box>
                <Typography variant="h6" sx={{ color: 'var(--text-primary)' }}>
                  Task Flow Overview
                </Typography>
                <Typography sx={{ color: '#70809d', fontWeight: 700, fontSize: '0.92rem' }}>
                  {efficiency}% of tasks have reached done
                </Typography>
              </Box>
              <Chip label="Project health" sx={{ bgcolor: '#fff2e3', color: '#fb5b3f', fontWeight: 800 }} />
            </Box>
            <Box sx={{ height: 310 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 15, right: 18, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="taskGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fb5b3f" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="#fb5b3f" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="6 8" vertical={false} stroke="#e8edf5" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#a0abc0', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a0abc0', fontSize: 12 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="tasks"
                    stroke="#fb5b3f"
                    strokeWidth={4}
                    fill="url(#taskGradient)"
                    dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#fb5b3f' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Paper
            className="hover-lift premium-shadow"
            sx={{
              height: 430,
              p: 3,
              color: '#fff',
              bgcolor: '#835f51',
              background:
                'linear-gradient(135deg, rgba(131,95,81,0.96), rgba(111,81,72,0.94)), radial-gradient(circle at 75% 35%, rgba(255,255,255,0.28), transparent 26%)',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ width: 42, height: 42, borderRadius: '8px', bgcolor: '#fff', color: '#2f4367', display: 'grid', placeItems: 'center' }}>
                <FolderKanban size={20} />
              </Box>
              <Chip label={`${efficiency}% healthy`} sx={{ bgcolor: 'rgba(255,255,255,0.16)', color: '#fff', fontWeight: 800 }} />
            </Box>
            <Box sx={{ height: 210, display: 'grid', placeItems: 'center' }}>
              <Box sx={{ position: 'relative', width: 165, height: 165 }}>
                <svg width="165" height="165">
                  <circle cx="82.5" cy="82.5" r="68" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="15" />
                  <circle
                    cx="82.5"
                    cy="82.5"
                    r="68"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="15"
                    strokeDasharray="427"
                    strokeDashoffset={427 - (427 * efficiency) / 100}
                    strokeLinecap="round"
                    transform="rotate(-90 82.5 82.5)"
                  />
                </svg>
                <Typography variant="h3" sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff' }}>
                  {efficiency}%
                </Typography>
              </Box>
            </Box>
            <Typography variant="h5" sx={{ color: '#fff', fontWeight: 900, mb: 1 }}>
              Faster way to finish project work
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.86)', lineHeight: 1.8, fontWeight: 600 }}>
              Track completion, workload, and overdue high-priority tasks from one focused dashboard.
            </Typography>
          </Paper>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 3, mt: 3 }}>
        <Box sx={{ minWidth: 0 }}>
          <Paper className="glass-panel premium-shadow" sx={{ p: 3, minHeight: 330, borderRadius: '16px' }}>
            <Typography variant="h6" sx={{ color: 'var(--text-primary)', mb: 3 }}>
              Task Distribution
            </Typography>
            <Box sx={{ height: 205, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={safeDistribution} dataKey="value" innerRadius={64} outerRadius={90} stroke="none">
                    {safeDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ color: '#2f4367', fontWeight: 900 }}>{totalTasks}</Typography>
                  <Typography sx={{ color: '#a0abc0', fontWeight: 900, fontSize: '0.72rem' }}>TOTAL</Typography>
                </Box>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.2, justifyContent: 'center', mt: 1 }}>
              {distribution.map((item) => (
                <Chip
                  key={item.name}
                  size="small"
                  label={`${item.name}: ${item.value}`}
                  sx={{ bgcolor: `${item.color}18`, color: item.color, fontWeight: 800 }}
                />
              ))}
            </Box>
          </Paper>
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Paper className="glass-panel premium-shadow hover-lift" sx={{ p: 3, minHeight: 330, borderRadius: '16px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Users size={21} color="#fb5b3f" />
              <Typography variant="h6" sx={{ color: 'var(--text-primary)' }}>
                Team Workload
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.4 }}>
              {(data?.workloadAnalysis || []).slice(0, 5).map((member) => (
                <Box key={member.user_id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.8 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 28, height: 28, bgcolor: '#fff2e3', color: '#fb5b3f', fontWeight: 900 }}>
                        {member.username?.[0]?.toUpperCase()}
                      </Avatar>
                      <Typography sx={{ fontWeight: 800, color: '#2f4367' }}>{member.username}</Typography>
                    </Box>
                    <Typography sx={{ fontWeight: 900, color: '#70809d', fontSize: '0.82rem' }}>
                      {member.in_progress_count} active
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min((Number(member.in_progress_count) / Math.max(inProgressTasks, 1)) * 100, 100)}
                    sx={{
                      height: 8,
                      borderRadius: '8px',
                      bgcolor: '#eef2f7',
                      '& .MuiLinearProgress-bar': { bgcolor: '#fb5b3f', borderRadius: '8px' },
                    }}
                  />
                </Box>
              ))}
              {!loading && (data?.workloadAnalysis || []).length === 0 && (
                <Typography sx={{ color: '#70809d', fontWeight: 700 }}>No active workload yet.</Typography>
              )}
            </Box>
          </Paper>
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Paper className="glass-panel premium-shadow" sx={{ p: 3, minHeight: 330, borderRadius: '16px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <AlertCircle size={21} color="#f43f5e" />
              <Typography variant="h6" sx={{ color: 'var(--text-primary)' }}>
                High Priority Alerts
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {(data?.overdueHighPriority || []).slice(0, 5).map((task) => (
                <Box
                  key={task.task_id}
                  sx={{
                    p: 1.7,
                    borderRadius: '8px',
                    bgcolor: '#fff7f8',
                    border: '1px solid #ffe4ea',
                  }}
                >
                  <Typography sx={{ fontWeight: 900, color: '#2f4367' }}>{task.title}</Typography>
                  <Typography sx={{ color: '#70809d', fontWeight: 700, fontSize: '0.82rem' }}>
                    Assigned to {task.assigned_to || 'Unassigned'}
                  </Typography>
                </Box>
              ))}
              {!loading && (data?.overdueHighPriority || []).length === 0 && (
                <Box sx={{ p: 2, borderRadius: '8px', bgcolor: '#effaf5', border: '1px solid #dff8ee' }}>
                  <Typography sx={{ color: '#159664', fontWeight: 900 }}>No overdue high-priority tasks.</Typography>
                  <Typography sx={{ color: '#70809d', fontWeight: 700, fontSize: '0.86rem' }}>
                    Your project is clear for now.
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
