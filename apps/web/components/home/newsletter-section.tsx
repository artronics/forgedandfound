import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";

export function NewsletterSection() {
  return (
    <section className="bg-foreground py-28 px-6 lg:px-10">
      <div className="max-w-xl mx-auto text-center space-y-10">

        <div className="space-y-4">
          <h2 className="font-serif italic text-4xl font-light text-background">
            Join the Studio Circle
          </h2>
          <p className="font-sans text-[10px] tracking-[0.24em] uppercase text-background/60">
            Early access to collections and artisanal insights.
          </p>
        </div>

        {/* Form — no logic, layout only */}
        <div className="flex flex-col md:flex-row gap-0 border-b border-background/20 pb-2">
          <Input
            type="email"
            placeholder="Your email address"
            className="
              bg-transparent border-none shadow-none rounded-none
              font-sans text-[11px] tracking-widest uppercase
              text-background placeholder:text-background/30
              focus-visible:ring-0 flex-1 h-12 px-0
            "
          />
          <Button
            variant="ghost"
            className="
              rounded-none font-sans text-[10px] tracking-[0.2em] uppercase
              text-background hover:text-secondary hover:bg-transparent
              h-12 px-6 shrink-0 transition-colors
            "
          >
            Subscribe
          </Button>
        </div>

      </div>
    </section>
  );
}
