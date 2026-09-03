"use client";

import {useState, type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {readApi} from "@/lib/types";

export default function AdminLoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function submit(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            await readApi("/api/admin/login", {
                method: "POST",
                body: JSON.stringify({username, password}),
            });
            router.replace("/admin");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="flex min-h-full items-center justify-center bg-paper px-4">
            <form
                onSubmit={submit}
                className="w-full max-w-sm space-y-4 rounded-2xl border border-ink/10 bg-white p-6"
            >
                <h1 className="font-display text-2xl">Staff</h1>
                <div className="space-y-1.5">
                    <Label htmlFor="user">Username</Label>
                    <Input id="user" value={username} onChange={(e) => setUsername(e.target.value)}/>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="pass">Password</Label>
                    <Input
                        id="pass"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>
                {error ? <p className="text-sm text-red-700">{error}</p> : null}
                <Button type="submit" className="w-full" disabled={busy}>
                    Continue
                </Button>
            </form>
        </div>
    );
}
