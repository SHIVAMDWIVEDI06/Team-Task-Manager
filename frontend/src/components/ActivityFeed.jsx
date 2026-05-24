import React from 'react';
import {
  Box,
  Drawer,
  Typography,
  IconButton,
  Avatar,
  Divider,
} from '@mui/material';
import { X } from 'lucide-react';

export default function ActivityFeed({ open, onClose, activities }) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: { xs: '100vw', sm: 360 }, p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 900, color: '#2f4367' }}>Project Activity</Typography>
          <IconButton onClick={onClose} size="small" sx={{ color: '#a0abc0' }}>
            <X size={20} />
          </IconButton>
        </Box>
        <Divider sx={{ mb: 3 }} />
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {activities.length === 0 ? (
            <Typography sx={{ color: '#a0abc0', textAlign: 'center' }}>No recent activity.</Typography>
          ) : (
            activities.map(activity => (
              <Box key={activity.id} sx={{ display: 'flex', gap: 2 }}>
                <Avatar sx={{ width: 36, height: 36, bgcolor: '#e8edf5', color: '#70809d', fontWeight: 900 }}>
                  {activity.username?.[0]?.toUpperCase() || '?'}
                </Avatar>
                <Box>
                  <Typography sx={{ color: '#4a5568', fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: 800, color: '#2f4367' }}>{activity.username || 'Someone'}</span>{' '}
                    {activity.action_type === 'comment_added' && 'commented on a task'}
                    {activity.action_type === 'task_created' && 'created a new task'}
                    {activity.action_type === 'member_added' && 'joined the project'}
                  </Typography>
                  <Typography sx={{ color: '#a0abc0', fontSize: '0.75rem', fontWeight: 600, mt: 0.5 }}>
                    {new Date(activity.created_at).toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            ))
          )}
        </Box>
      </Box>
    </Drawer>
  );
}
