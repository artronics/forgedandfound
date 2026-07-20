"use client";

import {Page, PageContent, PageHeader} from "@/components/Page";
import AccountSettings from "@/components/account/AccountSettings";

export default function AccountPage() {
  return (
    <Page>
      <PageHeader>
        <h2>Account</h2>
      </PageHeader>
      <PageContent>
        <AccountSettings/>
      </PageContent>
    </Page>
  );
}
