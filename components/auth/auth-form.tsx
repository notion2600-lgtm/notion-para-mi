"use client";

import { Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const configured = hasSupabaseEnv();

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName.trim() || null },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (signUpError) throw signUpError;
        setMessage("Revisa tu correo para confirmar la cuenta.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        window.location.assign(searchParams.get("next") || "/workspace");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la solicitud.");
    } finally {
      setPending(false);
    }
  }

  async function sendMagicLink() {
    setPending(true);
    setError(null);
    setMessage(null);

    try {
      if (!email) throw new Error("Escribe tu correo primero.");
      const { error: otpError } = await createClient().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (otpError) throw otpError;
      setMessage("Te enviamos un enlace mágico. Revisa tu correo.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo enviar el enlace.");
    } finally {
      setPending(false);
    }
  }

  if (!configured) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        Supabase aún no está conectado. Copia <code>.env.example</code> como
        <code> .env.local</code> y completa las claves del proyecto.
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={submitPassword}>
      {mode === "signup" && (
        <div className="space-y-2">
          <Label htmlFor="full-name">Nombre</Label>
          <Input
            autoComplete="name"
            id="full-name"
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Tu nombre"
            value={fullName}
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          autoComplete="email"
          id="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu@empresa.com"
          required
          type="email"
          value={email}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          id="password"
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        {mode === "signup" && (
          <p className="text-xs text-zinc-500">Usa al menos 8 caracteres.</p>
        )}
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {message && <p className="text-sm text-emerald-700" role="status">{message}</p>}
      <Button className="w-full" disabled={pending} type="submit">
        {pending && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
        {mode === "signup" ? "Crear cuenta" : "Entrar"}
      </Button>
      {mode === "login" && (
        <Button
          className="w-full"
          disabled={pending}
          onClick={sendMagicLink}
          type="button"
          variant="outline"
        >
          <Mail aria-hidden="true" className="size-4" />
          Enviarme un enlace mágico
        </Button>
      )}
      <p className="text-center text-sm text-zinc-500">
        {mode === "signup" ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}{" "}
        <Link
          className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
          href={mode === "signup" ? "/login" : "/signup"}
        >
          {mode === "signup" ? "Inicia sesión" : "Regístrate"}
        </Link>
      </p>
    </form>
  );
}
