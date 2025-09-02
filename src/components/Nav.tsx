'use client'
import React from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Container,
  Badge,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
  Button as MuiButton,
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import LogoutIcon from '@mui/icons-material/Logout'
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import HowToVoteIcon from '@mui/icons-material/HowToVote'
import ListAltIcon from '@mui/icons-material/ListAlt'
import {usePathname} from 'next/navigation'
import {signOut, useSession} from 'next-auth/react'
import DiscordButton from '@/components/DiscordButton'

const fetcher = (u: string) =>
  fetch(u, {cache: 'no-store'})
    .then((r) => r.json())
    .catch(() => [])

export default function Nav() {
  const pathname = usePathname()
  const {data: session} = useSession()
  const isAdmin = Boolean(session?.user?.isAdmin)
  const userName = session?.user?.name ?? ''
  const userEmail = session?.user?.email ?? ''
  const userImg = session?.user?.image ?? undefined

  const {data: pending = []} = useSWR(
    pathname?.includes('/vote') ? null : '/api/proposals/pending',
    fetcher,
  )
  const pendingCount = Array.isArray(pending) ? pending.length : 0

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)
  const handleOpen = (e: React.MouseEvent<HTMLElement>) =>
    setAnchorEl(e.currentTarget)
  const handleClose = () => setAnchorEl(null)

  function NavLink({
    to,
    label,
    icon,
    badge,
  }: {
    to: string
    label: string
    icon: React.ReactNode
    badge?: number
  }) {
    const active = pathname === to
    const base =
      'px-3 py-1 rounded-md text-sm font-medium transition-colors flex items-center'
    const cls = active
      ? 'bg-[#B71C1C] text-white font-semibold ring-1 ring-[#B71C1C]/60'
      : 'hover:bg-[#222224] text-gray-200'

    return (
      <Link
        href={to}
        className={`${base} ${cls}`}
        aria-current={active ? 'page' : undefined}
      >
        {badge && badge > 0 ? (
          <Badge badgeContent={badge} color="error" sx={{mr: 1}}>
            <span className="inline-flex items-center">{icon}</span>
          </Badge>
        ) : (
          <span className="inline-flex items-center mr-1">{icon}</span>
        )}
        <span>{label}</span>
      </Link>
    )
  }

  return (
    <AppBar
      position="sticky"
      elevation={6}
      sx={{background: '#161617', borderBottom: '1px solid #222224'}}
    >
      <Container maxWidth="md">
        <Toolbar disableGutters sx={{py: 0.5}}>
          {/* Brand */}
          <Box className="flex items-center space-x-2">
            <LibraryMusicIcon sx={{color: '#B71C1C'}} />
            <Typography
              variant="h6"
              className="font-bold"
              sx={{color: '#B71C1C'}}
            >
              Monkee Wrench
            </Typography>
          </Box>

          {/* Nav links */}
          <Box className="hidden md:flex items-center space-x-2 ml-6">
            <NavLink
              to="/"
              label="Dashboard"
              icon={<LibraryMusicIcon fontSize="small" />}
            />
            <NavLink
              to="/propose"
              label="Propose"
              icon={<PlaylistAddIcon fontSize="small" />}
            />
            <NavLink
              to="/vote"
              label="Vote"
              icon={<HowToVoteIcon fontSize="small" />}
              badge={pendingCount}
            />
            <NavLink
              to="/setlist"
              label="Setlist"
              icon={<ListAltIcon fontSize="small" />}
            />
          </Box>

          <Box sx={{flex: 1}} />

          {/* User dropdown */}
          {session?.user ? (
            <Box className="flex items-center space-x-2">
              <DiscordButton channelId="1347070995122622545" />
              <IconButton
                onClick={handleOpen}
                size="small"
                sx={{ml: 1}}
                aria-label="Account menu"
              >
                <Avatar
                  src={userImg}
                  alt={userName || userEmail || 'User'}
                  sx={{width: 32, height: 32}}
                >
                  {(userName || userEmail || '?').charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                id="account-menu"
                open={open}
                onClose={handleClose}
                onClick={handleClose}
                transformOrigin={{horizontal: 'right', vertical: 'top'}}
                anchorOrigin={{horizontal: 'right', vertical: 'bottom'}}
              >
                <Box sx={{px: 2, py: 1.5}}>
                  <Typography variant="subtitle2" sx={{fontWeight: 700}}>
                    {userName || userEmail}
                  </Typography>
                  {userEmail && userName && (
                    <Typography
                      variant="caption"
                      sx={{color: 'text.secondary'}}
                    >
                      {userEmail}
                    </Typography>
                  )}
                </Box>
                <Divider />
                {isAdmin && (
                  <Link href="/admin" passHref legacyBehavior>
                    <MenuItem component="a">
                      <ListItemIcon>
                        <SettingsIcon fontSize="small" />
                      </ListItemIcon>
                      Admin
                    </MenuItem>
                  </Link>
                )}
                <Divider />
                <MenuItem onClick={() => signOut({callbackUrl: '/login'})}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  Sign out
                </MenuItem>
              </Menu>
            </Box>
          ) : (
            <MuiButton
              component={Link}
              href="/login"
              size="small"
              sx={{color: '#ddd'}}
            >
              Sign in
            </MuiButton>
          )}
        </Toolbar>

        {/* Mobile nav */}
        <Box className="md:hidden flex px-2 pb-2 space-x-2">
          <NavLink
            to="/"
            label="Dashboard"
            icon={<LibraryMusicIcon fontSize="small" />}
          />
          <NavLink
            to="/propose"
            label="Propose"
            icon={<PlaylistAddIcon fontSize="small" />}
          />
          <NavLink
            to="/vote"
            label="Vote"
            icon={<HowToVoteIcon fontSize="small" />}
            badge={pendingCount}
          />
          <NavLink
            to="/setlist"
            label="Setlist"
            icon={<ListAltIcon fontSize="small" />}
          />
          {isAdmin && (
            <NavLink
              to="/admin"
              label="Admin"
              icon={<SettingsIcon fontSize="small" />}
            />
          )}
        </Box>
      </Container>
    </AppBar>
  )
}
