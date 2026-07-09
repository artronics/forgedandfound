import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

type ResetPageProps = {
  searchParams: Promise<{ email?: string; code?: string }>;
};

export default async function ResetPasswordPage({searchParams}: ResetPageProps) {
  const {email, code} = await searchParams;

  return (
    <div className="px-4 py-10">
      <ResetPasswordForm email={email ?? ""} code={code ?? ""}/>
    </div>
  );
}
