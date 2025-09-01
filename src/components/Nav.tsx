"use client";
import React from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  AppBar, Toolbar, Typography, Box, Container, Badge,
  IconButton, Avatar, Menu, MenuItem, ListItemIcon, Divider, Button as MuiButton
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import HowToVoteIcon from "@mui/icons-material/HowToVote";
import ListAltIcon from "@mui/icons-material/ListAlt";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

// tiny fetcher
const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then(r => r.json()).catch(() => []);

export default function Nav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = Boolean((session?.user as any)?.isAdmin);
  const userName = session?.user?.name ?? "";
  const userImg = session?.user?.image ?? undefined;

  const { data: pending = [] } = useSWR(pathname?.includes("/vote") ? null : "/api/proposals/pending", fetcher);
  const pendingCount = Array.isArray(pending) ? pending.length : 0;

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const link = (to: string, label: string, icon: React.ReactNode, badge?: number) => {
    const active = pathname === to;
    const base =
      "px-3 py-1 rounded-md text-sm font-medium transition-colors";
    const cls = active
      ? "bg-monkee-red text-white"
      : "hover:bg-[#222224] text-gray-200";

    return (
      <Link key={to} href={to} className={`${base} ${cls} flex items-center`}>
        {badge && badge > 0 ? (
          <Badge badgeContent={badge} color="error" sx={{ mr: 1 }}>
            <span className="inline-flex items-center">{icon}</span>
          </Badge>
        ) : (
          <span className="inline-flex items-center mr-1">{icon}</span>
        )}
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <AppBar position="sticky" elevation={6} sx={{ background: "#161617", borderBottom: "1px solid #222224" }}>
      <Container maxWidth="md">
        <Toolbar disableGutters sx={{ py: 0.5 }}>
          {/* Brand */}
          <Box className="flex items-center space-x-2">
            <LibraryMusicIcon sx={{ color: "#B71C1C" }} />
            <Typography variant="h6" className="font-bold" sx={{ color: "#B71C1C" }}>
              Monkee Wrench
            </Typography>
          </Box>

          {/* Nav links */}
          <Box className="hidden md:flex items-center space-x-2 ml-6">
            {link("/", "Dashboard", <LibraryMusicIcon fontSize="small" />)}
            {link("/propose", "Propose", <PlaylistAddIcon fontSize="small" />)}
            {link("/vote", "Vote", <HowToVoteIcon fontSize="small" />, pendingCount)}
            {link("/setlist", "Setlist", <ListAltIcon fontSize="small" />)}
            {isAdmin && link("/admin", "Admin", <SettingsIcon fontSize="small" />)}
          </Box>

          <Box sx={{ flex: 1 }} />

          {/* User dropdown */}
          {session?.user ? (
            <Box className="flex items-center space-x-2">
              <span className="hidden md:inline-block text-sm text-gray-300">{userName}</span>
              <IconButton onClick={handleOpen} size="small" sx={{ ml: 1 }} aria-label="Account menu">
                <Avatar src={userImg} sx={{ width: 32, height: 32 }} />
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                id="account-menu"
                open={open}
                onClose={handleClose}
                onClick={handleClose}
                transformOrigin={{ horizontal: "right", vertical: "top" }}
                anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
              >
                {isAdmin && (
                  <MenuItem component={Link as any} href="/admin">
                    <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
                    Admin
                  </MenuItem>
                )}
                <Divider />
                <MenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                  <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                  Sign out
                </MenuItem>
              </Menu>
            </Box>
          ) : (
            <MuiButton component={Link} href="/login" size="small" sx={{ color: "#ddd" }}>
              Sign in
            </MuiButton>
          )}
        </Toolbar>

        {/* Mobile nav */}
        <Box className="md:hidden flex px-2 pb-2 space-x-2">
          {link("/", "Dashboard", <LibraryMusicIcon fontSize="small" />)}
          {link("/propose", "Propose", <PlaylistAddIcon fontSize="small" />)}
          {link("/vote", "Vote", <HowToVoteIcon fontSize="small" />, pendingCount)}
          {link("/setlist", "Setlist", <ListAltIcon fontSize="small" />)}
          {isAdmin && link("/admin", "Admin", <SettingsIcon fontSize="small" />)}
        </Box>
      </Container>
    </AppBar>
  );
}
