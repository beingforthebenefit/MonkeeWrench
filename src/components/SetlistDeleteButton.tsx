"use client";

import { useTransition } from "react";
import { IconButton, Tooltip } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useRouter } from "next/navigation";

export default function SetlistDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onDelete = () => {
    if (!confirm("Delete this song from the setlist? This cannot be undone.")) return;
    startTransition(async () => {
      const res = await fetch(`/api/proposals/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
      else alert(`Delete failed: ${res.status}`);
    });
  };

  return (
    <Tooltip title="Delete song">
      <span>
        <IconButton
          size="small"
          onClick={onDelete}
          disabled={pending}
          aria-label="Delete song"
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  );
}
