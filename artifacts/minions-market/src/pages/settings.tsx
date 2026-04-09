import { useState } from "react";
import { useLocation } from "wouter";
import { useUpdateProfile, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LogOut, Globe, Upload, User, FileText } from "lucide-react";
import { Link } from "wouter";

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SettingsPage() {
  const { t, lang, setLang } = useLang();
  const { isAuthenticated, user, updateUser, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar || null);
  const [saving, setSaving] = useState(false);

  const updateProfile = useUpdateProfile();

  if (!isAuthenticated) { setLocation("/auth"); return null; }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Фото слишком большое (макс. 5 МБ)", variant: "destructive" });
      return;
    }
    setAvatarFile(file);
    // Превью
    const b64 = await fileToBase64(file);
    setAvatarPreview(b64);
    setAvatar(""); // сбрасываем URL поле
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let avatarUrl = avatar;
      if (avatarFile) {
        // Конвертируем в base64 для хранения
        avatarUrl = await fileToBase64(avatarFile);
      }
      updateProfile.mutate(
        { data: { firstName: firstName || undefined, lastName: lastName || undefined, avatar: avatarUrl || undefined, bio: bio || undefined } },
        {
          onSuccess: (updated) => {
            updateUser(updated as any);
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            toast({ title: t("profileUpdated") });
            setAvatarFile(null);
            setSaving(false);
          },
          onError: () => {
            toast({ title: t("error"), variant: "destructive" });
            setSaving(false);
          },
        }
      );
    } catch {
      toast({ title: t("error"), variant: "destructive" });
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  return (
    <div className="flex flex-col pb-4">
      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 glass border-b border-border/30">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}><ArrowLeft className="w-5 h-5" /></Button>
        <h1 className="font-bold">{t("settings")}</h1>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="bg-card rounded-xl border border-border/30 p-4 flex flex-col gap-4">
          <h2 className="font-semibold">{t("editProfile")}</h2>

          {/* Аватар с превью */}
          <div className="flex flex-col gap-2">
            <Label>{t("avatar")}</Label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-secondary border border-border/30 overflow-hidden flex items-center justify-center flex-shrink-0">
                {avatarPreview
                  ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" onError={() => setAvatarPreview(null)} />
                  : <User className="w-7 h-7 text-muted-foreground" />}
              </div>
              <div className="flex-1 flex flex-col gap-2">
                <Input value={avatar} onChange={(e) => { setAvatar(e.target.value); setAvatarPreview(e.target.value || null); setAvatarFile(null); }} placeholder="https://..." />
                <Label htmlFor="avatar-upload" className="cursor-pointer w-full">
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <span><Upload className="w-4 h-4 mr-2" /> Загрузить фото</span>
                  </Button>
                </Label>
                <Input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </div>
            </div>
            {avatarFile && <p className="text-xs text-muted-foreground">{avatarFile.name} — готово к сохранению</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("firstName")}</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} data-testid="input-firstname" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t("lastName")}</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} data-testid="input-lastname" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t("bio")}</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} data-testid="input-bio" />
          </div>
          <Button onClick={handleSave} disabled={saving || updateProfile.isPending} className="gradient-primary border-0" data-testid="button-save-profile">
            {saving || updateProfile.isPending ? t("loading") : t("save")}
          </Button>
        </div>

        <div className="bg-card rounded-xl border border-border/30 p-4 flex flex-col gap-3">
          <h2 className="font-semibold flex items-center gap-2"><Globe className="w-4 h-4" /> {t("language")}</h2>
          <div className="flex gap-2">
            <Button variant={lang === "ru" ? "default" : "secondary"} size="sm" onClick={() => setLang("ru")} data-testid="button-lang-ru">{t("ru")}</Button>
            <Button variant={lang === "en" ? "default" : "secondary"} size="sm" onClick={() => setLang("en")} data-testid="button-lang-en">{t("en")}</Button>
          </div>
        </div>

        <Link href="/legal">
          <div className="bg-card rounded-xl border border-border/30 p-4 flex items-center gap-3 cursor-pointer hover:border-primary/30 transition-colors">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Правовая информация</span>
          </div>
        </Link>

        <Button variant="destructive" className="w-full" onClick={handleLogout} data-testid="button-logout">
          <LogOut className="w-4 h-4 mr-2" /> {t("logout")}
        </Button>
      </div>
    </div>
  );
}
