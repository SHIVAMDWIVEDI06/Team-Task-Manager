import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Box, 
  Grid, 
  Card, 
  Avatar, 
  Chip, 
  Button, 
  Skeleton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton
} from '@mui/material';
import { 
  Users, 
  Mail, 
  Shield, 
  AlertCircle, 
  UserPlus, 
  ExternalLink,
  MoreHorizontal,
  Search
} from 'lucide-react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { API_BASE_URL } from '../config';

export default function Team() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_BASE_URL}/auth/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data);
      } catch (err) {
        console.error('Failed to fetch users', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  return (
    <Box>
      <Box sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: -1 }}>
            Team Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage roles and track performance metrics across the organization.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
           <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#f8fafc', px: 2, py: 1, borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Search size={18} color="#64748b" />
              <Typography variant="body2" sx={{ ml: 1, color: '#94a3b8' }}>Search members...</Typography>
           </Box>
           <Button variant="contained" startIcon={<UserPlus size={18} />} sx={{ borderRadius: 3, px: 3 }}>
            Invite Member
          </Button>
        </Box>
      </Box>

      <Grid container spacing={4}>
        {loading ? (
          [...Array(4)].map((_, i) => (
            <Grid item xs={12} md={3} key={i}>
              <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 5 }} />
            </Grid>
          ))
        ) : (
          users.map((user, index) => (
            <Grid item xs={12} sm={6} md={3} key={user.id}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card sx={{ 
                  p: 3, 
                  borderRadius: 5, 
                  border: '1px solid #e2e8f0', 
                  boxShadow: 'none', 
                  textAlign: 'center',
                  transition: 'all 0.3s',
                  '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', borderColor: 'primary.main' }
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: -2 }}>
                    <IconButton size="small"><MoreHorizontal size={16} /></IconButton>
                  </Box>
                  <Avatar 
                    sx={{ 
                      width: 72, 
                      height: 72, 
                      mx: 'auto', 
                      mb: 2, 
                      bgcolor: user.role === 'Admin' ? 'primary.main' : '#f1f5f9',
                      color: user.role === 'Admin' ? 'white' : 'primary.main',
                      fontSize: '1.5rem',
                      fontWeight: 800,
                      border: '4px solid white',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                    }}
                  >
                    {user.username?.[0]?.toUpperCase() || '?'}
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>{user.username}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 2.5 }}>
                    <Mail size={12} /> {user.email}
                  </Typography>
                  <Chip 
                    label={user.role} 
                    size="small" 
                    color={user.role === 'Admin' ? 'primary' : 'default'}
                    sx={{ fontWeight: 800, borderRadius: 2, px: 1 }}
                  />
                </Card>
              </motion.div>
            </Grid>
          ))
        )}
      </Grid>

      <Typography variant="h6" sx={{ mt: 8, mb: 3, fontWeight: 800 }}>Detailed Directory</Typography>
      <TableContainer component={Paper} sx={{ borderRadius: 5, border: '1px solid #e2e8f0', boxShadow: 'none', overflow: 'hidden' }}>
        <Table>
          <TableHead sx={{ bgcolor: '#f8fafc' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 800, color: '#64748b' }}>MEMBER</TableCell>
              <TableCell sx={{ fontWeight: 800, color: '#64748b' }}>ROLE</TableCell>
              <TableCell sx={{ fontWeight: 800, color: '#64748b' }}>EMAIL</TableCell>
              <TableCell sx={{ fontWeight: 800, color: '#64748b' }}>STATUS</TableCell>
              <TableCell sx={{ fontWeight: 800, color: '#64748b' }} align="right">ACTIONS</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} sx={{ '&:hover': { bgcolor: '#fbfcfe' } }}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem', fontWeight: 700 }}>{user.username?.[0]}</Avatar>
                    <Box>
                       <Typography variant="body2" sx={{ fontWeight: 700 }}>{user.username}</Typography>
                       <Typography variant="caption" color="text.secondary">Joined May 2026</Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip label={user.role} size="small" variant="outlined" sx={{ fontWeight: 700, borderColor: user.role === 'Admin' ? 'primary.light' : '#e2e8f0' }} />
                </TableCell>
                <TableCell>
                   <Typography variant="caption" sx={{ fontWeight: 500, color: '#64748b' }}>{user.email}</Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                     <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10b981' }} />
                     <Typography variant="caption" sx={{ fontWeight: 800, color: '#10b981' }}>ONLINE</Typography>
                  </Box>
                </TableCell>
                <TableCell align="right">
                   <Button size="small" variant="outlined" sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}>View Stats</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
