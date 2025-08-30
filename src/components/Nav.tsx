"use client";
import Link from "next/link";
import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
import { useSession, signOut } from "next-auth/react";

export default function Nav() {
  const { data } = useSession();
  const isAdmin = Boolean((data?.user as any)?.isAdmin);
  return (
    <AppBar position="sticky" color="transparent" sx={{ borderBottom: 1, borderColor: "divider" }}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1, color: "primary.main" }}>Monkee Wrench</Typography>
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button component={Link} href="/dashboard">Dashboard</Button>
          <Button component={Link} href="/propose">Propose</Button>
          <Button component={Link} href="/vote">Vote</Button>
          <Button component={Link} href="/setlist">Setlist</Button>
          {isAdmin && <Button component={Link} href="/admin">Admin</Button>}
          <Button onClick={() => signOut({ callbackUrl: "/signin" })}>Sign out</Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}