import React, { useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Mail, MoreHorizontal, Search, Shield, UserPlus, Users } from 'lucide-react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { API_BASE_URL } from '../config';
import PremiumIcon from '../components/PremiumIcon';

export default function Team() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_BASE_URL}/auth/users`, {
          headers: { Authorization: `Bearer ${token}` },
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
        <Typography sx={{ color: '#fff', opacity: 0.86, fontWeight: 700 }}>
          Manage roles and see who is available for project work.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: '#fff',
              color: '#a0abc0',
              px: 2,
              py: 1.15,
              borderRadius: '8px',
              minWidth: 210,
              boxShadow: '0 12px 24px rgba(47, 67, 103, 0.12)',
            }}
          >
            <Search size={18} />
            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Search members...</Typography>
          </Box>
          <Button variant="contained" startIcon={<UserPlus size={18} />} sx={{ bgcolor: '#fff', color: '#fb5b3f', '&:hover': { bgcolor: '#fff2e3' } }}>
            Invite Member
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 3 }}>
        {loading
          ? [...Array(4)].map((_, index) => (
              <Box key={index} sx={{ minWidth: 0 }}>
                <Skeleton variant="rectangular" height={250} sx={{ borderRadius: '8px' }} />
              </Box>
            ))
          : users.map((user, index) => (
              <Box key={user.id} sx={{ minWidth: 0 }}>
                <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                  <Card
                    sx={{
                      p: 3,
                      borderRadius: '8px',
                      border: '1px solid #e8edf5',
                      boxShadow: '0 16px 34px rgba(47, 67, 103, 0.08)',
                      textAlign: 'center',
                      height: '100%',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: -2 }}>
                      <IconButton size="small" sx={{ color: '#a0abc0' }}>
                        <MoreHorizontal size={17} />
                      </IconButton>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                      <PremiumIcon tone={user.role === 'Admin' ? 'coral' : 'teal'} size={78} radius="22px">
                        <Typography sx={{ color: '#fff', fontSize: '1.55rem', fontWeight: 900 }}>
                          {user.username?.[0]?.toUpperCase() || '?'}
                        </Typography>
                      </PremiumIcon>
                    </Box>
                    <Typography variant="h6" sx={{ color: '#2f4367', mb: 0.8 }}>
                      {user.username}
                    </Typography>
                    <Typography
                      sx={{
                        color: '#70809d',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 0.7,
                        mb: 2,
                        fontSize: '0.83rem',
                        fontWeight: 700,
                        wordBreak: 'break-word',
                      }}
                    >
                      <Mail size={13} /> {user.email}
                    </Typography>
                    <Chip
                      icon={<Shield size={14} />}
                      label={user.role}
                      sx={{
                        bgcolor: user.role === 'Admin' ? '#fff2e3' : '#effaf5',
                        color: user.role === 'Admin' ? '#fb5b3f' : '#159664',
                        fontWeight: 900,
                      }}
                    />
                  </Card>
                </motion.div>
              </Box>
            ))}
      </Box>

      <Paper
        sx={{
          mt: 4,
          borderRadius: '8px',
          border: '1px solid #e8edf5',
          boxShadow: '0 16px 34px rgba(47, 67, 103, 0.08)',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Users size={22} color="#fb5b3f" />
          <Typography variant="h6" sx={{ color: '#2f4367' }}>
            Detailed Directory
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: '#f6f8fb' }}>
              <TableRow>
                {['Member', 'Role', 'Email', 'Status', 'Actions'].map((header) => (
                  <TableCell key={header} sx={{ fontWeight: 900, color: '#70809d', textTransform: 'uppercase', fontSize: '0.76rem' }} align={header === 'Actions' ? 'right' : 'left'}>
                    {header}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} sx={{ '&:hover': { bgcolor: '#fbfcff' } }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ width: 34, height: 34, bgcolor: '#fb5b3f', fontWeight: 900 }}>
                        {user.username?.[0]?.toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography sx={{ color: '#2f4367', fontWeight: 900 }}>{user.username}</Typography>
                        <Typography sx={{ color: '#a0abc0', fontSize: '0.76rem', fontWeight: 700 }}>Team member</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={user.role} size="small" sx={{ bgcolor: '#f6f8fb', color: '#70809d', fontWeight: 900 }} />
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ color: '#70809d', fontWeight: 700, fontSize: '0.86rem' }}>{user.email}</Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#22c98a' }} />
                      <Typography sx={{ color: '#159664', fontWeight: 900, fontSize: '0.76rem' }}>ACTIVE</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="outlined" sx={{ borderColor: '#e8edf5', color: '#2f4367' }}>
                      View Stats
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
