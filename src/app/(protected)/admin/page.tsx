"use client";
import { useEffect, useState } from "react";
import { TextField, Button, Stack, Typography } from "@mui/material";

export default function Admin() {
  const [threshold, setThreshold] = useState(2);
  const [allowlist, setAllowlist] = useState("");

  async function load() {
    const res = await fetch("/api/settings");
    const j = await res.json();
    setThreshold(j.voteThreshold);
    setAllowlist(j.adminAllowlist.join(", "));
  }
  useEffect(() => { load(); }, []);

  async function save() {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voteThreshold: threshold, adminAllowlist: allowlist.split(",").map(s => s.trim()).filter(Boolean) })
    });
    await load();
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Admin Settings</Typography>
      <TextField label="Vote Threshold" type="number" value={threshold} onChange={e => setThreshold(parseInt(e.target.value || "0", 10))} />
      <TextField label="Admin Allowlist (emails, comma-separated)" value={allowlist} onChange={e => setAllowlist(e.target.value)} />
      <Button variant="contained" onClick={save}>Save</Button>
    </Stack>
  );
}