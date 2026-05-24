import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
  Chip,
  CircularProgress
} from '@mui/material';
import { Mail, Send } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import toast from 'react-hot-toast';

export default function InvitationModal({ open, onClose }) {
  const [email, setEmail] = useState('');
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchInvitations = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/invitations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInvitations(res.data);
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchInvitations();
    }
  }, [open]);

  const handleSendInvitation = async () => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setSending(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/invitations`,
        { email },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Invitation sent successfully!');
      setEmail('');
      fetchInvitations();
    } catch (err) {
      console.error('Failed to send invitation:', err);
      toast.error(err.response?.data?.error || 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '12px' } }}>
      <DialogTitle sx={{ fontWeight: 900, color: '#2f4367', pb: 1 }}>Invite Team Member</DialogTitle>
      <DialogContent>
        <Typography sx={{ color: '#70809d', mb: 3, fontSize: '0.9rem' }}>
          Send an invitation email to add a new member to your team.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 4, alignItems: 'flex-start' }}>
          <TextField
            autoFocus
            fullWidth
            placeholder="Enter email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            InputProps={{
              startAdornment: <Mail size={18} color="#a0abc0" style={{ marginRight: 8 }} />
            }}
          />
          <Button
            variant="contained"
            disabled={sending}
            onClick={handleSendInvitation}
            startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <Send size={18} />}
            sx={{ height: 56, px: 3, whiteSpace: 'nowrap' }}
          >
            Send Invite
          </Button>
        </Box>

        <Typography sx={{ fontWeight: 800, color: '#2f4367', mb: 1.5 }}>Recent Invitations</Typography>
        <Divider sx={{ mb: 2 }} />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : invitations.length > 0 ? (
          <List disablePadding>
            {invitations.map((inv) => (
              <ListItem key={inv.id} sx={{ px: 0, py: 1.5, borderBottom: '1px solid #f0f4f8' }}>
                <ListItemText
                  primary={
                    <Typography sx={{ fontWeight: 700, color: '#2f4367' }}>
                      {inv.email}
                    </Typography>
                  }
                  secondary={
                    <Typography sx={{ fontSize: '0.75rem', color: '#a0abc0', mt: 0.5 }}>
                      Invited by {inv.invited_by_name} • {new Date(inv.created_at).toLocaleDateString()}
                    </Typography>
                  }
                />
                <Chip
                  label={inv.status}
                  size="small"
                  sx={{
                    fontWeight: 800,
                    fontSize: '0.7rem',
                    bgcolor: inv.status === 'Pending' ? '#fff8ef' : (inv.status === 'Expired' ? '#fff7f8' : '#effaf5'),
                    color: inv.status === 'Pending' ? '#ff9b3d' : (inv.status === 'Expired' ? '#f43f5e' : '#159664'),
                    border: '1px solid',
                    borderColor: inv.status === 'Pending' ? '#ffe6ca' : (inv.status === 'Expired' ? '#ffe4ea' : '#dff8ee')
                  }}
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <Typography sx={{ color: '#a0abc0', fontSize: '0.9rem' }}>No pending invitations.</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button onClick={onClose} sx={{ color: '#70809d' }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
