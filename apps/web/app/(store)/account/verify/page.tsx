import VerifyEmailForm from "@/components/auth/VerifyEmailForm";

type VerifyPageProps = {
  searchParams: Promise<{ email?: string; code?: string; next?: string }>;
};

export default async function VerifyEmailPage({searchParams}: VerifyPageProps) {
  const {email, code, next} = await searchParams;

  return (
    <div className="px-4 py-10">
      <VerifyEmailForm email={email ?? ""} code={code ?? ""} next={next ?? "/"}/>
    </div>
  );
}
