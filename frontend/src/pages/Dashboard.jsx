import React, { useState, useEffect } from 'react';
import { 
  Grid, 
  Paper, 
  Typography, 
  Box, 
  LinearProgress, 
  Skeleton,
  IconButton,
  Button,
  FormControl,
  Select,
  MenuItem,
  Avatar,
  Chip
} from '@mui/material';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  TrendingUp,
  MoreHorizontal
} from 'lucide-react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { API_BASE_URL } from '../config';

const StatCard = ({ title, value, icon, color, loading, trend }) => (
  <Paper sx={{ p: 4, borderRadius: 5, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
      <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: `${color}.main`, color: 'white', display: 'flex' }}>
        {icon}
      </Box>
      <Box sx={{ textAlign: 'right' }}>
        <Typography variant="caption" color={trend.startsWith('+') ? 'success.main' : 'error.main'} sx={{ fontWeight: 800 }}>
          {trend}
        </Typography>
        <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: '0.65rem' }}>vs last week</Typography>
      </Box>
    </Box>
    <Typography color="text.secondary" variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5 }}>
      {title}
    </Typography>
    <Typography variant="h3" sx={{ mt: 1, fontWeight: 900, color: '#0f172a' }}>
      {loading ? <Skeleton width={60} /> : value}
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
        const res = await axios.get(`${API_BASE_URL}/projects`, { headers: { Authorization: `Bearer ${token}` } });
        setProjects(res.data);
        if (res.data.length > 0) setSelectedProjectId(res.data[0].id);
        else setLoading(false);
      } catch (err) { setLoading(false); }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      const fetchDashboardData = async () => {
        setLoading(true);
        try {
          const token = localStorage.getItem('token');
          const res = await axios.get(`${API_BASE_URL}/dashboard/${selectedProjectId}`, { headers: { Authorization: `Bearer ${token}` } });
          setData(res.data);
        } catch (err) {} finally { setLoading(false); }
      };
      fetchDashboardData();
    }
  }, [selectedProjectId]);

  const chartData = data ? [
    { name: 'To Do', value: Number(data.completionRate?.todoTasks) || 0, color: '#94a3b8' },
    { name: 'In Progress', value: Number(data.completionRate?.inprogressTasks) || 0, color: '#6366f1' },
    { name: 'Done', value: Number(data.completionRate?.doneTasks) || 0, color: '#10b981' },
  ].filter(d => d.value > 0) : [];

  const totalTasks = Number(data?.completionRate?.totalTasks) || 0;
  const safeChartData = chartData.length > 0 ? chartData : [{ name: 'Tasks', value: 1, color: '#f1f5f9' }];

  return (
    <Box sx={{ width: '100%', pb: 8 }}>
      <Box sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -1 }}>Project Analytics</Typography>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <Select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} sx={{ borderRadius: 3, bgcolor: 'white' }}>
            {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      <Grid container spacing={4}>
        {/* Row 1: Top Stats */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Total Tasks" value={totalTasks} icon={<Clock size={24} />} color="primary" loading={loading} trend="+18%" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Completed" value={Number(data?.completionRate?.doneTasks) || 0} icon={<CheckCircle size={24} />} color="success" loading={loading} trend="-4%" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Active Risks" value={data?.overdueHighPriority?.length || 0} icon={<AlertCircle size={24} />} color="error" loading={loading} trend="+3%" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Efficiency" value={`${data?.completionRate?.percentage || 0}%`} icon={<TrendingUp size={24} />} color="warning" loading={loading} trend="+5%" />
        </Grid>

        {/* Row 2: Triple Sections (Team | Task | Health) */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 4, borderRadius: 6, border: '1px solid #e2e8f0', boxShadow: 'none', height: 420 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 4 }}>Team Performance</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {data?.workloadAnalysis?.slice(0, 4).map(user => (
                <Box key={user.user_id}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{user.username}</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 900 }}>{user.in_progress_count} Active</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={(user.in_progress_count / 5) * 100} sx={{ height: 10, borderRadius: 5, bgcolor: '#f1f5f9' }} />
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 4, borderRadius: 6, border: '1px solid #e2e8f0', boxShadow: 'none', height: 420 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 4 }}>Task Distribution</Typography>
            <Box sx={{ height: 260, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <Pie 
                    data={safeChartData} 
                    innerRadius={70} 
                    outerRadius={95} 
                    paddingAngle={0} 
                    dataKey="value" 
                    stroke="none"
                  >
                    {safeChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1 }}>{totalTasks}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>TOTAL</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
               {chartData.map(d => (
                 <Box key={d.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: d.color }} />
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700 }}>{d.name}</Typography>
                 </Box>
               ))}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 4, borderRadius: 6, bgcolor: '#0f172a', color: 'white', height: 420, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, width: '100%' }}>Health Vitality</Typography>
            <Box sx={{ position: 'relative', width: 180, height: 180, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
               <svg width="180" height="180">
                  <circle cx="90" cy="90" r="75" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="15" />
                  <circle cx="90" cy="90" r="75" fill="none" stroke="#10b981" strokeWidth="15" strokeDasharray="471" strokeDashoffset={471 - (471 * (data?.completionRate?.percentage || 0)) / 100} strokeLinecap="round" />
               </svg>
               <Typography variant="h3" sx={{ position: 'absolute', fontWeight: 900 }}>{data?.completionRate?.percentage || 0}%</Typography>
            </Box>
            <Typography variant="caption" sx={{ mt: 3, opacity: 0.5, letterSpacing: 2, fontWeight: 700 }}>LIVE SCORE</Typography>
          </Paper>
        </Grid>

        {/* Row 3: Project Roadmap (Balanced Horizontal Strip) */}
        <Grid item xs={12}>
          <Paper sx={{ p: 4, borderRadius: 6, border: '1px solid #e2e8f0', boxShadow: 'none', bgcolor: '#f8fafc' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 900, whiteSpace: 'nowrap', color: 'primary.main', textTransform: 'uppercase', letterSpacing: 2, fontSize: '0.85rem' }}>Strategic Roadmap</Typography>
              <Box sx={{ flexGrow: 1 }}>
                <Grid container spacing={4}>
                  {[
                    { title: 'UX/UI Research', progress: 100, color: '#10b981' },
                    { title: 'API Integration', status: 'In Progress', progress: 65, color: '#6366f1' },
                    { title: 'Beta Testing', status: 'Upcoming', progress: 15, color: '#f59e0b' },
                    { title: 'Final Launch', status: 'Planned', progress: 0, color: '#94a3b8' },
                  ].map((item) => (
                    <Grid item xs={3} key={item.title}>
                      <Box sx={{ position: 'relative' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '0.75rem' }}>{item.title}</Typography>
                          <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary' }}>{item.progress}%</Typography>
                        </Box>
                        <LinearProgress variant="determinate" value={item.progress} sx={{ height: 12, borderRadius: 6, bgcolor: 'white', border: '1px solid #e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: item.color } }} />
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
