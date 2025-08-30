'use client'
import Link from 'next/link'
import useSWR from 'swr'
import {
  AppBar, Toolbar, Typography, Button, Box, Container, Badge,
  IconButton, Avatar, Menu, MenuItem, ListItemIcon, Divider
} from '@mui/material'
import Logout from '@mui/icons-material/Logout'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import HowToVoteIcon from '@mui/icons-material/HowToVote'
import { useSession, signIn, signOut } from 'next-auth/react'
import { useState } from 'react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function Nav() {
  const { data: session, status } = useSession()
  const isAuthed = status === 'authenticated'
  const isAdmin = Boolean((session?.user as any)?.isAdmin)
  const name = session?.user?.name || session?.user?.email || 'User'
  const image = (session?.user as any)?.image as string | undefined

  const { data: pending } = useSWR(isAuthed ? '/api/proposals/pending/count' : null, fetcher, { refreshInterval: 30000 })
  const pendingCount = pending?.count ?? 0

  const [anchorEl, setAnchorEl] = (useState as any)(null)
  const open = Boolean(anchorEl)
  const handleOpen = (e: any) => setAnchorEl(e.currentTarget)
  const handleClose = () => setAnchorEl(null)

  return (
    <AppBar
      elevation={0}
      position="sticky"
      color="transparent"
      sx={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(17,17,17,0.7)', borderBottom: 1, borderColor: 'divider' }}
    >
      <Toolbar component={Container} maxWidth="lg" disableGutters sx={{ gap: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1, color: 'primary.main', fontWeight: 700 }}>
          Monkee Wrench
        </Typography>

        {isAuthed ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button component={Link} href="/setlist" variant="text">Setlist</Button>
            <Button component={Link} href="/propose" variant="text">Propose</Button>
            <Button component={Link} href="/vote" variant="text"
              startIcon={<HowToVoteIcon />}>
              <Badge color="secondary" badgeContent={pendingCount} overlap="circular" sx={{ '& .MuiBadge-badge': { right: -12 } }}>
                Vote
              </Badge>
            </Button>

            <IconButton onClick={handleOpen} size="small" sx={{ ml: 1 }} aria-label="Account menu">
              <Avatar src={image} alt={name} sx={{ width: 32, height: 32 }}>
                {(!image && name) ? name[0]?.toUpperCase() : undefined}
              </Avatar>
            </IconButton>
            <Menu anchorEl={anchorEl} open={open} onClose={handleClose} onClick={handleClose}
                  transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                  anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
              {isAdmin && (
                <MenuItem component={Link} href="/admin">
                  <ListItemIcon><AdminPanelSettingsIcon fontSize="small" /></ListItemIcon>
                  Admin
                </MenuItem>
              )}
              {isAdmin && <Divider />}
              <MenuItem onClick={() => signOut({ callbackUrl: '/login' })}>
                <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
                Logout
              </MenuItem>
            </Menu>
          </Box>
        ) : (
          <Button onClick={() => signIn('google', { callbackUrl: '/setlist' })} variant="outlined" color="inherit">
            Sign in
          </Button>
        )}
      </Toolbar>
    </AppBar>
  )
}
