"use client";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardActions,
  IconButton,
  LinearProgress,
  Typography,
  Stack,
  Tooltip,
} from "@mui/material";
import ThumbUpOffAltIcon from "@mui/icons-material/ThumbUpOffAlt";
import ThumbUpAltIcon from "@mui/icons-material/ThumbUpAlt";

type Item = {
  id: string;
  title: string;
  artist: string;
  votes: number;
  mine: boolean;
  threshold: number;
};

export default function Vote() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

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

  async function toggleVote(id: string, mine: boolean) {
    try {
      setBusy((b) => ({ ...b, [id]: true }));
      const method = mine ? "DELETE" : "POST";
      const res = await fetch(`/api/proposals/${id}/vote`, { method });
      if (res.ok) await load();
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  return (
    <Stack spacing={2}>
      {items.map((p) => {
        const pct = Math.min(100, (p.votes / p.threshold) * 100);
        const VIcon = p.mine ? ThumbUpAltIcon : ThumbUpOffAltIcon;
        const label = p.mine ? "Unvote" : "Vote";
        const isBusy = !!busy[p.id];

        return (
          <Card key={p.id}>
            <CardContent>
              <Typography variant="h6">
                {p.title} — {p.artist}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{ my: 1 }}
              />
              <Typography variant="body2">
                {p.votes} / {p.threshold}
              </Typography>
            </CardContent>
            <CardActions>
              <Tooltip title={label}>
                <span>
                  <IconButton
                    aria-label={label}
                    onClick={() => toggleVote(p.id, p.mine)}
                    disabled={isBusy}
                    color={p.mine ? "primary" : "default"}
                  >
                    <VIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </CardActions>
          </Card>
        );
      })}
    </Stack>
  );
}
