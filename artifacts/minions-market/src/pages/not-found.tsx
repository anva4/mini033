import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Gamepad2, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 text-center">
      <Gamepad2 className="w-16 h-16 text-muted-foreground/30 mb-4" />
      <h1 className="text-3xl font-bold mb-2">404</h1>
      <p className="text-muted-foreground mb-6">Страница не найдена</p>
      <Button asChild>
        <Link href="/"><ArrowLeft className="w-4 h-4 mr-2" /> На главную</Link>
      </Button>
    </div>
  );
}
