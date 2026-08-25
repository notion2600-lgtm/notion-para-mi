"use client";

import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <Button type="submit" variant="ghost">
        <LogOut aria-hidden="true" className="size-4" />
        Salir
      </Button>
    </form>
  );
}
