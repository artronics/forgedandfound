export type CustomerResponse = {
  authenticated: boolean;
  customer: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  errors?: Array<{ message: string }>;
};

export async function fetchCustomer(): Promise<CustomerResponse> {
  const res = await fetch("/api/customer/me", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch customer: ${res.status}`);
  }

  return res.json();
}