import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Building2, User, Mail, Phone, Truck, FileText, Save } from "lucide-react";

export default function Profile() {
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    company_name: "",
    owner_name: "",
    email: "",
    phone: "",
    number_of_trucks: "",
    mc_number: "",
    dot_number: "",
  });

  useEffect(() => {
    base44.entities.CarrierProfile.list()
      .then((res) => {
        if (res && res.length > 0) {
          setProfile(res[0]);
          setForm({
            company_name: res[0].company_name || "",
            owner_name: res[0].owner_name || "",
            email: res[0].email || "",
            phone: res[0].phone || "",
            number_of_trucks: res[0].number_of_trucks ?? "",
            mc_number: res[0].mc_number || "",
            dot_number: res[0].dot_number || "",
          });
        }
      })
      .catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, number_of_trucks: form.number_of_trucks ? Number(form.number_of_trucks) : 0 };
      if (profile) {
        await base44.entities.CarrierProfile.update(profile.id, payload);
      } else {
        const created = await base44.entities.CarrierProfile.create(payload);
        setProfile(created);
      }
      toast({ title: "Profile saved", description: "Your carrier profile has been updated." });
    } catch (e) {
      toast({ title: "Error", description: "Could not save profile.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { key: "company_name", label: "Company name", icon: Building2, placeholder: "Acme Trucking LLC", required: true },
    { key: "owner_name", label: "Owner name", icon: User, placeholder: "John Doe" },
    { key: "email", label: "Email", icon: Mail, placeholder: "john@acmetrucking.com" },
    { key: "phone", label: "Phone", icon: Phone, placeholder: "(555) 123-4567" },
    { key: "number_of_trucks", label: "Number of trucks", icon: Truck, placeholder: "5", type: "number" },
    { key: "mc_number", label: "MC number", icon: FileText, placeholder: "MC-123456" },
    { key: "dot_number", label: "DOT number", icon: FileText, placeholder: "1234567" },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Carrier Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">This information is used to generate your claim emails.</p>
      </div>

      <Card className="p-6">
        <div className="grid sm:grid-cols-2 gap-5">
          {fields.map((f) => (
            <div key={f.key} className={f.key === "company_name" ? "sm:col-span-2" : ""}>
              <Label htmlFor={f.key} className="mb-1.5 flex items-center gap-1.5">
                <f.icon className="w-3.5 h-3.5 text-muted-foreground" />
                {f.label}{f.required && <span className="text-primary">*</span>}
              </Label>
              <Input
                id={f.key}
                type={f.type || "text"}
                value={form[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
              />
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={saving || !form.company_name}>
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </Card>
    </div>
  );
}