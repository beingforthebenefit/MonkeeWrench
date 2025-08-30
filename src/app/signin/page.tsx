"use client";
import { Button, Card, CardContent, Typography } from "@mui/material";
import { signIn } from "next-auth/react";

export default function SignIn() {
  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>Sign in to Monkee Wrench</Typography>
        <Typography variant="body2" gutterBottom>Google only. Private band hub.</Typography>
        <Button variant="contained" color="primary" onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>
          Continue with Google
        </Button>
      </CardContent>
    </Card>
  );
}