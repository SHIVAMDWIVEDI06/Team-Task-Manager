import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { 
  Box, 
  Drawer, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText, 
  Typography, 
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  Badge,
  Divider
} from '@mui/material';
import { 
  LayoutDashboard, 
  FolderKanban, 
  Users, 
  LogOut, 
  ChevronLeft,
  Bell,
  Search,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

const drawerWidth = 280;

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);

  const menuItems = [
    { text: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
    { text: 'My Projects', icon: <FolderKanban size={20} />, path: '/projects' },
    { text: 'Team', icon: <Users size={20} />, path: '/team' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f8fafc' }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: open ? drawerWidth : 88,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: open ? drawerWidth : 88,
            boxSizing: 'border-box',
            border: 'none',
            bgcolor: '#0f172a',
            color: '#94a3b8',
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            overflowX: 'hidden',
          },
        }}
      >
        <Box sx={{ p: 3, display: 'flex', alignItems: 'center', height: 80 }}>
          <Box sx={{ 
            width: 32, 
            height: 32, 
            bgcolor: 'primary.main', 
            borderRadius: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            mr: 2,
            boxShadow: '0 0 15px rgba(79, 70, 229, 0.5)'
          }}>
            <FolderKanban size={18} color="white" />
          </Box>
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: -0.5, color: 'white' }}>
                  Team Task Manager
                </Typography>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>

        <List sx={{ px: 2, mt: 2 }}>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
                <ListItemButton
                  onClick={() => navigate(item.path)}
                  sx={{
                    minHeight: 48,
                    borderRadius: 2,
                    px: 2.5,
                    bgcolor: isActive ? 'rgba(79, 70, 229, 0.1)' : 'transparent',
                    color: isActive ? 'white' : 'inherit',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.05)',
                      color: 'white',
                    },
                    transition: 'all 0.2s',
                  }}
                >
                  <ListItemIcon sx={{ 
                    minWidth: 0, 
                    mr: open ? 2 : 'auto', 
                    color: isActive ? 'primary.main' : 'inherit' 
                  }}>
                    {item.icon}
                  </ListItemIcon>
                  {open && <ListItemText primary={item.text} sx={{ 
                    '& .MuiTypography-root': { fontWeight: isActive ? 600 : 500, fontSize: '0.925rem' } 
                  }} />}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>

        <Box sx={{ mt: 'auto', p: 3 }}>
          <IconButton 
            onClick={() => setOpen(!open)}
            sx={{ 
              width: '100%', 
              borderRadius: 2, 
              bgcolor: 'rgba(255,255,255,0.05)',
              color: 'slate.400'
            }}
          >
            {open ? <ChevronLeft size={18} /> : <Search size={18} />}
          </IconButton>
        </Box>
      </Drawer>

      {/* Main Content Area */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ 
          height: 80, 
          px: 4, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          bgcolor: 'white',
          borderBottom: '1px solid',
          borderColor: 'slate.100'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
             <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'slate.50', px: 2, py: 1, borderRadius: 2, width: 300 }}>
                <Search size={18} color="#64748b" />
                <Typography variant="body2" sx={{ ml: 1, color: 'slate.400' }}>Search...</Typography>
             </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Tooltip title="Notifications">
              <IconButton size="small">
                <Badge variant="dot" color="primary">
                  <Bell size={20} color="#64748b" />
                </Badge>
              </IconButton>
            </Tooltip>
            
            <Box sx={{ height: 24, width: 1, bgcolor: 'slate.200' }} />

            <Box 
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1.5, 
                cursor: 'pointer',
                p: 0.5, pr: 1, borderRadius: 2,
                '&:hover': { bgcolor: 'slate.50' }
              }}
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.875rem', fontWeight: 700 }}>
                {user?.username?.[0]?.toUpperCase() || '?'}
              </Avatar>
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1 }}>{user?.username}</Typography>
                <Typography variant="caption" color="text.secondary">{user?.role}</Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        <Box sx={{ p: 4, flexGrow: 1 }}>
          <Outlet />
        </Box>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        sx={{ mt: 1 }}
        PaperProps={{
          sx: { width: 200, borderRadius: 3, p: 1, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }
        }}
      >
        <MenuItem onClick={() => setAnchorEl(null)} sx={{ borderRadius: 1.5 }}>My Profile</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)} sx={{ borderRadius: 1.5 }}>Settings</MenuItem>
        <Divider sx={{ my: 1 }} />
        <MenuItem onClick={handleLogout} sx={{ borderRadius: 1.5, color: 'error.main' }}>
          <LogOut size={16} style={{ marginRight: 12 }} /> Logout
        </MenuItem>
      </Menu>
    </Box>
  );
}
