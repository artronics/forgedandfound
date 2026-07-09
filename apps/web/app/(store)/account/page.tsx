"use client";

import {useCustomer} from "@/lib/customer/useCustomer";

export default function AccountPanel() {
  const {data, loading, error, refetch} = useCustomer();

  if (loading) {
    return <p>Loading...</p>;
  }

  if (error) {
    return (
      <div>
        <p>{error}</p>
        <button onClick={() => void refetch()}>Retry</button>
      </div>
    );
  }

  if (!data?.authenticated) {
    return <p>Please sign in.</p>;
  }

  return <pre>{JSON.stringify(data.customer, null, 2)}</pre>;
}