import {BrandLogo} from "@/components/brand";

export default function Home() {
  return (
    <main className="min-h-screen bg-base-200 text-base-content">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-16">
        <div className="w-full max-w-3xl rounded-box border border-base-300 bg-base-100 shadow-xl">
          <div className="flex flex-col gap-8 p-8 sm:p-10 md:p-14">
            <div className="flex flex-col gap-4 text-center">
              <p className="text-sm mb-8 font-semibold uppercase tracking-[0.3em] text-primary">
                Coming Soon
              </p>

              <h1 className="flex flex-col items-center text-primary">
                <BrandLogo size={60} className="pb-2"/>
                <div className="font-brand text-5xl">
                  Forged & Found
                </div>
              </h1>

              <p className="mx-auto max-w-2xl text-base leading-7 text-base-content/75 sm:text-lg">
                We&apos;re crafting something new. Our site is currently under
                construction, but Forged and Found will be launching soon.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <div className="badge badge-ring badge-lg px-4 py-4">
                Under Construction
              </div>
              <div className="badge badge-primary badge-lg px-4 py-4">
                Launching Soon
              </div>
            </div>

            <div className="mx-auto h-px w-full max-w-xl bg-base-300"/>

            <div className="text-center">
              <p className="text-sm text-base-content/60 sm:text-base">
                Thank you for your patience while we build the experience.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}