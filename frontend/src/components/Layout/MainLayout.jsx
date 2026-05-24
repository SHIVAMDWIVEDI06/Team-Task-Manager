import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  BookOpen,
  Boxes,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings as SettingsIcon,
  User as UserIcon,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SearchInput } from '../Search';
import PremiumIcon from '../PremiumIcon';
import NotificationBell from '../NotificationBell';

const drawerWidth = 314;
const collapsedWidth = 92;

const navItems = [
  { text: 'Dashboard', icon: <LayoutDashboard size={19} />, path: '/' },
  { text: 'Projects', icon: <FolderKanban size={19} />, path: '/projects' },
  { text: 'Team', icon: <Users size={19} />, path: '/team' },
];

const pageMeta = {
  '/': { crumb: 'Pages / Dashboard', title: 'Dashboard' },
  '/projects': { crumb: 'Pages / Projects', title: 'Projects' },
  '/team': { crumb: 'Pages / Team', title: 'Team' },
};

function getPageMeta(pathname) {
  if (pathname.startsWith('/projects/')) {
    return { crumb: 'Pages / Projects / Board', title: 'Project Board' };
  }
  return pageMeta[pathname] || { crumb: 'Pages', title: 'Dashboard' };
}

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const meta = getPageMeta(location.pathname);
  const sidebarOpen = isMobile || open;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 2.5 }}>
        <PremiumIcon tone="slate" size={40} radius="12px">
          <FolderKanban size={21} />
        </PremiumIcon>
        {sidebarOpen && (
          <Box>
            <Typography sx={{ fontWeight: 900, color: '#2f4367', whiteSpace: 'nowrap', lineHeight: 1.1 }}>
              TeamTask Manager
            </Typography>
            <Typography sx={{ color: '#8795ad', fontSize: '0.72rem', fontWeight: 800, mt: 0.3 }}>
              Workspace OS
            </Typography>
          </Box>
        )}
      </Box>

      {sidebarOpen && (
        <Box
          sx={{
            mx: 1,
            mb: 2,
            p: 1.6,
            borderRadius: '8px',
            border: '1px solid #eef2f7',
            background:
              'linear-gradient(135deg, rgba(255, 242, 227, 0.9), rgba(255, 255, 255, 0.96))',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.2 }}>
            <PremiumIcon tone="coral" size={34} radius="10px">
              <Boxes size={17} />
            </PremiumIcon>
            <Box>
              <Typography sx={{ color: '#2f4367', fontWeight: 900, fontSize: '0.86rem' }}>
                Control Center
              </Typography>
              <Typography sx={{ color: '#70809d', fontWeight: 700, fontSize: '0.74rem' }}>
                Projects, tasks, team
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
            {['Live boards', 'Workload', 'Risks'].map((label) => (
              <Chip
                key={label}
                label={label}
                size="small"
                sx={{
                  height: 22,
                  bgcolor: '#fff',
                  color: '#63728f',
                  border: '1px solid #eef2f7',
                  fontWeight: 800,
                  fontSize: '0.68rem',
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      <List sx={{ px: 0.5 }}>
        {navItems.map((item) => {
          const active =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);

          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
                sx={{
                  minHeight: 52,
                  borderRadius: '8px',
                  px: 2,
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  bgcolor: active ? '#f6f8fb' : 'transparent',
                  color: active ? '#fb5b3f' : '#63728f',
                  '&:hover': { bgcolor: '#f6f8fb', color: '#fb5b3f' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 0, mr: sidebarOpen ? 1.7 : 0 }}>
                  <Box
                    sx={{
                      width: 30,
                      height: 30,
                      borderRadius: '8px',
                      display: 'grid',
                      placeItems: 'center',
                      color: active ? '#fff' : '#70809d',
                      bgcolor: active ? '#fb5b3f' : '#f6f8fb',
                      boxShadow: active ? '0 10px 20px rgba(251, 91, 63, 0.22)' : 'none',
                    }}
                  >
                    {item.icon}
                  </Box>
                </ListItemIcon>
                {sidebarOpen && (
                  <Typography sx={{ fontWeight: active ? 800 : 700, fontSize: '0.94rem' }}>
                    {item.text}
                  </Typography>
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Box sx={{ mt: 2, px: sidebarOpen ? 2.5 : 1.5 }}>
        {sidebarOpen && (
          <Typography sx={{ fontSize: '0.75rem', color: '#8795ad', fontWeight: 800, mb: 1.5 }}>
            WORKSPACE
          </Typography>
        )}
        <List disablePadding>
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => navigate('/projects')}
              sx={{
                minHeight: 44,
                borderRadius: '8px',
                px: sidebarOpen ? 1.5 : 0,
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                color: '#63728f',
                '&:hover': { bgcolor: '#f6f8fb', color: '#fb5b3f' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, mr: sidebarOpen ? 1.5 : 0 }}>
                <PremiumIcon tone="green" size={30} radius="8px">
                  <BookOpen size={16} />
                </PremiumIcon>
              </ListItemIcon>
              {sidebarOpen && (
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 700 }}>
                  Project Docs
                </Typography>
              )}
            </ListItemButton>
          </ListItem>
        </List>
      </Box>

      <Box sx={{ mt: 'auto', p: 1 }}>
        {sidebarOpen && (
          <Box
            sx={{
              border: '1px solid #eef2f7',
              borderRadius: '8px',
              p: 2,
              mb: 1.5,
              textAlign: 'center',
              bgcolor: '#fbfcff',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
              <PremiumIcon tone="amber" size={54} radius="16px">
                <FolderKanban size={24} />
              </PremiumIcon>
            </Box>
            <Typography sx={{ fontWeight: 800, color: '#2f4367' }}>Need help?</Typography>
            <Typography sx={{ fontSize: '0.78rem', color: '#70809d', mb: 1.5 }}>
              Check your project boards
            </Typography>
            <Button fullWidth variant="contained" onClick={() => navigate('/projects')}>
              Open Projects
            </Button>
          </Box>
        )}
        {!isMobile && (
          <IconButton
            onClick={() => setOpen(!open)}
            sx={{
              width: '100%',
              borderRadius: '8px',
              color: '#70809d',
              bgcolor: '#f6f8fb',
              '&:hover': { bgcolor: '#eef2f7' },
            }}
          >
            {open ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </IconButton>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb', position: 'relative', overflowX: 'hidden' }}>
      <Box
        className="argon-gradient"
        sx={{
          position: 'fixed',
          inset: '0 0 auto 0',
          height: { xs: 260, md: 372 },
          zIndex: 0,
        }}
      />

      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileOpen : true}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: isMobile ? drawerWidth : open ? drawerWidth : collapsedWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: isMobile ? drawerWidth : open ? drawerWidth : collapsedWidth,
            height: { xs: '100%', md: 'calc(100vh - 36px)' },
            top: { xs: 0, md: 18 },
            left: { xs: 0, md: 22 },
            border: 'none',
            borderRadius: { xs: 0, md: '8px' },
            boxShadow: '0 18px 38px rgba(47, 67, 103, 0.13)',
            bgcolor: '#fff',
            overflowX: 'hidden',
            transition: 'width 0.25s ease',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          position: 'relative',
          zIndex: 1,
          ml: { xs: 0, md: open ? `${drawerWidth + 22}px` : `${collapsedWidth + 22}px` },
          minHeight: '100vh',
          transition: 'margin-left 0.25s ease',
        }}
      >
        <Box
          component="header"
          sx={{
            height: 80,
            px: { xs: 2, sm: 4 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            backgroundColor: 'var(--bg-glass)',
            borderBottom: '1px solid var(--border-light)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            {isMobile && (
              <IconButton
                onClick={() => setMobileOpen(true)}
                sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.15)' }}
              >
                <MenuIcon size={22} />
              </IconButton>
            )}
            <Box>
              <Typography sx={{ opacity: 0.72, fontWeight: 700, mb: 0.5 }}>{meta.crumb}</Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#fff' }}>
                {meta.title}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 } }}>
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <SearchInput variant="topbar" />
            </Box>
            <NotificationBell />
            <Button
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{
                p: 0.5,
                minWidth: 'auto',
                borderRadius: '12px',
                border: '1px solid var(--border-light)',
                bgcolor: 'var(--bg-surface)',
                '&:hover': { bgcolor: '#f1f5f9', transform: 'translateY(-2px)' },
                transition: 'all 0.2s',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1 }}>
                <Avatar
                  sx={{
                    width: 36,
                    height: 36,
                    bgcolor: 'var(--accent-primary)',
                    fontWeight: 800,
                    fontSize: '1rem',
                  }}
                >
                  {user?.username?.[0]?.toUpperCase() || 'U'}
                </Avatar>
                <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'left' }}>
                  <Typography sx={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.2 }}>
                    {user?.username}
                  </Typography>
                  <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 600 }}>
                    {user?.role === 'admin' ? 'Workspace Admin' : 'Member'}
                  </Typography>
                </Box>
              </Box>
            </Button>
          </Box>
        </Box>

        <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 5, mt: { xs: 0, md: 2 } }}>
          <Outlet />
        </Box>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: { width: 210, borderRadius: '8px', p: 1, boxShadow: '0 16px 34px rgba(47, 67, 103, 0.16)' },
        }}
      >
        <MenuItem disabled sx={{ borderRadius: '8px', opacity: '1 !important' }}>
          <Box>
            <Typography sx={{ fontWeight: 800, color: '#2f4367' }}>{user?.username}</Typography>
            <Typography sx={{ fontSize: '0.76rem', color: '#70809d' }}>{user?.role}</Typography>
          </Box>
        </MenuItem>
        <MenuItem 
          onClick={() => {
            setAnchorEl(null);
            navigate('/profile');
          }} 
          sx={{ borderRadius: '8px', fontWeight: 800, color: '#2f4367' }}
        >
          <UserIcon size={16} style={{ marginRight: 10 }} /> My Profile
        </MenuItem>
        <MenuItem 
          onClick={() => {
            setAnchorEl(null);
            navigate('/settings');
          }} 
          sx={{ borderRadius: '8px', fontWeight: 800, color: '#2f4367' }}
        >
          <SettingsIcon size={16} style={{ marginRight: 10 }} /> Settings
        </MenuItem>
        <MenuItem onClick={handleLogout} sx={{ borderRadius: '8px', color: 'error.main', fontWeight: 800 }}>
          <LogOut size={16} style={{ marginRight: 10 }} /> Logout
        </MenuItem>
      </Menu>
    </Box>
  );
}
