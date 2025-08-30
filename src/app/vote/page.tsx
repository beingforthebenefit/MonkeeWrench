"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardActions, Button, LinearProgress, Typography, Stack } from "@mui/material";

type Item = { id: string; title: string; artist: string; votes: number; mine: boolean; threshold: number };

export default function Vote() {
  const [items, setItems] = useState<Item[]>([]);

  async function load() {
    const res = await fetch("/api/proposals/pending", { cache: "no-store" });
    if (!res.ok) return;
    setItems(await res.json());
  }

  useEffect(() => {
    load();
    const es = new EventSource("/api/stream");
    es.onmessage = () => load();
    return () => es.close();
  }, []);

  async function vote(id: string, mine: boolean) {
    const method = mine ? "DELETE" : "POST";
    const res = await fetch(`/api/proposals/${id}/vote`, { method });
    if (res.ok) load();
  }

  return (
    <Stack spacing={2}>
      {items.map(p => (
        <Card key={p.id}>
          <CardContent>
            <Typography variant="h6">{p.title} — {p.artist}</Typography>
            <LinearProgress variant="determinate" value={Math.min(100, (p.votes / p.threshold) * 100)} sx={{ my: 1 }} />
            <Typography variant="body2">{p.votes} / {p.threshold}</Typography>
          </CardContent>
          <CardActions>
            <Button onClick={() => vote(p.id, p.mine)}>{p.mine ? "Un-vote" : "Vote"}</Button>
          </CardActions>
        </Card>
      ))}
    </Stack>
  );
}