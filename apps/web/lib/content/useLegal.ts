"use client";

import {useQuery} from "@apollo/client/react";
import {
  GetPrivacyPolicyDocument,
  GetRefundPolicyDocument,
  GetShippingPolicyDocument,
  GetTermsOfServiceDocument,
} from "@/graphql/generated/graphql";

export function usePrivacyPolicy() {
  const {data, loading, error} = useQuery(GetPrivacyPolicyDocument, {});
  return {data, loading, error};
}

export function useTermsOfService() {
  const {data, loading, error} = useQuery(GetTermsOfServiceDocument, {});
  return {data, loading, error};
}

export function useRefundPolicy() {
  const {data, loading, error} = useQuery(GetRefundPolicyDocument, {});
  return {data, loading, error};
}

export function useShippingPolicy() {
  const {data, loading, error} = useQuery(GetShippingPolicyDocument, {});
  return {data, loading, error};
}
