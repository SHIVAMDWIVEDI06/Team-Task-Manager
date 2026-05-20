import React, { useState, useEffect, useRef } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { Camera, Check, X, User, Mail, Lock, Save } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const cardSx = {
  borderRadius: '8px',
  border: '1px solid #e8edf5',
  boxShadow: '0 16px 34px rgba(47, 67, 103, 0.08)',
  bgcolor: '#fff',
};

export default function Profile() {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileData, setProfileData] = useState({
    username: '',
    email: '',
    avatar: '',
    role: '',
    created_at: '',
  });
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [avatarPreview, setAvatarPreview] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfileData(res.data);
      setFormData({
        username: res.data.username,
        email: res.data.email,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setAvatarPreview(res.data.avatar);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Username validation
    if (formData.username.trim().length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (formData.username.trim().length > 50) {
      newErrors.username = 'Username must not exceed 50 characters';
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    // Password validation (only if user is trying to change password)
    if (formData.newPassword || formData.currentPassword || formData.confirmPassword) {
      if (!formData.currentPassword) {
        newErrors.currentPassword = 'Current password is required to change password';
      }
      if (!formData.newPassword) {
        newErrors.newPassword = 'New password is required';
      } else if (formData.newPassword.length < 6) {
        newErrors.newPassword = 'New password must be at least 6 characters';
      }
      if (formData.newPassword !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const updateData = {
        username: formData.username,
        email: formData.email,
      };

      // Only include password fields if user is changing password
      if (formData.newPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      const res = await axios.patch(`${API_BASE_URL}/profile`, updateData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setProfileData(res.data.user);
      
      // Update user in localStorage and context
      const updatedUser = { ...user, ...res.data.user };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      if (setUser) {
        setUser(updatedUser);
      }

      // Clear password fields
      setFormData((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));

      toast.success('Profile updated successfully');
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to update profile';
      toast.error(errorMessage);
      
      // Set specific field errors if available
      if (err.response?.status === 401) {
        setErrors((prev) => ({ ...prev, currentPassword: 'Incorrect password' }));
      } else if (err.response?.status === 409) {
        setErrors((prev) => ({ ...prev, username: 'Username or email already exists' }));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload JPEG, PNG, GIF, or WebP');
      return;
    }

    // Validate file size (2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File size exceeds 2MB limit');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result;
      setAvatarPreview(base64String);

      // Upload avatar
      setUploadingAvatar(true);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.post(
          `${API_BASE_URL}/profile/avatar`,
          { avatar: base64String },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setProfileData(res.data.user);
        
        // Update user in localStorage and context
        const updatedUser = { ...user, ...res.data.user };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        if (setUser) {
          setUser(updatedUser);
        }

        toast.success('Avatar updated successfully');
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to upload avatar');
        setAvatarPreview(profileData.avatar);
      } finally {
        setUploadingAvatar(false);
      }
    };

    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API_BASE_URL}/profile/avatar`,
        { avatar: '' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setProfileData(res.data.user);
      setAvatarPreview(null);
      
      // Update user in localStorage and context
      const updatedUser = { ...user, avatar: '' };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      if (setUser) {
        setUser(updatedUser);
      }

      toast.success('Avatar removed successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 4, maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ mb: 3.5 }}>
        <Typography variant="h4" sx={{ color: '#fff', fontWeight: 900, mb: 1 }}>
          My Profile
        </Typography>
        <Typography sx={{ color: '#fff', opacity: 0.86, fontWeight: 700 }}>
          Manage your account settings and preferences
        </Typography>
      </Box>

      {/* Avatar Section */}
      <Paper sx={{ ...cardSx, p: 4, mb: 3 }}>
        <Typography variant="h6" sx={{ color: '#2f4367', mb: 3, fontWeight: 900 }}>
          Profile Picture
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
          <Box sx={{ position: 'relative' }}>
            <Avatar
              src={avatarPreview}
              sx={{
                width: 120,
                height: 120,
                bgcolor: '#fb5b3f',
                fontSize: '2.5rem',
                fontWeight: 900,
                border: '4px solid #fff',
                boxShadow: '0 8px 24px rgba(47, 67, 103, 0.15)',
              }}
            >
              {profileData.username?.[0]?.toUpperCase()}
            </Avatar>
            {uploadingAvatar && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'rgba(255, 255, 255, 0.9)',
                  borderRadius: '50%',
                }}
              >
                <CircularProgress size={40} />
              </Box>
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography sx={{ color: '#2f4367', fontWeight: 800, mb: 1 }}>
              Upload a new profile picture
            </Typography>
            <Typography sx={{ color: '#70809d', fontWeight: 600, fontSize: '0.9rem', mb: 2 }}>
              JPG, PNG, GIF or WebP. Max size 2MB.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<Camera size={18} />}
                onClick={handleAvatarClick}
                disabled={uploadingAvatar}
                sx={{
                  bgcolor: '#fb5b3f',
                  color: '#fff',
                  fontWeight: 800,
                  textTransform: 'none',
                  borderRadius: '8px',
                  px: 2.5,
                  '&:hover': { bgcolor: '#e54a30' },
                }}
              >
                Upload Photo
              </Button>
              {avatarPreview && (
                <Button
                  variant="outlined"
                  startIcon={<X size={18} />}
                  onClick={handleRemoveAvatar}
                  disabled={uploadingAvatar}
                  sx={{
                    borderColor: '#e8edf5',
                    color: '#70809d',
                    fontWeight: 800,
                    textTransform: 'none',
                    borderRadius: '8px',
                    px: 2.5,
                    '&:hover': { borderColor: '#d0d9e8', bgcolor: '#f8fafc' },
                  }}
                >
                  Remove
                </Button>
              )}
            </Box>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
            />
          </Box>
        </Box>
      </Paper>

      {/* Profile Information */}
      <Paper sx={{ ...cardSx, p: 4 }}>
        <Typography variant="h6" sx={{ color: '#2f4367', mb: 3, fontWeight: 900 }}>
          Profile Information
        </Typography>

        <form onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Username Field */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <User size={18} color="#70809d" />
                <Typography sx={{ color: '#2f4367', fontWeight: 800, fontSize: '0.9rem' }}>
                  Username
                </Typography>
              </Box>
              <TextField
                fullWidth
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                error={!!errors.username}
                helperText={errors.username}
                placeholder="Enter your username"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    bgcolor: '#f8fafc',
                    fontWeight: 700,
                  },
                }}
              />
            </Box>

            {/* Email Field */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Mail size={18} color="#70809d" />
                <Typography sx={{ color: '#2f4367', fontWeight: 800, fontSize: '0.9rem' }}>
                  Email Address
                </Typography>
              </Box>
              <TextField
                fullWidth
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                error={!!errors.email}
                helperText={errors.email}
                placeholder="Enter your email"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    bgcolor: '#f8fafc',
                    fontWeight: 700,
                  },
                }}
              />
            </Box>

            {/* Password Change Section */}
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Lock size={18} color="#70809d" />
                <Typography sx={{ color: '#2f4367', fontWeight: 800, fontSize: '0.9rem' }}>
                  Change Password
                </Typography>
              </Box>
              <Typography sx={{ color: '#70809d', fontWeight: 600, fontSize: '0.85rem', mb: 2 }}>
                Leave blank if you don't want to change your password
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  fullWidth
                  name="currentPassword"
                  type="password"
                  value={formData.currentPassword}
                  onChange={handleInputChange}
                  error={!!errors.currentPassword}
                  helperText={errors.currentPassword}
                  placeholder="Current password"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px',
                      bgcolor: '#f8fafc',
                      fontWeight: 700,
                    },
                  }}
                />
                <TextField
                  fullWidth
                  name="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  error={!!errors.newPassword}
                  helperText={errors.newPassword}
                  placeholder="New password (min. 6 characters)"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px',
                      bgcolor: '#f8fafc',
                      fontWeight: 700,
                    },
                  }}
                />
                <TextField
                  fullWidth
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  error={!!errors.confirmPassword}
                  helperText={errors.confirmPassword}
                  placeholder="Confirm new password"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px',
                      bgcolor: '#f8fafc',
                      fontWeight: 700,
                    },
                  }}
                />
              </Box>
            </Box>

            {/* Account Info */}
            <Box
              sx={{
                mt: 2,
                p: 2.5,
                borderRadius: '8px',
                bgcolor: '#f8fafc',
                border: '1px solid #e8edf5',
              }}
            >
              <Typography sx={{ color: '#70809d', fontWeight: 700, fontSize: '0.85rem', mb: 1 }}>
                <strong style={{ color: '#2f4367' }}>Role:</strong> {profileData.role}
              </Typography>
              <Typography sx={{ color: '#70809d', fontWeight: 700, fontSize: '0.85rem' }}>
                <strong style={{ color: '#2f4367' }}>Member since:</strong> {formatDate(profileData.created_at)}
              </Typography>
            </Box>

            {/* Submit Button */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button
                type="submit"
                variant="contained"
                startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Save size={18} />}
                disabled={saving}
                sx={{
                  bgcolor: '#fb5b3f',
                  color: '#fff',
                  fontWeight: 800,
                  textTransform: 'none',
                  borderRadius: '8px',
                  px: 4,
                  py: 1.2,
                  fontSize: '1rem',
                  '&:hover': { bgcolor: '#e54a30' },
                  '&:disabled': { bgcolor: '#d0d9e8' },
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          </Box>
        </form>
      </Paper>
    </Box>
  );
}
