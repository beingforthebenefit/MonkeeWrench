"use client";
import { useState } from "react";
import { TextField, Button, Stack, Alert } from "@mui/material";

export default function Propose() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("The Monkees");
  const [chartUrl, setChartUrl] = useState("");
  const [lyricsUrl, setLyricsUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setMsg(null);
    const res = await fetch("/api/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, artist, chartUrl, lyricsUrl, youtubeUrl })
    });
    if (!res.ok) setMsg(`Error: ${res.status}`);
    else { setMsg("Submitted"); setTitle(""); }
  }

  return (
    <Stack spacing={2}>
      <TextField label="Title" value={title} onChange={e => setTitle(e.target.value)} fullWidth />
      <TextField label="Artist" value={artist} onChange={e => setArtist(e.target.value)} fullWidth />
      <TextField label="Chart URL" value={chartUrl} onChange={e => setChartUrl(e.target.value)} fullWidth />
      <TextField label="Lyrics URL" value={lyricsUrl} onChange={e => setLyricsUrl(e.target.value)} fullWidth />
      <TextField label="YouTube URL" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} fullWidth />
      <Button variant="contained" onClick={submit}>Propose</Button>
      {msg && <Alert severity={msg === "Submitted" ? "success" : "error"}>{msg}</Alert>}
    </Stack>
  );
}