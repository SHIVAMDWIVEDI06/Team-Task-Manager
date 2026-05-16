import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Typography,
} from '@mui/material';
import { Activity, AlertCircle, CheckCircle2, Clock, TrendingUp, X } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

export default function UserStatsModal({ open, onClose, userId, username }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && userId) {
      fetchStats();
    }
  }, [open, userId]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/statistics/user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch statistics', err);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, label, value, color, bgColor }) => (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: '8px',
        border: '1px solid #e8edf5',
        boxShadow: '0 10px 24px rgba(47, 67, 103, 0.07)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '10px',
            bgcolor: bgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={20} color={color} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: '0.75rem', color: '#70809d', fontWeight: 700, textTransform: 'uppercase' }}>
            {label}
          </Typography>
          <Typography variant="h5" sx={{ color: '#2f4367', fontWeight: 900 }}>
            {value}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '12px' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ color: '#2f4367', fontWeight: 900 }}>
            {username}'s Statistics
          </Typography>
          <Typography sx={{ color: '#70809d', fontSize: '0.875rem', fontWeight: 700 }}>
            Performance overview and activity
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#70809d' }}>
          <X size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : stats ? (
          <Box>
            {/* Key Metrics */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
              <StatCard
                icon={Activity}
                label="Total Tasks"
                value={stats.statistics.totalTasks}
                color="#fb5b3f"
                bgColor="#fff2e3"
              />
              <StatCard
                icon={CheckCircle2}
                label="Completed"
                value={stats.statistics.completedTasks}
                color="#22c98a"
                bgColor="#effaf5"
              />
              <StatCard
                icon={Clock}
                label="In Progress"
                value={stats.statistics.inProgressTasks}
                color="#ff9b3d"
                bgColor="#fff8ef"
              />
              <StatCard
                icon={AlertCircle}
                label="Overdue"
                value={stats.statistics.overdueTasks}
                color="#f43f5e"
                bgColor="#fff7f8"
              />
            </Box>

            {/* Completion Rate */}
            <Paper
              sx={{
                p: 3,
                mb: 3,
                borderRadius: '8px',
                border: '1px solid #e8edf5',
                boxShadow: '0 10px 24px rgba(47, 67, 103, 0.07)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrendingUp size={20} color="#fb5b3f" />
                  <Typography sx={{ color: '#2f4367', fontWeight: 900 }}>Completion Rate</Typography>
                </Box>
                <Typography variant="h4" sx={{ color: '#fb5b3f', fontWeight: 900 }}>
                  {stats.statistics.completionRate}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={stats.statistics.completionRate}
                sx={{
                  height: 10,
                  borderRadius: '5px',
                  bgcolor: '#f6f8fb',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: '#fb5b3f',
                    borderRadius: '5px',
                  },
                }}
              />
            </Paper>

            {/* Priority Breakdown */}
            <Paper
              sx={{
                p: 3,
                mb: 3,
                borderRadius: '8px',
                border: '1px solid #e8edf5',
                boxShadow: '0 10px 24px rgba(47, 67, 103, 0.07)',
              }}
            >
              <Typography sx={{ color: '#2f4367', fontWeight: 900, mb: 2 }}>Tasks by Priority</Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip
                  label={`High: ${stats.statistics.priorityBreakdown.High}`}
                  sx={{ bgcolor: '#fff7f8', color: '#f43f5e', fontWeight: 900, border: '1px solid #ffe4ea' }}
                />
                <Chip
                  label={`Medium: ${stats.statistics.priorityBreakdown.Medium}`}
                  sx={{ bgcolor: '#fff8ef', color: '#ff9b3d', fontWeight: 900, border: '1px solid #ffe6ca' }}
                />
                <Chip
                  label={`Low: ${stats.statistics.priorityBreakdown.Low}`}
                  sx={{ bgcolor: '#effaf5', color: '#22c98a', fontWeight: 900, border: '1px solid #dff8ee' }}
                />
              </Box>
            </Paper>

            {/* Recent Activity */}
            <Paper
              sx={{
                p: 3,
                borderRadius: '8px',
                border: '1px solid #e8edf5',
                boxShadow: '0 10px 24px rgba(47, 67, 103, 0.07)',
              }}
            >
              <Typography sx={{ color: '#2f4367', fontWeight: 900, mb: 2 }}>Recent Activity</Typography>
              {stats.recentActivity.length > 0 ? (
                <Box>
                  {stats.recentActivity.map((activity, index) => (
                    <Box key={activity.id}>
                      <Box sx={{ py: 1.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                          <Typography sx={{ color: '#2f4367', fontWeight: 700, fontSize: '0.875rem' }}>
                            {activity.title}
                          </Typography>
                          <Chip
                            label={activity.status}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              fontWeight: 900,
                              bgcolor: activity.status === 'Done' ? '#effaf5' : activity.status === 'In Progress' ? '#fff8ef' : '#f6f8fb',
                              color: activity.status === 'Done' ? '#22c98a' : activity.status === 'In Progress' ? '#ff9b3d' : '#70809d',
                            }}
                          />
                        </Box>
                        <Typography sx={{ color: '#70809d', fontSize: '0.75rem', fontWeight: 700 }}>
                          {activity.project_name || 'No project'} • {new Date(activity.created_at).toLocaleDateString()}
                        </Typography>
                      </Box>
                      {index < stats.recentActivity.length - 1 && <Divider />}
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography sx={{ color: '#70809d', textAlign: 'center', py: 2 }}>No recent activity</Typography>
              )}
            </Paper>
          </Box>
        ) : (
          <Typography sx={{ color: '#70809d', textAlign: 'center', py: 4 }}>Failed to load statistics</Typography>
        )}
      </DialogContent>
    </Dialog>
  );
}
