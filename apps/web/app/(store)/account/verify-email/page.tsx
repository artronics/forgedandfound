import VerifyEmailClient from "@/components/account/VerifyEmailClient";

type VerifyEmailPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({searchParams}: VerifyEmailPageProps) {
  const {token} = await searchParams;

  return (
    <div className="px-4 py-10">
      <VerifyEmailClient token={token ?? ""}/>
    </div>
  );
}
