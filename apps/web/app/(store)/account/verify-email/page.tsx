import VerifyEmailClient from "@/components/account/VerifyEmailClient";

type VerifyEmailPageProps = {
  searchParams: Promise<{ email?: string; code?: string }>;
};

export default async function VerifyEmailPage({searchParams}: VerifyEmailPageProps) {
  const {email, code} = await searchParams;

  return (
    <div className="px-4 py-10">
      <VerifyEmailClient email={email ?? ""} code={code ?? ""}/>
    </div>
  );
}
