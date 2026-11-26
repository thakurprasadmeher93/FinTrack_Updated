import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Save, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AdminPlatformSettings } from "./types";

const defaultSettings: AdminPlatformSettings = {
  applicationName: "FinTrack",
  supportEmail: "",
  registrationEnabled: true,
};

async function requestSettings(method = "GET", body?: AdminPlatformSettings) {
  const response = await fetch("/api/admin/settings", {
    method,
    credentials: "include",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Platform settings request failed.");
  }
  return response.json() as Promise<AdminPlatformSettings>;
}

export function AdminSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const query = useQuery({
    queryKey: ["/api/admin/settings"],
    queryFn: () => requestSettings(),
  });
  const [form, setForm] = useState(defaultSettings);
  useEffect(() => {
    if (query.data) setForm(query.data);
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: () => requestSettings("PUT", form),
    onSuccess: updated => {
      setForm(updated);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform-config"] });
      toast({ title: "Platform settings saved" });
    },
    onError: error => toast({ title: "Settings were not saved", description: error.message, variant: "destructive" }),
  });

  const save = () => {
    if (query.data?.registrationEnabled && !form.registrationEnabled
      && !window.confirm("Disable new account registration? Existing accounts will not be affected.")) return;
    saveMutation.mutate();
  };

  if (query.isLoading) return <div className="space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full rounded-2xl" /></div>;
  if (query.isError) {
    return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <p>Platform settings could not be loaded.</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => query.refetch()}>Retry</Button>
    </div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Platform settings</h2>
        <p className="text-sm text-muted-foreground">Only safe display and registration settings are editable here.</p>
      </div>
      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Settings2 className="h-4 w-4 text-primary" /> Public app settings</CardTitle>
          <CardDescription>These values are used in the public app experience. Credentials and secrets are never shown or stored in this screen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium">Application name
              <Input maxLength={60} value={form.applicationName} onChange={event => setForm(value => ({ ...value, applicationName: event.target.value }))} />
            </label>
            <label className="space-y-1.5 text-sm font-medium">Support email
              <Input type="email" maxLength={254} value={form.supportEmail} onChange={event => setForm(value => ({ ...value, supportEmail: event.target.value }))} placeholder="support@example.com (optional)" />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2 text-amber-700"><AlertTriangle className="h-4 w-4" /></div>
              <div><p className="text-sm font-semibold">Allow new registrations</p><p className="mt-1 text-xs text-muted-foreground">When disabled, existing accounts continue to work; new sign-ups are rejected.</p></div>
            </div>
            <Switch checked={form.registrationEnabled} onCheckedChange={registrationEnabled => setForm(value => ({ ...value, registrationEnabled }))} aria-label="Allow new registrations" />
          </div>
          <div className="flex justify-end border-t border-border pt-4">
            <Button onClick={save} disabled={saveMutation.isPending}><Save className="h-4 w-4" />{saveMutation.isPending ? "Saving…" : "Save settings"}</Button>
          </div>
          <p className="text-xs text-muted-foreground">Payment credentials, database settings, currency behavior, free-tier limits, and maintenance mode remain environment-managed or outside this safe settings scope.</p>
        </CardContent>
      </Card>
    </div>
  );
}
